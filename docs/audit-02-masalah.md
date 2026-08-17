# Audit 02 — Gap, Risiko, dan Keterbatasan PusatRiset.ai

Tanggal: 2026-08-15
Dasar: `docs/audit-01-fakta.md` + investigasi tambahan (query database, pembacaan kode, pengujian langsung) khusus untuk dokumen ini.
Dokumen ini murni analisis gap/risiko. Tidak ada kolom solusi atau rekomendasi.

Urutan: risiko Tinggi → Sedang → Rendah.

---

## 1. Ringkasan interpretatif tayang ke publik tanpa pernah ditinjau manusia

**Kategori:** Konten
**Tingkat risiko:** Tinggi
**Kondisi saat ini:** Dari 84 summary berstatus `published` (tayang ke publik), 64 di antaranya (76,2%) bersumber `sourceType='ai_draft'` — artinya dihasilkan oleh LLM lewat `scripts/backfill-content.ts` dan LANGSUNG diset `status='published'` oleh script itu sendiri, tanpa melalui antrean admin. Hanya 1 dari 94 summary total di seluruh database yang berstatus `sourceType='ai_reviewed'` (secara harfiah ditinjau lewat aksi approve admin — dan baris itu adalah hasil pengujian alur admin di audit sebelumnya, bukan tinjauan editorial yang berdiri sendiri). 19 summary lain berstatus `manual` (dari seed).
**Kenapa ini masalah:** BuildSpec Bagian 1 poin 4 menyatakan aturan inti sistem: "TIDAK ADA interpretasi tayang tanpa manusia." Kondisi saat ini adalah kebalikan dari aturan itu untuk mayoritas konten interpretatif yang sedang tayang. `BRIEF_Round2_Design_dan_Backfill_Konten.md` Bagian B.0 secara eksplisit mengizinkan pengecualian ini ("Ini SEMENTARA untuk demo internal, BUKAN perilaku produksi") — pengecualian itu tertulis dan disengaja, bukan bug tersembunyi. Namun kondisi DATA saat ini (bukan kode-nya) tidak membedakan mana yang sudah lewat pengecualian demo dan mana yang genuinely ditinjau, kecuali lewat field `sourceType` yang tidak ditampilkan ke publik di UI mana pun (dicek: `sourceType` tidak muncul di respons `GET /api/v1/papers/:id` maupun di halaman `/riset/[id]`).
**Bukti:** Query Prisma langsung ke database yang sedang dipakai aplikasi:
```
summaries.status: published 84, draft 10
summaries.sourceType: manual 19, ai_draft 74, ai_reviewed 1
ai_draft AND published: 64 baris (76.2% dari total published)
```
Kode `scripts/backfill-content.ts` baris ~230: `status: isValid ? "published" : "draft"` — publish otomatis tanpa gerbang admin, dikonfirmasi lewat pembacaan kode dan dikonfirmasi lewat pengujian nyata (summary yang di-generate lewat backfill langsung tampil di halaman publik tanpa aksi admin, diuji berulang kali sepanjang sesi backfill berlangsung).

---

## 2. Fitur submission publik adalah jalur buntu — approve tidak membuat paper apa pun

**Kategori:** Teknis
**Tingkat risiko:** Tinggi
**Kondisi saat ini:** `POST /api/v1/submissions` hanya menerima `{name?, email, claimedIdentifier?}` — TIDAK ADA field judul, abstrak, penulis, atau data paper apa pun yang dikirim pengguna. Di sisi admin, `POST /api/admin/submissions/:id/review` dengan `action=approve` HANYA mengeksekusi `prisma.submission.update({ where: { id }, data: { status: "approved" } })` — tidak ada `prisma.paper.create()`, tidak ada pemanggilan OpenAlex/DOI resolver, tidak ada penautan `paperId` ke paper mana pun (meski kolom `Submission.paperId` ada di skema, field itu TIDAK PERNAH diisi di kode manapun yang ditemukan). Pencarian menyeluruh (`grep -rln "submission"`) terhadap seluruh `src/`, `scripts/`, `prisma/` hanya menemukan 3 file aplikasi yang menyentuh submission: endpoint create, endpoint review, dan tampilan antrean admin — tidak ada file lain yang memproses hasil approve.
**Kenapa ini masalah:** Dari sudut pandang pengguna publik yang mengajukan jurnal/paper lewat form ini, dan dari sudut pandang admin yang menekan tombol "Approve", tindakan itu memberi kesan bahwa paper akan masuk katalog — padahal secara teknis tidak ada mekanisme apa pun yang membuat itu terjadi. Status `submission.status` berubah jadi `approved`, tapi katalog (`papers` table) tidak bertambah sama sekali akibat aksi ini.
**Bukti:** Isi lengkap `src/app/api/admin/submissions/[id]/review/route.ts` (dibaca langsung):
```ts
const status = parsed.data.action === "approve" ? "approved" : parsed.data.reason;
await prisma.submission.update({ where: { id }, data: { status } });
return ok({ id, status });
```
Tidak ada baris lain di fungsi ini. Isi lengkap `POST /api/v1/submissions` body schema: `{ name: optional, email: required, claimedIdentifier: optional }` — tidak ada field metadata paper.

