# Audit 01 — Fakta Kondisi Aplikasi PusatRiset.ai

Tanggal audit: 2026-08-15
Metode: pengujian langsung (browser + curl + query database + pembacaan kode), bukan dugaan dari membaca kode saja. Setiap temuan di bawah dikonfirmasi lewat minimal satu metode pengujian nyata; metode yang dipakai disebutkan per temuan.
Lingkungan yang diuji: server lokal (`next dev` dan `next start`/production build) yang tersambung ke database TiDB Cloud (target deploy saat ini — lihat Bagian 2.4).

Dokumen ini murni pencatatan fakta. Tidak ada penilaian baik/buruk, tidak ada opini, tidak ada rekomendasi.

---

## 1. Alur Pengguna yang Benar-Benar Berfungsi Saat Ini

### 1.1 Home (`/`)

**Yang bisa dilakukan pengguna:**
- Melihat hero + search bar (submit → `/katalog?q=...`, diuji: mengarah ke katalog dengan filter query terisi).
- Melihat 4 kartu statistik: Total Riset (126), Riset Indonesia (122), Institusi Terlibat (133), Ringkasan Terkurasi (83) — diuji lewat pembacaan DOM langsung, angka sama persis dengan hasil query database independen.
- Melihat 6 kartu "Riset Terbaru" (paper dengan summary published, diurutkan terbaru) — link masing-masing kartu ke halaman detail paper yang benar.
- Klik "Buka Dashboard" → `/dashboard`.

**Sumber data:** langsung dari database (query `getHomeStats()`), campuran seed manual (26 paper hand-special) dan hasil fetch OpenAlex (100 paper) dan hasil backfill LLM (untuk angka "Ringkasan Terkurasi").

**Elemen terlihat tapi tidak fungsional:** tidak ditemukan pada pengujian ini.

### 1.2 Katalog (`/katalog`)

**Yang bisa dilakukan pengguna, semua diuji satu per satu lewat manipulasi query string langsung (bukan hanya baca kode):**
- Search bar (`?q=`) — diuji dengan kata kunci "diabetes": mengembalikan 1 hasil yang benar-benar mengandung kata itu di judul. Diuji dengan kata kunci tidak ada (`zzznonexistentqueryxyz`): server mengembalikan HTML berisi teks "Tidak ada hasil — coba longgarkan filter." (dikonfirmasi lewat curl ke HTML mentah; lihat catatan alat di Bagian 4).
- Filter asal riset (`origin=local` / `international`) — diuji: local=122, international=4 (total 126, sama dengan total keseluruhan, tidak ada tumpang tindih/hilang).
- Filter rentang tahun (`yearFrom`/`yearTo`) — diuji `2020-2021`: 35 hasil, sampel 5 hasil semua bertahun 2021.
- Filter badge relevansi (`relevance=`) — diuji `retracted`: 1 hasil, kartu menampilkan indikator "Ditarik". Diuji `none`: 121 hasil (paper tanpa badge sama sekali).
- Filter tag kebijakan (`policyTag=kesehatan`) — diuji: 3 hasil.
- Filter subbidang (`subfield=Machine Learning`) — diuji: 11 hasil.
- Toggle "Hanya akses terbuka" (`openAccess=true`) — diuji: 98 hasil (sama dengan jumlah paper `abstractDisplayPolicy=full` di database).
- Toggle "Sembunyikan yang sudah digantikan" (`hideSuperseded=true`) — diuji: 122 hasil (126 dikurangi paper berstatus superseded).
- Paginasi — diuji `page=2`: menampilkan 20 kartu berikutnya, teks "Halaman 2 dari 7" (126÷20 dibulatkan ke atas = 7, benar).
- Setiap filter menghasilkan URL yang bisa dibagikan (searchParams), sesuai pengamatan URL bar setelah tiap pengujian di atas.

**Sumber data:** query `listPapers()` terhadap database (campuran seed + OpenAlex, difilter `metadataStatus=indexed`).

