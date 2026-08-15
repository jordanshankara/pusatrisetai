# BRIEF UNTUK CODER — Round 2: Desain Visual + Pengisian Konten Nyata
### Tujuan: prototype siap ditunjukkan ke bos. Dua pekerjaan paralel, terpisah, jangan dicampur.

**PENTING — baca dulu sebelum mulai:**
Ini SEMENTARA untuk demo internal, BUKAN perilaku produksi. Titik pengecualiannya ditandai eksplisit di Bagian B. Jangan hapus/lupakan aturan gerbang editorial dari build spec — itu tetap berlaku saat aplikasi go-live publik. Kita hanya melompatinya khusus untuk mengisi konten demo kali ini.

---

# BAGIAN A — DESAIN VISUAL

## A.1 Palet warna (dari referensi + biru sebagai warna khas)

Referensi yang diberikan bergaya "editorial hangat" — krem/parchment, foto bertekstur, judul serif, kartu dengan bayangan lembut. Kita adaptasi nuansanya tapi ganti aksen emas/coklat referensi dengan **biru sebagai warna khas PusatRiset.ai** (asosiasi kredibilitas & institusi akademik).

```css
:root {
  /* Latar & permukaan — hangat, bukan putih steril */
  --bg-page: #F7F3EA;        /* krem lembut, pengganti putih polos */
  --bg-card: #FFFFFF;
  --bg-card-alt: #F0EBE0;    /* krem lebih gelap, untuk section pembeda */
  --border-warm: #E4DDCC;

  /* Biru — warna khas, pengganti peran emas di referensi */
  --brand-blue-900: #0C2D4A;   /* judul besar, header, teks penting */
  --brand-blue-700: #14508A;   /* tombol utama, link, aksen aktif */
  --brand-blue-100: #E3EEF7;   /* latar badge/chip biru, hover halus */

  /* Teks */
  --text-primary: #241F16;     /* hampir hitam kehangatan, bukan #000 */
  --text-secondary: #6B6355;
  --text-muted: #9C9484;

  /* Badge relevansi — TETAP terpisah dari palet dekoratif di atas.
     Ini kode makna, jangan diganti supaya konsisten & bisa dibedakan. */
  --badge-still-relevant: #2F7A4F;   /* hijau */
  --badge-needs-update:   #B98A1E;   /* kuning tua */
  --badge-superseded:     #C9701F;   /* oranye */
  --badge-retracted:      #B8352E;   /* merah */
  --badge-foundational:   var(--brand-blue-700); /* biru — konsisten dgn warna khas */
}
```

## A.2 Tipografi
- **Judul (H1/H2 halaman)**: font serif editorial (mis. "Source Serif 4" atau "Lora" dari Google Fonts) — meniru "CREATIVE WRITER'S HUB" di referensi, beri kesan jurnal/publikasi ilmiah.
- **Body & UI (nav, tombol, meta info)**: font sans yang sudah dipakai (sistem/Tailwind default) — TIDAK perlu diserifkan semua, referensi juga mencampur serif-judul + sans-UI.
- **Label kecil di atas judul section** (seperti "✒ CURRENT PROJECTS" di referensi) — versi kita: label kecil huruf kapital, warna `--text-muted`, tanpa ikon bulu; contoh: "RISET TERBARU", "STATISTIK".

## A.3 Elemen kartu (meniru bahasa visual referensi, TANPA foto dekoratif)
Referensi pakai foto suasana (meja tulis, mesin ketik) sebagai penghias. **Kita TIDAK pakai foto stok** — situs riset ilmiah, foto dekoratif menurunkan kredibilitas. Yang diambil dari referensi hanya: sudut membulat lembut, bayangan halus (`box-shadow` tipis, bukan flat design polos), padding lega, garis pemisah tipis warna `--border-warm`.

```css
.card {
  background: var(--bg-card);
  border-radius: 14px;
  border: 1px solid var(--border-warm);
  box-shadow: 0 2px 8px rgba(36, 31, 22, 0.04);
  padding: 24px;
}
```

## A.4 Yang HARUS diubah di tiap halaman
- **Home**: hero pakai `--bg-card-alt` sebagai latar section, judul pakai font serif, 4 kartu statistik jadi card style A.3, kartu "Riset Terbaru" dapat border-radius lebih besar (16px) meniru kartu manuskrip di referensi.
- **Katalog**: sidebar filter dapat `--bg-card-alt`, badge relevansi TETAP pakai warna semantik A.1 (jangan disamakan ke krem), chip tag kebijakan pakai `--brand-blue-100` + `--brand-blue-700` teks.
- **Detail**: tab aktif pakai underline `--brand-blue-700` (bukan hitam polos), judul H1 font serif.
- **Dashboard**: chart dua warna diganti — batang "Indonesia" pakai `--brand-blue-700`, batang "Internasional" pakai `--bg-card-alt` dengan border `--border-warm` (bukan biru muda pucat yang sulit dibedakan seperti sebelumnya).
- **Admin panel**: TIDAK perlu ikut gaya editorial hangat — tetap functional/netral (putih, border tegas) supaya jelas ini alat kerja, bukan halaman publik. Ini best practice: bedakan visual "produk" vs "alat internal".

