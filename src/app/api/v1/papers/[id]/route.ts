import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notFound, ok, internalError } from "@/lib/api/response";
import { withPublicPaperFilter } from "@/lib/queries/public";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") === "en" ? "en" : "id";

  try {
    const paper = await prisma.paper.findFirst({
      where: withPublicPaperFilter({ id }),
      include: {
        venue: true,
        identifiers: true,
        titles: true,
        topics: true,
        citationStats: true,
        versions: { orderBy: { versionNumber: "asc" } },
        relevance: true,
        summaries: { where: { status: "published", language: lang } },
        policyTags: { where: { status: "published" }, include: { tag: true } },
        paperAuthors: { orderBy: { authorOrder: "asc" }, include: { author: true } },
        affiliations: { include: { institution: true } },
        affiliationCountries: true,
        relationsOld: {
          where: { status: "approved", relationType: { in: ["superseded_by", "extended_by", "follow_up_same_author"] } },
          include: { new: { select: { id: true, title: true, publishedDate: true } } },
        },
      },
    });

    if (!paper) {
      // Bagian 6.6 — cek paper_merges, redirect 308 kalau ada, 404 kalau tidak.
      const merge = await prisma.paperMerge.findFirst({ where: { mergedId: id } });
      if (merge) {
        const url = new URL(request.url);
        url.pathname = url.pathname.replace(id, merge.survivingId);
        return NextResponse.redirect(url, 308);
      }
      return notFound("Paper tidak ditemukan.");
    }

    // authors + institusi KHUSUS paper ini (author bisa punya afiliasi beda di paper lain)
    const authors = paper.paperAuthors.map((pa) => ({
      name: pa.author.name,
      institutions: paper.affiliations
        .filter((aff) => aff.authorId === pa.authorId)
        .map((aff) => ({ id: aff.institution.id, name: aff.institution.name, country: aff.institution.country })),
    }));

    const data = {
      id: paper.id,
      title: paper.title,
      titles: paper.titles.map((t) => ({ language: t.language, title: t.title, isPrimary: t.isPrimary })),
      abstract: paper.abstractDisplayPolicy === "full" ? paper.abstractRaw : null,
      abstractDisplayPolicy: paper.abstractDisplayPolicy,
      canonicalUrl: paper.canonicalUrl,
      identifiers: paper.identifiers.map((i) => ({ idType: i.idType, idValue: i.idValue })),
      authors,
      topics: paper.topics.map((t) => ({
        domain: t.domain,
        field: t.field,
        subfield: t.subfield,
        topic: t.topic,
        isPrimary: t.isPrimary,
      })),
      venue: paper.venue
        ? { id: paper.venue.id, displayName: paper.venue.displayName, venueType: paper.venue.venueType, tier: paper.venue.tier, country: paper.venue.country }
        : null,
      origin: paper.origin,
      affiliationCountries: paper.affiliationCountries.map((c) => c.countryCode),
      isFoundational: paper.isFoundational,
      // Patch 3: afiliasi perkiraan harus jujur ditampilkan, bukan disembunyikan
      affiliationInferred: paper.affiliationInferred,
      summary: paper.summaries[0]
        ? {
            language: paper.summaries[0].language,
            summaryLayperson: paper.summaries[0].summaryLayperson,
            summaryTechnical: paper.summaries[0].summaryTechnical,
            relevanceIndonesia: paper.summaries[0].relevanceIndonesia,
            provenance: paper.summaries[0].provenance,
          }
        : null, // Bagian 6.8: TIDAK fallback diam-diam ke bahasa lain
      relevance: paper.relevance
        ? { publishedStatus: paper.relevance.publishedStatus, publishedReasoning: paper.relevance.publishedReasoning }
        : null,
      policyTags: paper.policyTags.map((pt) => pt.tag.slug),
      successors: paper.relationsOld.map((rel) => ({
        relationType: rel.relationType,
        reasoningText: rel.reasoningText,
        paper: { id: rel.new.id, title: rel.new.title, publishedDate: rel.new.publishedDate },
      })),
      versions: paper.versions.map((v) => ({
        versionNumber: v.versionNumber,
        changedSummary: v.changedSummary,
        versionDate: v.versionDate,
      })),
      citationStats: paper.citationStats
        ? {
            citationCountTotal: paper.citationStats.citationCountTotal,
            fwci: paper.citationStats.fwci,
            retractionStatus: paper.citationStats.retractionStatus,
          }
        : null,
      // enrichmentStatus SENGAJA tidak disertakan (Patch 4: hanya admin, jangan pernah publik)
    };

    return ok(data);
  } catch (error) {
    return internalError(error);
  }
}