**Elemen terlihat tapi tidak fungsional:** tidak ditemukan pada pengujian ini — seluruh kombinasi filter yang diuji mengubah hasil sesuai ekspektasi.

### 1.3 Detail Paper (`/riset/[id]`)

**Yang bisa dilakukan pengguna, tiap skenario diuji dengan paper spesifik dari database:**
- Melihat badge relevansi besar + alasan — diuji pada paper `publishedStatus=superseded`: badge "Sudah Digantikan" tampil beserta kartu "Riset Penerus".
- Melihat banner retracted — diuji pada paper `publishedStatus=retracted`: teks "telah ditarik" dan "Ditarik" tampil.
- Melihat badge "Riset Fondasi" — diuji pada paper `isFoundational=true`: tampil.
- Melihat kartu "Riset Serupa" (relasi `related_semantic`) — diuji pada paper dengan relasi approved: 5 kartu tampil, masing-masing berisi judul + alasan singkat + link internal ke paper lain di database sendiri (diuji: link `href` mengarah ke `/riset/{uuid}` yang valid, bukan ke situs luar).
- Melihat penanda "afiliasi perkiraan" — diuji pada paper `affiliationInferred=true`: teks "perkiraan (belum dikonfirmasi penulis)" tampil.
- Melihat judul sekunder (dwibahasa) — diuji pada paper dengan >1 `PaperTitle`: judul kedua tampil miring di bawah H1.
- Melihat riwayat versi — diuji pada paper dengan 3 `PaperVersion`: ketiga versi (v1, v2, v3) tampil dengan tanggal dan catatan perubahan masing-masing.
- Melihat pesan "Ringkasan dalam bahasa ini belum tersedia" — diuji pada paper tanpa summary sama sekali: tampil sesuai teks itu, tidak fallback diam-diam ke bahasa lain.
- Abstrak disensor sesuai kebijakan — diuji pada paper `abstractDisplayPolicy=summary_only` yang `abstractRaw`-nya TERISI di database: halaman TIDAK menampilkan isi abstrak, hanya menampilkan teks "kebijakan lisensi" (baca di sumber resmi).
- Ekspor BibTeX — diuji: `GET /api/v1/papers/{id}/export?format=bibtex` mengembalikan entri `@article` valid dengan title/author/year/journal terisi. Format selain `bibtex` (diuji `format=xml`) → HTTP 400.
- Tombol "Buka Sumber Resmi" — hadir bila ada `canonicalUrl`/identifier yang bisa dijadikan URL (dikonfirmasi lewat pembacaan kode; tidak diklik langsung di sesi ini).
- Sanggahan (`POST /api/v1/disputes`) — diuji langsung ke API: `{paperId, disputeType, email, argument}` → HTTP 201, data tersimpan dengan `status=open`. Rate limit diuji: 5 request pertama dalam waktu singkat → 201, request ke-6 dan ke-7 → HTTP 429. Tombol pemicu modal "Keberatan dengan konten ini?" dikonfirmasi ada di kode dan tampil di DOM halaman (dibaca lewat `read_page`), TIDAK diklik langsung untuk membuka modalnya di sesi audit ini.

**Redirect paper yang di-merge — TEMUAN PENTING, dua perilaku berbeda tergantung jalur akses:**
- **Lewat API** (`GET /api/v1/papers/{mergedId}`) — diuji langsung: HTTP **308 Permanent Redirect** dengan header `Location` mengarah ke id paper survivor. Sesuai kontrak API di BuildSpec Bagian 5.
- **Lewat halaman UI** (`GET /riset/{mergedId}`) — diuji dengan curl (HTTP client tanpa eksekusi JavaScript): response berstatus **HTTP 200**, bukan 301/308, baik di mode `next dev` maupun `next start` (production build). Diuji ULANG dengan browser sungguhan (menjalankan JavaScript): setelah beberapa detik, tab berpindah ke `/riset/{survivingId}` dan menampilkan judul & konten paper survivor dengan benar — dikonfirmasi lewat `location.href` browser yang berubah ke id survivor dan judul tab yang berubah ke judul paper survivor. Mekanisme redirect halaman ini (fungsi `permanentRedirect()` dari `next/navigation`) mengirim instruksi redirect lewat payload yang dieksekusi di sisi klien (JavaScript), bukan lewat header HTTP `Location` di respons awal — perilaku ini didokumentasikan di `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/permanentRedirect.md`: *"When used in a streaming context, this will insert a meta tag to emit the redirect on the client side."*

