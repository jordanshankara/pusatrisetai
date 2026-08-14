# PusatRiset.ai — Prototype

Katalog + lapisan interpretasi untuk riset AI Indonesia & internasional. Lihat
[BUILD_SPEC_Prototype_PusatRiset_ai.md](./BUILD_SPEC_Prototype_PusatRiset_ai.md) dan
[PATCH_v1_BuildSpec_Prototype.md](./PATCH_v1_BuildSpec_Prototype.md) untuk spesifikasi lengkap.

> **Catatan penyimpangan dari spec**: database yang dipakai adalah **MySQL/MariaDB (XAMPP)**,
> bukan PostgreSQL seperti di BUILD_SPEC Bagian 3 — lihat catatan adaptasi di kepala
> `prisma/schema.prisma` untuk detail dan alasannya. Search FTS pakai MySQL `MATCH...AGAINST`
> (native `@@fulltext` Prisma) menggantikan tsvector Postgres.

## Cara menjalankan

1. Pastikan **XAMPP** (Apache + MySQL) sudah berjalan.
2. `cp .env.example .env` — sesuaikan `DATABASE_URL` kalau MySQL Anda pakai password.
3. `npm install`
4. `npm run db:migrate` — membuat database `pusatriset` + seluruh tabel.
5. `npm run db:seed` — mengisi data contoh (~66 paper + venue, institusi, penulis, dll).
6. `npm run dev` — buka [http://localhost:3000](http://localhost:3000).

Verifikasi cepat tanpa database: `npm test` (unit test) dan `npm run build` (type-check + build produksi).

## Kredensial admin (dev only)

Dari `.env` / `.env.example`:
- Email: `admin@pusatriset.ai`
- Password: `changeme-local-only`

Buka [http://localhost:3000/admin](http://localhost:3000/admin) — otomatis redirect ke
`/admin/login` bila belum login. Sesi disimpan sebagai cookie token yang ditandatangani
(HMAC-SHA256, stateless — lihat catatan di `src/lib/auth/admin-session.ts`; sengaja BUKAN
session-store in-memory karena Turbopack dev mengisolasi module graph per-route, jadi `Map`
in-memory ternyata tidak reliable sebagai session store bahkan di single-process dev).

Login juga bisa lewat API langsung (curl/Postman):
```bash
curl -c cookie.txt -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pusatriset.ai","password":"changeme-local-only"}'

curl -b cookie.txt http://localhost:3000/api/admin/queue
```
`/api/admin/login` dan `/api/admin/logout` **bukan** bagian dari kontrak Bagian 5 — util dev,
tapi sekarang juga dipakai oleh halaman `/admin/login` sungguhan.

## Kasus uji merge/redirect

Seed membuat satu kasus **paper merge** untuk menguji redirect di halaman `/riset/[id]`:
- Paper survivor: *"Optimasi Rute Distribusi Logistik Perkotaan Menggunakan Reinforcement Learning"*
- UUID lama (`merged_id`, sengaja tidak mengarah ke paper mana pun):
  ```
  00000000-0000-4000-8000-000000000099
  ```
  Buka `http://localhost:3000/riset/00000000-0000-4000-8000-000000000099` di browser →
  redirect permanen ke halaman paper survivor (terverifikasi via `permanentRedirect`).

## Status tahapan

- [x] **Tahap 1** — setup proyek, schema Prisma (20 tabel + Patch 1–4), migrasi.
- [x] **Tahap 2** — seed data deterministik (Bagian 8): 66 paper, semua kasus uji wajib.
- [x] **Tahap 3** — API routes (`/api/v1/...`, `/api/admin/...`) dengan helper query dua-sumbu
      (`src/lib/queries/public.ts`), FTS MySQL, BibTeX, rate limit, auth admin cookie-session.
- [x] **Tahap 4** — halaman publik (Home, Katalog, Detail, Dashboard, Metodologi) — diverifikasi
      visual lewat browser terhadap data seed asli.
- [x] **Tahap 5** — admin panel (`/admin`) + halaman login (`/admin/login`) — diverifikasi
      end-to-end lewat curl (login → antrean → approve/reject tiap tab → tayang di API publik
      tanpa restart → reset ulang lewat `db:seed`).

## Acceptance checklist (Bagian 2.3 BuildSpec)

1. [x] `npm run db:migrate && npm run db:seed && npm run dev` jalan tanpa error (XAMPP MySQL, bukan docker-compose Postgres).
2. [x] Katalog + search "diabetes" + filter kombinasi — **terverifikasi visual**: `/katalog?q=diabetes` menampilkan hasil tepat; filter subfield+hideSuperseded teruji (7 hasil, superseded tersembunyi).
3. [x] Halaman detail paper `superseded` — **terverifikasi visual**: badge "Sudah Digantikan", kartu "Riset Penerus" dengan alasan & link ke paper 2024.
4. [x] Abstrak tersensor sesuai `abstractDisplayPolicy` — **terverifikasi di API & UI**: paper `restricted` menampilkan pesan pengganti, bukan `abstractRaw`.
5. [x] Login admin → antrean → approve summary draft → tayang tanpa restart — **terverifikasi end-to-end** lewat halaman `/admin` (login → tab Ringkasan → edit+approve → `GET /api/v1/papers/:id` langsung menampilkan teks baru, tanpa restart server).
6. [x] `GET /api/v1/papers/:id/export?format=bibtex` menghasilkan BibTeX valid, tombol "Ekspor BibTeX" di halaman detail — **terverifikasi**.
7. [x] Redirect merge — **terverifikasi di halaman**: `/riset/{merged-uuid}` redirect permanen ke paper survivor.
8. [x] `npm run build` sukses tanpa type error.
9. [x] `deriveAbstractPolicy()` punya unit test dan lulus 4 kasus (Patch 6) — 7 test, semua pass.
10. [x] Paper CC BY-SA → `full`; paper `restricted` → `summary_only`, API tidak pernah mengirim `abstractRaw` saat itu.
11. [x] Tampilan judul dwibahasa — **terverifikasi**: judul sekunder tampil italic di bawah H1 pada paper yang punya `titles` ganda.
12. [x] Penanda "afiliasi perkiraan" — **terverifikasi**: teks "⚑ Afiliasi institusi merupakan perkiraan" tampil di halaman detail paper `affiliationInferred=true`.
13. [x] `enrichmentStatus` tidak pernah muncul di respons publik — field sengaja dikecualikan dari service layer (`src/lib/services/papers.ts`).

## Arsitektur Tahap 3 & 4

Logika query/bisnis dipusatkan di `src/lib/services/papers.ts` — dipakai LANGSUNG oleh Server
Component halaman (`/`, `/katalog`, `/riset/[id]`, `/dashboard`) maupun oleh route handler
`/api/v1/*`, supaya filter dua-sumbu editorial (Bagian 6.1) dan shaping data tidak dobel-tulis
dan tidak bisa drift antara API publik dan halaman.

Filter Katalog memakai native HTML `<form method="GET">` dengan auto-submit `onChange` (client
component tipis `FilterForm.tsx`) — state filter sepenuhnya di URL (shareable), tab Detail
(Data Asli / Ringkasan) dan switcher bahasa (id/en) juga URL-driven, bukan client state, supaya
konsisten dengan pola yang sama dan tetap SEO-friendly.

## Arsitektur Tahap 5

Panel admin (`/admin`) adalah satu client component (`AdminQueueClient.tsx`) yang fetch
`GET /api/admin/queue` sekali di mount, lalu approve/reject tiap item memanggil endpoint review
masing-masing dan **menghapus item dari state lokal** (bukan re-fetch ulang seluruh antrean) —
supaya terasa instan tanpa refresh manual, sesuai Bagian 7. `/admin/page.tsx` (Server Component)
mengecek cookie sesi dan `redirect("/admin/login")` bila tidak valid, sebelum me-render client
component sama sekali (proteksi di server, bukan cuma UI).

Dua endpoint review (`/api/admin/disputes/:id/review`, `/api/admin/submissions/:id/review`) tidak
ada di kontrak eksplisit Bagian 5 (yang eksplisit hanya `GET /api/admin/queue` utk Sanggahan &
Submission) — ditambahkan mengikuti pola endpoint review lain karena tab "Sanggahan" & "Submission"
di Bagian 7 tetap butuh aksi Approve/Reject.

**Catatan data**: 66 paper dari `db:seed` adalah data buatan (Tahap 2) — DOI berpola
`10.99999/pusatriset-demo-xxx` menandakan ini, dipakai supaya semua kasus uji editorial (badge,
sensor abstrak, merge, dll) selalu ada dan deterministik. Untuk riset **sungguhan**, jalankan
script opsional Bagian 9 (lihat bawah).

## Bagian 9 — Fetch data riset asli dari OpenAlex (opsional)

`scripts/fetch-openalex.ts` mengambil works nyata dari OpenAlex (filter: institusi Indonesia +
bidang Computer Science) dan meng-insert-nya sebagai `Paper` baru — origin `local`, sourceTier
`tier_2`, **tanpa summary/relevance** (beda sengaja dari paper seed: mendemokan kontras antara
riset yang sudah dikurasi editor vs baru masuk mentah). Idempotent — jalan berkali-kali tidak
menduplikasi (dicek via `openalex_id`/`doi` di `paper_identifiers`).

```bash
# di .env: ENABLE_OPENALEX_FETCH=true
npm run fetch:openalex
```

Diverifikasi langsung terhadap API OpenAlex sungguhan: 100/100 works berhasil di-insert (0 gagal),
jalan ulang kedua kali → 100/100 di-skip (idempoten terbukti). Paper hasil fetch dicek tayang benar
di `GET /api/v1/papers/:id` publik — `summary: null`, `relevance: null`, `enrichmentStatus` tetap
tidak bocor ke respons publik.

Nonaktif secara default (`ENABLE_OPENALEX_FETCH=false`) — kalau dijalankan tanpa flag ini, script
keluar segera tanpa menyentuh database sama sekali.

## Contoh pemakaian API

```bash
curl "http://localhost:3000/api/v1/papers?q=diabetes"
curl "http://localhost:3000/api/v1/papers/{id}"
curl "http://localhost:3000/api/v1/papers/{id}/export?format=bibtex"
curl "http://localhost:3000/api/v1/topics"
curl "http://localhost:3000/api/v1/stats/trends"
curl -X POST "http://localhost:3000/api/v1/disputes" -H "Content-Type: application/json" \
  -d '{"paperId":"...","disputeType":"relevance_badge","email":"a@b.com","argument":"..."}'
```
