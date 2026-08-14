-- Manual migration — ADAPTASI MYSQL dari aturan Bagian 6.4 build spec:
-- "max 1 summary published per (paper_id, language)".
--
-- Versi Postgres asli pakai partial unique index (CREATE UNIQUE INDEX ... WHERE status='published'),
-- tapi MySQL tidak mendukung WHERE di UNIQUE INDEX. Diakali dengan generated column: kolom ini
-- bernilai NULL untuk status apa pun selain 'published' (dan MySQL mengizinkan banyak NULL di
-- kolom UNIQUE), sehingga constraint hanya benar-benar menyala saat status='published'.
ALTER TABLE summaries ADD COLUMN published_key VARCHAR(300)
  GENERATED ALWAYS AS (
    CASE WHEN status = 'published' THEN CONCAT(paper_id, ':', language) ELSE NULL END
  ) STORED;

CREATE UNIQUE INDEX ux_summary_published ON summaries(published_key);
