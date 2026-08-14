import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

const bodySchema = z.object({ action: z.enum(["approve", "reject"]) });

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
    const relation = await prisma.paperRelation.findUnique({ where: { id } });
    if (!relation) return notFound("Relasi tidak ditemukan.");

    const status = parsed.data.action === "approve" ? "approved" : "rejected";
    await prisma.paperRelation.update({ where: { id }, data: { status } });
    return ok({ id, status });
  } catch (error) {
    return internalError(error);
  }
}
