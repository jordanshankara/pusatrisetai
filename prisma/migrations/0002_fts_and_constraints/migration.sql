-- Manual migration (Bagian 6.4 build spec) — tidak dihasilkan oleh `prisma migrate diff`,
-- karena Prisma tidak mendukung generated columns / partial unique index secara native.
-- Jalankan setelah 0001_init.

-- Full-text search: kolom tsvector generated dari title + abstract_raw.
-- Catatan (Bagian 6.4): FTS mengindeks abstrak termasuk yang policy=summary_only — itu boleh
-- (mencari != menampilkan); yang dilarang hanya MENAMPILKAN abstrak mentah di API/UI.
ALTER TABLE papers ADD COLUMN fts tsvector GENERATED ALWAYS AS
  (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(abstract_raw,''))) STORED;

CREATE INDEX ix_papers_fts ON papers USING GIN(fts);

-- Maksimal 1 summary published per (paper_id, language) — enforce di DB, bukan hanya di kode.
CREATE UNIQUE INDEX ux_summary_published ON summaries(paper_id, language) WHERE status = 'published';
