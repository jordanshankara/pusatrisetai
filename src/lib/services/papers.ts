import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withPublicPaperFilter } from "@/lib/queries/public";
import { buildBibtex } from "@/lib/bibtex";

/**
 * Lapisan servis bersama: dipakai LANGSUNG oleh Server Component halaman (Bagian 7,
 * "server component fetch") DAN oleh route handler /api/v1/* (Bagian 5) — supaya logika
 * filter dua-sumbu & shaping data tidak dobel-tulis dan tidak bisa drift antara keduanya.
 */

export const RELEVANCE_FILTER_VALUES = ["still_relevant", "needs_update", "superseded", "retracted", "foundational", "none"] as const;
export type RelevanceFilterValue = (typeof RELEVANCE_FILTER_VALUES)[number];

export interface ListPapersParams {
  q?: string;
  origin?: "local" | "international";
  yearFrom?: number;
  yearTo?: number;
  subfield?: string | string[];
  tier?: "tier_1" | "tier_2" | "tier_3";
  relevance?: RelevanceFilterValue;
  openAccess?: boolean;
  country?: string;
  policyTag?: string;
  hideSuperseded?: boolean;
  page: number;
  perPage: number;
}

export interface PaperListItem {
  id: string;
  title: string;
  publishedDate: Date | null;
  origin: "local" | "international";
  venueDisplayName: string | null;
  authorsPreview: string[];
  authorCount: number;
  primarySubfield: string | null;
  relevanceBadge: string | null;
  policyTags: string[];
  hasPublishedSummary: boolean;
}

export interface ListPapersResult {
  data: PaperListItem[];
  total: number;
  page: number;
  perPage: number;
  facets: {
    origin: { local: number; international: number };
    years: Record<string, number>;
    subfields: Record<string, number>;
  };
}