## A.5 Acceptance visual
1. Tidak ada satu pun warna hex baru di luar token A.1 dipakai langsung di komponen (semua lewat variabel).
2. Badge relevansi tetap 5 warna berbeda dan tidak tertukar dengan warna dekoratif krem/biru.
3. Kontras teks vs latar lulus AA (teks `--text-primary` di atas `--bg-page` dan `--bg-card` aman; jangan taruh `--text-muted` di atas `--brand-blue-700`).
4. Dark mode BOLEH diabaikan untuk round ini (prototype demo, bukan requirement produksi) — tapi jangan hardcode di tempat yang akan menyulitkan penambahan dark mode nanti.

---

# BAGIAN B — PENGISIAN KONTEN: RINGKASAN + KETERKAITAN UNTUK ~100+ PAPER

## B.0 Pengecualian sadar (baca dulu)
Alur produksi normal: ringkasan AI berstatus `draft` → antre admin → baru `published`. **Untuk demo ini kita lompati** — script langsung menulis `status='published'` supaya bos bisa lihat versi "jadi". Tandai tiap ringkasan hasil script ini dengan `sourceType='ai_draft'` (BUKAN `ai_reviewed` — itu label untuk yang sungguh direview manusia) supaya jujur secara data bahwa ini belum melalui tinjauan editor sungguhan, meski status tampil `published`. Saat produksi nanti, alur normal (draft→antre→approve) diaktifkan kembali — jangan hapus logikanya, cukup jangan dipakai untuk demo ini.

## B.1 Scope
- Sasaran: **semua paper di database yang belum punya `summaries` berstatus published** (baik dari seed maupun hasil fetch OpenAlex).
- Buat script mandiri: `scripts/backfill-content.ts`, dijalankan manual (`npx tsx scripts/backfill-content.ts`), BUKAN bagian dari aplikasi/API.
- Boleh dijalankan bertahap/di-resume (jangan proses ulang paper yang sudah selesai — cek dulu apakah sudah ada summary published sebelum generate lagi).

## B.2 Spesifikasi Ringkasan — WAJIB komprehensif, bukan satu paragraf

Ini poin paling penting Anda: **bukan satu paragraf selesai.** Struktur wajib per ringkasan (field `summaryLayperson` dan `summaryTechnical` dari skema yang sudah ada):

### `summaryLayperson` (ringkasan awam) — target 4-6 kalimat, BOLEH 2 paragraf pendek:
1. Kalimat pembuka: riset ini tentang apa, dengan bahasa sehari-hari (bukan jargon teknis mentah).
2. Kalimat masalah: masalah apa yang coba dipecahkan, kenapa itu penting.
3. Kalimat pendekatan: bagaimana cara mereka mengatasinya (disederhanakan, tanpa istilah matematis).
4. Kalimat hasil: apa yang mereka temukan/capai (kalau ada angka di abstrak, boleh disebut; kalau tidak ada, JANGAN mengarang angka).
5-6. Opsional: kalimat penutup tentang implikasi praktisnya.

### `summaryTechnical` (ringkasan teknis) — target 5-8 kalimat:
1. Konteks penelitian & gap yang diisi (dibanding riset sebelumnya, kalau disebut di abstrak).
2. Metode/pendekatan teknis (nama arsitektur, dataset, metrik — SESUAI yang tertulis di abstrak, jangan tambah detail yang tidak ada).
3. Hasil eksperimen dengan angka SPESIFIK dari abstrak (kalau ada).
4. Keterbatasan atau catatan penting (kalau abstrak menyebutnya).
5. Kesimpulan teknis singkat.

### `relevanceIndonesia` — 3-5 kalimat, BUKAN template kosong:
- Kalau paper Indonesia (`origin='local'`): jelaskan relevansinya untuk konteks nasional secara konkret — sektor mana (kesehatan/pertanian/birokrasi/dst — cocokkan ke `policy_tags` yang ada), kenapa penting untuk Indonesia SPESIFIK (bukan generik "AI penting untuk Indonesia").
- Kalau paper internasional: jelaskan APAKAH dan BAGAIMANA metodenya bisa relevan diterapkan/dipelajari untuk konteks Indonesia. Kalau memang tidak ada kaitan jelas, tulis jujur: "Riset ini bersifat fundamental/global dan tidak memiliki kaitan sektor spesifik dengan Indonesia saat ini, namun metodenya berpotensi diadaptasi untuk [alasan singkat]." — JANGAN memaksakan relevansi yang mengada-ada.

