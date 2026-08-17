/**
 * BAGIAN B.2-B.4 (BRIEF Round 2) — script opsional, dijalankan manual:
 *   `npx tsx scripts/backfill-content.ts [--limit N]`
 *
 * Mengisi ringkasan (content — satu field rich-text) untuk semua
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
import { LLMClient } from "../src/lib/services/llm-client";
import { POLICY_TAG_LABELS } from "../src/lib/policy-tags";
import { buildSummaryPrompt, sectorHint, wordCount, findUnverifiedNumbers, findIncompletenessIssues, plainTextToParagraphHtml } from "../src/lib/llm/summary-prompt";

const prisma = new PrismaClient();

const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : undefined;

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
    const prompt = buildSummaryPrompt({
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

    const { summaryContent, extractedNumbers } = result as Record<string, unknown>;
    if (typeof summaryContent !== "string") {
      errored++;
      console.error(`  [skip] ${paper.id} "${paper.title.slice(0, 60)}" — respons JSON tidak lengkap, dilewati.`);
      continue;
    }

    const unverified = findUnverifiedNumbers(extractedNumbers, abstract);
    const incompleteness = findIncompletenessIssues([{ label: "summaryContent", text: summaryContent }]);
    const allIssues = [...unverified, ...incompleteness];
    const isValid = allIssues.length === 0;

    await prisma.summary.create({
      data: {
        paperId: paper.id,
        language: "id",
        content: plainTextToParagraphHtml(summaryContent),
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
