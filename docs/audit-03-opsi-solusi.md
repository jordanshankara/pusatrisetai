# Audit 03 — Opsi Solusi per Masalah

Tanggal: 2026-08-15
Dasar: `docs/audit-02-masalah.md`.

Tiap masalah diberi 2-3 opsi pendekatan berbeda, disajikan setara tanpa rekomendasi. Urutan masalah mengikuti urutan risiko di audit-02 (Tinggi → Sedang → Rendah).

---

## 1. Ringkasan interpretatif tayang ke publik tanpa pernah ditinjau manusia

**Opsi A — Kembalikan ke gerbang editorial normal**
- Ubah `status` seluruh 64 summary `ai_draft` yang saat ini `published` menjadi `draft`, sehingga wajib melalui antrean admin (`/admin` tab Ringkasan) sebelum tayang lagi — mengembalikan alur ke aturan asli BuildSpec Bagian 6.1.
- Effort: Kecil (satu query UPDATE massal) untuk perubahan status; Besar untuk beban kerja manusia sesudahnya (64 item perlu direview satu per satu lewat panel admin yang sudah ada dan berfungsi).
- Trade-off: katalog publik akan terlihat jauh lebih "kosong" (sedikit ringkasan tayang) sampai proses review selesai. Waktu review 64 item oleh manusia belum diketahui durasinya.

**Opsi B — Tambah label transparansi di UI publik, tanpa ubah gerbang**
- Tampilkan indikator kecil di halaman detail (mis. "Ringkasan dibantu AI, belum ditinjau editor manusia") untuk summary dengan `sourceType='ai_draft'`, berbeda dari label existing "ringkasan dibantu AI, ditinjau editor" yang sekarang dipakai seragam untuk semua summary.
- Effort: Kecil (field `sourceType` sudah ada di database, tinggal query dan render kondisional di `src/app/riset/[id]/page.tsx`).
- Trade-off: tidak menutup gap prinsip "tidak ada interpretasi tayang tanpa manusia" — hanya membuatnya transparan ke pembaca, bukan menghilangkan risiko kontennya salah.

**Opsi C — Review sampel (spot-check) sebagian, bukan seluruhnya**
- Admin mereview subset (mis. 20% dipilih acak) dari 64 summary `ai_draft` published sebagai pengecekan kualitas mewakili keseluruhan, sisanya tetap tayang mengandalkan validasi otomatis B.4 (cek angka + kelengkapan teks) yang sudah berjalan.
- Effort: Sedang (perlu keputusan metodologi sampling + waktu review untuk subset).
- Trade-off: risiko konten keliru tetap terbuka untuk ~80% yang tidak direview — mengurangi risiko secara statistik, bukan menghilangkan.

`[BUTUH KEPUTUSAN BISNIS]` — ketiga opsi bermuara pada satu pertanyaan non-teknis: apakah konten hasil AI tanpa tinjauan manusia bisa diterima tayang untuk konteks saat ini (demo internal) atau harus mengikuti prinsip inti BuildSpec secara ketat.

---

## 2. Fitur submission publik adalah jalur buntu — approve tidak membuat paper apa pun

**Opsi A — Bangun pipeline approve→create-paper penuh**
- Saat admin approve submission dengan `claimedIdentifier` berupa DOI/arXiv ID, panggil lookup (mis. ke OpenAlex by-DOI, pola sudah ada presedennya di `scripts/fetch-openalex.ts`) untuk menarik metadata dan membuat `Paper` baru, lalu isi `Submission.paperId` menaut ke paper yang terbentuk.
- Effort: Besar (perlu endpoint lookup baru, mapping data OpenAlex-by-DOI ke skema, penanganan kasus DOI tidak ketemu/tidak valid, UI konfirmasi sebelum create).
- Trade-off: submission tanpa `claimedIdentifier` (field opsional di skema saat ini) tidak akan punya jalur otomatis sama sekali.

**Opsi B — Approve = trigger form manual admin, bukan otomatis**
- Perluas form publik untuk mewajibkan minimal judul dan link/DOI sumber (bukan hanya `claimedIdentifier` bebas teks). Saat admin approve, arahkan ke form "Buat Paper dari Submission" yang sudah terisi sebagian dari data submission, admin melengkapi sisanya secara manual sebelum submit `Paper.create()`.
- Effort: Sedang (tambah 1-2 field wajib di form publik, satu halaman/form admin baru untuk create-paper dari submission).
- Trade-off: tetap bergantung tenaga admin per submission, tidak otomatis; tapi lebih terkendali dari sisi kurasi kualitas dibanding Opsi A yang full-otomatis.

