# PusatRiset.ai — Prototype

Katalog + lapisan interpretasi untuk riset AI Indonesia & internasional. Lihat
[BUILD_SPEC_Prototype_PusatRiset_ai.md](./BUILD_SPEC_Prototype_PusatRiset_ai.md) dan
[PATCH_v1_BuildSpec_Prototype.md](./PATCH_v1_BuildSpec_Prototype.md) untuk spesifikasi lengkap.

> **Catatan penyimpangan dari spec**: database yang dipakai adalah **MySQL/MariaDB (XAMPP)**,
> bukan PostgreSQL seperti di BUILD_SPEC Bagian 3 — lihat catatan adaptasi di kepala
> `prisma/schema.prisma` untuk detail dan alasannya.

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

(Belum ada halaman admin/login di Tahap 1–2 — kredensial ini disiapkan untuk tahap berikutnya.)

## Kasus uji merge/redirect

Seed membuat satu kasus **paper merge** untuk menguji redirect 301 di `riset/[id]`:
- Paper survivor: *"Optimasi Rute Distribusi Logistik Perkotaan Menggunakan Reinforcement Learning"*
- UUID lama (`merged_id`, sengaja tidak mengarah ke paper mana pun):
  ```
  00000000-0000-4000-8000-000000000099
  ```
  Akses `riset/00000000-0000-4000-8000-000000000099` (atau `GET /api/v1/papers/00000000-0000-4000-8000-000000000099`,
  setelah Tahap 3) seharusnya redirect ke paper survivor di atas.

## Status tahapan

- [x] **Tahap 1** — setup proyek, schema Prisma (20 tabel + Patch 1–4), migrasi.
- [x] **Tahap 2** — seed data deterministik (Bagian 8): 66 paper, semua kasus uji wajib
      (foundational, superseded, retracted, needs_update, summary_only+abstractRaw, tanpa summary,
      draft antrean, relasi suggested, merge, multi-versi, relevance tanpa badge, "diabetes"
      untuk uji search, ≥8 judul dwibahasa, ≥5 affiliationInferred, sebaran enrichmentStatus).
- [ ] **Tahap 3** — API routes (`/api/v1/...`, `/api/admin/...`) dengan helper query dua-sumbu.
- [ ] **Tahap 4** — halaman publik (Home, Katalog, Detail, Dashboard, Metodologi).
- [ ] **Tahap 5** — admin panel + auth.

## Acceptance checklist (Bagian 2.3 BuildSpec)

1. [x] `docker compose up -d && npm run db:migrate && npm run db:seed && npm run dev` jalan tanpa error
       — **catatan**: diganti XAMPP MySQL, bukan docker-compose Postgres; alur yang sama (`db:migrate` → `db:seed` → `dev`) sudah diverifikasi jalan.
2. [ ] Katalog + search "diabetes" + filter kombinasi — menunggu Tahap 4 (data sudah siap: paper "Prediksi Risiko Diabetes Tipe 2..." ada di seed).
3. [ ] Halaman detail paper `superseded` — data sudah siap (`tb_2019` → `tb_2024`), UI menunggu Tahap 4.
4. [ ] Abstrak tersensor sesuai `abstractDisplayPolicy` — data sudah siap, penyensoran di lapisan API menunggu Tahap 3.
5. [ ] Login admin → approve summary draft → tayang tanpa restart — menunggu Tahap 3 & 5.
6. [ ] Ekspor BibTeX — menunggu Tahap 3.
7. [ ] Redirect merge 301 — data sudah siap (lihat UUID di atas), endpoint menunggu Tahap 3.
8. [x] `npm run build` sukses tanpa type error.
9. [x] `deriveAbstractPolicy()` punya unit test dan lulus 4 kasus (Patch 6) — 7 test, semua pass.
10. [x] Paper CC BY-SA menampilkan `full`; paper `restricted` menghasilkan `summary_only` dengan `abstractRaw` tetap tersimpan di DB (penyensoran aktual di API menunggu Tahap 3).
11. [ ] Tampilan judul dwibahasa — data sudah siap (8 paper), UI menunggu Tahap 4.
12. [ ] Penanda "afiliasi perkiraan" — data sudah siap (8 paper `affiliationInferred=true`), UI menunggu Tahap 4.
13. [ ] `enrichmentStatus` di admin, tidak di publik — data sudah siap, halaman menunggu Tahap 5.