---

## 3. Rate limiter anti-abuse memakai memori in-process — tidak menyala lintas instance di deployment serverless

**Kategori:** Teknis
**Tingkat risiko:** Tinggi
**Kondisi saat ini:** `src/lib/api/rate-limit.ts` (dipakai `POST /api/v1/disputes` dan `POST /api/v1/submissions`, batas 5/menit per IP) menyimpan counter di `const buckets = new Map()` — variabel JavaScript biasa di memori proses, bukan di database atau cache eksternal (Redis dsb). Komentar di baris pertama file ini menyatakan sendiri: "Cukup untuk prototype single-process; TIDAK cocok untuk deployment multi-instance." Target deploy aplikasi ini adalah Vercel (lihat `docs/audit-01-fakta.md` Bagian 3), yang menjalankan tiap request lewat serverless function — bisa berupa beberapa instance/proses paralel yang tidak berbagi memori satu sama lain, terutama saat traffic bersamaan.
**Kenapa ini masalah:** Rate limit yang diuji berhasil di lingkungan lokal single-process (audit-01 Bagian 1.3: request ke-6 dan ke-7 → HTTP 429) tidak terjamin berperilaku sama begitu berjalan di Vercel dengan lebih dari satu instance function aktif bersamaan — tiap instance punya `Map` counter sendiri-sendiri yang terpisah.
**Bukti:** Isi `src/lib/api/rate-limit.ts` baris 1-2 (komentar asli di kode), dan `Map` in-memory sebagai satu-satunya penyimpanan state, dibaca langsung dari file.

---

## 4. Tidak ada kebijakan privasi meski aplikasi mengumpulkan data pribadi (nama, email)

**Kategori:** Legal
**Tingkat risiko:** Tinggi
**Kondisi saat ini:** Dua alur publik mengumpulkan data pribadi tanpa autentikasi: form sanggahan (`Dispute.submittedByName`, `Dispute.submittedByEmail`, keduanya opsional di skema tapi diuji dapat diisi) dan form submission (`Submission.submittedByEmail` wajib, `submittedByName` opsional). Pencarian kata "privasi"/"privacy" di seluruh `src/` dan semua file `.md` di root proyek: nol hasil. Tidak ada halaman kebijakan privasi, tidak ada teks consent/persetujuan di `DisputeModal.tsx` sebelum submit, tidak ada mekanisme penghapusan data yang ditemukan di kode.
**Kenapa ini masalah:** Data nama dan email pengguna publik tersimpan permanen di database (tidak ada TTL/retention policy yang ditemukan di skema atau kode) tanpa pemberitahuan kepada pengguna tentang bagaimana data itu dipakai, disimpan, atau dihapus.
**Bukti:** `grep -rli "privasi\|privacy" src/ *.md` → nol hasil. `prisma/schema.prisma` baris 495-507 (model `Dispute` dan `Submission`) menunjukkan field `submittedByName`/`submittedByEmail` tersimpan tanpa anotasi enkripsi/masking apa pun.

---

## 5. Deteksi paper baru 100% manual — tidak ada penjadwalan otomatis

