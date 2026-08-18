/**
 * Perbaikan retroaktif bug: openalex-ingest.ts dulu hardcode origin="local" utk SEMUA paper
 * hasil fetch OpenAlex, apa pun `--countries` yang dipakai (ID atau US|CN) — padahal origin
 * seharusnya di-derive dari affiliasi penulis aktual (>=1 penulis berafiliasi institusi
 * Indonesia -> local, lihat schema.prisma model Paper). Sudah diperbaiki di
 * src/lib/services/openalex-ingest.ts untuk paper BARU; script ini membetulkan paper LAMA
 * (tierReason='openalex_fetch') yang sudah terlanjur ke-insert dengan origin salah.
 *
 * Idempotent: hanya UPDATE baris yang origin-nya benar-benar berbeda dari hasil derive ulang.
 */
import { prisma } from "@/lib/db";

async function main() {
  let cursor: string | undefined;
  let checked = 0;
  let fixedToLocal = 0;
  let fixedToIntl = 0;

  while (true) {
    const batch = await prisma.paper.findMany({
      where: { tierReason: "openalex_fetch" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, origin: true, affiliationCountries: { select: { countryCode: true } } },
    });
    if (batch.length === 0) break;

    for (const p of batch) {
      const hasIndonesia = p.affiliationCountries.some((c) => c.countryCode === "ID");
      const correctOrigin: "local" | "international" = hasIndonesia ? "local" : "international";
      if (correctOrigin !== p.origin) {
        await prisma.paper.update({ where: { id: p.id }, data: { origin: correctOrigin } });
        if (correctOrigin === "local") fixedToLocal++;
        else fixedToIntl++;
      }
    }

    checked += batch.length;
    cursor = batch[batch.length - 1].id;
    if (checked % 2000 === 0) console.log(`[${checked}] diperiksa — dibetulkan ke local=${fixedToLocal}, international=${fixedToIntl}`);
  }

  console.log(`\n✓ Selesai. Total diperiksa: ${checked}`);
  console.log(`  Dibetulkan jadi local: ${fixedToLocal}`);
  console.log(`  Dibetulkan jadi international: ${fixedToIntl}`);

  const originCounts = await prisma.paper.groupBy({ by: ["origin"], _count: { _all: true } });
  console.log("\n=== Distribusi origin sekarang (semua paper) ===");
  for (const row of originCounts) console.log(`  ${row.origin}: ${row._count._all}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
