/**
 * BAGIAN 9 (BuildSpec) + penajaman filter topik (lihat riwayat kerja) — script opsional,
 * dijalankan manual: `npx tsx scripts/fetch-openalex.ts [--countries=ID] [--limit=N]`
 * Hanya jalan bila ENABLE_OPENALEX_FETCH=true di .env. TIDAK dipanggil otomatis oleh app/seed.
 *
 * Wrapper tipis CLI di atas src/lib/services/openalex-ingest.ts — logic inti (filter dua
 * lapis, insert Paper/CitationStats/dst) dipindah ke sana supaya bisa dipakai juga oleh
 * src/app/api/cron/fetch-openalex/route.ts untuk ingest incremental harian. Script ini tetap
 * dipakai untuk backfill besar/manual (bisa tarik ribuan paper sekaligus, tanpa batas waktu
 * eksekusi serverless).
 *
 * Idempotent: paper dengan openalex_id (atau doi) yang sudah ada di paper_identifiers dilewati,
 * aman dijalankan ulang/lanjut. Satu record/satu halaman gagal -> skip + log, TIDAK menggagalkan
 * seluruh run.
 */
import { prisma } from "../src/lib/db";
import { runOpenAlexIngest } from "../src/lib/services/openalex-ingest";

const countriesArg = process.argv.find((a) => a.startsWith("--countries="));
const COUNTRIES = countriesArg ? countriesArg.split("=")[1] : "ID";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;

async function main() {
  if (process.env.ENABLE_OPENALEX_FETCH !== "true") {
    console.log("ENABLE_OPENALEX_FETCH != true — dibatalkan. Set di .env untuk menjalankan script ini (Bagian 9, opsional).");
    return;
  }

  console.log(`Negara: ${COUNTRIES} | Subbidang: Artificial Intelligence + Computer Vision | Open Access saja`);
  if (LIMIT) console.log(`(dibatasi --limit=${LIMIT} untuk uji coba)`);

  const result = await runOpenAlexIngest({
    countries: COUNTRIES,
    limit: LIMIT,
    onProgress: (line) => console.log(line),
  });

  console.log(
    `\nSelesai. diproses=${result.processed} inserted=${result.inserted} bukan-AI(dibuang)=${result.notAi} skip(sudah ada)=${result.skipped} gagal=${result.failed}`
  );
}

main()
  .catch((error) => {
    console.error("Fetch OpenAlex gagal total:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
