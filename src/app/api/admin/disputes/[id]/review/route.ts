import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

/// Tidak ada di kontrak Bagian 5 eksplisit, tapi diperlukan tab "Sanggahan" (Bagian 7) —
/// pola sama dengan relations/review: action approve/reject + resolution opsional.
const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  resolution: z.string().optional(),
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
    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) return notFound("Sanggahan tidak ditemukan.");

    const status = parsed.data.action === "approve" ? "accepted" : "rejected";
    await prisma.dispute.update({
      where: { id },
      data: { status, resolution: parsed.data.resolution ?? null },
    });
    return ok({ id, status });
  } catch (error) {
    return internalError(error);
  }
}
