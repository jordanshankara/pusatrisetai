import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, apiError, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

/// Cari kandidat paper lain untuk direlasikan (combobox floating di AddRelationForm).
/// Tanpa `q`: kandidat "mirip topik" (overlap subbidang dgn paper ini) — supaya panel TIDAK
/// kosong saat baru dibuka, sesuai arahan "utamakan yang mirip-mirip dulu". Dengan `q` (>=2
/// karakter): pencarian judul biasa.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  try {
    if (q.length >= 2) {
      const papers = await prisma.paper.findMany({
        where: { id: { not: id }, title: { contains: q } },
        select: { id: true, title: true, publishedDate: true },
        take: 15,
        orderBy: { publishedDate: "desc" },
      });
      return ok({ mode: "search", data: papers });
    }

    const myTopics = await prisma.paperTopic.findMany({
      where: { paperId: id, subfield: { not: null } },
      select: { subfield: true },
    });
    const subfields = [...new Set(myTopics.map((t) => t.subfield!))];
    if (subfields.length === 0) return ok({ mode: "similar", data: [] });

    const papers = await prisma.paper.findMany({
      where: { id: { not: id }, topics: { some: { subfield: { in: subfields } } } },
      select: { id: true, title: true, publishedDate: true },
      take: 15,
      orderBy: { publishedDate: "desc" },
    });
    return ok({ mode: "similar", data: papers });
  } catch (error) {
    return internalError(error);
  }
}

const bodySchema = z.object({
  targetPaperId: z.string().uuid(),
  relationType: z.enum(["superseded_by", "follow_up_same_author", "related_semantic", "contradicted_by", "extended_by"]),
  reasoningText: z.string().min(1),
  // "this_is_new" = paper ini adalah versi baru, target adalah versi lama (dst sesuai relationType).
  direction: z.enum(["this_is_old", "this_is_new"]).default("this_is_new"),
});

/// Relasi manual yang staf buat sadar — LANGSUNG status="approved" (beda dari relasi
/// AI-suggested milik scripts/backfill-relations.ts yang lewat antrean suggested->approve),
/// sesuai prinsip "staf = kurator terpercaya" yang sudah dipakai di bagian lain sistem ini.
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

  const { targetPaperId, relationType, reasoningText, direction } = parsed.data;
  if (targetPaperId === id) return badRequest("Tidak bisa merelasikan paper dengan dirinya sendiri.");

  const paperIdOld = direction === "this_is_new" ? targetPaperId : id;
  const paperIdNew = direction === "this_is_new" ? id : targetPaperId;

  try {
    const [thisPaper, target] = await Promise.all([
      prisma.paper.findUnique({ where: { id }, select: { id: true } }),
      prisma.paper.findUnique({ where: { id: targetPaperId }, select: { id: true } }),
    ]);
    if (!thisPaper) return notFound("Paper tidak ditemukan.");
    if (!target) return notFound("Paper tujuan tidak ditemukan.");

    const created = await prisma.paperRelation.create({
      data: { paperIdOld, paperIdNew, relationType, reasoningText, status: "approved" },
    });
    return ok({ id: created.id, status: "approved" }, undefined, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "RELATION_ALREADY_EXISTS", "Relasi dengan jenis ini antara kedua paper sudah ada.");
    }
    return internalError(error);
  }
}
