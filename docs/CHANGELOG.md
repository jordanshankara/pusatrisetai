# Changelog

Dicatat manual per putaran kerja besar (bukan per commit kecil). Format: apa yang berubah,
kenapa, dan file utama yang terlibat — supaya bisa ditelusuri tanpa harus baca ulang seluruh
riwayat percakapan.

## [Belum dirilis] — Redesain UX Admin, Filter/Prioritas Jurnal, Role Admin/Editor, Redesain Visual Publik

### 1. Redesain app shell admin (sidebar, bukan header publik yang kebawa)

**Kenapa:** panel admin sebelumnya memakai Header/Footer situs publik (logo, nav Katalog/Dashboard/
Metodologi) di atas kontennya sendiri, tanpa sidebar — UX-nya membingungkan dan tidak terasa
seperti aplikasi admin sungguhan.

- `src/app/(public)/layout.tsx` (baru) — Header/Footer publik dipindah ke sini; `src/app/layout.tsx`
  (root) sekarang cuma html/font/metadata, tidak lagi merender chrome publik ke semua route.
- `src/app/admin/(protected)/layout.tsx` — merender shell admin (sidebar + area konten) SEKALI
  untuk semua halaman `/admin/*`; halaman di bawahnya tidak lagi gambar header sendiri.
- `src/components/admin/AdminSidebar.tsx`, `AdminCard.tsx` (baru) — nav dengan badge jumlah
  antrean, identitas & logout, wrapper card konsisten.

### 2. Ringkasan: input manual + bantuan AI opsional (bukan tombol generate otomatis)

**Kenapa:** alur lama "klik generate → AI bikin draft → masuk antrean" salah arah — staf perlu
bisa mengetik ringkasan sendiri, AI cuma alat bantu isi teks awal.

- `src/app/api/admin/papers/[id]/summary/suggest/route.ts` — stateless, TIDAK menulis DB, cuma
  mengembalikan draf.
- `src/app/api/admin/papers/[id]/summary/route.ts` — publish langsung dari input manual staf.
- `src/components/admin/PaperAdminDetail.tsx` — form ringkasan + tombol "Isi dengan bantuan AI".

### 3. Kombobox relasi floating dengan kandidat mirip-topik

- `src/app/api/admin/papers/[id]/relations/route.ts` (GET) — mode "similar" (default, berdasar
  kesamaan subbidang) vs "search" (kalau ada query).
- `src/components/admin/AddRelationForm.tsx` — panel floating searchable, bukan dropdown kecil.

### 4. Filter/sort/prioritas lengkap + ringkasan jadi satu field rich text

**Kenapa:** daftar `/admin/jurnal` sempat menampilkan 6000+ paper tanpa filter/sort/pagination
sama sekali; dan ringkasan yang tadinya dipaksa jadi 3 kolom terpisah (Sederhana/Teknis/Relevansi)
diubah jadi satu field bebas-format supaya staf yang menentukan strukturnya sendiri.

- `prisma/schema.prisma` — `Summary.summaryLayperson/summaryTechnical/relevanceIndonesia` (3
  kolom) digabung jadi satu `Summary.content` (HTML). Data lama dimigrasi (bukan dibuang).
- `src/components/admin/RichTextEditor.tsx` (baru) — editor Tiptap (Bold/Italic/Underline/
  Heading/List saja — sengaja tanpa pilihan font, ikut tipografi editorial situs).
- `src/app/api/admin/papers/route.ts` — filter (asal, rentang tahun, status ringkasan/relevansi,
  status metadata/pengayaan, "baru 7 hari") + sort (termasuk **Prioritas: Tier + Sitasi**,
  algoritmik) + pagination sungguhan.
- `src/components/admin/PaperListClient.tsx` — panel filter, badge status per baris, pagination.
- `src/lib/llm/summary-prompt.ts`, `scripts/backfill-content.ts`, `prisma/seed.ts` — disesuaikan
  ke field `content` tunggal.

### 5. Role Admin vs Editor + menu Settings + pin prioritas manual

**Kenapa:** sebelumnya cuma ada SATU akun admin dari `.env` (tanpa tabel User sungguhan meski
modelnya sudah ada di skema). Perlu multi-user: admin bisa atur pengaturan API key, buat akun
editor, dan menandai paper prioritas untuk dikerjakan editor duluan.

- `prisma/schema.prisma` — `User.passwordHash` (baru), `Paper.priorityPinnedAt` (pin prioritas),
  model `AppSetting` baru (key-value untuk pengaturan API LLM via UI, bukan cuma `.env`).
- `src/lib/auth/password.ts` (baru) — hash/verify password (scrypt, `node:crypto`, tanpa
  dependency baru).