**Opsi C — Hilangkan/nonaktifkan form submission publik sampai pipeline siap**
- Ganti form submission dengan instruksi kontak manual (mis. alamat email editorial) di halaman yang sama, tanpa endpoint `POST /api/v1/submissions` yang memberi kesan proses otomatis.
- Effort: Kecil (ubah komponen UI, endpoint API boleh tetap ada tidak dipakai atau dihapus).
- Trade-off: pengguna kehilangan jalur self-service yang sudah ada (walau saat ini jalur itu tidak benar-benar berfungsi ujung-ke-ujung).

---

## 3. Rate limiter anti-abuse memakai memori in-process — tidak menyala lintas instance di deployment serverless

**Opsi A — Pindahkan state ke storage eksternal yang dibagi**
- Ganti `Map` in-memory di `src/lib/api/rate-limit.ts` dengan storage yang diakses semua instance (mis. Vercel KV, Upstash Redis, atau tabel database yang sudah ada).
- Effort: Sedang (provisioning service tambahan kalau pakai KV/Redis eksternal, atau migrasi skema kecil kalau pakai tabel database yang sudah ada; `checkRateLimit()` perlu jadi `async`, dan seluruh pemanggilnya di route handler perlu disesuaikan).
- Trade-off: menambah satu dependency/service (kalau pakai Redis/KV eksternal) atau menambah beban baca-tulis ke database utama (kalau pakai tabel).

**Opsi B — Serahkan rate limiting ke layer platform**
- Pakai fitur rate limiting bawaan platform hosting (mis. Vercel Firewall rules) di depan endpoint `/api/v1/disputes` dan `/api/v1/submissions`, alih-alih logika custom di kode aplikasi.
- Effort: Kecil-Sedang (konfigurasi di dashboard platform, bukan perubahan kode aplikasi; effort tepatnya tergantung fitur apa yang tersedia di paket Vercel yang dipakai).
- Trade-off: rate limit jadi bergantung pada konfigurasi platform eksternal, sulit diuji lokal seperti pengujian yang sudah dilakukan di audit-01.

**Opsi C — Terima keterbatasan untuk skala saat ini**
- Biarkan mekanisme in-memory apa adanya, dengan pemahaman eksplisit bahwa proteksinya hanya efektif penuh selama traffic rendah/instance tunggal.
- Effort: Kecil (tidak ada perubahan kode, hanya pencatatan keputusan).
- Trade-off: begitu traffic nyata datang dan Vercel menjalankan banyak instance paralel, endpoint publik (dispute/submission) berisiko menerima spam tanpa proteksi efektif.

---

## 4. Tidak ada kebijakan privasi meski aplikasi mengumpulkan data pribadi (nama, email)

**Opsi A — Halaman kebijakan privasi statis**
- Buat halaman baru (pola sama seperti `/metodologi` yang sudah ada dan berfungsi) menjelaskan data apa dikumpulkan (nama, email di dispute/submission), untuk apa dipakai, berapa lama disimpan, dan cara memintanya dihapus. Tautkan dari footer.
- Effort: Kecil (satu halaman statis + satu baris tautan di `Footer.tsx`, pola komponen sudah ada persis).
- Trade-off: isi kebijakan (terutama masa retensi data dan mekanisme penghapusan) perlu ketentuan konkret dari luar kode ini.

**Opsi B — Consent eksplisit di titik pengumpulan data**
- Tambahkan checkbox/teks persetujuan di `DisputeModal.tsx` dan form submission sebelum tombol submit aktif, dengan tautan ke halaman kebijakan privasi.
- Effort: Kecil-Sedang (tambah field UI + validasi form sebelum submit).
- Trade-off: menambah satu langkah gesekan (friction) bagi pengguna yang ingin mengirim sanggahan/usulan.