**Paper tidak ditemukan (id acak/tidak valid) — perilaku serupa:**
- **Lewat API**: diuji, HTTP **404**.
- **Lewat halaman UI**: diuji, HTTP **200** (bukan 404), baik dev maupun production build. Isi halaman yang dirender (dikonfirmasi lewat browser sungguhan, `read_page`) menampilkan teks "Paper tidak ditemukan." — konten yang benar tampil ke pengguna, hanya status code HTTP dokumen awal yang bukan 404.

**Sumber data:** query `getPaperDetail()`, campuran seed + OpenAlex + hasil backfill LLM untuk field summary/relasi.

**Elemen terlihat tapi tidak fungsional:** tidak ditemukan — satu-satunya temuan adalah perbedaan status code HTTP seperti di atas, bukan elemen yang tidak berfungsi bagi pengguna akhir yang memakai browser.

### 1.4 Dashboard (`/dashboard`)

**Yang bisa dilakukan pengguna:**
- Melihat chart batang "Jumlah Riset per Tahun" (split Indonesia vs internasional) — diuji: kedua heading section ("Jumlah Riset per Tahun" dan "Riset per Subbidang") dan datanya tampil di HTML respons server.
- Data chart bersumber dari `GET /api/v1/stats/trends` — diuji langsung: mengembalikan `byYear` dan `bySubfield`.

**Catatan data (fakta, bukan penilaian):** `byYear` dari API memuat entri tahun **1970** dengan 1 paper local. Paper tersebut (`STATISTIK DESKRIPTIF DALAM PENELITIAN KUALITATIF`, id `57fa5836-...`) memiliki `publishedDate` tersimpan persis `1970-01-01T00:00:00.000Z` di database.

**Elemen terlihat tapi tidak fungsional:** tidak ditemukan pada pengujian ini.

### 1.5 Metodologi (`/metodologi`)

**Yang bisa dilakukan pengguna:** membaca konten statis. Diuji: ketujuh section yang disyaratkan BuildSpec Bagian 7 seluruhnya ada di HTML respons server — "Sumber Data", "Sistem Tier Venue", "Dua Sumbu Editorial", "Arti Setiap Badge" (dengan 5 contoh badge dirender lewat komponen `RelevanceBadge` yang sama dengan katalog/detail), "Kebijakan Abstrak & Lisensi", "Kebijakan Inklusi", "Cara Mengajukan Sanggahan", "Disclaimer".

**Elemen terlihat tapi tidak fungsional:** tidak ditemukan.

### 1.6 Admin (`/admin`, setelah login di `/admin/login`)

**Catatan alat pengujian:** pengujian awal lewat `next dev` (mode development, Turbopack) di sesi ini berulang kali menunjukkan halaman `/admin` menampilkan skeleton loading milik halaman Home, bukan konten Panel Editorial, meski title tab sudah benar "Admin — PusatRiset.ai" dan server merespons HTTP 200 dengan HTML yang benar (dikonfirmasi lewat curl memakai cookie sesi). Perilaku ini tidak muncul lagi setelah pengujian diulang di `next start` (production build) — di situ seluruh alur di bawah berhasil diuji penuh tanpa anomali, di tab browser baru maupun lewat reload penuh (`location.reload()`).

