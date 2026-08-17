import { prisma } from "@/lib/db";
import { ok, notFound, internalError } from "@/lib/api/response";
import { requireAdminRole } from "@/lib/api/require-admin";

/// Toggle pin prioritas — HANYA admin (editor cuma melihat badge-nya, lihat PaperListClient/
/// PaperAdminDetail useAdminRole()). Set priorityPinnedAt=now() / null, dipakai sebagai
/// penanda "paper mana yang admin minta dikerjakan duluan" (lihat Paper.priorityPinnedAt).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const paper = await prisma.paper.findUnique({ where: { id }, select: { id: true, priorityPinnedAt: true } });
    if (!paper) return notFound("Paper tidak ditemukan.");

    const updated = await prisma.paper.update({
      where: { id },
      data: { priorityPinnedAt: paper.priorityPinnedAt ? null : new Date() },
      select: { priorityPinnedAt: true },
    });
    return ok({ priorityPinnedAt: updated.priorityPinnedAt });
  } catch (error) {
    return internalError(error);
  }
}
