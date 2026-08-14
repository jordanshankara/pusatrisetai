import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  edits: z
    .object({
      summaryLayperson: z.string().optional(),
      summaryTechnical: z.string().optional(),
      relevanceIndonesia: z.string().optional(),
    })
    .optional(),
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
    const summary = await prisma.summary.findUnique({ where: { id } });
    if (!summary) return notFound("Summary tidak ditemukan.");

    if (parsed.data.action === "reject") {
      await prisma.summary.update({
        where: { id },
        data: { status: "rejected", reviewedById: auth.email },
      });
      return ok({ id, status: "rejected" });
    }

    // approve: terapkan edits (bila ada), lalu satu transaksi (Bagian 5)
    const edits = parsed.data.edits;
    await prisma.$transaction([
      prisma.summary.updateMany({
        where: { paperId: summary.paperId, language: summary.language, status: "published", NOT: { id } },
        data: { status: "rejected" },
      }),
      prisma.summary.update({
        where: { id },
        data: {
          ...(edits?.summaryLayperson !== undefined ? { summaryLayperson: edits.summaryLayperson } : {}),
          ...(edits?.summaryTechnical !== undefined ? { summaryTechnical: edits.summaryTechnical } : {}),
          ...(edits?.relevanceIndonesia !== undefined ? { relevanceIndonesia: edits.relevanceIndonesia } : {}),
          status: "published",
          sourceType: summary.sourceType === "ai_draft" ? "ai_reviewed" : summary.sourceType,
          reviewedById: auth.email,
        },
      }),
    ]);

    return ok({ id, status: "published" });
  } catch (error) {
    return internalError(error);
  }
}
