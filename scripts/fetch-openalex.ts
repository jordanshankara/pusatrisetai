/**
 * BAGIAN 9 (BuildSpec) — script opsional, dijalankan manual: `npx tsx scripts/fetch-openalex.ts`
 * Hanya jalan bila ENABLE_OPENALEX_FETCH=true di .env. TIDAK dipanggil otomatis oleh app/seed.
 *
 * Fetch works dari OpenAlex (institutions.country_code:ID, primary_topic.field.id:Computer
 * Science) lalu insert sebagai Paper baru — origin=local, sourceTier=tier_2,
 * tierReason='openalex_fetch_prototype', TANPA summaries/relevance (kontras sengaja terhadap
 * paper seed yang sudah terkurasi — mendemokan nilai lapisan editorial produk).
 *
 * Idempotent: paper dengan openalex_id (atau doi) yang sudah ada di paper_identifiers dilewati.
 * Satu record gagal diproses -> di-skip + log, TIDAK menggagalkan seluruh run (Bagian 9).
 */
import { PrismaClient, type License } from "@prisma/client";
import { deriveAbstractPolicy } from "../src/lib/rules/abstract-policy";
import { deriveAffiliationCountries } from "../src/lib/rules/affiliation-countries";

const prisma = new PrismaClient();

const FETCH_TIMEOUT_MS = 30_000;
const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO ?? "dev@pusatriset.ai";
// field 17 = Computer Science (cukup untuk prototype, per Bagian 9)
const OPENALEX_URL = `https://api.openalex.org/works?filter=institutions.country_code:ID,primary_topic.field.id:https://openalex.org/fields/17&per-page=100&mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;

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
  primary_location?: { source?: { display_name?: string | null } | null; license?: string | null } | null;
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

async function processWork(work: OpenAlexWork): Promise<"inserted" | "skipped"> {
  if (await alreadyIndexed(work)) return "skipped";

  const title = work.title ?? work.display_name;
  if (!title) return "skipped";

  const abstract = reconstructAbstract(work.abstract_inverted_index);
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
      sourceTier: "tier_2",
      tierReason: "openalex_fetch_prototype",
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

async function main() {
  if (process.env.ENABLE_OPENALEX_FETCH !== "true") {
    console.log("ENABLE_OPENALEX_FETCH != true — dibatalkan. Set di .env untuk menjalankan script ini (Bagian 9, opsional).");
    return;
  }

  console.log(`Fetch ${OPENALEX_URL}`);
  let response: Response;
  try {
    response = await fetchWithTimeout(OPENALEX_URL);
  } catch (error) {
    console.error("Fetch OpenAlex gagal (timeout/network):", error);
    process.exitCode = 1;
    return;
  }
  if (!response.ok) {
    console.error(`OpenAlex API error: HTTP ${response.status}`);
    process.exitCode = 1;
    return;
  }

  const body = (await response.json()) as OpenAlexResponse;
  const works = body.results ?? [];
  console.log(`Diterima ${works.length} works dari OpenAlex.`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const work of works) {
    try {
      const result = await processWork(work);
      if (result === "inserted") inserted++;
      else skipped++;
    } catch (error) {
      failed++;
      console.error(`Gagal memproses work ${work.id} ("${work.title ?? work.display_name}"):`, error);
    }
  }

  console.log(`Selesai. inserted=${inserted} skipped(duplikat/tanpa judul)=${skipped} failed=${failed}`);
}

main()
  .catch((error) => {
    console.error("Fetch OpenAlex gagal total:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
