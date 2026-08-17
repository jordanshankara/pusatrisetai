/**
 * Prompt & validator ringkasan — diekstrak dari scripts/backfill-content.ts (Bagian B.2-B.4)
 * supaya bisa dipakai juga oleh src/app/api/admin/papers/[id]/summary/generate/route.ts
 * (draft ringkasan AI on-demand per paper dari halaman admin).
 *
 * CATATAN PENTING: modul ini HANYA menyediakan prompt + validator (kode, bukan LLM). Keputusan
 * "publish otomatis atau tetap draft" TIDAK ada di sini secara sengaja — script CLI dan route
 * admin punya kebijakan berbeda (lihat masing-masing pemanggil).
 */

export function buildSummaryPrompt(input: {
  title: string;
  abstract: string;
  subfield: string;
  venue: string;
  origin: string;
  sectorHint: string;
}): string {
  return `Anda adalah editor sains yang menerjemahkan paper riset kecerdasan buatan (AI)
ke dalam Bahasa Indonesia yang mengalir, jelas, dan jujur terhadap sumber — untuk
pembaca umum yang cerdas: pembuat kebijakan, jurnalis, mahasiswa, praktisi.

ATURAN MUTLAK:
1. HANYA gunakan informasi yang ADA di judul dan abstrak yang diberikan.
   JANGAN mengarang angka, metode, atau klaim yang tidak tertulis di abstrak.
2. Kalau abstrak tidak menyebut angka hasil, JANGAN membuat angka. Tulis kualitatif saja.
3. Bedakan "penulis melaporkan/mengklaim" dari "penelitian ini membuktikan" —
   gunakan bahasa yang tidak berlebihan (hedged), sesuai norma penulisan ilmiah.
4. Bagian relevansi untuk Indonesia harus JUJUR — kalau tidak ada kaitan jelas, katakan begitu.
   JANGAN memaksakan narasi relevansi yang tidak berdasar.
5. Bahasa Indonesia sehari-hari yang mengalir, BUKAN terjemahan literal kaku.
   Istilah teknis baku (neural network, transformer, dst) boleh tetap Inggris.

Tulis SATU teks ringkasan mengalir (bukan beberapa kotak terpisah), yang di dalamnya
tetap mencakup, dengan urutan alami sebagai paragraf-paragraf berurutan (pisahkan tiap
paragraf dengan baris kosong):
1. (4-6 kalimat) Riset ini tentang apa dengan bahasa sehari-hari, masalah apa yang
   dipecahkan dan kenapa penting, bagaimana cara mereka mengatasinya (disederhanakan,
   tanpa istilah matematis), apa yang mereka temukan (sebutkan angka HANYA jika ada
   di abstrak).
2. (5-8 kalimat, boleh lebih teknis) Konteks riset & gap yang diisi (kalau disebut),
   metode/pendekatan teknis (arsitektur, dataset, metrik SESUAI abstrak), hasil
   eksperimen dengan angka SPESIFIK dari abstrak (kalau ada), keterbatasan/catatan
   penting (kalau disebut).
3. (3-5 kalimat, BUKAN template kosong) Relevansi untuk Indonesia: ${input.sectorHint}

INPUT:
Judul: ${input.title}
Abstrak: ${input.abstract}
Topik/subbidang: ${input.subfield}
Venue: ${input.venue}
Asal (Indonesia/internasional): ${input.origin}

OUTPUT (JSON, tanpa markdown, tanpa teks lain di luar JSON):
{
  "summaryContent": "paragraf 1\\n\\nparagraf 2\\n\\nparagraf 3, sesuai struktur di atas...",
  "extractedNumbers": ["daftar semua angka/persentase yang disebut di ringkasan, untuk verifikasi"]
}

Jika abstrak yang diberikan kosong atau kurang dari 50 kata, kembalikan:
{"error": "abstract_too_thin"}`;
}