**Bahasa:** Indonesia sehari-hari yang mengalir, seperti menjelaskan ke kolega yang cerdas tapi bukan spesialis bidang itu. Hindari kalimat pasif berlapis khas terjemahan mesin ("dapat dilakukan oleh"), hindari istilah Inggris kalau ada padanan Indonesia yang wajar dipakai (tapi istilah teknis baku seperti "neural network", "transformer" boleh tetap Inggris — itu memang istilah baku di bidang ini).

## B.3 System prompt (siap pakai untuk LLM)

```
Anda adalah editor sains yang menerjemahkan paper riset kecerdasan buatan (AI)
ke dalam Bahasa Indonesia yang mengalir, jelas, dan jujur terhadap sumber — untuk
pembaca umum yang cerdas: pembuat kebijakan, jurnalis, mahasiswa, praktisi.

ATURAN MUTLAK:
1. HANYA gunakan informasi yang ADA di judul dan abstrak yang diberikan.
   JANGAN mengarang angka, metode, atau klaim yang tidak tertulis di abstrak.
2. Kalau abstrak tidak menyebut angka hasil, JANGAN membuat angka. Tulis kualitatif saja.
3. Bedakan "penulis melaporkan/mengklaim" dari "penelitian ini membuktikan" —
   gunakan bahasa yang tidak berlebihan (hedged), sesuai norma penulisan ilmiah.
4. relevanceIndonesia harus JUJUR — kalau tidak ada kaitan jelas, katakan begitu.
   JANGAN memaksakan narasi relevansi yang tidak berdasar.
5. Bahasa Indonesia sehari-hari yang mengalir, BUKAN terjemahan literal kaku.
   Istilah teknis baku (neural network, transformer, dst) boleh tetap Inggris.

INPUT:
Judul: {title}
Abstrak: {abstract}
Topik/subbidang: {subfield}
Venue: {venue}
Asal (Indonesia/internasional): {origin}

OUTPUT (JSON, tanpa markdown, tanpa teks lain di luar JSON):
{
  "summaryLayperson": "4-6 kalimat sesuai struktur di atas...",
  "summaryTechnical": "5-8 kalimat sesuai struktur di atas...",
  "relevanceIndonesia": "3-5 kalimat, jujur, tidak mengada-ada...",
  "extractedNumbers": ["daftar semua angka/persentase yang disebut di ringkasan, untuk verifikasi"]
}

Jika abstrak yang diberikan kosong atau kurang dari 50 kata, kembalikan:
{"error": "abstract_too_thin"}
```

## B.4 Validasi WAJIB sebelum menyimpan (kode, bukan LLM — murah & penting)

```
Untuk setiap hasil dari LLM:
1. Parse JSON. Gagal parse → skip, catat ke log, JANGAN simpan sebagian.
2. Ambil extractedNumbers dari respons LLM.
3. Untuk tiap angka di extractedNumbers: cek apakah angka itu (atau angka yang
   sangat mirip) muncul di teks abstrak asli.
4. Kalau ADA angka yang tidak ditemukan di abstrak → JANGAN auto-publish.
   Simpan dengan sourceType='ai_draft' tapi status TETAP 'draft' (bukan
   published) + catat di kolom log terpisah `docs/backfill-flagged.csv`
   (paperId, title, angka yang mencurigakan) — ini yang nanti Anda tunjukkan
   ke saya/user untuk direview manual, JANGAN diputuskan sendiri oleh script.
5. Kalau lolos → simpan sebagai summaries: language='id', sourceType='ai_draft',
   provenance='from_abstract', status='published' (SESUAI pengecualian B.0),
   authoredById=null.
```

Ini penting: **jangan biarkan script mem-publish buta.** Kalaupun 95% aman untuk demo, celah 5% yang mengarang angka adalah yang paling memalukan kalau terlihat bos.

## B.5 Keterkaitan antar paper ("Riset Serupa" — skala prototype, BUKAN full pipeline produksi)

Untuk demo, JANGAN bangun pipeline embedding+pgvector penuh (itu scope produksi). Cukup versi ringan yang tetap terasa nyata:

