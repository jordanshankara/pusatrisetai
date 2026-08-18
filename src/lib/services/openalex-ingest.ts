/**
 * Logic inti ingest OpenAlex — diekstrak dari scripts/fetch-openalex.ts supaya bisa dipakai
 * dari DUA entry point: script CLI (backfill besar/manual, lihat scripts/fetch-openalex.ts)
 * dan route cron harian (src/app/api/cron/fetch-openalex/route.ts, ingest incremental).
 *
 * FILTER DUA LAPIS (lihat riwayat kerja — mengganti filter lama "seluruh Computer Science"
 * yang terbukti 84% bukan riset AI):
 * - Lapis 1 (di query OpenAlex): subbidang Artificial Intelligence + Computer Vision
 *   (subfields/1702, subfields/1707), open_access.is_oa:true, negara sesuai parameter,
 *   opsional from_created_date untuk ingest incremental.
 * - Lapis 2 (di kode, scripts/lib/ai-keywords.ts): daftar ~170 pola kata kunci AI/ML
 *   diterapkan ke judul+abstrak SEBELUM disimpan.
 *
 * Insert sebagai Paper baru — origin=local, sourceTier=tier_2, tierReason='openalex_fetch',
 * metadataStatus=indexed, TANPA summaries/relevance (staf riset yang mengerjakan itu manual).
 *
 * Idempotent: paper dengan openalex_id (atau doi) yang sudah ada di paper_identifiers dilewati.
 */
import type { License } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveAbstractPolicy } from "@/lib/rules/abstract-policy";
import { deriveAffiliationCountries } from "@/lib/rules/affiliation-countries";
import { isAiRelated } from "./ai-keywords";

const FETCH_TIMEOUT_MS = 30_000;
const PER_PAGE = 200; // maksimum OpenAlex
const REQUEST_DELAY_MS = 350; // sopan ke OpenAlex, sesuai yang diuji aman sebelumnya
const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO ?? "dev@pusatriset.ai";

// subfields/1702 = Artificial Intelligence, subfields/1707 = Computer Vision and Pattern Recognition
const AI_SUBFIELDS = "https://openalex.org/subfields/1702|https://openalex.org/subfields/1707";

export interface OpenAlexIngestOptions {
  countries: string;
  limit?: number;
  /** Filter OpenAlex from_created_date (YYYY-MM-DD) — untuk ingest incremental (cron harian). */
  sinceCreatedDate?: string;
  onProgress?: (line: string) => void;
}

export interface OpenAlexIngestResult {
  processed: number;
  inserted: number;
  notAi: number;
  skipped: number;
  failed: number;
  totalCandidates: number | null;
}

interface OpenAlexInstitution {
  id: string;
  display_name: string;
  country_code: string | null;
  type?: string | null;
  ror?: string | null;
}

interface OpenAlexAuthorship {
  author: { id: string; display_name: string; orcid?: string | null };
  institutions: OpenAlexInstitution[];
}

