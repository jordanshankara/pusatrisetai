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
6. `npm run dev` — buka [http://localhost:3000](http://localhost:3000). Belum ada halaman visual —
   API bisa dites lewat curl/Postman (lihat contoh di bawah).

Verifikasi cepat tanpa database: `npm test` (unit test) dan `npm run build` (type-check + build produksi).

## Kredensial admin (dev only)

Dari `.env` / `.env.example`:
- Email: `admin@pusatriset.ai`
- Password: `changeme-local-only`

Belum ada halaman login (menyusul Tahap 5). Untuk sesi admin, login lewat API:
```bash
curl -c cookie.txt -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pusatriset.ai","password":"changeme-local-only"}'

# lalu pakai cookie.txt untuk semua request /api/admin/*
curl -b cookie.txt http://localhost:3000/api/admin/queue
```
`/api/admin/login` dan `/api/admin/logout` **bukan** bagian dari kontrak Bagian 5 — murni util dev
untuk menguji endpoint admin sebelum ada halaman login sungguhan (cookie-session in-memory, lihat
`src/lib/auth/admin-session.ts`).

## Kasus uji merge/redirect

Seed membuat satu kasus **paper merge** untuk menguji redirect 301/308:
- Paper survivor: *"Optimasi Rute Distribusi Logistik Perkotaan Menggunakan Reinforcement Learning"*
- UUID lama (`merged_id`, sengaja tidak mengarah ke paper mana pun):
  ```
  00000000-0000-4000-8000-000000000099
  ```
  ```bash
  curl -i http://localhost:3000/api/v1/papers/00000000-0000-4000-8000-000000000099
  # -> 308 Permanent Redirect ke /api/v1/papers/{id-survivor}
  ```

## Status tahapan

- [x] **Tahap 1** — setup proyek, schema Prisma (20 tabel + Patch 1–4), migrasi.
- [x] **Tahap 2** — seed data deterministik (Bagian 8): 66 paper, semua kasus uji wajib.
- [x] **Tahap 3** — API routes (`/api/v1/...`, `/api/admin/...`) dengan helper query dua-sumbu
      (`src/lib/queries/public.ts`), FTS MySQL, BibTeX, rate limit, auth admin cookie-session.
- [ ] **Tahap 4** — halaman publik (Home, Katalog, Detail, Dashboard, Metodologi).
- [ ] **Tahap 5** — admin panel (UI) + halaman login.

## Acceptance checklist (Bagian 2.3 BuildSpec)

1. [x] `npm run db:migrate && npm run db:seed && npm run dev` jalan tanpa error (XAMPP MySQL, bukan docker-compose Postgres).
2. [ ] Katalog UI + search "diabetes" + filter kombinasi — **API sudah terverifikasi jalan** (`GET /api/v1/papers?q=diabetes` mengembalikan hasil tepat), UI menunggu Tahap 4.
3. [ ] Halaman detail paper `superseded` — **API sudah terverifikasi**: `tb_2019` badge `superseded`, relasi `superseded_by` approved ke `tb_2024`. UI menunggu Tahap 4.
4. [x] Abstrak tersensor sesuai `abstractDisplayPolicy` — **terverifikasi**: paper `restricted` mengembalikan `abstract: null` dari API meski `abstractRaw` terisi di DB.
5. [x] Login admin → antrean → approve summary draft → tayang tanpa restart — **terverifikasi end-to-end** lewat curl (lihat riwayat commit).
6. [x] `GET /api/v1/papers/:id/export?format=bibtex` menghasilkan BibTeX valid — **terverifikasi**, escape karakter & key generation sesuai Bagian 6.5.
7. [x] Redirect merge 308 — **terverifikasi**: akses UUID lama redirect ke paper survivor.
8. [x] `npm run build` sukses tanpa type error.
9. [x] `deriveAbstractPolicy()` punya unit test dan lulus 4 kasus (Patch 6) — 7 test, semua pass.
10. [x] Paper CC BY-SA → `full`; paper `restricted` → `summary_only`, API tidak pernah mengirim `abstractRaw` saat itu.
11. [ ] Tampilan judul dwibahasa — **data + API siap** (`GET /api/v1/papers/:id` mengembalikan array `titles`), UI menunggu Tahap 4.
12. [ ] Penanda "afiliasi perkiraan" — **data + API siap** (field `affiliationInferred` di detail response), UI menunggu Tahap 4.
13. [x] `enrichmentStatus` tidak pernah muncul di respons publik (`GET /api/v1/papers/:id`) — field sengaja dikecualikan dari mapping response.

## Contoh pemakaian API (Tahap 3)

```bash
# List + search + filter
curl "http://localhost:3000/api/v1/papers?q=diabetes"
curl "http://localhost:3000/api/v1/papers?origin=local&relevance=needs_update"
curl "http://localhost:3000/api/v1/papers?hideSuperseded=true"

# Detail
curl "http://localhost:3000/api/v1/papers/{id}"

# Ekspor BibTeX
curl "http://localhost:3000/api/v1/papers/{id}/export?format=bibtex"

# Topik & tren
curl "http://localhost:3000/api/v1/topics"
curl "http://localhost:3000/api/v1/stats/trends"

# Dispute & submission publik
curl -X POST "http://localhost:3000/api/v1/disputes" -H "Content-Type: application/json" \
  -d '{"paperId":"...","disputeType":"relevance_badge","email":"a@b.com","argument":"..."}'
```