**Kategori:** Operasional
**Tingkat risiko:** Sedang
**Kondisi saat ini:** `scripts/fetch-openalex.ts` hanya bisa dijalankan lewat perintah manual (`npm run fetch:openalex`) oleh manusia di terminal. Pencarian menyeluruh untuk mekanisme penjadwalan (`cron`, `node-schedule`, `setInterval`, file `vercel.json` untuk Vercel Cron Jobs) di `src/`, `scripts/`, `package.json`, dan root proyek: nol hasil. Tidak ada file `vercel.json` sama sekali di proyek ini.
**Kenapa ini masalah:** Kalau ada paper baru terbit di OpenAlex besok, sistem tidak akan mendeteksinya sampai seseorang secara sadar menjalankan script itu lagi secara manual.
**Bukti:** `grep -rn "cron\|node-schedule\|setInterval" src/ scripts/ package.json` → nol hasil. `find . -maxdepth 1 -iname "vercel.json"` → tidak ditemukan.

---

## 6. Tidak ada mekanisme deteksi kegagalan sumber data yang diam-diam

**Kategori:** Operasional
**Tingkat risiko:** Sedang
**Kondisi saat ini:** Tidak ada endpoint health-check (`grep` untuk `health`/`status`/`monitor` di `src/app/api`: nol hasil), tidak ada integrasi Sentry atau tooling monitoring lain (sesuai desain — BuildSpec Bagian 2.2 eksplisit menyatakan Sentry tidak masuk prototype), tidak ada log persisten dari hasil run `fetch-openalex.ts`/`backfill-content.ts`/`backfill-relations.ts` selain output console saat script itu berjalan (tidak disimpan ke file/tabel log). Selama sesi audit ini, ditemukan secara langsung bahwa provider LLM (Gemini) bisa gagal total (seluruh key kena HTTP 429 "quota exceeded") — kegagalan itu HANYA terlihat lewat output console yang sedang berjalan saat itu, tidak ada catatan permanen di database maupun sistem lain.
**Kenapa ini masalah:** Kalau `fetch-openalex.ts` atau proses backfill gagal total di suatu run (mis. OpenAlex down, atau seluruh API key LLM kena limit), tidak ada cara mengetahui hal itu terjadi kecuali orang yang menjalankannya secara manual membaca output terminal saat itu juga.
**Bukti:** `docs/backfill-report.md` (dibuat otomatis oleh script) hanya berisi ringkasan hasil SATU kali run terakhir — dicek: dokumen ini tertimpa (overwritten) tiap kali script dijalankan ulang, bukan log historis. `find src/app/api -iname "*health*" -o -iname "*status*" -o -iname "*monitor*"` → nol hasil.

---

## 7. Lisensi/hak cipta abstrak bergantung penuh pada metadata self-report OpenAlex, tanpa verifikasi independen

**Kategori:** Legal
**Tingkat risiko:** Sedang
**Kondisi saat ini:** Untuk 100 paper hasil `fetch-openalex.ts` (79% dari 126 total paper), nilai `licenseNormalized` dan `isOpenAccess` yang dipakai fungsi `deriveAbstractPolicy()` diambil langsung dari field `primary_location.license` dan `open_access.is_oa` yang dikembalikan API OpenAlex apa adanya (`scripts/fetch-openalex.ts` baris 155-158), tanpa langkah verifikasi tambahan apa pun terhadap sumber aslinya (mis. membuka halaman jurnal, membaca `dc:rights` langsung dari penerbit). 98 dari 126 paper di database berstatus `abstractDisplayPolicy='full'` (abstrak ditampilkan penuh) — mayoritas basis datanya adalah metadata pihak ketiga (OpenAlex) yang tidak diverifikasi ulang.
**Kenapa ini masalah:** Gerbang kebijakan abstrak (`deriveAbstractPolicy()`) berfungsi dengan benar secara LOGIKA (diuji di audit-01: paper `summary_only` dengan abstrak terisi di DB tetap disensor) — tapi ketepatan hasilnya bergantung sepenuhnya pada akurasi data yang dikirim OpenAlex, yang merupakan agregator pihak ketiga, bukan sumber hukum utama (penerbit/jurnal itu sendiri).
**Bukti:** `scripts/fetch-openalex.ts` baris 155-158:
```ts
const licenseNormalized = mapLicense(work.primary_location?.license);
...
isOpenAccess: work.open_access?.is_oa ?? false,
```
Tidak ada langkah verifikasi tambahan sesudahnya sebelum data ini dipakai `deriveAbstractPolicy()`.

---

## 8. Kuota API eksternal untuk backfill konten habis berulang kali dalam pemakaian nyata

