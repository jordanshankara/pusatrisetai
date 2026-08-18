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
  quartile?: "q1" | "q2" | "q3" | "q4" | "unindexed";
  openAccess?: boolean;
  country?: string;
  policyTag?: string;
  hideSuperseded?: boolean;
  page: number;
  perPage: number;
  /** Hitung facets (origin/tahun/subbidang) — default false. Archive publik tidak memakainya
   *  (sidebar filter subbidang pakai getTopicsWithCounts terpisah); API publik /api/v1/papers
   *  kirim true eksplisit supaya kontrak responsnya tidak berubah. */
  includeFacets?: boolean;
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
  sjrQuartile: string | null;
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
  if (params.quartile) andConditions.push({ sjrQuartile: params.quartile });
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

  // PATCH: dulu andConditions.push({ id: { in: searchOrder } }) dipasang DI DALAM blok `if
  // (params.q)`, sebelum `where` final dibangun — jadi query ranking kata kunci di bawah ini
  // TIDAK ikut memfilter origin/tahun/subfield/dll (filter itu baru diterapkan belakangan lewat
  // andConditions). Sekarang query ranking dibangun dari andConditions yang SUDAH lengkap,
  // supaya searchOrder itu sendiri sudah fully-filtered — pagination bisa slice searchOrder
  // langsung tanpa takut ada baris yang lolos slice tapi seharusnya kefilter kondisi lain.
  let searchOrder: string[] | null = null;
  if (params.q) {
    // ADAPTASI: MySQL FULLTEXT MATCH...AGAINST dibuang (TiDB Cloud, target deploy, tidak
    // mendukung FULLTEXT multi-kolom seperti MySQL asli) — pakai `contains` biasa yang portable
    // di MySQL lokal maupun TiDB.
    //
    // PATCH: dulu mencocokkan SELURUH query sebagai satu frasa persis (mis. "AI untuk
    // pendidikan" harus muncul utuh di judul/abstrak) — hampir tidak pernah cocok untuk query
    // natural multi-kata. Sekarang dipecah per kata (buang stopword umum ID/EN), cocok kalau
    // SALAH SATU kata muncul (OR), diranking berdasarkan berapa banyak kata yang cocok + bobot
    // lebih tinggi kalau cocok di judul dibanding cuma di abstrak.
    const STOPWORDS = new Set([
      "untuk", "dan", "yang", "di", "ke", "dari", "pada", "atau", "dengan", "dalam", "ini", "itu", "adalah", "sebagai",
      "for", "and", "the", "of", "in", "on", "or", "with", "a", "an", "to", "is",
    ]);
    const words = Array.from(
      new Set(
        params.q
          .toLowerCase()
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
      )
    );
    const effectiveWords = words.length > 0 ? words : [params.q.toLowerCase().trim()].filter(Boolean);

    const rows = await prisma.paper.findMany({
      where: withPublicPaperFilter({
        AND: [...andConditions, { OR: effectiveWords.flatMap((w) => [{ title: { contains: w } }, { abstractRaw: { contains: w } }]) }],
      }),
      select: { id: true, title: true, abstractRaw: true },
    });
    searchOrder = rows
      .map((r) => {
        const titleLower = r.title.toLowerCase();
        const abstractLower = (r.abstractRaw ?? "").toLowerCase();
        let score = 0;
        for (const w of effectiveWords) {
          if (titleLower.includes(w)) score += 3;
          else if (abstractLower.includes(w)) score += 1;
        }
        return { id: r.id, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.id);
    if (searchOrder.length === 0) {
      return emptyResult(params.page, params.perPage);
    }
  }

  // PATCH (perf): dulu findMany di sini TANPA skip/take menarik SEMUA baris cocok (bisa 22k+)
  // berikut 6 relasi ter-join, baru dipotong (.slice) & dihitung facet di JS setelahnya — pada
  // dataset besar ini butuh 60+ detik. Sekarang skip/take didorong ke query Prisma supaya hanya
  // `perPage` baris yang pernah kena 6 join sekaligus; `total` dihitung lewat count()/panjang
  // searchOrder (murah, tanpa join) yang berjalan paralel dengan fetch halaman saat ini.
  const where = searchOrder
    ? withPublicPaperFilter({ id: { in: searchOrder } })
    : withPublicPaperFilter(andConditions.length > 0 ? { AND: andConditions } : {});
  const skip = (params.page - 1) * params.perPage;
  const pageIds = searchOrder ? searchOrder.slice(skip, skip + params.perPage) : null;

  const paperInclude = {
    venue: { select: { displayName: true } },
    paperAuthors: { orderBy: { authorOrder: "asc" as const }, include: { author: { select: { name: true } } } },
    topics: { where: { isPrimary: true }, select: { subfield: true } },
    relevance: { select: { publishedStatus: true } },
    policyTags: { where: { status: "published" as const }, include: { tag: { select: { slug: true } } } },
    summaries: { where: { status: "published" as const }, select: { id: true } },
  } satisfies Prisma.PaperInclude;

  const [total, papers, facets] = await Promise.all([
    searchOrder ? searchOrder.length : prisma.paper.count({ where }),
    pageIds
      ? prisma.paper.findMany({ where: withPublicPaperFilter({ id: { in: pageIds } }), include: paperInclude })
      : prisma.paper.findMany({ where, orderBy: { publishedDate: "desc" }, skip, take: params.perPage, include: paperInclude }),
    params.includeFacets ? computeFacets(where) : Promise.resolve(emptyFacets()),
  ]);

  // Re-sort HANYA atas halaman saat ini (<= perPage baris), bukan seluruh dataset — beda dari
  // versi lama yang sort di atas seluruh hasil match sebelum slice.
  const ordered = pageIds ? pageIds.map((id) => papers.find((p) => p.id === id)).filter((p): p is (typeof papers)[number] => p != null) : papers;

  const data: PaperListItem[] = ordered.map((p) => ({
    id: p.id,
    title: p.title,
    publishedDate: p.publishedDate,
    origin: p.origin,
    venueDisplayName: p.venue?.displayName ?? null,
    authorsPreview: p.paperAuthors.slice(0, 3).map((pa) => pa.author.name),
    authorCount: p.paperAuthors.length,
    primarySubfield: p.topics[0]?.subfield ?? null,
    relevanceBadge: p.relevance?.publishedStatus ?? null,
    sjrQuartile: p.sjrQuartile,
    policyTags: p.policyTags.map((pt) => pt.tag.slug),
    hasPublishedSummary: p.summaries.length > 0,
  }));

  return { data, total, page: params.page, perPage: params.perPage, facets };
}

function emptyResult(page: number, perPage: number): ListPapersResult {
  return { data: [], total: 0, page, perPage, facets: emptyFacets() };
}

function emptyFacets(): ListPapersResult["facets"] {
  return { origin: { local: 0, international: 0 }, years: {}, subfields: {} };
}

/** Facets (hitungan origin/tahun/subbidang) lewat query agregasi ringan, BUKAN dengan menarik
 *  seluruh baris + 6 relasi lalu hitung di JS (versi lama) — origin & subfield lewat groupBy
 *  (murni di database); tahun tetap select kolom tipis (publishedDate saja, tanpa join) lalu
 *  di-bucket di JS karena GROUP BY YEAR() butuh raw SQL yang berisiko drift dari `where` yang
 *  berisi banyak kondisi relasi (topics.some, policyTags.some, dll). */
async function computeFacets(where: Prisma.PaperWhereInput): Promise<ListPapersResult["facets"]> {
  const [originRows, subfieldRows, yearRows] = await Promise.all([
    prisma.paper.groupBy({ by: ["origin"], where, _count: { _all: true } }),
    prisma.paperTopic.groupBy({
      by: ["subfield"],
      where: { subfield: { not: null }, isPrimary: true, paper: where },
      _count: { _all: true },
    }),
    prisma.paper.findMany({ where, select: { publishedDate: true } }),
  ]);

  const origin = { local: 0, international: 0 };
  for (const r of originRows) origin[r.origin] = r._count._all;

  const subfields: Record<string, number> = {};
  for (const r of subfieldRows) if (r.subfield) subfields[r.subfield] = r._count._all;

  const years: Record<string, number> = {};
  for (const r of yearRows) {
    if (!r.publishedDate) continue;
    const year = String(r.publishedDate.getUTCFullYear());
    years[year] = (years[year] ?? 0) + 1;
  }

  return { origin, years, subfields };
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
  summary: { language: string; content: string | null; provenance: string } | null;
  relevance: { publishedStatus: string | null; publishedReasoning: string | null } | null;
  sjrQuartile: string | null;
  policyTags: string[];
  successors: Array<{ relationType: string; reasoningText: string | null; paper: { id: string; title: string; publishedDate: Date | null } }>;
  related: Array<{ reasoningText: string | null; paper: { id: string; title: string; publishedDate: Date | null } }>;
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

  // "Riset Serupa" (related_semantic) — query terpisah karena disimpan searah (old->new) oleh
  // script backfill B.5, tapi maknanya simetris. Dicek dari KEDUA arah supaya tidak bergantung
  // paper mana yang diproses lebih dulu saat backfill.
  const relatedRows = await prisma.paperRelation.findMany({
    where: { status: "approved", relationType: "related_semantic", OR: [{ paperIdOld: paper.id }, { paperIdNew: paper.id }] },
    include: {
      old: { select: { id: true, title: true, publishedDate: true } },
      new: { select: { id: true, title: true, publishedDate: true } },
    },
  });

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
      ? { language: paper.summaries[0].language, content: paper.summaries[0].content, provenance: paper.summaries[0].provenance }
      : null,
    relevance: paper.relevance ? { publishedStatus: paper.relevance.publishedStatus, publishedReasoning: paper.relevance.publishedReasoning } : null,
    sjrQuartile: paper.sjrQuartile,
    policyTags: paper.policyTags.map((pt) => pt.tag.slug),
    successors: paper.relationsOld.map((rel) => ({
      relationType: rel.relationType,
      reasoningText: rel.reasoningText,
      paper: { id: rel.new.id, title: rel.new.title, publishedDate: rel.new.publishedDate },
    })),
    related: relatedRows.map((rel) => {
      const other = rel.paperIdOld === paper.id ? rel.new : rel.old;
      return { reasoningText: rel.reasoningText, paper: { id: other.id, title: other.title, publishedDate: other.publishedDate } };
    }),
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
  const where = withPublicPaperFilter({});

  // PATCH (perf): dulu findMany dengan include topics lalu reduce SEMUA baris di JS untuk KEDUA
  // sumbu (tahun & subbidang) sekaligus. bySubfield sekarang lewat groupBy murni database (2
  // panggilan, satu per origin, karena origin ada di Paper sementara subfield ada di relasi
  // PaperTopic — Prisma groupBy tidak bisa gabung kolom lintas-relasi dalam satu call). byYear
  // tetap select kolom tipis (origin + publishedDate saja, tanpa join topics) lalu di-bucket di
  // JS, karena GROUP BY YEAR() butuh raw SQL yang berisiko drift dari `where`.
  const [yearRows, subfieldLocalRows, subfieldIntlRows] = await Promise.all([
    prisma.paper.findMany({ where, select: { origin: true, publishedDate: true } }),
    prisma.paperTopic.groupBy({
      by: ["subfield"],
      where: { subfield: { not: null }, isPrimary: true, paper: { ...where, origin: "local" } },
      _count: { _all: true },
    }),
    prisma.paperTopic.groupBy({
      by: ["subfield"],
      where: { subfield: { not: null }, isPrimary: true, paper: { ...where, origin: "international" } },
      _count: { _all: true },
    }),
  ]);

  const byYearMap = new Map<number, { local: number; international: number }>();
  for (const p of yearRows) {
    if (!p.publishedDate) continue;
    const year = p.publishedDate.getUTCFullYear();
    const entry = byYearMap.get(year) ?? { local: 0, international: 0 };
    entry[p.origin] += 1;
    byYearMap.set(year, entry);
  }
  const byYear = Array.from(byYearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, counts]) => ({ year, ...counts }));

  const bySubfieldMap = new Map<string, { local: number; international: number }>();
  for (const r of subfieldLocalRows) {
    if (!r.subfield) continue;
    bySubfieldMap.set(r.subfield, { local: r._count._all, international: 0 });
  }
  for (const r of subfieldIntlRows) {
    if (!r.subfield) continue;
    const entry = bySubfieldMap.get(r.subfield) ?? { local: 0, international: 0 };
    entry.international = r._count._all;
    bySubfieldMap.set(r.subfield, entry);
  }
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
  popularPapers: PaperListItem[];
}

