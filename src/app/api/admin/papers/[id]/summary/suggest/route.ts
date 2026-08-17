import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, apiError, internalError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { LLMClient } from "@/lib/services/llm-client";
import { POLICY_TAG_LABELS } from "@/lib/policy-tags";
import { buildSummaryPrompt, sectorHint, wordCount, findUnverifiedNumbers, findIncompletenessIssues, plainTextToParagraphHtml } from "@/lib/llm/summary-prompt";

/// Draf ringkasan AI — STATELESS, TIDAK menulis apa pun ke DB (beda dari versi lama route ini
/// yang menulis Summary "draft" ke antrean). Sesuai arahan: staf mengisi ringkasan secara
/// MANUAL (lihat POST /api/admin/papers/[id]/summary), AI cuma alat bantu mengisi teks awal
/// yang staf tinjau/edit dulu di form sebelum menekan "Simpan & Terbitkan" — bukan alur
/// klik-generate-lalu-antre-review terpisah. Pola respons identik dengan
/// relevance/suggest/route.ts (mengembalikan saran, bukan menyimpan).
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
        topics: { where: { isPrimary: true }, take: 1 },
        policyTags: { include: { tag: true } },
      },
    });
    if (!paper) return notFound("Paper tidak ditemukan.");

    const abstract = paper.abstractRaw ?? "";
    if (wordCount(abstract) < 50) {
      return badRequest("Abstrak paper ini kosong atau terlalu pendek (<50 kata) untuk dibuatkan saran ringkasan.");
    }

    const policyTagLabels = paper.policyTags.map((pt) => POLICY_TAG_LABELS[pt.tag.slug] ?? pt.tag.slug);
    const prompt = buildSummaryPrompt({
      title: paper.title,
      abstract,
      subfield: paper.topics[0]?.subfield ?? paper.topics[0]?.field ?? "tidak diketahui",
      venue: paper.venueNameRaw ?? "tidak diketahui",
      origin: paper.origin === "local" ? "Indonesia" : "Internasional",
      sectorHint: sectorHint(paper.origin, policyTagLabels),
    });

    const llm = await LLMClient.fromSettings();
    const result = await llm.generateJson(prompt);
    if (!result) {
      return apiError(502, "LLM_UNAVAILABLE", "Gagal mendapat respons dari AI (semua provider gagal), coba lagi nanti.");
    }
    if (result.error === "abstract_too_thin") {
      return badRequest("Abstrak paper ini dinilai AI terlalu tipis untuk dibuatkan saran ringkasan.");
    }

    const { summaryContent, extractedNumbers } = result as Record<string, unknown>;
    if (typeof summaryContent !== "string") {
      return apiError(502, "LLM_BAD_RESPONSE", "Respons AI tidak lengkap/tidak sesuai format yang diharapkan.");
    }

    const issues = [...findUnverifiedNumbers(extractedNumbers, abstract), ...findIncompletenessIssues([{ label: "summaryContent", text: summaryContent }])];

    return ok({ content: plainTextToParagraphHtml(summaryContent), issues });
  } catch (error) {
    return internalError(error);
  }
}
