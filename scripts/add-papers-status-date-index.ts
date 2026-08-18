/**
 * Migrasi satu-kali: tambah index komposit (metadata_status, published_date) di tabel papers.
 * Dijalankan manual lewat raw SQL (BUKAN `prisma db push`) karena db push pernah mencoba
 * men-drop kolom generated manual `summaries.published_key` yang tidak dikenal Prisma — lihat
 * docs/CHANGELOG.md. Scoped hanya ke tabel papers, aman dijalankan berkali-kali (skip kalau
 * index sudah ada).
 */
import { prisma } from "@/lib/db";

async function main() {
  const existing: Array<{ Key_name: string }> = await prisma.$queryRawUnsafe(
    "SHOW INDEX FROM `papers` WHERE Key_name = 'papers_metadata_status_published_date_idx'"
  );
  if (existing.length > 0) {
    console.log("Index sudah ada, skip.");
    return;
  }
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `papers` ADD INDEX `papers_metadata_status_published_date_idx` (`metadata_status`, `published_date`)"
  );
  console.log("Index papers_metadata_status_published_date_idx ditambahkan.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
