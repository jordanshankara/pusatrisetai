import { z } from "zod";
import { ok, internalError, zodValidationError } from "@/lib/api/response";
import { listPapers, RELEVANCE_FILTER_VALUES } from "@/lib/services/papers";

const querySchema = z.object({
  q: z.string().trim().min(1).optional(),
  origin: z.enum(["local", "international"]).optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  subfield: z.union([z.string(), z.array(z.string())]).optional(),
  tier: z.enum(["tier_1", "tier_2", "tier_3"]).optional(),
  relevance: z.enum(RELEVANCE_FILTER_VALUES).optional(),
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
  const raw = Object.fromEntries(searchParams.entries());
  const subfields = searchParams.getAll("subfield");
  const parsed = querySchema.safeParse({ ...raw, subfield: subfields.length > 1 ? subfields : subfields[0] });
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  try {
    const result = await listPapers({ ...parsed.data, includeFacets: true });
    return ok(result.data, { total: result.total, page: result.page, perPage: result.perPage, facets: result.facets });
  } catch (error) {
    return internalError(error);
  }
}