interface OpenAlexWork {
  id: string;
  doi: string | null;
  title: string | null;
  display_name: string | null;
  publication_date: string | null;
  language: string | null;
  open_access?: { is_oa?: boolean } | null;
  primary_location?: { source?: { display_name?: string | null; issn_l?: string | null } | null; license?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: OpenAlexAuthorship[];
  primary_topic?: {
    display_name?: string | null;
    subfield?: { display_name?: string | null } | null;
    field?: { display_name?: string | null } | null;
    domain?: { display_name?: string | null } | null;
    score?: number | null;
  } | null;
  cited_by_count?: number;
  counts_by_year?: Array<{ year: number; cited_by_count: number }>;
  fwci?: number | null;
  citation_normalized_percentile?: { value?: number | null } | null;
}

interface OpenAlexResponse {
  results: OpenAlexWork[];
  meta: { count: number; next_cursor: string | null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(cursor: string, countries: string, sinceCreatedDate?: string): string {
  let filter = `institutions.country_code:${countries},primary_topic.subfield.id:${AI_SUBFIELDS},open_access.is_oa:true`;
  if (sinceCreatedDate) filter += `,from_created_date:${sinceCreatedDate}`;
  return `https://api.openalex.org/works?filter=${filter}&per-page=${PER_PAGE}&cursor=${cursor}&mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;
}

/// Rekonstruksi abstrak dari inverted index (format standar OpenAlex).
function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const positions: Array<[number, string]> = [];
  for (const [word, idxs] of Object.entries(index)) {
    for (const idx of idxs) positions.push([idx, word]);
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, word]) => word).join(" ");
}

/// Mapping longgar string lisensi OpenAlex -> enum License kita; tak dikenal -> unknown (aman, summary_only).
function mapLicense(raw: string | null | undefined): License {
  switch (raw) {
    case "cc-by":
      return "cc_by";
    case "cc-by-sa":
      return "cc_by_sa";
    case "cc-by-nc":
      return "cc_by_nc";
    case "cc-by-nc-sa":
      return "cc_by_nc_sa";
    case "cc0":
    case "public-domain":
      return "cc0";
    case undefined:
    case null:
      return "unknown";
    default:
      return "other_open";
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPageWithRetry(cursor: string, countries: string, sinceCreatedDate: string | undefined, log: (line: string) => void): Promise<OpenAlexResponse | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(buildUrl(cursor, countries, sinceCreatedDate));
      if (res.status === 429) {
        log(`  [rate-limit] tunggu 5s lalu coba lagi (percobaan ${attempt + 1}/3)...`);
        await sleep(5000);
        continue;
      }
      if (!res.ok) {
        log(`  [halaman gagal] HTTP ${res.status}, percobaan ${attempt + 1}/3`);
        await sleep(1500);
        continue;
      }
      return (await res.json()) as OpenAlexResponse;
    } catch (error) {
      log(`  [halaman gagal] ${error instanceof Error ? error.message : String(error)}, percobaan ${attempt + 1}/3`);
      await sleep(1500);
    }
  }
  return null;
}

/// Author.openalexAuthorId TIDAK unique di schema (beda dari Institution) -> upsert manual (find lalu create).
async function upsertAuthor(a: OpenAlexAuthorship["author"]): Promise<string> {
  const existing = await prisma.author.findFirst({ where: { openalexAuthorId: a.id } });
  if (existing) return existing.id;
  const created = await prisma.author.create({
    data: { name: a.display_name, orcidId: a.orcid ?? null, openalexAuthorId: a.id },
  });
  return created.id;
}

async function upsertInstitution(inst: OpenAlexInstitution): Promise<string> {
  const row = await prisma.institution.upsert({
    where: { openalexInstitutionId: inst.id },
    update: {},
    create: {
      name: inst.display_name,
      country: inst.country_code,
      institutionType: inst.type ?? null,
      rorId: inst.ror ?? null,
      openalexInstitutionId: inst.id,
    },
  });
  return row.id;
}

async function alreadyIndexed(work: OpenAlexWork): Promise<boolean> {
  const byOpenAlexId = await prisma.paperIdentifier.findUnique({
    where: { idType_idValue: { idType: "openalex_id", idValue: work.id } },
  });
  if (byOpenAlexId) return true;
  if (work.doi) {
    const byDoi = await prisma.paperIdentifier.findUnique({
      where: { idType_idValue: { idType: "doi", idValue: work.doi } },
    });
    if (byDoi) return true;
  }
  return false;
}

async function processWork(work: OpenAlexWork): Promise<"inserted" | "skipped" | "not_ai"> {
  if (await alreadyIndexed(work)) return "skipped";

  const title = work.title ?? work.display_name;
  if (!title) return "skipped";

  const abstract = reconstructAbstract(work.abstract_inverted_index);

  // Lapis 2: gerbang kata kunci AI/ML — lihat scripts/lib/ai-keywords.ts
  if (!isAiRelated(title, abstract)) return "not_ai";

  const licenseNormalized = mapLicense(work.primary_location?.license);
  const abstractDisplayPolicy = deriveAbstractPolicy({
    licenseNormalized,
    isOpenAccess: work.open_access?.is_oa ?? false,
  });

  const authorships = work.authorships ?? [];
  const authorCountries = authorships.flatMap((a) => a.institutions.map((i) => i.country_code));
  const affiliationCountries = deriveAffiliationCountries(authorCountries);

  const paper = await prisma.paper.create({
    data: {
      title,
      abstractRaw: abstract,
      abstractDisplayPolicy,
      publishedDate: work.publication_date ? new Date(work.publication_date) : null,
      language: work.language ?? null,
      origin: "local",
      venueNameRaw: work.primary_location?.source?.display_name ?? null,
      /// dipakai belakangan utk backfill kuartil SJR (lihat scripts/backfill-sjr-quartile.ts) —
      /// TIDAK dihitung di sini supaya ingest tetap ringan/cepat (kuartil butuh call Elsevier terpisah, ada kuota mingguan)
      issnL: work.primary_location?.source?.issn_l ?? null,
      sourceTier: "tier_2",
      tierReason: "openalex_fetch",
      metadataStatus: "indexed",
      licenseRaw: work.primary_location?.license ?? null,
      licenseNormalized,
      enrichmentStatus: "enriched_openalex",
    },
  });

  await prisma.paperTitle.create({
    data: { paperId: paper.id, language: work.language ?? "id", title, isPrimary: true },
  });

  await prisma.paperIdentifier.create({
    data: { paperId: paper.id, idType: "openalex_id", idValue: work.id },
  });
  if (work.doi) {
    await prisma.paperIdentifier.create({
      data: { paperId: paper.id, idType: "doi", idValue: work.doi },
    });
  }

  if (work.primary_topic) {
    await prisma.paperTopic.create({
      data: {
        paperId: paper.id,
        domain: work.primary_topic.domain?.display_name ?? null,
        field: work.primary_topic.field?.display_name ?? null,
        subfield: work.primary_topic.subfield?.display_name ?? null,
        topic: work.primary_topic.display_name ?? null,
        isPrimary: true,
        score: work.primary_topic.score ?? null,
      },
    });
  }

  // OpenAlex kadang mencantumkan authorship duplikat utk penulis yang sama (mis. 2 baris beda
  // afiliasi) — PaperAuthor/AuthorAffiliation pk tidak izinkan itu, jadi dedup dulu per author.id,
  // gabungkan institutions-nya.
  const uniqueAuthorships = new Map<string, OpenAlexAuthorship>();
  for (const authorship of authorships) {
    const existing = uniqueAuthorships.get(authorship.author.id);
    if (existing) {
      existing.institutions = [...existing.institutions, ...authorship.institutions];
    } else {
      uniqueAuthorships.set(authorship.author.id, { ...authorship, institutions: [...authorship.institutions] });
    }
  }

  let order = 0;
  for (const authorship of uniqueAuthorships.values()) {
    const authorId = await upsertAuthor(authorship.author);
    await prisma.paperAuthor.create({ data: { paperId: paper.id, authorId, authorOrder: order + 1 } });
    order++;

    const uniqueInstitutionIds = new Set<string>();
    for (const inst of authorship.institutions) {
      if (uniqueInstitutionIds.has(inst.id)) continue;
      uniqueInstitutionIds.add(inst.id);
      const institutionId = await upsertInstitution(inst);
      await prisma.authorAffiliation.create({ data: { authorId, institutionId, paperId: paper.id } });
    }
  }

  for (const code of affiliationCountries) {
    await prisma.paperAffiliationCountry.create({ data: { paperId: paper.id, countryCode: code } });
  }

  await prisma.citationStats.create({
    data: {
      paperId: paper.id,
      citationCountTotal: work.cited_by_count ?? 0,
      citationByYear: work.counts_by_year ? JSON.stringify(work.counts_by_year) : undefined,
      fwci: work.fwci ?? null,
      citationNormalizedPercentile: work.citation_normalized_percentile?.value ?? null,
    },
  });

  return "inserted";
}

/// Jalankan satu putaran ingest penuh (mengikuti cursor sampai habis, atau sampai limit).
/// Dipakai baik oleh script CLI (backfill besar) maupun route cron (incremental harian).
export async function runOpenAlexIngest(options: OpenAlexIngestOptions): Promise<OpenAlexIngestResult> {
  const log = options.onProgress ?? (() => {});
  let inserted = 0;
  let skipped = 0;
  let notAi = 0;
  let failed = 0;
  let processed = 0;
  let cursor = "*";
  let totalCandidates: number | null = null;

  while (cursor) {
    const page = await fetchPageWithRetry(cursor, options.countries, options.sinceCreatedDate, log);
    if (!page) {
      log("  [halaman gagal permanen setelah 3x percobaan] — hentikan run.");
      break;
    }
    if (totalCandidates === null) {
      totalCandidates = page.meta.count;
      log(`Total kandidat Lapis 1 (subbidang+OA, sebelum saring kata kunci): ${totalCandidates.toLocaleString("id-ID")}`);
    }

    for (const work of page.results) {
      if (options.limit && processed >= options.limit) break;
      processed++;
      try {
        const result = await processWork(work);
        if (result === "inserted") inserted++;
        else if (result === "not_ai") notAi++;
        else skipped++;
      } catch (error) {
        failed++;
        log(`  Gagal memproses work ${work.id} ("${work.title ?? work.display_name}"): ${error instanceof Error ? error.message : error}`);
      }

      if (processed % 100 === 0) {
        log(`[${processed}] diproses — inserted=${inserted} bukan-AI=${notAi} skip=${skipped} gagal=${failed}`);
      }
    }

    if (options.limit && processed >= options.limit) break;
    cursor = page.meta.next_cursor ?? "";
    if (cursor) await sleep(REQUEST_DELAY_MS);
  }

  return { processed, inserted, notAi, skipped, failed, totalCandidates };
}
