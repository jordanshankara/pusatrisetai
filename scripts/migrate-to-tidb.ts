/**
 * Migrasi data satu-kali: MySQL lokal XAMPP (LOCAL_DATABASE_URL) -> TiDB Cloud (DATABASE_URL —
 * app sekarang jalan lewat sini). Dijalankan manual: `npx tsx scripts/migrate-to-tidb.ts`
 *
 * Kedua sisi MySQL-compatible (skema sudah identik lewat `prisma db push` + migrasi manual
 * kolom generated summaries.published_key — lihat riwayat kerja) jadi migrasi murni salin data
 * mentah per tabel, TIDAK lewat Prisma (Prisma Client hanya bicara ke SATU datasource per
 * instance). Urutan tabel mengikuti dependensi FK logis (parent dulu) — meski relationMode di
 * schema.prisma = "prisma" (TiDB tidak pakai FK constraint DB-level), urutan ini tetap dijaga
 * untuk kebersihan data.
 *
 * Idempotent secara kasar: DELETE dulu isi tabel tujuan sebelum insert ulang (target TiDB
 * dianggap kosong/percobaan, BUKAN dipakai untuk merge data production yang sudah ada
 * penambahan manual). Pakai DELETE bukan TRUNCATE supaya aman dijalankan berkali-kali tanpa
 * masalah urutan FK/kolom generated di TiDB.
 */
import mysql from "mysql2/promise";

process.loadEnvFile?.(".env");

const TABLES_IN_ORDER = [
  "users",
  "policy_tags",
  "approved_venues",
  "institutions",
  "authors",
  "institution_name_variants",
  "venue_arxiv_categories",
  "papers",
  "paper_titles",
  "paper_identifiers",
  "paper_topics",
  "paper_authors",
  "author_affiliations",
  "paper_affiliation_countries",
  "citation_stats",
  "paper_versions",
  "paper_relations",
  "relevance_scores",
  "paper_policy_tags",
  "summaries",
  "disputes",
  "submissions",
  "paper_merges",
];

function sourceConn() {
  return mysql.createConnection(process.env.LOCAL_DATABASE_URL!);
}

function targetConn() {
  const url = new URL(process.env.DATABASE_URL!);
  return mysql.createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    multipleStatements: false,
  });
}

async function migrateTable(source: mysql.Connection, target: mysql.Connection, table: string): Promise<number> {
  const [rows] = await source.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\``);
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  // summaries.published_key GENERATED ALWAYS -> tidak boleh diisi manual, DB yang hitung sendiri
  const insertableColumns = columns.filter((c) => c !== "published_key");

  const values = rows.map((row) =>
    insertableColumns.map((col) => {
      const v = row[col];
      if (v !== null && typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v); // kolom JSON
      return v;
    })
  );

  await target.query(`DELETE FROM \`${table}\``);
  const columnList = insertableColumns.map((c) => `\`${c}\``).join(", ");
  await target.query(`INSERT INTO \`${table}\` (${columnList}) VALUES ?`, [values]);
  return rows.length;
}

async function main() {
  if (!process.env.LOCAL_DATABASE_URL || !process.env.DATABASE_URL) {
    throw new Error("LOCAL_DATABASE_URL (sumber) dan DATABASE_URL (tujuan, TiDB) harus terisi di .env.");
  }

  const source = await sourceConn();
  const target = await targetConn();
  console.log("Terhubung ke sumber (lokal) dan tujuan (TiDB).");

  let totalRows = 0;
  for (const table of TABLES_IN_ORDER) {
    try {
      const n = await migrateTable(source, target, table);
      totalRows += n;
      console.log(`  ${table}: ${n} baris`);
    } catch (error) {
      console.error(`  GAGAL di tabel ${table}: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // urutan dependensi penting -> hentikan, jangan lanjut dengan data parsial
    }
  }

  console.log(`\nSelesai. Total ${totalRows} baris dipindahkan ke TiDB.`);
  await source.end();
  await target.end();
}

main().catch((error) => {
  console.error("Migrasi ke TiDB gagal:", error);
  process.exitCode = 1;
});
