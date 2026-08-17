import type { Prisma, MetadataStatus, EnrichmentStatus } from "@prisma/client";

const METADATA_STATUSES: MetadataStatus[] = ["indexed", "queued_review", "rejected", "withdrawn"];
const ENRICHMENT_STATUSES: EnrichmentStatus[] = ["pending", "enriched_openalex", "no_doi", "not_found_openalex", "failed"];
import { prisma } from "@/lib/db";
import { ok, internalError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

/// Daftar paper untuk /admin/jurnal — "kotak masuk" staf: paper yang butuh perhatian editorial
/// (ringkasan, relevansi, dst). Query admin ringan sendiri (BUKAN listPapers() dari
/// src/lib/services/papers.ts) — itu dirancang untuk katalog publik (filter
/// metadataStatus=indexed, facet, search-ranking) yang tidak relevan di sini; di admin SEMUA
/// metadataStatus tampil secara default supaya staf bisa audit data kotor kalau perlu.
const SORT_OPTIONS = ["newest", "oldest", "title_asc", "recently_added", "oldest_added", "priority"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function sortToOrderBy(sort: SortOption): Prisma.PaperOrderByWithRelationInput | Prisma.PaperOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return { publishedDate: "asc" };
    case "title_asc":
      return { title: "asc" };
    case "recently_added":
      return { createdAt: "desc" };
    case "oldest_added":
      return { createdAt: "asc" };
    case "priority":
      return [{ sourceTier: "asc" }, { citationStats: { citationCountTotal: "desc" } }];
    case "newest":
    default:
      return { publishedDate: "desc" };
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const missingSummary = url.searchParams.get("missingSummary") === "true";
  const origin = url.searchParams.get("origin");
  const yearFrom = Number(url.searchParams.get("yearFrom") ?? "");
  const yearTo = Number(url.searchParams.get("yearTo") ?? "");
  const newOnly = url.searchParams.get("newOnly") === "true";
  const pinnedOnly = url.searchParams.get("pinnedOnly") === "true";
  const summaryStatus = url.searchParams.get("summaryStatus");
  const relevanceStatus = url.searchParams.get("relevanceStatus");
  const metadataStatus = url.searchParams.get("metadataStatus");
  const enrichmentStatus = url.searchParams.get("enrichmentStatus");
  const sortParam = url.searchParams.get("sort") ?? "newest";
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(sortParam) ? (sortParam as SortOption) : "newest";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") ?? "50") || 50));

  const and: Prisma.PaperWhereInput[] = [];

  if (q) and.push({ title: { contains: q } });
  if (origin === "local" || origin === "international") and.push({ origin });
  if (Number.isFinite(yearFrom) && yearFrom > 0) and.push({ publishedDate: { gte: new Date(Date.UTC(yearFrom, 0, 1)) } });
  if (Number.isFinite(yearTo) && yearTo > 0) and.push({ publishedDate: { lte: new Date(Date.UTC(yearTo, 11, 31)) } });
  if (newOnly) and.push({ createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
  if (pinnedOnly) and.push({ priorityPinnedAt: { not: null } });
  if (metadataStatus && (METADATA_STATUSES as string[]).includes(metadataStatus)) and.push({ metadataStatus: metadataStatus as MetadataStatus });
  if (enrichmentStatus && (ENRICHMENT_STATUSES as string[]).includes(enrichmentStatus)) and.push({ enrichmentStatus: enrichmentStatus as EnrichmentStatus });

  const effectiveSummaryStatus = summaryStatus ?? (missingSummary ? "none" : null);
  if (effectiveSummaryStatus === "none") {
    and.push({ summaries: { none: { language: "id" } } });
  } else if (effectiveSummaryStatus === "draft") {
    and.push({ summaries: { some: { language: "id" } } });
    and.push({ summaries: { none: { language: "id", status: "published" } } });
  } else if (effectiveSummaryStatus === "published") {
    and.push({ summaries: { some: { language: "id", status: "published" } } });
  }

  if (relevanceStatus === "unscored") {
    and.push({ OR: [{ relevance: null }, { relevance: { publishedStatus: null } }] });
  } else if (relevanceStatus === "published") {
    and.push({ relevance: { publishedStatus: { not: null } } });
  }

  const where: Prisma.PaperWhereInput = and.length > 0 ? { AND: and } : {};

  try {
    const [total, papers] = await Promise.all([
      prisma.paper.count({ where }),
      prisma.paper.findMany({
        where,
        orderBy: sortToOrderBy(sort),
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          title: true,
          origin: true,
          publishedDate: true,
          createdAt: true,
          metadataStatus: true,
          licenseNormalized: true,
          tierReason: true,
          sourceTier: true,
          isFoundational: true,
          enrichmentStatus: true,
          priorityPinnedAt: true,
          summaries: { where: { language: "id" }, select: { status: true } },
          relevance: { select: { publishedStatus: true, computedStatus: true } },
          citationStats: { select: { citationCountTotal: true } },
        },
      }),
    ]);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const data = papers.map((p) => {
      const summaryStatuses = p.summaries.map((s) => s.status);
      const summaryStatusComputed: "none" | "draft" | "published" = summaryStatuses.includes("published")
        ? "published"
        : summaryStatuses.length > 0
          ? "draft"
          : "none";

      return {
        id: p.id,
        title: p.title,
        origin: p.origin,
        publishedDate: p.publishedDate,
        metadataStatus: p.metadataStatus,
        licenseNormalized: p.licenseNormalized,
        tierReason: p.tierReason,
        sourceTier: p.sourceTier,
        isFoundational: p.isFoundational,
        enrichmentStatus: p.enrichmentStatus,
        priorityPinnedAt: p.priorityPinnedAt,
        isNew: p.createdAt.getTime() >= sevenDaysAgo,
        summaryStatus: summaryStatusComputed,
        relevancePublishedStatus: p.relevance?.publishedStatus ?? null,
        relevanceComputedStatus: p.relevance?.computedStatus ?? null,
        citationCountTotal: p.citationStats?.citationCountTotal ?? null,
      };
    });

    return ok(data, { total, page, perPage });
  } catch (error) {
    return internalError(error);
  }
}
