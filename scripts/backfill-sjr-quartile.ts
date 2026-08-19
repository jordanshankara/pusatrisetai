/**
 * Backfill kuartil SJR untuk paper yang belum dicek (issn_l dan/atau sjr_quartile masih NULL).
 * Idempotent — aman dijalankan berkali-kali, cuma proses baris yang belum selesai. Dipakai
 * ulang tiap kali ada batch paper baru masuk (mis. habis fetch OpenAlex) yang belum tersentuh
 * quartile check.
 *
 * Alur:
 * 1. Backfill issn_l yang masih kosong lewat OpenAlex (batch 50 id).
 * 2. Paper yang TETAP tidak punya issn_l -> langsung unindexed (hemat kuota Elsevier).
 * 3. Distribusi SJR Computer Science dari Elsevier (cache lokal, refresh kalau > 7 hari).
 * 4. Dedup ISSN unik di antara paper sjr_quartile masih NULL -> 1 panggilan Elsevier per ISSN,
 *    updateMany ke semua paper dengan issn_l itu sekaligus.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { fetchComputerScienceSjrDistribution, lookupSjrScore, bucketQuartile } from "@/lib/services/sjr-quartile";

const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO ?? "dev@pusatriset.ai";
const DIST_CACHE_PATH = path.join(process.cwd(), "docs", ".sjr-distribution-cache.json");
const DIST_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getDistribution(): Promise<number[]> {
  if (fs.existsSync(DIST_CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(DIST_CACHE_PATH, "utf-8"));
    if (Date.now() - cached.fetchedAt < DIST_CACHE_MAX_AGE_MS) {
      console.log(`✓ Pakai cache distribusi SJR (${cached.scores.length} jurnal, diambil ${new Date(cached.fetchedAt).toISOString()})`);
      return cached.scores;
    }
  }
  console.log("⬇ Mengambil distribusi SJR kategori Computer Science dari Elsevier...");
  const scores = await fetchComputerScienceSjrDistribution();
  fs.mkdirSync(path.dirname(DIST_CACHE_PATH), { recursive: true });
  fs.writeFileSync(DIST_CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), scores }));
  console.log(`✓ Distribusi diambil: ${scores.length} jurnal.`);
  return scores;
}

async function backfillIssn() {
  console.log("\n=== Tahap 1: backfill issn_l dari OpenAlex utk paper yang belum dicek ===");
  let processed = 0;
  let filled = 0;
  while (true) {
    const batch = await prisma.paper.findMany({
      where: { issnL: null, sjrQuartile: null, identifiers: { some: { idType: "openalex_id" } } },
      take: 50,
      select: { id: true, identifiers: { where: { idType: "openalex_id" }, select: { idValue: true } } },
    });
    if (batch.length === 0) break;

    const idMap = new Map(batch.map((p) => [p.identifiers[0].idValue, p.id]));
    const idsParam = Array.from(idMap.keys()).map((id) => id.replace("https://openalex.org/", "")).join("|");
    const url = `https://api.openalex.org/works?filter=ids.openalex:${idsParam}&per-page=50&mailto=${encodeURIComponent(OPENALEX_MAILTO)}&select=id,primary_location`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const foundIds = new Set<string>();
      for (const work of data.results ?? []) {
        const paperId = idMap.get(work.id);
        if (!paperId) continue;
        foundIds.add(work.id);
        const issnL = work.primary_location?.source?.issn_l ?? null;
        await prisma.paper.update({ where: { id: paperId }, data: { issnL } });
        if (issnL) filled++;
      }
      // Mark papers yang tidak ditemukan di OpenAlex dengan issn_l="" supaya tidak di-retry lagi
      for (const [oaId, paperId] of idMap) {
        if (!foundIds.has(oaId)) {
          await prisma.paper.update({ where: { id: paperId }, data: { issnL: "" } });
        }
      }
    } catch (error) {
      console.log(`  [gagal batch] ${error instanceof Error ? error.message : error} — skip batch, retry di run berikutnya (idempotent)`);
    }

    processed += batch.length;
    if (processed % 500 === 0) console.log(`  [${processed}] diproses — ${filled} dapat issn_l`);
    await sleep(300);
  }
  console.log(`✓ Selesai tahap 1: ${processed} diproses, ${filled} dapat issn_l.`);
}

async function markUnindexedWithoutIssn() {
  const result = await prisma.paper.updateMany({
    where: { sjrQuartile: null, OR: [{ issnL: null }, { issnL: "" }] },
    data: { sjrQuartile: "unindexed" },
  });
  console.log(`\n=== Tahap 2: ${result.count} paper tanpa ISSN -> unindexed langsung ===`);
}

async function resolveQuartilesForDistinctIssns(distribution: number[]) {
  console.log("\n=== Tahap 3: resolve kuartil per ISSN unik (dedup) ===");
  const rows = await prisma.paper.findMany({
    where: { sjrQuartile: null, issnL: { not: null } },
    select: { issnL: true },
    distinct: ["issnL"],
  });
  const distinctIssns = rows.map((r) => r.issnL!).filter(Boolean);
  console.log(`ISSN unik yang perlu di-resolve: ${distinctIssns.length}`);

  let done = 0, succeeded = 0;
  for (const issn of distinctIssns) {
    try {
      const latest = await lookupSjrScore(issn);
      if (!latest) {
        await prisma.paper.updateMany({ where: { issnL: issn, sjrQuartile: null }, data: { sjrQuartile: "unindexed" } });
      } else {
        const quartile = bucketQuartile(latest.score, distribution);
        await prisma.paper.updateMany({
          where: { issnL: issn, sjrQuartile: null },
          data: { sjrQuartile: quartile, sjrScore: latest.score, sjrYear: latest.year },
        });
        succeeded++;
      }
    } catch (error) {
      console.log(`  ⚠ ISSN ${issn}: ${error instanceof Error ? error.message : error}`);
    }
    done++;
    if (done % 100 === 0) console.log(`  [${done}/${distinctIssns.length}] ISSN diproses (${succeeded} indexed)`);
    await sleep(200);
  }
  console.log(`✓ Selesai resolve ${done} ISSN unik (${succeeded} indexed, ${done - succeeded} non-Scopus).`);
}

async function main() {
  await backfillIssn();
  await markUnindexedWithoutIssn();
  const distribution = await getDistribution();
  await resolveQuartilesForDistinctIssns(distribution);

  const summary = await prisma.paper.groupBy({ by: ["sjrQuartile"], _count: { _all: true } });
  const total = await prisma.paper.count();
  console.log("\n=== RINGKASAN AKHIR ===");
  for (const row of summary) {
    const label = row.sjrQuartile ?? "belum_dicek";
    const pct = ((row._count._all / total) * 100).toFixed(1);
    console.log(`  ${label.padEnd(12)} ${row._count._all.toString().padStart(6)} (${pct}%)`);
  }
}

main()
  .then(() => {
    console.log("\n✅ Selesai!");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ Error:", e);
    process.exit(1);
  });
