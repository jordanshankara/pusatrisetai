import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, internalError, zodValidationError } from "@/lib/api/response";
import { withPublicPaperFilter } from "@/lib/queries/public";
import type { Prisma } from "@prisma/client";

const RELEVANCE_VALUES = ["still_relevant", "needs_update", "superseded", "retracted", "foundational", "none"] as const;

const querySchema = z.object({
  q: z.string().trim().min(1).optional(),
  origin: z.enum(["local", "international"]).optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  subfield: z.string().optional(),
  tier: z.enum(["tier_1", "tier_2", "tier_3"]).optional(),
  relevance: z.enum(RELEVANCE_VALUES).optional(),
  openAccess: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  country: z.string().optional(),
  policyTag: z.string().optional(),
  hideSuperseded: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }
  const q = parsed.data;

  try {
    const andConditions: Prisma.PaperWhereInput[] = [];
    if (q.origin) andConditions.push({ origin: q.origin });
    if (q.yearFrom) andConditions.push({ publishedDate: { gte: new Date(Date.UTC(q.yearFrom, 0, 1)) } });
    if (q.yearTo) andConditions.push({ publishedDate: { lte: new Date(Date.UTC(q.yearTo, 11, 31)) } });
    if (q.subfield) andConditions.push({ topics: { some: { subfield: q.subfield } } });
    if (q.tier) andConditions.push({ sourceTier: q.tier });
    if (q.openAccess === true) andConditions.push({ abstractDisplayPolicy: "full" });
    if (q.country) andConditions.push({ affiliationCountries: { some: { countryCode: q.country } } });
    if (q.policyTag) {
      andConditions.push({ policyTags: { some: { status: "published", tag: { slug: q.policyTag } } } });
    }
    if (q.relevance) {
      if (q.relevance === "none") {
        andConditions.push({ OR: [{ relevance: null }, { relevance: { publishedStatus: null } }] });
      } else {
        andConditions.push({ relevance: { publishedStatus: q.relevance } });
      }
    }
    if (q.hideSuperseded) {
      andConditions.push({ NOT: { relevance: { publishedStatus: "superseded" } } });
    }

    let searchOrder: string[] | null = null;
    if (q.q) {
      const rows = await prisma.$queryRaw<Array<{ id: string; score: number }>>`
        SELECT id, MATCH(title, abstract_raw) AGAINST(${q.q} IN NATURAL LANGUAGE MODE) AS score
        FROM papers
        WHERE MATCH(title, abstract_raw) AGAINST(${q.q} IN NATURAL LANGUAGE MODE)
      `;
      searchOrder = rows.sort((a, b) => b.score - a.score).map((r) => r.id);
      if (searchOrder.length === 0) {
        return responseEmpty(q.page, q.perPage);
      }
      andConditions.push({ id: { in: searchOrder } });
    }

    const where = withPublicPaperFilter(andConditions.length > 0 ? { AND: andConditions } : {});

    const papers = await prisma.paper.findMany({
      where,
      orderBy: searchOrder ? undefined : { publishedDate: "desc" },
      include: {
        venue: { select: { displayName: true } },
        paperAuthors: {
          orderBy: { authorOrder: "asc" },
          include: { author: { select: { name: true } } },
        },
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

    // facets dari seluruh hasil terfilter (sebelum pagination)
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
    const start = (q.page - 1) * q.perPage;
    const pageItems = ordered.slice(start, start + q.perPage);

    const data = pageItems.map((p) => ({
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

    return ok(data, { total, page: q.page, perPage: q.perPage, facets });
  } catch (error) {
    return internalError(error);
  }
}

function responseEmpty(page: number, perPage: number) {
  return ok([], { total: 0, page, perPage, facets: { origin: { local: 0, international: 0 }, years: {}, subfields: {} } });
}
