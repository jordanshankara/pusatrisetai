/**
 * BAGIAN B.2-B.4 (BRIEF Round 2) — script opsional, dijalankan manual:
 *   `npx tsx scripts/backfill-content.ts [--limit N]`
 *
 * Mengisi ringkasan (summaryLayperson, summaryTechnical, relevanceIndonesia) untuk semua
 * paper yang BELUM punya summary published berbahasa Indonesia, pakai LLMClient
 * (scripts/lib/llm-client.ts) — Gemini API dicoba dulu, fallback ke model gratis OpenRouter
 * kalau kuota Gemini habis.
 *
 * B.0 — pengecualian sadar KHUSUS demo ini: hasil di-publish LANGSUNG (status='published'),
 * TAPI sourceType SELALU 'ai_draft' (bukan 'ai_reviewed') supaya jujur secara data bahwa ini
 * belum direview editor manusia sungguhan, meski status tampil published. Alur produksi normal
 * (draft -> antre admin -> approve) TIDAK dihapus/diubah — cukup dilompati untuk run ini.
 *
 * B.4 — validasi WAJIB sebelum publish (kode, bukan LLM): (1) setiap angka yang diklaim LLM
 * di `extractedNumbers` dicek balik ke abstrak asli; (2) ditemukan saat spot-check manual —
 * teks juga dicek tidak terpotong di tengah kalimat/kata (beberapa model, terutama fallback
 * OpenRouter, kadang memotong respons meski JSON-nya tetap valid secara sintaks) dan tidak
 * mengandung karakter skrip lain yang nyasar (mis. Han/Cyrillic). Kalau ada SATU SAJA masalah
 * -> TIDAK di-publish (status tetap 'draft'), dicatat ke docs/backfill-flagged.csv untuk
 * direview manusia. Script TIDAK PERNAH memutuskan sendiri bahwa itu "aman".
 *
 * Resume-safe: paper yang sudah punya summary language='id' sourceType='ai_draft' (published
 * ATAU flagged-draft dari run sebelumnya) di-skip — jalankan ulang tidak akan memproses ulang
 * atau menduplikasi baris.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { LLMClient } from "./lib/llm-client";
import { POLICY_TAG_LABELS } from "../src/lib/policy-tags";

const prisma = new PrismaClient();

const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : undefined;

const SYSTEM_PROMPT_TEMPLATE = (input: {
  title: string;
  abstract: string;
  subfield: string;
  venue: string;
  origin: string;
  sectorHint: string;
}) => `Anda adalah editor sains yang menerjemahkan paper riset kecerdasan buatan (AI)
ke dalam Bahasa Indonesia yang mengalir, jelas, dan jujur terhadap sumber — untuk
pembaca umum yang cerdas: pembuat kebijakan, jurnalis, mahasiswa, praktisi.

ATURAN MUTLAK:
1. HANYA gunakan informasi yang ADA di judul dan abstrak yang diberikan.
   JANGAN mengarang angka, metode, atau klaim yang tidak tertulis di abstrak.
2. Kalau abstrak tidak menyebut angka hasil, JANGAN membuat angka. Tulis kualitatif saja.
3. Bedakan "penulis melaporkan/mengklaim" dari "penelitian ini membuktikan" —
   gunakan bahasa yang tidak berlebihan (hedged), sesuai norma penulisan ilmiah.
4. relevanceIndonesia harus JUJUR — kalau tidak ada kaitan jelas, katakan begitu.
   JANGAN memaksakan narasi relevansi yang tidak berdasar.
5. Bahasa Indonesia sehari-hari yang mengalir, BUKAN terjemahan literal kaku.
   Istilah teknis baku (neural network, transformer, dst) boleh tetap Inggris.

STRUKTUR WAJIB:
- summaryLayperson (4-6 kalimat, boleh 2 paragraf pendek): (1) riset ini tentang apa dengan
  bahasa sehari-hari, (2) masalah apa yang dipecahkan dan kenapa penting, (3) bagaimana cara
  mereka mengatasinya (disederhanakan, tanpa istilah matematis), (4) apa yang mereka temukan
  (sebutkan angka HANYA jika ada di abstrak), (5-6 opsional) implikasi praktisnya.
- summaryTechnical (5-8 kalimat): (1) konteks riset & gap yang diisi (kalau disebut), (2)
  metode/pendekatan teknis (arsitektur, dataset, metrik SESUAI abstrak), (3) hasil eksperimen
  dengan angka SPESIFIK dari abstrak (kalau ada), (4) keterbatasan/catatan penting (kalau
  disebut), (5) kesimpulan teknis singkat.
- relevanceIndonesia (3-5 kalimat, BUKAN template kosong): ${input.sectorHint}

INPUT:
Judul: ${input.title}
Abstrak: ${input.abstract}
Topik/subbidang: ${input.subfield}
Venue: ${input.venue}
Asal (Indonesia/internasional): ${input.origin}

OUTPUT (JSON, tanpa markdown, tanpa teks lain di luar JSON):
{
  "summaryLayperson": "4-6 kalimat sesuai struktur di atas...",
  "summaryTechnical": "5-8 kalimat sesuai struktur di atas...",
  "relevanceIndonesia": "3-5 kalimat, jujur, tidak mengada-ada...",
  "extractedNumbers": ["daftar semua angka/persentase yang disebut di ringkasan, untuk verifikasi"]
}

Jika abstrak yang diberikan kosong atau kurang dari 50 kata, kembalikan:
{"error": "abstract_too_thin"}`;

function sectorHint(origin: string, policyTagLabels: string[]): string {
  if (origin === "local") {
    const sectors = policyTagLabels.length > 0 ? policyTagLabels.join(", ") : null;
    return sectors
      ? `Paper ini dari Indonesia — jelaskan relevansinya untuk konteks nasional secara konkret, kaitkan ke sektor: ${sectors}. Kenapa penting untuk Indonesia SPESIFIK (bukan generik "AI penting untuk Indonesia").`
      : `Paper ini dari Indonesia — jelaskan relevansinya untuk konteks nasional secara konkret (sektor kesehatan/pertanian/birokrasi/pendidikan/dst yang paling relevan dari isi abstrak). Kenapa penting untuk Indonesia SPESIFIK, bukan generik.`;
  }
  return `Paper ini internasional — jelaskan APAKAH dan BAGAIMANA metodenya bisa relevan diterapkan/dipelajari untuk konteks Indonesia. Kalau memang tidak ada kaitan jelas, tulis jujur: "Riset ini bersifat fundamental/global dan tidak memiliki kaitan sektor spesifik dengan Indonesia saat ini, namun metodenya berpotensi diadaptasi untuk [alasan singkat]." JANGAN memaksakan relevansi yang mengada-ada.`;
}

function wordCount(text: string): number {
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
function findUnverifiedNumbers(extractedNumbers: unknown, abstractRaw: string): string[] {
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
/// karakter dari skrip lain (mis. Han/Cyrillic) di tengah teks Indonesia. Kode, bukan LLM —
/// sama seperti B.4, jangan biarkan publish otomatis kalau ada tanda-tanda ini.
const NON_LATIN_SCRIPT = /[一-鿿぀-ヿ가-힯Ѐ-ӿ؀-ۿ]/;
function endsCleanly(text: string): boolean {
  return /[.!?)”"'）]\s*$/.test(text.trim());
}
function findIncompletenessIssues(fields: { label: string; text: string }[]): string[] {
  const issues: string[] = [];
  for (const { label, text } of fields) {
    if (text.trim().length < 20) issues.push(`${label} terlalu pendek/kosong`);
    else if (!endsCleanly(text)) issues.push(`${label} tampak terpotong (tidak diakhiri tanda baca): "...${text.trim().slice(-30)}"`);
    if (NON_LATIN_SCRIPT.test(text)) issues.push(`${label} mengandung karakter non-Latin mencurigakan (kemungkinan glitch model)`);
  }
  return issues;
}

interface FlaggedRow {
  paperId: string;
  title: string;
  issues: string;
}

async function main() {
  const llm = new LLMClient();

  const candidates = await prisma.paper.findMany({
    where: {
      abstractRaw: { not: null },
      summaries: { none: { language: "id", sourceType: "ai_draft" } },
    },
    include: {
      topics: { where: { isPrimary: true }, take: 1 },
      policyTags: { include: { tag: true } },
    },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  console.log(`Ditemukan ${candidates.length} paper tanpa summary published (bahasa Indonesia). Mulai backfill...`);
  if (LIMIT) console.log(`(dibatasi --limit ${LIMIT} untuk uji coba)`);

  let published = 0;
  let flagged = 0;
  let skippedThin = 0;
  let errored = 0;
  const flaggedRows: FlaggedRow[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const paper = candidates[i];
    const abstract = paper.abstractRaw ?? "";

    if (wordCount(abstract) < 50) {
      skippedThin++;
      continue;
    }

    const policyTagLabels = paper.policyTags.map((pt) => POLICY_TAG_LABELS[pt.tag.slug] ?? pt.tag.slug);
    const prompt = SYSTEM_PROMPT_TEMPLATE({
      title: paper.title,
      abstract,
      subfield: paper.topics[0]?.subfield ?? paper.topics[0]?.field ?? "tidak diketahui",
      venue: paper.venueNameRaw ?? "tidak diketahui",
      origin: paper.origin === "local" ? "Indonesia" : "Internasional",
      sectorHint: sectorHint(paper.origin, policyTagLabels),
    });

    const result = await llm.generateJson(prompt);

    if (!result) {
      errored++;
      console.error(`  [skip] ${paper.id} "${paper.title.slice(0, 60)}" — gagal total (network/timeout/semua key habis).`);
      continue;
    }

    if (result.error === "abstract_too_thin") {
      skippedThin++;
      continue;
    }

    const { summaryLayperson, summaryTechnical, relevanceIndonesia, extractedNumbers } = result as Record<string, unknown>;
    if (typeof summaryLayperson !== "string" || typeof summaryTechnical !== "string" || typeof relevanceIndonesia !== "string") {
      errored++;
      console.error(`  [skip] ${paper.id} "${paper.title.slice(0, 60)}" — respons JSON tidak lengkap, dilewati.`);
      continue;
    }

    const unverified = findUnverifiedNumbers(extractedNumbers, abstract);
    const incompleteness = findIncompletenessIssues([
      { label: "summaryLayperson", text: summaryLayperson },
      { label: "summaryTechnical", text: summaryTechnical },
      { label: "relevanceIndonesia", text: relevanceIndonesia },
    ]);
    const allIssues = [...unverified, ...incompleteness];
    const isValid = allIssues.length === 0;

    await prisma.summary.create({
      data: {
        paperId: paper.id,
        language: "id",
        summaryLayperson,
        summaryTechnical,
        relevanceIndonesia,
        sourceType: "ai_draft", // B.0: BUKAN ai_reviewed — belum direview editor manusia
        provenance: "from_abstract",
        status: isValid ? "published" : "draft", // B.4: TIDAK publish otomatis kalau ada angka mencurigakan
        authoredById: null,
      },
    });

    if (isValid) {
      published++;
    } else {
      flagged++;
      flaggedRows.push({ paperId: paper.id, title: paper.title, issues: allIssues.join("; ") });
      console.warn(`  [flag] ${paper.id} "${paper.title.slice(0, 60)}" — ${allIssues.length} isu (angka tak terverifikasi/teks terpotong/dll), TIDAK di-publish.`);
    }

    if ((i + 1) % 10 === 0 || i === candidates.length - 1) {
      console.log(`[${i + 1}/${candidates.length}] processed, ${flagged} flagged, ${skippedThin + errored} skipped (model: ${llm.modelInUse})`);
    }
  }

  mkdirSync("docs", { recursive: true });

  const csvLines = ["paperId,title,issues", ...flaggedRows.map((r) => `"${r.paperId}","${r.title.replace(/"/g, '""')}","${r.issues.replace(/"/g, '""')}"`)];
  writeFileSync("docs/backfill-flagged.csv", csvLines.join("\n") + "\n", "utf8");

  const report = `# Laporan Backfill Konten (Bagian B.2-B.4)

Dijalankan: ${new Date().toISOString()}
Provider/model terakhir dipakai: ${llm.modelInUse}

## Ringkasan
- Total paper dikandidatkan (belum punya summary ai_draft bahasa Indonesia): ${candidates.length}
- Published (lolos validasi angka B.4, langsung tayang — sourceType='ai_draft', B.0): ${published}
- Di-flag (ada angka tak terverifikasi, status TETAP draft, masuk backfill-flagged.csv): ${flagged}
- Dilewati (abstrak kosong/kurang dari 50 kata): ${skippedThin}
- Error (gagal total di SEMUA provider — network/timeout/kuota Gemini+OpenRouter habis): ${errored}

## Detail
Daftar paper yang di-flag ada di \`docs/backfill-flagged.csv\` (${flaggedRows.length} baris) — ini
yang perlu direview manusia sebelum diputuskan publish manual atau diedit.

## Catatan
- Semua summary hasil script ini memakai sourceType='ai_draft' (BUKAN 'ai_reviewed') sesuai
  pengecualian B.0 — status published TIDAK berarti sudah ditinjau editor sungguhan.
- Jalankan ulang script ini aman (resume-safe): paper yang sudah punya summary ai_draft
  bahasa Indonesia (published atau ter-flag) tidak diproses ulang.
`;
  writeFileSync("docs/backfill-report.md", report, "utf8");

  console.log("\n=== SELESAI ===");
  console.log(`Published: ${published} | Flagged: ${flagged} | Skipped (tipis): ${skippedThin} | Error: ${errored}`);
  console.log("Laporan: docs/backfill-report.md");
  console.log("Daftar flagged: docs/backfill-flagged.csv");
}

main()
  .catch((error) => {
    console.error("Backfill konten gagal total:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