**Kategori:** Teknis
**Tingkat risiko:** Sedang
**Kondisi saat ini:** Selama proses backfill di sesi-sesi sebelumnya (dicatat di riwayat kerja, bukan simulasi), seluruh 3 API key Gemini yang dipakai (`GEMINI_API_KEYS`) mengembalikan HTTP 429 "You exceeded your current quota" pada model `gemini-2.5-flash` DAN `gemini-3-flash-preview` di hari yang sama, dengan detail kuota gratis tercatat langsung dari respons API: `"limit: 20, model: gemini-3-flash"` (20 request/hari per model per project). Provider fallback (OpenRouter, 3 model gratis) juga sempat menunjukkan kegagalan beruntun (timeout berulang, error `"Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached"`) pada momen tertentu.
**Kenapa ini masalah:** Proses pengisian konten (ringkasan + keterkaitan antar paper) bergantung pada kuota API gratis yang terbukti kecil (20 request/hari untuk salah satu model) dan bisa habis dalam satu sesi kerja normal. Ini tidak memengaruhi pengguna akhir yang membuka halaman (dikonfirmasi di audit-01: nol pemanggilan API eksternal saat runtime aplikasi), tapi memengaruhi kelengkapan/kecepatan pengisian data baru ke depannya.
**Bukti:** Respons mentah API Gemini yang diterima langsung selama sesi kerja (dicatat di riwayat percakapan): `{"code": 429, "message": "You exceeded your current quota...", "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier", "quotaValue": "20"}`. 10 dari 74 summary `ai_draft` berstatus `draft` (bukan `published`) — sebagian karena gagal validasi B.4, sebagian riwayat menunjukkan sebagian lain gagal total dihasilkan sama sekali akibat kuota habis dan harus di-retry di sesi terpisah.

---

## 9. Tidak ada mekanisme deduplikasi lintas-sumber selain unique constraint pada identifier tunggal

**Kategori:** Teknis
**Tingkat risiko:** Sedang
**Kondisi saat ini:** Satu-satunya proteksi duplikat yang ditemukan di skema: `@@unique([idType, idValue])` pada tabel `paper_identifiers` (mencegah identifier yang SAMA PERSIS — mis. DOI yang sama — dimasukkan dua kali). Tidak ditemukan mekanisme pencocokan judul (fuzzy matching), pencocokan penulis+tahun, atau cross-check lain yang bisa mendeteksi paper yang SAMA tapi masuk lewat identifier BERBEDA (mis. satu baris dari seed manual dengan DOI fiktif, satu lagi masuk asli dari OpenAlex dengan DOI sungguhan untuk riset yang secara substansi sama).
**Kenapa ini masalah:** Proteksi yang ada terbukti cukup untuk mencegah duplikasi saat SATU sumber yang sama dijalankan ulang (dikonfirmasi historis: re-run `fetch-openalex.ts` menghasilkan 100/100 "skipped", bukan duplikat) — tapi tidak ada lapisan proteksi untuk skenario paper yang sama masuk dari DUA sumber berbeda dengan identifier berbeda.
**Bukti:** `grep -n "@@unique" prisma/schema.prisma` menunjukkan HANYA satu constraint terkait identifier paper (baris 270: `@@unique([idType, idValue])` di model `PaperIdentifier`). Query `groupBy` judul paper saat audit ini menunjukkan 0 duplikat PERSIS di 126 paper saat ini (bukti tidak adanya masalah SAAT INI, bukan bukti adanya proteksi untuk mencegahnya di masa depan).

---

## 10. `docs/backfill-flagged.csv` tidak sinkron dengan status database saat ini

