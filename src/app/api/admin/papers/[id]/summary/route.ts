import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

const bodySchema = z.object({
  content: z.string().min(1),
});

/// Publikasi ringkasan yang DITULIS STAF SECARA MANUAL — langsung status="published", tanpa
/// antrean, karena staf sadar menulis/mengedit sendiri (prinsip "staf = kurator terpercaya",
/// sama seperti endpoint relasi manual). AI (lihat summary/suggest/route.ts) hanya boleh
/// mengisi teks awal di form sebelum staf menekan tombol ini — tidak pernah menulis ke DB
/// sendiri. Pola transaksi (demote summary published lain lalu create) identik dengan
/// summaries/[id]/review/route.ts.
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
    const paper = await prisma.paper.findUnique({ where: { id }, select: { id: true } });
    if (!paper) return notFound("Paper tidak ditemukan.");

    const [, created] = await prisma.$transaction([
      prisma.summary.updateMany({
        where: { paperId: id, language: "id", status: "published" },
        data: { status: "rejected" },
      }),
      prisma.summary.create({
        data: {
          paperId: id,
          language: "id",
          content: parsed.data.content,
          sourceType: "manual",
          provenance: "from_abstract",
          status: "published",
          authoredById: auth.email,
          reviewedById: auth.email,
        },
      }),
    ]);

    return ok({ id: created.id, status: "published" }, undefined, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
