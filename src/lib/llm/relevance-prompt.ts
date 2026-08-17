import { z } from "zod";

/// Saran relevansi AI ("upload AI, tanya" — deteksi paper usang) — sengaja sesederhana
/// mungkin sesuai arahan: satu panggilan LLM, dibumbui data nyata yang sudah kita punya
/// (sitasi, relasi superseded yang sudah disetujui), staf yang meninjau hasilnya secara
/// manual sebelum jadi keputusan publik (lihat src/app/api/admin/papers/[id]/relevance/route.ts
/// yang TIDAK diubah oleh fitur ini).
export const relevanceSuggestionSchema = z.object({
  computedStatus: z.enum(["too_new_to_score", "still_relevant", "needs_update", "superseded", "retracted"]),
  computedScore: z.number().min(0).max(100).nullable().optional(),
  computedReasoning: z.string().min(1),
});

export type RelevanceSuggestion = z.infer<typeof relevanceSuggestionSchema>;

export function buildRelevanceSuggestPrompt(input: {
  title: string;
  publishedDate: Date | null;
  citationCountTotal: number;
  fwci: number | null;
  retractionStatus: string;
  supersededByTitles: string[];
}): string {
  const ageYears = input.publishedDate ? new Date().getFullYear() - input.publishedDate.getFullYear() : null;
  return `Anda menilai apakah sebuah paper riset AI masih relevan untuk ditampilkan sebagai rujukan
di sebuah katalog riset publik, HANYA berdasarkan data yang diberikan — JANGAN menebak isi paper
yang tidak disebutkan di sini.

DATA PAPER:
- Judul: ${input.title}
- Umur paper: ${ageYears !== null ? `${ageYears} tahun` : "tidak diketahui"}
- Total sitasi tercatat: ${input.citationCountTotal}
- FWCI (field-weighted citation impact, native OpenAlex): ${input.fwci ?? "tidak tersedia"}
- Status retraksi: ${input.retractionStatus}
- Paper lain yang SUDAH ditandai staf sebagai penggantinya (superseded_by, kalau ada): ${
    input.supersededByTitles.length > 0 ? input.supersededByTitles.join("; ") : "tidak ada"
  }

ATURAN:
1. Kalau status retraksi bukan "none", computedStatus HARUS "retracted".
2. Kalau ada paper pengganti yang sudah ditandai staf, computedStatus HARUS "superseded".
3. Kalau umur paper tidak diketahui atau kurang dari 1 tahun DAN tidak ada sitasi, gunakan "too_new_to_score".
4. Selain itu, nilai dari kombinasi umur+sitasi+FWCI secara wajar: sitasi/FWCI tinggi relatif
   umurnya -> "still_relevant"; umur cukup tua dengan sitasi sangat sedikit relatif bidang AI
   yang bergerak cepat -> pertimbangkan "needs_update" (bukan otomatis usang, hanya sinyal).
5. JANGAN mengarang alasan di luar data yang diberikan. Kalau data terbatas, katakan itu di
   computedReasoning.

OUTPUT (JSON, tanpa markdown, tanpa teks lain):
{"computedStatus": "too_new_to_score|still_relevant|needs_update|superseded|retracted", "computedScore": <0-100 atau null kalau tidak bisa dinilai>, "computedReasoning": "2-3 kalimat Bahasa Indonesia, jujur, berbasis data di atas"}`;
}