export async function listPapers(params: ListPapersParams): Promise<ListPapersResult> {
  const andConditions: Prisma.PaperWhereInput[] = [];
  if (params.origin) andConditions.push({ origin: params.origin });
  if (params.yearFrom) andConditions.push({ publishedDate: { gte: new Date(Date.UTC(params.yearFrom, 0, 1)) } });
  if (params.yearTo) andConditions.push({ publishedDate: { lte: new Date(Date.UTC(params.yearTo, 11, 31)) } });
  if (params.subfield) {
    const subfields = Array.isArray(params.subfield) ? params.subfield : [params.subfield];
    if (subfields.length > 0) andConditions.push({ topics: { some: { subfield: { in: subfields } } } });
  }
  if (params.tier) andConditions.push({ sourceTier: params.tier });
  if (params.openAccess === true) andConditions.push({ abstractDisplayPolicy: "full" });
  if (params.country) andConditions.push({ affiliationCountries: { some: { countryCode: params.country } } });
  if (params.policyTag) {
    andConditions.push({ policyTags: { some: { status: "published", tag: { slug: params.policyTag } } } });
  }
  if (params.relevance) {
    if (params.relevance === "none") {
      andConditions.push({ OR: [{ relevance: null }, { relevance: { publishedStatus: null } }] });
    } else {
      andConditions.push({ relevance: { publishedStatus: params.relevance } });
    }
  }
  if (params.hideSuperseded) {
    andConditions.push({ NOT: { relevance: { publishedStatus: "superseded" } } });
  }

  let searchOrder: string[] | null = null;
  if (params.q) {
    const rows = await prisma.$queryRaw<Array<{ id: string; score: number }>>`
      SELECT id, MATCH(title, abstract_raw) AGAINST(${params.q} IN NATURAL LANGUAGE MODE) AS score
      FROM papers
      WHERE MATCH(title, abstract_raw) AGAINST(${params.q} IN NATURAL LANGUAGE MODE)
    `;
    searchOrder = rows.sort((a, b) => b.score - a.score).map((r) => r.id);
    if (searchOrder.length === 0) {
      return emptyResult(params.page, params.perPage);
    }
    andConditions.push({ id: { in: searchOrder } });
  }

  const where = withPublicPaperFilter(andConditions.length > 0 ? { AND: andConditions } : {});

  const papers = await prisma.paper.findMany({
    where,
    orderBy: searchOrder ? undefined : { publishedDate: "desc" },
    include: {
      venue: { select: { displayName: true } },
      paperAuthors: { orderBy: { authorOrder: "asc" }, include: { author: { select: { name: true } } } },
      topics: { where: { isPrimary: true }, select: { subfield: true } },
      relevance: { select: { publishedStatus: true } },
      policyTags: { where: { status: "published" }, include: { tag: { select: { slug: true } } } },
      summaries: { where: { status: "published" }, select: { id: true } },
    },
  });

  let ordered = papers;
  if (searchOrder) {
    const orderIndex = new Map(searchOrder.map((id, i) => [id, i]));
    ordered = [...papers].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
  }

  const facets = {
    origin: { local: 0, international: 0 },
    years: {} as Record<string, number>,
    subfields: {} as Record<string, number>,
  };
  for (const p of ordered) {
    facets.origin[p.origin] += 1;
    if (p.publishedDate) {
      const year = String(p.publishedDate.getUTCFullYear());
      facets.years[year] = (facets.years[year] ?? 0) + 1;
    }
    const subfield = p.topics[0]?.subfield;
    if (subfield) facets.subfields[subfield] = (facets.subfields[subfield] ?? 0) + 1;
  }

  const total = ordered.length;
  const start = (params.page - 1) * params.perPage;
  const pageItems = ordered.slice(start, start + params.perPage);

  const data: PaperListItem[] = pageItems.map((p) => ({
    id: p.id,
    title: p.title,
    publishedDate: p.publishedDate,
    origin: p.origin,
    venueDisplayName: p.venue?.displayName ?? null,
    authorsPreview: p.paperAuthors.slice(0, 3).map((pa) => pa.author.name),
    authorCount: p.paperAuthors.length,
    primarySubfield: p.topics[0]?.subfield ?? null,
    relevanceBadge: p.relevance?.publishedStatus ?? null,
    policyTags: p.policyTags.map((pt) => pt.tag.slug),
    hasPublishedSummary: p.summaries.length > 0,
  }));

  return { data, total, page: params.page, perPage: params.perPage, facets };
}

function emptyResult(page: number, perPage: number): ListPapersResult {
  return { data: [], total: 0, page, perPage, facets: { origin: { local: 0, international: 0 }, years: {}, subfields: {} } };
}

export interface PaperDetail {
  id: string;
  title: string;
  publishedDate: Date | null;
  titles: Array<{ language: string; title: string; isPrimary: boolean }>;
  abstract: string | null;
  abstractDisplayPolicy: string;
  canonicalUrl: string | null;
  identifiers: Array<{ idType: string; idValue: string }>;
  authors: Array<{ name: string; institutions: Array<{ id: string; name: string; country: string | null }> }>;
  topics: Array<{ domain: string | null; field: string | null; subfield: string | null; topic: string | null; isPrimary: boolean }>;
  venue: { id: string; displayName: string; venueType: string; tier: string; country: string | null } | null;
  origin: "local" | "international";
  affiliationCountries: string[];
  isFoundational: boolean;
  affiliationInferred: boolean;
  summary: { language: string; summaryLayperson: string | null; summaryTechnical: string | null; relevanceIndonesia: string | null; provenance: string } | null;
  relevance: { publishedStatus: string | null; publishedReasoning: string | null } | null;
  policyTags: string[];
  successors: Array<{ relationType: string; reasoningText: string | null; paper: { id: string; title: string; publishedDate: Date | null } }>;
  versions: Array<{ versionNumber: number; changedSummary: string | null; versionDate: Date | null }>;
  citationStats: { citationCountTotal: number; fwci: number | null; retractionStatus: string } | null;
}

