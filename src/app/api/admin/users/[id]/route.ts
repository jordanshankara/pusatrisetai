import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, notFound, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdminRole } from "@/lib/api/require-admin";

const bodySchema = z.object({ active: z.boolean() });

/// Nonaktifkan/aktifkan user — BUKAN hapus permanen (prinsip keamanan: hindari delete
/// permanen data akun; riwayat authoredById/reviewedById di Summary tetap bermakna).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRole();
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

  if (id === auth.userId && !parsed.data.active) {
    return badRequest("Tidak bisa menonaktifkan akun sendiri.", "CANNOT_DEACTIVATE_SELF");
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return notFound("User tidak ditemukan.");

    const updated = await prisma.user.update({
      where: { id },
      data: { active: parsed.data.active },
      select: { id: true, email: true, role: true, active: true },
    });
    return ok(updated);
  } catch (error) {
    return internalError(error);
  }
}