**Opsi C — Kurangi data yang dikumpulkan**
- Jadikan email benar-benar opsional di seluruh alur (saat ini `Submission.submittedByEmail` wajib di validasi endpoint), sediakan jalur kirim sepenuhnya anonim.
- Effort: Sedang (ubah skema validasi `zod` di endpoint, pertimbangkan ulang bagaimana admin follow-up ke pengirim kalau perlu klarifikasi tanpa kontak).
- Trade-off: admin kehilangan kemampuan menghubungi balik pengirim sanggahan/usulan untuk klarifikasi.

`[BUTUH KEPUTUSAN BISNIS]` — khususnya untuk Opsi A (isi kebijakan: berapa lama data disimpan, siapa yang berhak akses) dan Opsi C (apakah kemampuan follow-up ke pengirim lebih penting daripada anonimitas penuh).

---

## 5. Deteksi paper baru 100% manual — tidak ada penjadwalan otomatis

**Opsi A — Vercel Cron Job**
- Bungkus logika `scripts/fetch-openalex.ts` sebagai API route (`/api/cron/fetch-openalex` misalnya), daftarkan jadwal di `vercel.json` (fitur Vercel Cron Jobs) untuk berjalan berkala (mis. mingguan).
- Effort: Sedang (perlu adaptasi script CLI jadi route handler HTTP yang dipanggil Vercel, karena Vercel Cron memanggil endpoint bukan menjalankan proses `tsx` langsung).
- Trade-off: menambah satu titik yang berjalan otomatis di production — perlu penanganan timeout/durasi function Vercel untuk proses yang bisa berjalan lama (100 paper per run).

**Opsi B — Scheduler eksternal**
- Jalankan `scripts/fetch-openalex.ts` apa adanya (tanpa perlu diubah jadi endpoint HTTP) lewat scheduler di luar Vercel, mis. GitHub Actions dengan cron trigger yang punya akses ke `DATABASE_URL` dan `OPENALEX_MAILTO` sebagai secret.
- Effort: Sedang (setup workflow CI terpisah, tidak menyentuh kode aplikasi sama sekali).
- Trade-off: menambah dependency ke platform CI eksternal untuk operasional inti; kredensial database perlu disimpan sebagai secret di dua tempat (Vercel dan CI).

**Opsi C — Tetap manual, sesuai desain awal**
- Biarkan `fetch-openalex.ts` sebagai script opsional yang dijalankan manual, sesuai statusnya di BuildSpec Bagian 9 ("script opsional") — dokumentasikan sebagai keputusan sadar, bukan gap yang perlu ditutup.
- Effort: Kecil (tidak ada perubahan, hanya penegasan status di dokumentasi).
- Trade-off: paper baru tidak akan masuk katalog sampai seseorang secara sadar menjalankan script lagi.

---

## 6. Tidak ada mekanisme deteksi kegagalan sumber data yang diam-diam

**Opsi A — Log hasil run tersimpan permanen di database**
- Tambah tabel baru (mis. `harvest_runs`, mengikuti pola yang sudah disebut di `SPEC_Konektor_OAI_PMH_PusatRiset.md` untuk tahap produksi) yang mencatat tiap eksekusi script (`fetch-openalex`, `backfill-content`, `backfill-relations`): waktu mulai/selesai, jumlah sukses/gagal, pesan error ringkas.
- Effort: Sedang (migrasi skema baru + tambah kode pencatatan di 3 script yang ada).
- Trade-off: perlu ada tempat untuk MELIHAT log ini (belum tentu halaman admin sudah punya UI untuk itu — perlu ditambah terpisah).

**Opsi B — Notifikasi otomatis saat gagal signifikan**
- Tiap script mengirim notifikasi (email atau webhook, mis. ke Slack) di akhir eksekusi kalau tingkat kegagalan melewati ambang tertentu (mis. >20% record gagal).
- Effort: Sedang (perlu integrasi service pengirim notifikasi + kredensial/webhook URL baru sebagai env var).
- Trade-off: menambah dependency eksternal (email/Slack service) untuk operasional yang saat ini murni manual.

**Opsi C — Terima kondisi manual saat ini, perkuat lewat dokumentasi operator**
- Tidak menambah infrastruktur baru; pastikan panduan menjalankan script (README/dokumentasi internal) secara eksplisit mengingatkan operator untuk membaca `docs/backfill-report.md` dan output console setiap selesai menjalankan.
- Effort: Kecil (perubahan dokumentasi saja).
- Trade-off: deteksi kegagalan tetap sepenuhnya bergantung kedisiplinan manusia yang menjalankan script, tidak ada jaring pengaman otomatis.