export function sectorHint(origin: string, policyTagLabels: string[]): string {
  if (origin === "local") {
    const sectors = policyTagLabels.length > 0 ? policyTagLabels.join(", ") : null;
    return sectors
      ? `Paper ini dari Indonesia — jelaskan relevansinya untuk konteks nasional secara konkret, kaitkan ke sektor: ${sectors}. Kenapa penting untuk Indonesia SPESIFIK (bukan generik "AI penting untuk Indonesia").`
      : `Paper ini dari Indonesia — jelaskan relevansinya untuk konteks nasional secara konkret (sektor kesehatan/pertanian/birokrasi/pendidikan/dst yang paling relevan dari isi abstrak). Kenapa penting untuk Indonesia SPESIFIK, bukan generik.`;
  }
  return `Paper ini internasional — jelaskan APAKAH dan BAGAIMANA metodenya bisa relevan diterapkan/dipelajari untuk konteks Indonesia. Kalau memang tidak ada kaitan jelas, tulis jujur: "Riset ini bersifat fundamental/global dan tidak memiliki kaitan sektor spesifik dengan Indonesia saat ini, namun metodenya berpotensi diadaptasi untuk [alasan singkat]." JANGAN memaksakan relevansi yang mengada-ada.`;
}

/// Bungkus teks ringkasan AI (plain text, paragraf dipisah baris kosong) jadi HTML paragraf
/// sederhana untuk mengisi RichTextEditor — escape dulu supaya teks dari LLM (yang menyerap
/// abstrak eksternal, sumber tidak sepenuhnya terpercaya) tidak bisa menyuntik markup.
export function plainTextToParagraphHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(p)}</p>`)
    .join("");
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/// Ambil token angka (termasuk desimal/persen) dari sebuah teks, dinormalisasi (tanpa
/// pemisah ribuan, titik sebagai desimal) supaya bisa dibandingkan apa adanya.
function extractNormalizedNumbers(text: string): Set<string> {
  const matches = text.match(/\d[\d.,]*\d|\d/g) ?? [];
  const out = new Set<string>();
  for (const m of matches) {
    const normalized = m.replace(/,(?=\d{3}(\D|$))/g, "").replace(/,/g, ".");
    out.add(normalized);
  }
  return out;
}

/// B.4: cek tiap angka yang diklaim LLM (extractedNumbers) ada di abstrak asli.
/// Return daftar angka yang TIDAK ditemukan (kosong = semua angka valid).
export function findUnverifiedNumbers(extractedNumbers: unknown, abstractRaw: string): string[] {
  if (!Array.isArray(extractedNumbers)) return [];
  const abstractNumbers = extractNormalizedNumbers(abstractRaw);
  const unverified: string[] = [];
  for (const claim of extractedNumbers) {
    if (typeof claim !== "string") continue;
    const claimNumbers = extractNormalizedNumbers(claim);
    if (claimNumbers.size === 0) continue; // bukan klaim numerik (mis. teks non-angka nyasar)
    for (const n of claimNumbers) {
      if (!abstractNumbers.has(n)) unverified.push(`${claim} (angka "${n}" tidak ditemukan di abstrak)`);
    }
  }
  return unverified;
}

/// Validasi kelengkapan/kewarasan teks (BUKAN dari B.4, tapi gerbang tambahan yang sama
/// pentingnya — ditemukan saat spot-check manual): beberapa model (khususnya fallback
/// OpenRouter) kadang memotong respons di tengah kata/kalimat meski JSON-nya tetap "valid"
/// secara sintaks (provider menutup paksa string yang belum selesai), atau menyelipkan
/// karakter dari skrip lain (mis. Han/Cyrillic) di tengah teks Indonesia. Kode, bukan LLM.
const NON_LATIN_SCRIPT = /[一-鿿぀-ヿ가-힯Ѐ-ӿ؀-ۿ]/;
function endsCleanly(text: string): boolean {
  return /[.!?)”"'）]\s*$/.test(text.trim());
}
export function findIncompletenessIssues(fields: { label: string; text: string }[]): string[] {
  const issues: string[] = [];
  for (const { label, text } of fields) {
    if (text.trim().length < 20) issues.push(`${label} terlalu pendek/kosong`);
    else if (!endsCleanly(text)) issues.push(`${label} tampak terpotong (tidak diakhiri tanda baca): "...${text.trim().slice(-30)}"`);
    if (NON_LATIN_SCRIPT.test(text)) issues.push(`${label} mengandung karakter non-Latin mencurigakan (kemungkinan glitch model)`);
  }
  return issues;
}
