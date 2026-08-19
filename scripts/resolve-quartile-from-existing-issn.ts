/**
 * Jalankan tahap 2+3 dari backfill-sjr-quartile.ts SECARA TERPISAH dari tahap 1 — dipakai saat
 * OpenAlex lagi rate-limit (429 terus-terusan, lihat docs/backfill-sjr-quartile-local.log) tapi
 * sebagian besar paper SUDAH punya issn_l terisi dari backfill sebelumnya. Skip tahap 1 (biar
 * gak nunggu OpenAlex), langsung resolve kuartil Scopus dari issn_l yang sudah ada.
 *
 * PENTING beda dari markUnindexedWithoutIssn() di script asli: di sini HANYA issn_l="" (sudah
 * dicoba OpenAlex, TERKONFIRMASI tidak ada ISSN) yang di-mark unindexed. issn_l masih NULL
 * (belum pernah dicoba sama sekali) DIBIARKAN NULL — supaya backfill tahap 1 nanti (pas
 * OpenAlex sudah gak rate-limit) masih bisa proses baris itu, bukan ke-skip permanen.
 */
import { prisma } from "@/lib/db";
import { fetchComputerScienceSjrDistribution, lookupSjrScore, bucketQuartile } from "@/lib/services/sjr-quartile";
import fs from "node:fs";
import path from "node:path";

const DIST_CACHE_PATH = path.join(process.cwd(), "docs", ".sjr-distribution-cache.json");
const DIST_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getDistribution(): Promise<number[]> {
  if (fs.existsSync(DIST_CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(DIST_CACHE_PATH, "utf-8"));
    if (Date.now() - cached.fetchedAt < DIST_CACHE_MAX_AGE_MS) {
      console.log(`✓ Pakai cache distribusi SJR (${cached.scores.length} jurnal)`);
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

async function main() {
  const markedEmpty = await prisma.paper.updateMany({
    where: { sjrQuartile: null, issnL: "" },
    data: { sjrQuartile: "unindexed" },
  });
  console.log(`\n=== Tahap 2: ${markedEmpty.count} paper terkonfirmasi tanpa ISSN -> unindexed ===`);

  const distribution = await getDistribution();

  console.log("\n=== Tahap 3: resolve kuartil per ISSN unik yang SUDAH tersimpan ===");
  const rows = await prisma.paper.findMany({
    where: { sjrQuartile: null, AND: [{ issnL: { not: null } }, { issnL: { not: "" } }] },
    select: { issnL: true },
    distinct: ["issnL"],
  });
  const distinctIssns = rows.map((r) => r.issnL!).filter(Boolean);
  console.log(`ISSN unik yang perlu di-resolve: ${distinctIssns.length}`);

  let done = 0,
    succeeded = 0;
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

  const summary = await prisma.paper.groupBy({ by: ["origin", "sjrQuartile"], _count: { _all: true } });
  const total = await prisma.paper.count();
  console.log("\n=== RINGKASAN AKHIR (per origin) ===");
  for (const row of summary) {
    const label = row.sjrQuartile ?? "belum_dicek";
    console.log(`  ${row.origin.padEnd(15)} ${label.padEnd(12)} ${row._count._all}`);
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