- `src/lib/auth/admin-session.ts` — sesi sekarang bawa `userId`+`role` (bukan cuma email); secret
  HMAC pindah dari `ADMIN_PASSWORD` (bug lama: satu password jadi secret bersama) ke
  `SESSION_SECRET` sendiri.
- `src/app/api/admin/login/route.ts` — login lewat tabel `User` (bukan lagi cek env langsung).
- `src/lib/api/require-admin.ts` — `requireAdmin()` (staf mana pun, tidak berubah perilaku) +
  `requireAdminRole()` baru (strict admin-only, dipakai Settings/manajemen user/pin prioritas).
- `scripts/bootstrap-admin-user.ts` (baru) — migrasi kredensial `.env` lama jadi baris `User`
  admin pertama, idempotent, dijalankan sekali.
- `src/app/admin/(protected)/settings/page.tsx`, `src/components/admin/SettingsClient.tsx`,
  `src/app/api/admin/settings/route.ts`, `src/app/api/admin/users/**` — menu Settings admin-only
  (proteksi ganda: sidebar disembunyikan DAN redirect server-side), form ganti API key LLM
  (termasking), buat/nonaktifkan akun editor.
- `src/lib/services/llm-client.ts` — `LLMClient.fromSettings()` (baca `AppSetting` dulu, fallback
  `.env`) dipakai HANYA 2 route web (summary/relevance suggest); script CLI tetap pakai `.env`.
- `src/app/api/admin/papers/[id]/priority/route.ts`, `PaperListClient.tsx`, `PaperAdminDetail.tsx`
  — toggle pin 📌 (admin-only, editor cuma lihat badge-nya).

### 6. Perbaikan loophole (ditemukan lewat audit UX sebelum redesain)

- `src/lib/admin-fetch.ts` (baru) — redirect otomatis ke `/admin/login` saat sesi kedaluwarsa
  (401), bukan cuma toast generik yang membingungkan.
- `PaperAdminDetail.tsx` — peringatan `beforeunload`/konfirmasi navigasi kalau ringkasan belum
  disimpan.
- `src/lib/api/rate-limit.ts` + 2 endpoint suggest — rate limit 10/menit per user untuk cegah
  spam biaya LLM.
- `src/app/(public)/katalog/page.tsx` — kotak pencarian dulu menghapus filter aktif (form
  terpisah dari `FilterForm`, tidak membawa filter lain); sekarang filter aktif dibawa lewat
  hidden input saat submit pencarian baru.

### 7. Redesain visual situs publik (biru/putih profesional, bukan lagi krem editorial)

**Kenapa:** desain lama dinilai "berantakan" — krem/coklat, heading serif, tanpa ikon, tanpa nav
mobile. Diganti ke gaya SaaS modern biru/putih mengikuti referensi, TANPA mengubah struktur
navbar-atas atau informasi tiap halaman.

- `src/app/globals.css` — nilai token warna diganti (nama variable/Tailwind utility DIPERTAHANKAN
  supaya semua komponen otomatis ikut, tidak perlu find-replace class satu-satu): `--bg-page`
  krem→putih-kebiruan, `--text-primary` coklat→navy, `--shadow-card` lebih tegas.
- `src/components/Header.tsx` — hamburger menu mobile (client component), ikon logo.
- `src/components/admin/AdminSidebar.tsx` — sidebar admin juga jadi off-canvas di mobile.
- Dependency baru: `lucide-react` — ikon di stat card, nav, section header (Home, Katalog,
  Dashboard).
- `src/components/DisputeModal.tsx` — dulu pakai token admin netral (`--accent`/`--border`),
  sekarang ikut token editorial publik supaya konsisten dengan desain baru.
- Heading `font-serif` → sans di semua halaman publik (Home, Katalog, Dashboard, Metodologi,
  Riset detail).

## Cara migrasi database (kalau setup ulang dari nol)

Proyek ini pakai TiDB Cloud — `prisma migrate dev` GAGAL karena masalah shadow-database dengan
riwayat migrasi lama (`FULLTEXT index must specify one column name`). Pola yang dipakai:
`prisma db push` untuk skema baru TANPA menyentuh tabel `summaries` (punya kolom generated
manual `published_key` yang tidak dikenal Prisma, `db push` akan mencoba men-drop-nya kalau ikut
di-diff) — kolom/tabel baru lain ditambah lewat `ALTER TABLE`/`CREATE TABLE` manual via
`prisma.$executeRawUnsafe`, lalu `npx prisma generate` untuk regenerate client.

Setelah migrasi skema pertama kali (atau `git pull` yang membawa `prisma/schema.prisma` baru):

```bash
npx prisma generate
npx tsx scripts/bootstrap-admin-user.ts   # migrasi ADMIN_EMAIL/ADMIN_PASSWORD .env -> tabel User
```