**Yang bisa dilakukan pengguna (diuji penuh di production build):**
- Login dengan `ADMIN_EMAIL`/`ADMIN_PASSWORD` dari env → redirect ke `/admin`, session cookie (`pusatriset_admin_session`, HttpOnly) diset.
- Akses `/admin` tanpa login → redirect ke `/admin/login` (diuji).
- Akses `GET /api/admin/queue` tanpa login → HTTP 401 (diuji).
- 5 tab: **Ringkasan, Relasi, Policy Tag, Sanggahan, Submission** — kelimanya diuji lewat klik langsung, masing-masing menampilkan daftar item sesuai isi database saat itu.
- Approve pada tab Ringkasan — diuji end-to-end: klik "Approve" pada satu item → item hilang dari daftar tanpa reload halaman → dikonfirmasi lewat query database langsung: `summaries.status` berubah dari `draft` menjadi `published`, `summaries.source_type` berubah dari `ai_draft` menjadi `ai_reviewed` (sesuai aturan BuildSpec Bagian 5: "sourceType ai_draft→ai_reviewed").
- Tombol "Keluar" (logout) — ada di DOM, tidak diklik langsung di sesi ini.
- Panel "Set Relevansi Manual" (form override relevansi per paper) — ada di DOM (dikonfirmasi lewat `read_page`), tidak diuji submit-nya di sesi ini.

**Sumber data:** query `getAdminQueue()` langsung ke database (summaries draft/in_review, relations suggested, policyTags suggested, disputes open, submissions queued).

**Elemen terlihat tapi tidak fungsional:** tidak ditemukan pada bagian yang diuji. Bagian yang TIDAK diuji secara fungsional di sesi ini (hanya dikonfirmasi ada di DOM): tombol Reject di kelima tab, tombol Keluar, form "Set Relevansi Manual", edit field ringkasan sebelum approve.

---

## 2. Inventaris Teknis

### 2.1 Endpoint API — Publik (`/api/v1/*`)

| Endpoint | Method | Diuji? |
|---|---|---|
| `/api/v1/papers` | GET | Ya (lewat halaman katalog + filter) |
| `/api/v1/papers/:id` | GET | Ya (found, redirect 308, not_found 404) |
| `/api/v1/papers/:id/export?format=bibtex` | GET | Ya |
| `/api/v1/topics` | GET | Ya |
| `/api/v1/stats/trends` | GET | Ya |
| `/api/v1/disputes` | POST | Ya (termasuk rate limit) |
| `/api/v1/submissions` | POST | Ya |

### 2.2 Endpoint API — Admin (`/api/admin/*`, dilindungi `requireAdmin()` per-route, BUKAN lewat `middleware.ts` — tidak ada file `middleware.ts` di proyek ini)

| Endpoint | Method | Dilindungi requireAdmin? | Diuji? |
|---|---|---|---|
| `/api/admin/login` | POST | Tidak (memang endpoint login) | Ya |
| `/api/admin/logout` | POST | Tidak | Tidak diuji langsung |
| `/api/admin/queue` | GET | Ya | Ya |
| `/api/admin/summaries/:id/review` | POST | Ya | Ya (aksi approve) |
| `/api/admin/relations/:id/review` | POST | Ya | Tidak diuji langsung |
| `/api/admin/policy-tags/review` | POST | Ya | Tidak diuji langsung |
| `/api/admin/disputes/:id/review` | POST | Ya | Tidak diuji langsung |
| `/api/admin/submissions/:id/review` | POST | Ya | Tidak diuji langsung |
| `/api/admin/papers/:id/relevance` | POST | Ya | Tidak diuji langsung |

### 2.3 Request Eksternal

Dicek lewat pencarian teks `fetch(` ke domain eksternal di seluruh `src/` dan `scripts/`. Hasil: **tidak ada satu pun panggilan ke domain eksternal di dalam `src/` (aplikasi Next.js yang jalan saat render halaman)**. Tiga panggilan eksternal seluruhnya ada di `scripts/` (dijalankan manual, terpisah dari aplikasi):