export type PaperDetailResult = { type: "found"; data: PaperDetail } | { type: "redirect"; survivingId: string } | { type: "not_found" };

export async function getPaperDetail(id: string, lang: "id" | "en"): Promise<PaperDetailResult> {
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
    const merge = await prisma.paperMerge.findFirst({ where: { mergedId: id } });
    if (merge) return { type: "redirect", survivingId: merge.survivingId };
    return { type: "not_found" };
  }

  const authors = paper.paperAuthors.map((pa) => ({
    name: pa.author.name,
    institutions: paper.affiliations
      .filter((aff) => aff.authorId === pa.authorId)
      .map((aff) => ({ id: aff.institution.id, name: aff.institution.name, country: aff.institution.country })),
  }));

  const data: PaperDetail = {
    id: paper.id,
    title: paper.title,
    publishedDate: paper.publishedDate,
    titles: paper.titles.map((t) => ({ language: t.language, title: t.title, isPrimary: t.isPrimary })),
    abstract: paper.abstractDisplayPolicy === "full" ? paper.abstractRaw : null,
    abstractDisplayPolicy: paper.abstractDisplayPolicy,
    canonicalUrl: paper.canonicalUrl,
    identifiers: paper.identifiers.map((i) => ({ idType: i.idType, idValue: i.idValue })),
    authors,
    topics: paper.topics.map((t) => ({ domain: t.domain, field: t.field, subfield: t.subfield, topic: t.topic, isPrimary: t.isPrimary })),
    venue: paper.venue
      ? { id: paper.venue.id, displayName: paper.venue.displayName, venueType: paper.venue.venueType, tier: paper.venue.tier, country: paper.venue.country }
      : null,
    origin: paper.origin,
    affiliationCountries: paper.affiliationCountries.map((c) => c.countryCode),
    isFoundational: paper.isFoundational,
    affiliationInferred: paper.affiliationInferred,
    summary: paper.summaries[0]
      ? {
          language: paper.summaries[0].language,
          summaryLayperson: paper.summaries[0].summaryLayperson,
          summaryTechnical: paper.summaries[0].summaryTechnical,
          relevanceIndonesia: paper.summaries[0].relevanceIndonesia,
          provenance: paper.summaries[0].provenance,
        }
      : null,
    relevance: paper.relevance ? { publishedStatus: paper.relevance.publishedStatus, publishedReasoning: paper.relevance.publishedReasoning } : null,
    policyTags: paper.policyTags.map((pt) => pt.tag.slug),
    successors: paper.relationsOld.map((rel) => ({
      relationType: rel.relationType,
      reasoningText: rel.reasoningText,
      paper: { id: rel.new.id, title: rel.new.title, publishedDate: rel.new.publishedDate },
    })),
    versions: paper.versions.map((v) => ({ versionNumber: v.versionNumber, changedSummary: v.changedSummary, versionDate: v.versionDate })),
    citationStats: paper.citationStats
      ? { citationCountTotal: paper.citationStats.citationCountTotal, fwci: paper.citationStats.fwci, retractionStatus: paper.citationStats.retractionStatus }
      : null,
    // enrichmentStatus SENGAJA tidak disertakan (Patch 4: hanya admin, jangan pernah publik)
  };

  return { type: "found", data };
}