const homeCardInclude = {
  venue: { select: { displayName: true } },
  paperAuthors: { orderBy: { authorOrder: "asc" as const }, include: { author: { select: { name: true } } } },
  topics: { where: { isPrimary: true }, select: { subfield: true } },
  relevance: { select: { publishedStatus: true } },
  policyTags: { where: { status: "published" as const }, include: { tag: { select: { slug: true } } } },
  summaries: { where: { status: "published" as const }, select: { id: true } },
} satisfies Prisma.PaperInclude;

type HomeCardPaper = Prisma.PaperGetPayload<{ include: typeof homeCardInclude }>;

function mapToPaperListItem(p: HomeCardPaper): PaperListItem {
  return {
    id: p.id,
    title: p.title,
    publishedDate: p.publishedDate,
    origin: p.origin,
    venueDisplayName: p.venue?.displayName ?? null,
    authorsPreview: p.paperAuthors.slice(0, 3).map((pa) => pa.author.name),
    authorCount: p.paperAuthors.length,
    primarySubfield: p.topics[0]?.subfield ?? null,
    relevanceBadge: p.relevance?.publishedStatus ?? null,
    sjrQuartile: p.sjrQuartile,
    policyTags: p.policyTags.map((pt) => pt.tag.slug),
    hasPublishedSummary: p.summaries.length > 0,
  };
}

export async function getHomeStats(): Promise<HomeStats> {
  const [totalPapers, localPapers, institutionCount, curatedSummaryCount, recent, popular] = await Promise.all([
    prisma.paper.count({ where: withPublicPaperFilter({}) }),
    prisma.paper.count({ where: withPublicPaperFilter({ origin: "local" }) }),
    prisma.institution.count(),
    prisma.summary.count({ where: { status: "published" } }),
    prisma.paper.findMany({
      where: withPublicPaperFilter({}),
      orderBy: { publishedDate: "desc" },
      take: 6,
      include: homeCardInclude,
    }),
    prisma.paper.findMany({
      // gt:0 supaya "terpopuler" tidak menampilkan paper 0 sitasi selagi data sitasi masih tipis
      where: withPublicPaperFilter({ citationStats: { citationCountTotal: { gt: 0 } } }),
      orderBy: { citationStats: { citationCountTotal: "desc" } },
      take: 6,
      include: homeCardInclude,
    }),
  ]);

  return {
    totalPapers,
    localPapers,
    institutionCount,
    curatedSummaryCount,
    recentPapers: recent.map(mapToPaperListItem),
    popularPapers: popular.map(mapToPaperListItem),
  };
}