| Domain | Dipanggil dari | Kapan | Pakai kunci apa |
|---|---|---|---|
| `api.openalex.org` | `scripts/fetch-openalex.ts` | Manual, sekali per run, hanya jika `ENABLE_OPENALEX_FETCH=true` | Tidak pakai API key, hanya parameter `mailto` (`OPENALEX_MAILTO`) |
| `generativelanguage.googleapis.com` (Gemini) | `scripts/lib/llm-client.ts`, dipakai oleh `backfill-content.ts` dan `backfill-relations.ts` | Manual, per paper diproses | `GEMINI_API_KEYS` (3 key dipisah koma, dirotasi) |
| `openrouter.ai` | `scripts/lib/llm-client.ts`, tier fallback | Manual, hanya kalau semua key Gemini gagal | `OPENROUTER_API_KEY` |

### 2.4 Database — TiDB Cloud (target deploy saat ini)

Database yang dipakai aplikasi saat audit ini dijalankan: **TiDB Cloud** (MySQL-compatible), bukan MySQL lokal XAMPP yang dipakai sepanjang pengembangan awal. Migrasi data dari lokal ke TiDB dilakukan lewat `scripts/migrate-to-tidb.ts` (2164 baris dipindah lintas 23 tabel). MySQL lokal (`LOCAL_DATABASE_URL`) masih ada sebagai referensi, tidak lagi dipakai aplikasi.

**Jumlah baris per tabel (dicek langsung lewat Prisma `count()` terhadap database yang sedang dipakai aplikasi):**

| Tabel | Jumlah baris |
|---|---|
| papers | 126 |
| paper_titles | 129 |
| paper_identifiers | 219 |
| paper_topics | 126 |
| paper_authors | 300 |
| authors | 299 |
| author_affiliations | 333 |
| paper_affiliation_countries | 160 |
| institutions | 133 |
| institution_name_variants | 0 |
| approved_venues | 9 |
| venue_arxiv_categories | 2 |
| citation_stats | 126 |
| paper_versions | 28 |
| paper_relations | 43 |
| relevance_scores | 8 |
| policy_tags | 6 |
| paper_policy_tags | 16 |
| summaries | 94 |
| users | 2 |
| disputes | 2 |
| submissions | 2 |
| paper_merges | 1 |

**Rincian per status/kategori (dicek langsung):**
- `papers.origin`: local 122, international 4.
- `papers.metadataStatus`: indexed 126 (seluruhnya).
- `papers.sourceTier`: tier_1 3, tier_2 123, (tier_3 0).
- `papers.enrichmentStatus`: enriched_openalex 112, pending 9, no_doi 3, not_found_openalex 2.
- `papers.abstractDisplayPolicy`: full 98, summary_only 28.
- `papers.affiliationInferred`: true 5, false 121.
- `papers.isFoundational`: true 1, false 125.
- `summaries.status`: published 84, draft 10.
- `summaries.sourceType`: manual 19, ai_draft 74, ai_reviewed 1.
- `summaries.language`: id 90, en 4.
- `paper_relations.status`: approved 39, suggested 4.
- `paper_relations.relationType`: related_semantic 40, superseded_by 1, extended_by 1, follow_up_same_author 1.
- `paper_policy_tags.status`: published 12, suggested 4.
- `relevance_scores.publishedStatus`: foundational 1, retracted 1, still_relevant 1, superseded 1, needs_update 1, NULL 3.

### 2.5 Script di Luar Aplikasi Utama