export async function getBibtexForPaper(id: string): Promise<string | null> {
  const paper = await prisma.paper.findFirst({
    where: withPublicPaperFilter({ id }),
    include: {
      venue: { select: { displayName: true, venueType: true } },
      identifiers: { where: { idType: "doi" } },
      paperAuthors: { orderBy: { authorOrder: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!paper) return null;

  return buildBibtex({
    title: paper.title,
    authors: paper.paperAuthors.map((pa) => ({ name: pa.author.name })),
    year: paper.publishedDate ? paper.publishedDate.getUTCFullYear() : null,
    venueDisplayName: paper.venue?.displayName ?? null,
    venueType: paper.venue?.venueType ?? null,
    doi: paper.identifiers[0]?.idValue ?? null,
    canonicalUrl: paper.canonicalUrl,
  });
}

export async function getTopicsWithCounts(): Promise<Array<{ subfield: string; count: number }>> {
  const rows = await prisma.paperTopic.groupBy({
    by: ["subfield"],
    where: { subfield: { not: null }, paper: { metadataStatus: "indexed" } },
    _count: { _all: true },
  });
  return rows
    .filter((r) => r.subfield !== null)
    .map((r) => ({ subfield: r.subfield as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export interface TrendsResult {
  byYear: Array<{ year: number; local: number; international: number }>;
  bySubfield: Array<{ subfield: string; local: number; international: number }>;
}

export async function getTrends(): Promise<TrendsResult> {
  const papers = await prisma.paper.findMany({
    where: withPublicPaperFilter({}),
    select: { origin: true, publishedDate: true, topics: { where: { isPrimary: true }, select: { subfield: true } } },
  });

  const byYearMap = new Map<number, { local: number; international: number }>();
  const bySubfieldMap = new Map<string, { local: number; international: number }>();

  for (const p of papers) {
    if (p.publishedDate) {
      const year = p.publishedDate.getUTCFullYear();
      const entry = byYearMap.get(year) ?? { local: 0, international: 0 };
      entry[p.origin] += 1;
      byYearMap.set(year, entry);
    }
    const subfield = p.topics[0]?.subfield;
    if (subfield) {
      const entry = bySubfieldMap.get(subfield) ?? { local: 0, international: 0 };
      entry[p.origin] += 1;
      bySubfieldMap.set(subfield, entry);
    }
  }

  const byYear = Array.from(byYearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, counts]) => ({ year, ...counts }));

  const bySubfield = Array.from(bySubfieldMap.entries())
    .sort((a, b) => b[1].local + b[1].international - (a[1].local + a[1].international))
    .map(([subfield, counts]) => ({ subfield, ...counts }));

  return { byYear, bySubfield };
}

export interface HomeStats {
  totalPapers: number;
  localPapers: number;
  institutionCount: number;
  curatedSummaryCount: number;
  recentPapers: PaperListItem[];
}

export async function getHomeStats(): Promise<HomeStats> {
  const [totalPapers, localPapers, institutionCount, curatedSummaryCount, recent] = await Promise.all([
    prisma.paper.count({ where: withPublicPaperFilter({}) }),
    prisma.paper.count({ where: withPublicPaperFilter({ origin: "local" }) }),
    prisma.institution.count(),
    prisma.summary.count({ where: { status: "published" } }),
    prisma.paper.findMany({
      where: withPublicPaperFilter({}),
      orderBy: { publishedDate: "desc" },
      take: 6,
      include: {
        venue: { select: { displayName: true } },
        paperAuthors: { orderBy: { authorOrder: "asc" }, include: { author: { select: { name: true } } } },
        topics: { where: { isPrimary: true }, select: { subfield: true } },
        relevance: { select: { publishedStatus: true } },
        policyTags: { where: { status: "published" }, include: { tag: { select: { slug: true } } } },
        summaries: { where: { status: "published" }, select: { id: true } },
      },
    }),
  ]);

  const recentPapers: PaperListItem[] = recent.map((p) => ({
    id: p.id,
    title: p.title,
    publishedDate: p.publishedDate,
    origin: p.origin,
    venueDisplayName: p.venue?.displayName ?? null,
    authorsPreview: p.paperAuthors.slice(0, 3).map((pa) => pa.author.name),
    authorCount: p.paperAuthors.length,
    primarySubfield: p.topics[0]?.subfield ?? null,
    relevanceBadge: p.relevance?.publishedStatus ?? null,
    policyTags: p.policyTags.map((pt) => pt.tag.slug),
    hasPublishedSummary: p.summaries.length > 0,
  }));

  return { totalPapers, localPapers, institutionCount, curatedSummaryCount, recentPapers };
}
