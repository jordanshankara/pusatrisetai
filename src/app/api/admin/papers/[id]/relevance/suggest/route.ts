import { prisma } from "@/lib/db";
import { ok, notFound, apiError, internalError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { LLMClient } from "@/lib/services/llm-client";
import { buildRelevanceSuggestPrompt, relevanceSuggestionSchema } from "@/lib/llm/relevance-prompt";

/// Saran relevansi AI, dibumbui data nyata (sitasi, relasi superseded yang sudah approved) —
/// menyimpan HANYA ke RelevanceScore.computed* (upsert), TIDAK PERNAH menyentuh
/// publishedStatus/publishedReasoning/overrideById — itu tetap murni keputusan staf lewat
/// endpoint /relevance yang sudah ada dan TIDAK berubah oleh route ini.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!checkRateLimit(`ai-suggest:${auth.email}`, 10)) {
    return apiError(429, "RATE_LIMITED", "Terlalu banyak permintaan bantuan AI — coba lagi dalam semenit.");
  }

  const { id } = await params;

  try {
    const paper = await prisma.paper.findUnique({
      where: { id },
      include: {
        citationStats: true,
        relationsOld: {
          where: { status: "approved", relationType: "superseded_by" },
          include: { new: { select: { title: true } } },
        },
      },
    });
    if (!paper) return notFound("Paper tidak ditemukan.");

    const prompt = buildRelevanceSuggestPrompt({
      title: paper.title,
      publishedDate: paper.publishedDate,
      citationCountTotal: paper.citationStats?.citationCountTotal ?? 0,
      fwci: paper.citationStats?.fwci ?? null,
      retractionStatus: paper.citationStats?.retractionStatus ?? "none",
      supersededByTitles: paper.relationsOld.map((r) => r.new.title),
    });

    const llm = await LLMClient.fromSettings();
    const result = await llm.generateJson(prompt);
    if (!result) {
      return apiError(502, "LLM_UNAVAILABLE", "Gagal mendapat respons dari AI (semua provider gagal), coba lagi nanti.");
    }

    const parsed = relevanceSuggestionSchema.safeParse(result);
    if (!parsed.success) {
      return apiError(502, "LLM_BAD_RESPONSE", "Respons AI tidak sesuai format yang diharapkan.");
    }

    const { computedStatus, computedScore, computedReasoning } = parsed.data;
    await prisma.relevanceScore.upsert({
      where: { paperId: id },
      create: { paperId: id, computedStatus, computedScore: computedScore ?? null, computedReasoning },
      update: { computedStatus, computedScore: computedScore ?? null, computedReasoning },
    });

    return ok({ computedStatus, computedScore: computedScore ?? null, computedReasoning });
  } catch (error) {
    return internalError(error);
  }
}