| Script | Fungsi | Pernah dijalankan? |
|---|---|---|
| `prisma/seed.ts` (`npm run db:seed`) | Seed 26 paper hand-special + data pendukung (venue, institution, author, policy tag, user) | Ya, berkali-kali sepanjang pengembangan |
| `scripts/fetch-openalex.ts` (`npm run fetch:openalex`) | Tarik ±100 paper riil dari OpenAlex | Ya |
| `scripts/remove-filler-seed.ts` | Hapus paper filler generik pasca-fetch OpenAlex | Ya |
| `scripts/backfill-content.ts` (`npm run backfill:content`) | Isi ringkasan (layperson/technical/relevansi Indonesia) lewat LLM | Ya, berkali-kali (resume-safe) |
| `scripts/backfill-relations.ts` (`npm run backfill:relations`) | Isi relasi antar paper ("Riset Serupa"/"Riset Penerus") lewat LLM | Ya |
| `scripts/migrate-to-tidb.ts` | Pindah data dari MySQL lokal ke TiDB Cloud | Ya, sekali |
| `prisma migrate deploy` (`npm run db:migrate`) | Terapkan migration SQL terformat ke database | Tidak dipakai untuk TiDB — TiDB disiapkan lewat `prisma db push` + eksekusi SQL manual (lihat `prisma/migrations/0003_tidb_deploy_notes/migration.sql`), bukan lewat perintah ini |

### 2.6 Environment Variables

Dicek lewat pencarian `process.env.` di seluruh `src/`, `scripts/`, `prisma/`:

| Variable | Dipakai untuk |
|---|---|
| `DATABASE_URL` | Koneksi Prisma ke database (saat ini: TiDB Cloud) |
| `LOCAL_DATABASE_URL` | Sumber data untuk `scripts/migrate-to-tidb.ts` (MySQL lokal) |
| `ADMIN_EMAIL` | Kredensial login admin |
| `ADMIN_PASSWORD` | Kredensial login admin + kunci penandatanganan HMAC sesi (`src/lib/auth/admin-session.ts`) |
| `ENABLE_OPENALEX_FETCH` | Feature-flag, `fetch-openalex.ts` keluar segera kalau bukan `"true"` |
| `OPENALEX_MAILTO` | Parameter `mailto` di URL request OpenAlex |
| `GEMINI_API_KEYS` | Daftar API key Gemini (dipisah koma) untuk backfill |
| `GEMINI_MODEL_PRIMARY` | Nama model Gemini utama |
| `GEMINI_MODEL_FALLBACK` | Nama model Gemini fallback |
| `OPENROUTER_API_KEY` | API key OpenRouter (tier fallback kedua backfill) |
| `NODE_ENV` | Dipakai `src/lib/db.ts` untuk pola singleton Prisma Client di mode non-production |

---

## 3. Fitur ADA vs TIDAK ADA

Dibandingkan terhadap: `BUILD_SPEC_Prototype_PusatRiset_ai.md`, `PATCH_v1_BuildSpec_Prototype.md`, `SPEC_Konektor_OAI_PMH_PusatRiset.md`, `BRIEF_Analisis_HAR_untuk_Coder.md`, `BRIEF_Round2_Design_dan_Backfill_Konten.md`.