**Kategori:** Operasional
**Tingkat risiko:** Rendah
**Kondisi saat ini:** File berisi 11 baris paper yang di-flag validasi B.4. Salah satu barisnya (paper "Emerging Smart Logistics and Transportation Using IoT and Blockchain") tercatat berstatus `draft` di file CSV, padahal database saat ini menunjukkan summary itu sudah berstatus `published`/`sourceType=ai_reviewed` (di-approve manual lewat panel admin selama pengujian audit-01). Kolom `issues` di seluruh 11 baris juga tidak berisi alasan spesifik penolakan asli (angka mana yang tidak terverifikasi, atau apakah teks terpotong) — hanya referensi generik ke `summary.id` untuk dicek manual, karena file ini di-generate ulang pasca-fakta lewat query database, bukan dari log asli tiap run backfill (yang tertimpa/hilang tiap kali script dijalankan ulang).
**Kenapa ini masalah:** File yang dimaksudkan sebagai daftar kerja untuk tinjauan manusia (per `BRIEF_Round2...md` Bagian B.4: "ini yang nanti Anda tunjukkan ke saya/user untuk direview manual") tidak mencerminkan kondisi terkini secara akurat, dan tidak menyimpan alasan spesifik per item yang dibutuhkan untuk benar-benar meninjau isinya.
**Bukti:** `wc -l docs/backfill-flagged.csv` → 12 baris (1 header + 11 data). Isi baris "3530657b-aaa4-49ba-b719-be02dbb807d5" (paper Emerging Smart Logistics) dibandingkan dengan query database langsung menunjukkan `status='published'`, `sourceType='ai_reviewed'` — tidak cocok dengan asumsi "draft" yang tersirat di file.

---

## 11. Tidak ada pengujian beban (load testing) sama sekali sepanjang riwayat proyek

**Kategori:** Operasional
**Tingkat risiko:** Rendah
**Kondisi saat ini:** Pencarian tooling load-testing (`k6`, `artillery`, `loadtest`, `autocannon`) di `package.json` dan seluruh proyek: nol hasil. Seluruh pengujian yang tercatat sepanjang riwayat proyek ini (termasuk audit-01) dilakukan lewat satu browser tab atau satu proses `curl` sekaligus, tidak pernah dengan permintaan bersamaan (concurrent) dalam jumlah berarti.
**Kenapa ini masalah:** Belum ada bukti empiris tentang bagaimana aplikasi (khususnya kombinasi Vercel serverless functions + TiDB Cloud Serverless + rate limiter in-memory yang sudah dicatat di temuan #3) berperilaku di bawah banyak pengguna bersamaan — baik dari sisi performa maupun dari sisi kebenaran fungsional (mis. rate limit, koneksi database).
**Bukti:** `grep -iE "k6|artillery|loadtest|autocannon" package.json` → nol hasil. Tidak ada file/script pengujian beban ditemukan di seluruh direktori proyek.

---

## 12. Deploy ke Vercel belum benar-benar terjadi

**Kategori:** Operasional
**Tingkat risiko:** Rendah
**Kondisi saat ini:** Sudah dicatat di `docs/audit-01-fakta.md` Bagian 3 — kode sudah disiapkan (`postinstall: prisma generate`, environment variable sudah didaftar), panduan langkah sudah diberikan, tapi tidak ada bukti proses deploy sungguhan berhasil selesai di Vercel pada saat kedua dokumen audit ini ditulis.
**Kenapa ini masalah:** Seluruh pengujian di audit-01 dan analisis di dokumen ini dilakukan terhadap server lokal (`next dev`/`next start`) yang tersambung ke database TiDB Cloud — bukan terhadap deployment Vercel yang sesungguhnya. Ada kemungkinan environment Vercel (build process, cold start, region, dsb) menunjukkan perilaku berbeda dari yang tercatat di kedua dokumen ini.
**Bukti:** Tidak ada URL deployment Vercel yang tercatat di riwayat kerja maupun di file konfigurasi proyek manapun.

---

## Catatan Konfirmasi Positif (bukan risiko — dicatat karena secara eksplisit diminta dicek)

Dua hal yang diminta dicek secara eksplisit di instruksi audit ini, dan hasil pengecekannya adalah TIDAK ditemukan risiko:

- **Pemanggilan API eksternal saat pengguna browsing halaman:** dicek lewat pencarian `fetch(` ke domain eksternal di seluruh `src/` — nol hasil. Ketiga API eksternal (OpenAlex, Gemini, OpenRouter) hanya dipanggil dari `scripts/` yang dijalankan manual, terpisah dari siklus hidup aplikasi. Tidak ada biaya yang timbul tiap kali pengguna membuka halaman.
- **Eksposur API key ke browser:** dicek lewat pencarian prefiks `NEXT_PUBLIC_` (nol hasil) dan pencarian nama variabel key (`GEMINI_API_KEYS`, `OPENROUTER_API_KEY`, `OPENALEX_MAILTO`) di seluruh `src/` (nol hasil — hanya muncul di `scripts/`, yang tidak pernah di-bundle ke kode yang dikirim ke browser). Tidak ditemukan jalur di mana API key ini bisa sampai ke sisi klien.
