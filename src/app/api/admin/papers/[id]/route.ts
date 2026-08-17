import { prisma } from "@/lib/db";
import { ok, notFound, internalError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

/// Detail admin (BUKAN getPaperDetail() publik — di sini semua status ditampilkan, tanpa
/// filter metadataStatus=indexed) untuk /admin/jurnal/[id]: dasar bagi tombol "Buatkan draft
/// ringkasan (AI)", form tambah relasi, dan panel relevansi.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        identifiers: true,
        topics: true,
        citationStats: true,
        relevance: true,
        summaries: { orderBy: { createdAt: "desc" } },
        relationsOld: { include: { new: { select: { id: true, title: true } } } },
        relationsNew: { include: { old: { select: { id: true, title: true } } } },
      },
    });
    if (!paper) return notFound("Paper tidak ditemukan.");

    return ok(paper);
  } catch (error) {
    return internalError(error);
  }
}