```
Untuk setiap paper P:
1. Ambil semua paper LAIN yang share minimal 1 subfield yang sama (paper_topics)
2. Dari kandidat itu, urutkan berdasarkan overlap kata kunci judul (sederhana:
   hitung kata-kata bermakna yang sama antara judul P dan kandidat — buang
   stopword umum ID/EN)
3. Ambil 5 kandidat teratas
4. SATU panggilan LLM per paper P (bukan per pasangan — hemat biaya), berikan
   judul P + daftar 5 kandidat (judul+tahun+abstrak ringkas), minta LLM pilih
   maksimal 3 yang benar-benar related_semantic DAN kalau ada yang jelas-jelas
   penerus (metode lebih baru menyelesaikan masalah sama), tandai relationType
   berbeda.
5. Simpan ke paper_relations dengan status LANGSUNG 'approved' (pengecualian
   demo yang sama seperti B.0 — di produksi ini harus 'suggested' dulu).
   confidence_score dari LLM tetap disimpan apa adanya.
6. JANGAN buat relasi kalau LLM sendiri tidak yakin (kembalikan array kosong
   itu hasil valid, bukan kegagalan yang harus dipaksa ada isinya).
```

**Prompt untuk langkah 4 (ringkas):**
```
Berikut satu paper utama dan 5 paper kandidat yang bertopik serupa.
Untuk MASING-MASING kandidat, tentukan salah satu:
- "related": topik serupa, sama-sama relevan dibaca bersamaan, TAPI bukan
  saling menggantikan
- "successor": kandidat ini adalah versi lebih baru yang menyelesaikan
  masalah yang sama dengan pendekatan lebih maju (HANYA jika benar-benar
  jelas dari abstrak, jangan menebak)
- "none": tidak cukup terkait untuk direkomendasikan

Jangan tandai "successor" hanya karena topik sama — topik NLP Bahasa Indonesia
dan NLP Bahasa Inggris BUKAN saling menggantikan meski temanya mirip.

[Paper utama: judul, tahun, abstrak singkat]
[Kandidat 1-5: judul, tahun, abstrak singkat]

Output JSON: [{"candidateIndex": 0, "verdict": "related|successor|none",
"reasoning": "1 kalimat alasan singkat, Bahasa Indonesia"}, ...]
```

## B.6 Urutan eksekusi & rate limit
1. Jalankan B.2-B.4 (ringkasan) untuk SEMUA paper dulu, sampai selesai/di-resume.
2. Baru jalankan B.5 (keterkaitan) — karena butuh abstrak ringkas yang sama, dan supaya paper yang error di tahap ringkasan tidak ikut jadi kandidat relasi.
3. Delay antar panggilan LLM sesuai rate limit provider yang dipakai (baca dokumentasi API-nya). Retry maksimal 2x kalau timeout, lalu skip & log — jangan menghentikan seluruh proses karena satu paper gagal.
4. Progress log ke console tiap 10 paper: `[45/103] processed, 3 flagged, 2 skipped`.

## B.7 Output & laporan akhir
Setelah script selesai, tulis `docs/backfill-report.md` berisi:
- Total paper diproses, berapa published, berapa di-flag (B.4.4), berapa error/skip.
- Total relasi tercipta, dipecah per relationType.
- Daftar isi `backfill-flagged.csv` disebut di laporan (jangan disalin ulang isinya).

## B.8 Acceptance criteria Bagian B
1. Query `SELECT COUNT(*) FROM summaries WHERE status='published' AND language='id'` mendekati jumlah total paper (kecuali yang flagged/error).
2. Ambil 5 ringkasan acak, baca manual — bukan satu paragraf, mengikuti struktur B.2, bahasa Indonesia mengalir bukan terjemahan kaku.
3. Ambil 1 paper yang punya `relevanceIndonesia` — kalau paper itu internasional tanpa kaitan jelas, kalimatnya JUJUR mengatakan tidak ada kaitan langsung (bukan dipaksakan).
4. Buka halaman detail paper yang punya relasi — kartu "Riset Serupa/Penerus" muncul dan linknya ke paper lain di database sendiri (internal, bukan keluar situs).
5. `docs/backfill-flagged.csv` ada dan bisa dibuka — ini yang akan direview manusia berikutnya.
6. Tidak ada satupun `summaryTechnical` yang mengandung angka yang tidak ada di `abstractRaw` paper terkait (spot-check 10 sampel manual).

---

# URUTAN KERJA UNTUK CODER
1. Bagian A dulu (desain) — dampak visual langsung terlihat, cepat.
2. Bagian B.2-B.4 (ringkasan) — paling penting, paling lama jalannya (biarkan jalan di background).
3. Bagian B.5 (relasi) — setelah B.2-4 selesai.
4. Laporkan balik: hasil acceptance criteria A.5 dan B.8, plus isi `backfill-report.md`.

Jangan gabung ke satu prompt raksasa — minta coder konfirmasi Bagian A selesai dulu sebelum mulai Bagian B, supaya kalau ada revisi warna, tidak mengganggu proses backfill yang sedang berjalan lama.
