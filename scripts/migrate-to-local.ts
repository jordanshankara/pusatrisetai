/**
 * Migrasi data satu-kali: TiDB Cloud (TIDB_DATABASE_URL) -> MySQL lokal XAMPP (DATABASE_URL,
 * app sekarang jalan lewat sini). Kebalikan dari scripts/migrate-to-tidb.ts — dipakai saat mau
 * kerja offline/lokal dengan salinan penuh data produksi. Dijalankan manual:
 * `npx tsx scripts/migrate-to-local.ts`
 *
 * Kedua sisi MySQL-compatible (skema identik lewat `prisma db push`) jadi migrasi murni salin
 * data mentah per tabel, TIDAK lewat Prisma. Urutan tabel mengikuti dependensi FK logis (parent
 * dulu). INSERT dilakukan per-batch (bukan satu query raksasa) karena TiDB punya puluhan ribu
 * baris di beberapa tabel (papers, authors, dll) — hindari melebihi max_allowed_packet.
 *
 * Idempotent secara kasar: DELETE dulu isi tabel tujuan sebelum insert ulang (target lokal
 * dianggap kosong/percobaan, BUKAN dipakai untuk merge data yang sudah ada penambahan manual).
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

const BATCH_SIZE = 500;

function sourceConn() {
  const url = new URL(process.env.TIDB_DATABASE_URL!);
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

function targetConn() {
  return mysql.createConnection(process.env.DATABASE_URL!);
}

async function migrateTable(source: mysql.Connection, target: mysql.Connection, table: string): Promise<number> {
  const [rows] = await source.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\``);
  await target.query(`SET FOREIGN_KEY_CHECKS=0`);
  await target.query(`DELETE FROM \`${table}\``);
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  // summaries.published_key GENERATED ALWAYS -> tidak boleh diisi manual, DB yang hitung sendiri
  const insertableColumns = columns.filter((c) => c !== "published_key");
  const columnList = insertableColumns.map((c) => `\`${c}\``).join(", ");

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const values = chunk.map((row) =>
      insertableColumns.map((col) => {
        const v = row[col];
        if (v !== null && typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
        return v;
      })
    );
    await target.query(`INSERT INTO \`${table}\` (${columnList}) VALUES ?`, [values]);
  }
  return rows.length;
}

async function main() {
  if (!process.env.TIDB_DATABASE_URL || !process.env.DATABASE_URL) {
    throw new Error("TIDB_DATABASE_URL (sumber) dan DATABASE_URL (tujuan, lokal) harus terisi di .env.");
  }
  if (!process.env.DATABASE_URL.includes("localhost") && !process.env.DATABASE_URL.includes("127.0.0.1")) {
    throw new Error("DATABASE_URL tidak menunjuk ke localhost — batalkan demi keamanan (mungkin masih arah TiDB).");
  }

  const source = await sourceConn();
  const target = await targetConn();
  console.log("Terhubung ke sumber (TiDB) dan tujuan (lokal).");

  let totalRows = 0;
  for (const table of TABLES_IN_ORDER) {
    try {
      const n = await migrateTable(source, target, table);
      totalRows += n;
      console.log(`  ${table}: ${n} baris`);
    } catch (error) {
      console.error(`  GAGAL di tabel ${table}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  console.log(`\nSelesai. Total ${totalRows} baris disalin ke lokal.`);
  await source.end();
  await target.end();
}

main().catch((error) => {
  console.error("Migrasi ke lokal gagal:", error);
  process.exitCode = 1;
});
