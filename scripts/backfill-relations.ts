/**
 * BAGIAN B.5 (BRIEF Round 2) — script opsional, dijalankan manual SETELAH
 * scripts/backfill-content.ts selesai (B.6: urutan wajib, jangan berbarengan — paper yang
 * gagal/error di tahap ringkasan tidak boleh ikut jadi kandidat relasi di sini):
 *   `npx tsx scripts/backfill-relations.ts [--limit N]`
 *
 * Versi ringan (BUKAN pipeline embedding+pgvector produksi, sesuai B.5): kandidat diambil dari
 * overlap subbidang (paper_topics) lalu di-ranking pakai overlap kata kunci judul sederhana,
 * top-5 dikirim ke SATU panggilan LLM per paper utama (hemat biaya — bukan per pasangan) untuk
 * diputuskan verdict-nya.
 *
 * B.0 — pengecualian sadar KHUSUS demo ini: relasi langsung status='approved' (bukan
 * 'suggested' seperti alur produksi normal). Gerbang editorial normal (suggested -> antre
 * admin -> approve) TIDAK dihapus, cukup dilompati untuk run demo ini.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { LLMClient } from "../src/lib/services/llm-client";

const prisma = new PrismaClient();

const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : undefined;

const STOPWORDS = new Set([
  // Indonesia
  "dan", "di", "ke", "dari", "untuk", "pada", "dengan", "yang", "ini", "itu", "atau", "dalam",
  "sebagai", "adalah", "akan", "telah", "dapat", "tidak", "juga", "oleh", "secara", "terhadap",
  "antara", "suatu", "para", "kami", "kita", "studi", "analisis", "penelitian", "berbasis",
  // English
  "the", "a", "an", "of", "for", "and", "in", "on", "to", "with", "using", "based", "via",
  "towards", "through", "from", "into", "by", "is", "are", "be", "this", "that", "its", "study",
  "analysis", "approach", "model", "models",
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

interface PoolPaper {
  id: string;
  title: string;
  publishedDate: Date | null;
  abstractRaw: string | null;
  origin: string;
  subfields: string[];
}

function shortAbstract(text: string | null, max = 400): string {
  if (!text) return "(tidak tersedia)";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const VERDICT_PROMPT = (main: PoolPaper, candidates: PoolPaper[]) => `Berikut satu paper utama dan ${candidates.length} paper kandidat yang bertopik serupa.
Untuk MASING-MASING kandidat, tentukan salah satu:
- "related": topik serupa, sama-sama relevan dibaca bersamaan, TAPI bukan
  saling menggantikan
- "successor": kandidat ini adalah versi lebih baru yang menyelesaikan
  masalah yang sama dengan pendekatan lebih maju (HANYA jika benar-benar
  jelas dari abstrak, jangan menebak)
- "none": tidak cukup terkait untuk direkomendasikan

Jangan tandai "successor" hanya karena topik sama — topik NLP Bahasa Indonesia
dan NLP Bahasa Inggris BUKAN saling menggantikan meski temanya mirip.

Paper utama: "${main.title}" (${main.publishedDate?.getFullYear() ?? "tahun tidak diketahui"})
Abstrak singkat: ${shortAbstract(main.abstractRaw)}

${candidates.map((c, i) => `Kandidat ${i}: "${c.title}" (${c.publishedDate?.getFullYear() ?? "tahun tidak diketahui"})\nAbstrak singkat: ${shortAbstract(c.abstractRaw)}`).join("\n\n")}

Output JSON (array, tanpa markdown, tanpa teks lain di luar JSON):
{"verdicts": [{"candidateIndex": 0, "verdict": "related|successor|none", "reasoning": "1 kalimat alasan singkat, Bahasa Indonesia"}, ...]}
Kalau tidak ada kandidat yang cukup terkait, kembalikan array verdicts kosong — itu hasil valid,
JANGAN dipaksa ada isinya.`;

async function relationAlreadyExists(paperIdA: string, paperIdB: string, relationType: string): Promise<boolean> {
  const existing = await prisma.paperRelation.findFirst({
    where: {
      relationType: relationType as never,
      OR: [
        { paperIdOld: paperIdA, paperIdNew: paperIdB },
        { paperIdOld: paperIdB, paperIdNew: paperIdA },
      ],
    },
  });
  return existing !== null;
}

async function main() {
  const llm = new LLMClient();

  const rows = await prisma.paper.findMany({
    where: {
      abstractRaw: { not: null },
      summaries: { some: { language: "id" } }, // B.6.2: hanya paper yg lolos tahap ringkasan (punya summary, published maupun ter-flag draft)
    },
    include: { topics: true },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  const pool: PoolPaper[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    publishedDate: p.publishedDate,
    abstractRaw: p.abstractRaw,
    origin: p.origin,
    subfields: p.topics.map((t) => (t.subfield ?? t.field ?? "").toLowerCase().trim()).filter(Boolean),
  }));

  console.log(`Pool kandidat relasi: ${pool.length} paper (punya summary, siap dipasangkan).`);
  if (LIMIT) console.log(`(dibatasi --limit ${LIMIT} untuk uji coba)`);

  let processed = 0;
  let noCandidates = 0;
  let errored = 0;
  const relationCounts: Record<string, number> = { related_semantic: 0, superseded_by: 0 };

  for (let i = 0; i < pool.length; i++) {
    const main = pool[i];
    const mainTokens = titleTokens(main.title);

    const candidates = pool
      .filter((p) => p.id !== main.id && p.subfields.some((s) => main.subfields.includes(s)))
      .map((p) => ({ paper: p, score: overlapScore(mainTokens, titleTokens(p.title)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.paper);

    if (candidates.length === 0) {
      noCandidates++;
      processed++;
      continue;
    }

    const result = await llm.generateJson(VERDICT_PROMPT(main, candidates));
    if (!result || !Array.isArray(result.verdicts)) {
      errored++;
      console.error(`  [skip] ${main.id} "${main.title.slice(0, 60)}" — gagal total atau respons tidak valid.`);
      processed++;
      continue;
    }

    for (const v of result.verdicts as Array<{ candidateIndex?: number; verdict?: string; reasoning?: string }>) {
      if (typeof v.candidateIndex !== "number" || !candidates[v.candidateIndex]) continue;
      if (v.verdict !== "related" && v.verdict !== "successor") continue; // "none" -> tidak disimpan

      const candidate = candidates[v.candidateIndex];
      const relationType = v.verdict === "successor" ? "superseded_by" : "related_semantic";

      if (await relationAlreadyExists(main.id, candidate.id, relationType)) continue;

      try {
        await prisma.paperRelation.create({
          data: {
            paperIdOld: main.id, // successor: main = versi lama, candidate = penggantinya
            paperIdNew: candidate.id,
            relationType: relationType as never,
            reasoningText: v.reasoning ?? null,
            status: "approved", // B.0: pengecualian demo, produksi harus 'suggested'
          },
        });
        relationCounts[relationType] = (relationCounts[relationType] ?? 0) + 1;
      } catch (error) {
        console.error(`  [skip] gagal simpan relasi ${main.id}->${candidate.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    processed++;
    if (processed % 10 === 0 || processed === pool.length) {
      const totalRelations = Object.values(relationCounts).reduce((a, b) => a + b, 0);
      console.log(`[${processed}/${pool.length}] processed, ${totalRelations} relasi tersimpan, ${errored} error (model: ${llm.modelInUse})`);
    }
  }

  const totalRelations = Object.values(relationCounts).reduce((a, b) => a + b, 0);
  const section = `## Bagian B.5 — Keterkaitan Antar Paper

Dijalankan: ${new Date().toISOString()}
Provider/model terakhir dipakai: ${llm.modelInUse}

- Pool paper diproses (punya summary, layak jadi kandidat): ${pool.length}
- Paper tanpa kandidat sesubbidang (dilewati, tidak ada panggilan LLM): ${noCandidates}
- Error (gagal total di semua provider): ${errored}
- Total relasi tersimpan: ${totalRelations}
  - related_semantic ("Riset Serupa"): ${relationCounts.related_semantic ?? 0}
  - superseded_by ("Riset Penerus"): ${relationCounts.superseded_by ?? 0}

Semua relasi hasil script ini langsung status='approved' sesuai pengecualian demo B.0 —
produksi normal harus lewat antrean admin ('suggested' -> approve).
`;

  const reportPath = "docs/backfill-report.md";
  const existingReport = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
  const withoutOldB5 = existingReport.replace(/## Bagian B\.5[\s\S]*$/, "").trimEnd();
  writeFileSync(reportPath, `${withoutOldB5 ? withoutOldB5 + "\n\n" : ""}${section}`, "utf8");

  console.log("\n=== SELESAI ===");
  console.log(`Total relasi: ${totalRelations} (related_semantic: ${relationCounts.related_semantic ?? 0}, superseded_by: ${relationCounts.superseded_by ?? 0})`);
  console.log(`Laporan ditambahkan ke: ${reportPath}`);
}

main()
  .catch((error) => {
    console.error("Backfill relasi gagal total:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