| Fitur | Status | Catatan |
|---|---|---|
| Next.js App Router + TypeScript + Tailwind | Ada | — |
| Database via Prisma | Ada | Spec asli: PostgreSQL. Adaptasi bertahap: MySQL/XAMPP lokal → TiDB Cloud (lihat 2.4) |
| Halaman Home | Ada | Diuji, lihat 1.1 |
| Halaman Katalog + search + filter | Ada | Diuji, lihat 1.2 |
| Halaman Detail Paper (2 tab + badge + kartu penerus) | Ada | Diuji, lihat 1.3 |
| Halaman Dashboard Tren (2 chart) | Ada | Diuji, lihat 1.4 |
| Halaman Metodologi | Ada | Diuji, lihat 1.5 |
| Halaman Admin (login + antrean + approve/reject) | Ada | Diuji, lihat 1.6. Tombol Reject di 5 tab dan panel relevansi manual: ada di kode+DOM, tidak diuji fungsional |
| Search full-text | Ada, dengan catatan | Spec awal: Postgres `tsvector`. Diimplementasikan: MySQL `FULLTEXT` (adaptasi tahap awal), lalu diganti Prisma `contains` biasa saat migrasi ke TiDB (TiDB tidak mendukung `FULLTEXT` multi-kolom) |
| Ekspor BibTeX | Ada | Diuji, lihat 1.3 |
| Script `fetch-openalex.ts` (feature-flag) | Ada | Dijalankan, 100 paper masuk (lihat 2.4, 2.5) |
| Redirect 301/308 untuk paper merge (kontrak API) | Ada | Diuji di endpoint `/api/v1/papers/:id`: HTTP 308 + Location header |
| Redirect paper merge di halaman UI `/riset/[id]` | Ada, dengan catatan | Berfungsi di browser sungguhan (diuji, JS dieksekusi); response HTTP awal berstatus 200 bukan 301/308 (lihat 1.3) |
| `metadataStatus=indexed` filter di semua query publik | Ada | Diuji tidak langsung lewat total count katalog = total papers indexed |
| `summaries.status=published` filter di halaman publik | Ada | Diuji: paper tanpa summary published menampilkan "belum tersedia", bukan draft |
| `relations.status=approved` filter di halaman publik | Ada | Diuji: kartu "Riset Serupa"/"Riset Penerus" hanya dari relasi approved (dikonfirmasi lewat kode service layer) |
| Badge relevansi dari `publishedStatus` (bukan `computedStatus`) | Ada | Dikonfirmasi lewat kode (`RelevanceScore.publishedStatus` yang dipakai di query, `computedStatus` tidak pernah di-`select` untuk halaman publik) |
| Sensor abstrak di lapisan API (bukan hanya UI) | Ada | Diuji: paper `summary_only` dengan `abstractRaw` terisi di DB tidak menampilkan abstrak |
| Middleware melindungi `/admin/*` dan `/api/admin/*` | Sebagian | Tidak ada file `middleware.ts`. Proteksi diimplementasikan per-route lewat fungsi `requireAdmin()` (API) dan pengecekan sesi manual di server component (`/admin/page.tsx`). Diuji: akses tanpa sesi ditolak di kedua jalur |
| Auth admin (cookie-session) | Ada | Token HMAC-SHA256 stateless (`src/lib/auth/admin-session.ts`), bukan NextAuth |
| Rate limit dispute/submission (5/menit per endpoint) | Ada | Diuji: request ke-6 dan ke-7 dalam waktu singkat → HTTP 429 |
| LLM summarization | Ada | Spec awal (BuildSpec Bagian 2.2) eksplisit menyebut ini TIDAK MASUK prototype ("summaries datang dari seed; sediakan stub"). Diimplementasikan penuh di Bagian B (Round 2): `scripts/backfill-content.ts`, 74 summary `ai_draft` (lihat 2.4) |
| Stub `lib/ai/summarize.ts` | Tidak Ada | File ini disebut di BuildSpec Bagian 3 sebagai stub. Tidak ditemukan di `src/lib/`. Fungsinya digantikan backfill LLM nyata (lihat baris di atas) |
| Embeddings/pgvector/semantic search | Tidak Ada | Sesuai spec (BuildSpec 2.2: eksplisit TIDAK MASUK prototype) |
| OAI-PMH harvester | Tidak Ada | Sesuai spec (`SPEC_Konektor_OAI_PMH...md` eksplisit: "Bukan bagian dari prototype") |
| Analisis HAR (riset OAI-PMH) | Ada | Dokumen terpisah `docs/riset/har-analysis-itb.md` sudah ada, sesuai `BRIEF_Analisis_HAR_untuk_Coder.md` (riset paralel, bukan fitur aplikasi) |
| Scraping HTML | Tidak Ada | Sesuai spec |
| BullMQ/Redis/Meilisearch/Sentry | Tidak Ada | Sesuai spec |
| Auth pembaca publik, bookmark, policy-brief generator | Tidak Ada | Sesuai spec |
| Relevance score compute job (cron) | Tidak Ada | Sesuai spec — nilai relevansi dari seed manual + input admin, tidak ada job otomatis |
| Ekspansi negara di luar filter generik | Tidak Ada | Sesuai spec — kolom `affiliationCountries`/filter `country` generik ada, tidak ada harvest negara lain |
| `deriveAbstractPolicy()` sebagai fungsi turunan (Patch 1) | Ada | File `src/lib/rules/abstract-policy.ts` + `abstract-policy.test.ts` ada |
| Tabel `paper_titles` dwibahasa (Patch 2) | Ada | Diuji, lihat 1.3. 129 baris `paper_titles` untuk 126 `papers` |
| `affiliationInferred` (Patch 3) | Ada | Diuji, lihat 1.3. 5 paper bernilai `true` |
| `enrichmentStatus` hanya di admin, bukan publik (Patch 4) | Ada | Dikonfirmasi lewat kode: field ini eksplisit dikomentari "SENGAJA tidak disertakan" di `getPaperDetail()` untuk halaman publik |
| Desain visual editorial (Bagian A, Round 2) | Ada | Palet krem/biru lewat CSS variable, badge relevansi terpisah dari palet dekoratif, font serif untuk judul, admin panel dikecualikan dari gaya ini |
| Backfill ringkasan (Bagian B.2-B.4, Round 2) | Ada, sebagian di-flag | 84 published, 10 draft/di-flag (tervalidasi kode: angka tak terverifikasi ke abstrak asli, atau teks terpotong/karakter non-Latin nyasar) |
| Backfill keterkaitan (Bagian B.5, Round 2) | Ada | 43 relasi tersimpan (39 approved, 4 suggested — 4 suggested ini dari seed manual, bukan dari backfill B.5 yang langsung set approved) |
| Deploy ke Vercel | Tidak Ada | Kode sudah disiapkan (`postinstall: prisma generate` di `package.json`, dsb) dan panduan langkah sudah diberikan ke pengguna; belum ada bukti deploy sungguhan berhasil di Vercel pada saat audit ini ditulis |
| Deploy database ke TiDB Cloud | Ada | Aplikasi yang diuji di audit ini berjalan di atas TiDB Cloud, data 2164 baris/23 tabel sudah dipindah (lihat 2.4, 2.5) |