---

## 7. Lisensi/hak cipta abstrak bergantung penuh pada metadata self-report OpenAlex, tanpa verifikasi independen

**Opsi A — Tambah lapisan verifikasi admin sebelum tampil penuh**
- Tambah field baru (mis. `Paper.licenseVerifiedByAdmin`, default `false`) di skema. `deriveAbstractPolicy()` memperlakukan paper hasil fetch otomatis sebagai `summary_only` sampai admin menandai terverifikasi lewat panel admin, baru berubah ke `full`.
- Effort: Sedang (migrasi skema + logika tambahan di `deriveAbstractPolicy()` + UI admin untuk menandai verifikasi, kemungkinan perlu tab baru di panel admin).
- Trade-off: 98 paper yang sekarang tampil abstrak penuh akan otomatis tersembunyi sampai diverifikasi ulang satu-satu — beban kerja admin baru.

**Opsi B — Terima data OpenAlex sebagai sumber kepercayaan, dengan disclaimer**
- Tidak mengubah logika `deriveAbstractPolicy()`. Tambahkan kalimat eksplisit di halaman Metodologi bahwa status lisensi untuk paper hasil fetch otomatis bersumber dari metadata pihak ketiga (OpenAlex), belum diverifikasi manual ke penerbit asli.
- Effort: Kecil (edit teks di `src/app/metodologi/page.tsx`, tidak ada perubahan logika).
- Trade-off: risiko ketidaktepatan data (kalau OpenAlex salah melaporkan status lisensi suatu paper) tetap ada, hanya diberitahukan lebih transparan.

**Opsi C — Perketat default untuk semua paper hasil fetch otomatis**
- Ubah `fetch-openalex.ts` supaya SEMUA paper hasil fetch otomatis (bukan hasil input manual editor) diset `abstractDisplayPolicy='summary_only'` tanpa terkecuali, tidak peduli status `is_oa`/lisensi yang dilaporkan OpenAlex.
- Effort: Kecil-Sedang (ubah satu baris logika di `fetch-openalex.ts`, tidak perlu skema baru).
- Trade-off: paper yang sebenarnya open access sungguhan (klaim OpenAlex-nya akurat) akan kehilangan tampilan abstrak penuh tanpa alasan berbasis fakta — mengurangi nilai produk (BuildSpec Bagian 1 menekankan abstrak asli sebagai pembeda utama).

`[BUTUH KEPUTUSAN BISNIS]` — pemilihan di antara ketiga opsi ini bergantung pada toleransi risiko hukum organisasi terhadap keakuratan data pihak ketiga (OpenAlex), bukan murni pertimbangan teknis.

---

## 8. Kuota API eksternal untuk backfill konten habis berulang kali dalam pemakaian nyata

**Opsi A — Upgrade ke tier berbayar**
- Aktifkan billing di salah satu provider (Gemini API paid tier, atau tambah saldo OpenRouter) untuk menaikkan kuota harian secara signifikan.
- Effort: Kecil (aktivasi billing di dashboard provider, tidak ada perubahan kode — `llm-client.ts` sudah generic terhadap kuota).
- Trade-off: menimbulkan biaya berjalan (`$`) yang sebelumnya nol.

**Opsi B — Tambah lebih banyak API key gratis**
- Buat akun/project Google AI Studio tambahan untuk mendapat API key gratis baru, tambahkan ke `GEMINI_API_KEYS` (dipisah koma) — mekanisme rotasi multi-key sudah ada dan berfungsi di `scripts/lib/llm-client.ts`.
- Effort: Kecil (pembuatan akun baru + edit satu env var, tidak ada perubahan kode).
- Trade-off: total kuota tetap terbatas (jumlah key × 20/hari), hanya menunda titik habis, bukan menghilangkannya; berpotensi melanggar ketentuan penggunaan wajar provider kalau terlalu banyak akun dibuat untuk tujuan ini.

