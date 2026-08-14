import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

const PUBLISHED_RELEVANCE_VALUES = ["still_relevant", "needs_update", "superseded", "retracted", "foundational"] as const;

const bodySchema = z.object({
  publishedStatus: z.enum(PUBLISHED_RELEVANCE_VALUES),
  publishedReasoning: z.string().min(1),
  overrideReason: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Body request harus JSON valid.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return zodValidationError(parsed.error);

  try {
    const paper = await prisma.paper.findUnique({ where: { id } });
    if (!paper) return notFound("Paper tidak ditemukan.");

    const { publishedStatus, publishedReasoning, overrideReason } = parsed.data;

    await prisma.$transaction([
      prisma.relevanceScore.upsert({
        where: { paperId: id },
        create: { paperId: id, publishedStatus, publishedReasoning, overrideById: auth.email, overrideReason },
        update: { publishedStatus, publishedReasoning, overrideById: auth.email, overrideReason },
      }),
      ...(publishedStatus === "foundational"
        ? [prisma.paper.update({ where: { id }, data: { isFoundational: true } })]
        : []),
    ]);

    return ok({ id, publishedStatus });
  } catch (error) {
    return internalError(error);
  }
}