---

## 4. Catatan Metodologi Pengujian

- Beberapa pengujian awal lewat `curl` terhadap halaman `/riset/[id]` dan `/katalog` (bukan endpoint `/api/v1/*`) awalnya tampak menunjukkan konten kosong atau status "tidak ditemukan" yang keliru. Investigasi lebih lanjut (dibandingkan dengan hasil query database langsung dan pengujian ulang lewat browser sungguhan yang menjalankan JavaScript) menunjukkan hal ini disebabkan oleh cara Next.js App Router versi yang dipakai proyek ini (16.3.1) merender redirect/streaming di sisi klien, bukan oleh data atau logika aplikasi yang salah. Rincian per kasus dicatat di Bagian 1.3.
- Satu anomali alat pengujian (halaman `/admin` menampilkan skeleton halaman lain di mode `next dev`) tidak muncul lagi saat diuji ulang di `next start` (production build) — dicatat di Bagian 1.6.
- Selama pengujian, sempat dibuat data uji coba (dispute dan submission dengan email `audit@test.com` serta beberapa entri "rate limit test") untuk memverifikasi rate limiting dan alur admin. Seluruh data uji coba ini sudah dihapus dari database sebelum dokumen ini ditulis, kecuali satu tindakan approve pada satu summary asli (paper "Emerging Smart Logistics and Transportation Using IoT and Blockchain") yang statusnya kini `published`/`ai_reviewed` secara permanen sebagai bagian dari pengujian alur approve end-to-end.