**Opsi C — Sebar proses backfill lintas beberapa hari**
- Jalankan `scripts/backfill-content.ts`/`backfill-relations.ts` dengan parameter `--limit` (sudah ada di kedua script) secara terjadwal dalam batch kecil per hari, alih-alih mencoba memproses semua sekaligus.
- Effort: Kecil (parameter sudah ada, tinggal dijalankan berkala — bisa manual atau dikombinasikan dengan solusi penjadwalan di masalah #5).
- Trade-off: waktu penyelesaian backfill total jadi lebih lama (tersebar berhari-hari), bukan sekali jalan.

---

## 9. Tidak ada mekanisme deduplikasi lintas-sumber selain unique constraint pada identifier tunggal

**Opsi A — Pencocokan fuzzy judul sebelum insert**
- Tambahkan pengecekan kemiripan judul (dinormalisasi — huruf kecil, tanpa tanda baca — dibandingkan dengan fungsi similarity string/Levenshtein) terhadap paper yang sudah ada, dijalankan sebelum `fetch-openalex.ts` (atau alur input lain di masa depan) membuat `Paper` baru.
- Effort: Sedang (perlu memilih/menulis fungsi similarity, menentukan ambang batas kemiripan yang wajar, uji coba supaya tidak salah tandai paper berbeda sebagai duplikat).
- Trade-off: ambang batas kemiripan yang terlalu longgar berisiko salah menolak paper yang sebenarnya berbeda; terlalu ketat berisiko tetap meloloskan duplikat nyata.

**Opsi B — Wajibkan review manual sebelum paper baru masuk katalog publik**
- Ubah default `metadataStatus` hasil fetch otomatis dari `indexed` menjadi `queued_review` (nilai enum ini sudah ada di skema, saat ini tidak dipakai sama sekali — 126/126 paper berstatus `indexed`). Tambah tampilan di panel admin untuk meninjau dan mengubah jadi `indexed` secara manual, termasuk mengecek potensi duplikat saat itu.
- Effort: Kecil-Sedang (ubah satu nilai default di `fetch-openalex.ts` + satu tab/tampilan baru di admin untuk approve metadata, enum & filter `metadataStatus=indexed` di query publik sudah ada dan teruji).
- Trade-off: paper baru tidak langsung tayang ke publik, perlu antrean tambahan yang mengonsumsi waktu admin.

**Opsi C — Terima risiko saat ini, cek manual berkala**
- Tidak ada perubahan otomatis; admin sesekali menjalankan query pencarian judul mirip (sudah dicontohkan di audit-01/02 lewat `groupBy` judul) sebagai bagian rutinitas manual.
- Effort: Kecil (tidak ada perubahan kode).
- Trade-off: mengandalkan kedisiplinan manual, tidak ada jaring pengaman otomatis; skala 126 paper saat ini kecil, tapi tidak diketahui berapa skala yang masih realistis dicek manual.

---

## 10. `docs/backfill-flagged.csv` tidak sinkron dengan status database saat ini

**Opsi A — Simpan alasan flag di database, bukan hanya file**
- Tambah field baru (mis. `Summary.flagReason`, tipe teks nullable) yang diisi `backfill-content.ts` saat menandai `status='draft'` karena gagal validasi. File CSV (kalau masih dibutuhkan) di-generate ulang dari database ini kapan saja, bukan disimpan sebagai satu-satunya sumber kebenaran.
- Effort: Sedang (migrasi skema kecil + ubah `backfill-content.ts` untuk menulis field ini).
- Trade-off: menambah satu kolom yang hanya relevan untuk konten `sourceType='ai_draft'` berstatus `draft` — tidak dipakai jenis summary lain.

**Opsi B — Script regenerasi CSV on-demand**
- Buat script pendek terpisah (mis. `scripts/generate-flagged-report.ts`) yang query `summaries` where `sourceType='ai_draft' AND status='draft'` langsung dari database saat ini dan menulis ulang CSV — pola persis yang sudah dipakai manual satu kali selama audit ini.
- Effort: Kecil (query dan pola penulisan file sudah terbukti dipakai, tinggal dibungkus jadi script berdiri sendiri, dijalankan sebelum sesi review manusia).
- Trade-off: alasan flag SPESIFIK per item (angka mana yang gagal verifikasi) tetap tidak tersimpan kalau tidak dikombinasikan dengan Opsi A — hasil regenerasi tetap generik seperti sekarang.

**Opsi C — Hilangkan file CSV, tampilkan langsung di panel admin**
- Tambah tab/tampilan baru di `/admin` yang menampilkan daftar summary `ai_draft` berstatus `draft` langsung dari database secara real-time, tanpa perantara file.
- Effort: Sedang (endpoint API baru + komponen tab di `AdminQueueClient.tsx`, mengikuti pola 5 tab yang sudah ada dan berfungsi).
- Trade-off: menambah kompleksitas panel admin (tab ke-6); workflow tinjau-lewat-spreadsheet/CSV (kalau ada preferensi begitu) tidak lagi didukung langsung.

---

## 11. Tidak ada pengujian beban (load testing) sama sekali sepanjang riwayat proyek

**Opsi A — Jalankan load test terstruktur sebelum akses publik luas**
- Pakai tool seperti k6 atau Artillery untuk mensimulasikan N pengguna bersamaan mengakses halaman-halaman utama (Katalog, Detail, pencarian) terhadap deployment (lokal dulu, lalu staging/production Vercel).
- Effort: Sedang (instalasi tool, penulisan skenario skrip, waktu eksekusi dan interpretasi hasil).
- Trade-off: hasil load test terhadap lingkungan lokal belum tentu representatif terhadap perilaku Vercel+TiDB Cloud yang sesungguhnya; perlu diulang di lingkungan production untuk hasil paling akurat.

**Opsi B — Pantau performa nyata secara pasif setelah live**
- Aktifkan tooling monitoring bawaan platform (Vercel Analytics/Speed Insights, dashboard metrik TiDB Cloud) untuk mengamati performa aktual begitu aplikasi diakses pengguna sungguhan, tanpa simulasi di muka.
- Effort: Kecil (aktivasi fitur platform, sebagian tersedia gratis di tier Vercel yang umum dipakai).
- Trade-off: risiko baru terlihat SETELAH masalah performa terjadi di depan pengguna nyata, bukan sebelum.

**Opsi C — Tunda sampai ada indikasi kebutuhan**
- Tidak melakukan pengujian beban maupun monitoring tambahan sekarang; skala penggunaan saat ini (personal/demo) dianggap tidak membutuhkannya.
- Effort: Kecil (tidak ada tindakan).
- Trade-off: kalau traffic melonjak tiba-tiba tanpa peringatan dini, tidak ada data awal untuk memprediksi titik masalah sebelum terjadi.

---

## 12. Deploy ke Vercel belum benar-benar terjadi

**Opsi A — Lanjutkan proses deploy sesuai panduan yang sudah ada**
- Ikuti langkah yang sudah didokumentasikan (isi environment variables di dashboard Vercel sesuai daftar di `docs/audit-01-fakta.md` Bagian 2.6, klik Deploy), lalu verifikasi build dan seluruh alur (Bagian 1 audit-01) berjalan sama di URL production.
- Effort: Kecil (langkah sudah dirancang dan didokumentasikan sebelumnya, tinggal eksekusi).
- Trade-off: kalau ada perbedaan perilaku di lingkungan Vercel sungguhan (mis. terkait temuan #1.3 di audit-01 soal redirect halaman UI), baru akan terlihat setelah deploy nyata.

**Opsi B — Deploy ke preview/staging dulu, baru production**
- Push ke branch terpisah supaya Vercel membuat preview deployment otomatis (fitur bawaan Vercel per-branch/PR), verifikasi menyeluruh di URL preview sebelum mengarahkan domain production ke situ.
- Effort: Kecil-Sedang (Vercel preview deployment otomatis tersedia tanpa konfigurasi tambahan untuk repo yang sudah terhubung; effort tambahan hanya di proses verifikasi sebelum promote).
- Trade-off: menambah satu tahap sebelum aplikasi benar-benar bisa diakses di domain final.

**Opsi C — Pertimbangkan ulang platform hosting**
- Evaluasi platform alternatif (mis. Railway, Render, atau VPS mandiri) sebagai pengganti Vercel, kalau ada pertimbangan yang membuatnya kurang cocok setelah tinjauan lebih lanjut.
- Effort: Besar (setup ulang proses deploy dari nol; kode Next.js standar pada dasarnya portable ke platform lain, tapi konfigurasi environment/database connection perlu disiapkan ulang).
- Trade-off: kehilangan waktu yang sudah diinvestasikan menyiapkan jalur Vercel (`postinstall: prisma generate`, dsb — lihat audit-01 Bagian 3).

`[BUTUH KEPUTUSAN BISNIS]` — khusus Opsi C, karena menyangkut pilihan platform dan struktur biaya jangka panjang, bukan sekadar pertimbangan teknis.
