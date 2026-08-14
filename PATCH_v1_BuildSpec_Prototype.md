# PATCH v1 untuk BUILD_SPEC_Prototype_PusatRiset_ai.md
### WAJIB dibaca bersama build spec. Patch ini MENIMPA bagian yang disebut di bawah.
### Alasan: build spec ditulis sebelum verifikasi lapangan OAI-PMH selesai. Empat hal berubah di fondasi.

**Aturan konflik:** kalau isi patch ini berbeda dari build spec, **patch ini yang menang.**
**Yang TIDAK berubah:** seluruh Bagian 2 (scope), 3 (stack), 5 (API) kecuali yang disebut eksplisit, 7 (halaman) kecuali yang disebut eksplisit. Prototype tetap seed-only, tetap tanpa harvester.

---

## PATCH 1 — Lisensi: `abstractDisplayPolicy` menjadi TURUNAN, bukan input manual

**Alasan:** verifikasi lapangan membuktikan jurnal Indonesia (UGM) mencantumkan lisensi CC BY-SA per record di `dc:rights`. Artinya kebijakan tampil-tidaknya abstrak punya dasar legal terdokumentasi, bukan tebakan. Ini harus jadi fondasi sejak awal karena menentukan logika API dan UI.

### Tambahan di model `Paper` (schema.prisma):
```prisma
enum License { cc_by cc_by_sa cc_by_nc cc_by_nc_sa cc0 other_open restricted unknown }

// tambahkan ke model Paper:
  /// String lisensi apa adanya dari sumber (dc:rights / OpenAlex). Bukti audit — jangan dinormalisasi di tempat ini.
  licenseRaw        String?  @map("license_raw")
  licenseNormalized License  @default(unknown) @map("license_normalized")
```

### Aturan turunan (implement sebagai fungsi `deriveAbstractPolicy()` di `src/lib/rules/abstract-policy.ts`):
```
INPUT: licenseNormalized, isOpenAccess (bool, opsional), sourcePermission ('open'|'metadata_only'|null)

1. JIKA sourcePermission === 'metadata_only'        → 'summary_only'   // MENANG atas semua aturan lain
2. JIKA licenseNormalized ∈ {cc_by, cc_by_sa, cc_by_nc, cc_by_nc_sa, cc0, other_open} → 'full'
3. JIKA isOpenAccess === true                       → 'full'
4. selain itu                                        → 'summary_only'
```
Langkah 1 tidak boleh dihilangkan meski prototype belum punya tabel `sources` — terima `sourcePermission` sebagai parameter opsional (di seed selalu `null` kecuali kasus uji). Ini memastikan aturan tidak perlu ditulis ulang di tahap produksi.

**`abstractDisplayPolicy` TETAP ADA sebagai kolom** (hasil derivasi disimpan, untuk kecepatan query), tapi **wajib diisi lewat `deriveAbstractPolicy()`**, tidak pernah diketik manual — termasuk di seed. Tulis satu test unit untuk fungsi ini (4 kasus di atas).

---

## PATCH 2 — Judul dwibahasa: tabel `paper_titles`

**Alasan:** `dc:title` di jurnal Indonesia sering berisi judul Indonesia DAN Inggris dalam satu record. Satu kolom `title` tidak cukup, dan menambahkannya nanti = migrasi menyakitkan.

### Tabel baru:
```prisma
model PaperTitle {
  paperId   String  @map("paper_id")
  paper     Paper   @relation(fields: [paperId], references: [id], onDelete: Cascade)
  language  String                        /// 'id' | 'en' | lainnya
  title     String
  isPrimary Boolean @default(false) @map("is_primary")
  @@id([paperId, language])
  @@map("paper_titles")
}
```
Tambahkan `titles PaperTitle[]` ke model `Paper`.

**`Paper.title` TETAP ADA** sebagai judul primary (denormalisasi untuk FTS, sorting, dan kesederhanaan query). Aturan: `Paper.title` HARUS sama dengan `PaperTitle` yang `isPrimary=true`. Enforce di seed dan di helper penulisan.

### Dampak UI (Bagian 7 build spec):
- Halaman detail: tampilkan judul primary sebagai H1; kalau ada judul bahasa lain, tampilkan di bawahnya dengan gaya lebih kecil/miring dan label bahasa. Jangan tampilkan dua H1.
- Katalog: judul primary saja.

### Dampak seed (Bagian 8): minimal 8 paper Indonesia harus punya judul ID + EN sekaligus, untuk menguji tampilan ini.

---

## PATCH 3 — Afiliasi perkiraan: `affiliationInferred`

**Alasan:** metadata OAI (Dublin Core) tidak memuat afiliasi penulis sama sekali. Di produksi, sebagian afiliasi akan diturunkan dari jurnalnya (jurnal ITB → diasumsikan penulis ITB), bukan terverifikasi. Platform harus jujur membedakan keduanya, dan UI-nya harus dibangun sejak awal.

### Tambahan di model `Paper`:
```prisma
  /// TRUE = afiliasi ditebak dari institusi penerbit jurnal, bukan dari data penulis terverifikasi
  affiliationInferred Boolean @default(false) @map("affiliation_inferred")
```

### Dampak UI:
- Halaman detail, di baris afiliasi penulis: kalau `affiliationInferred=true`, tampilkan penanda kecil "afiliasi perkiraan" dengan tooltip: "Afiliasi diperkirakan dari institusi penerbit jurnal, belum terverifikasi dari data penulis."
- **JANGAN** menyembunyikannya atau menampilkannya seolah data pasti.

### Dampak seed: minimal 5 paper dengan `affiliationInferred=true`.

---

## PATCH 4 — Status pengayaan: `enrichmentStatus`

**Alasan:** di produksi, kelengkapan metadata (topik, sitasi, afiliasi) bergantung pada apakah DOI paper ketemu di OpenAlex. Kolom ini menandai kualitas data per record dan dipakai admin untuk triase.

```prisma
enum EnrichmentStatus { pending enriched_openalex no_doi not_found_openalex failed }

// tambahkan ke model Paper:
  enrichmentStatus EnrichmentStatus @default(pending) @map("enrichment_status")
```

**Dampak UI:** tampilkan HANYA di halaman admin (kolom kecil di antrean), **JANGAN** di halaman publik. Seed: sebarkan beragam nilai, termasuk beberapa `no_doi` dan `not_found_openalex`.

---

## PATCH 5 — Penegasan yang sudah benar (jangan diubah)

Temuan lapangan **mengonfirmasi** keputusan-keputusan ini di build spec. Coder tidak perlu mengubahnya, tapi harus tahu alasannya supaya tidak "memperbaiki" yang sudah benar:

- **Identitas jamak (`PaperIdentifier`)** — terbukti perlu: `dc:identifier` di OAI bisa muncul berkali-kali dan campur (DOI, URL, ID internal).
- **`metadataStatus` punya nilai `withdrawn`** — terbukti perlu: sebagian sumber menghapus record tanpa pemberitahuan, jadi kita menandai, bukan menghapus.
- **Sensor abstrak dilakukan di lapisan API, bukan UI** (Bagian 6.2) — tetap berlaku mutlak, dan sekarang makin penting karena aturannya berbasis lisensi.
- **Dua sumbu editorial** (Bagian 6.1) — tidak berubah sama sekali.
- **Prototype tanpa harvester** — tetap. Semua temuan OAI lain (endpoint per jurnal, tanpa REST API, tanpa WAF, rekonsiliasi) TIDAK berlaku untuk prototype dan tidak boleh dibangun sekarang.

---

## PATCH 6 — Tambahan acceptance criteria (menambah Bagian 2.3 build spec)

9. Fungsi `deriveAbstractPolicy()` punya unit test dan lulus 4 kasus; tidak ada satu pun `abstractDisplayPolicy` di seed yang diketik manual.
10. Paper berlisensi CC BY-SA menampilkan abstrak penuh; paper `licenseNormalized='restricted'` tidak menampilkan abstrak dan API-nya tidak mengirim `abstractRaw`.
11. Paper dengan judul ID+EN menampilkan keduanya di halaman detail (satu H1 + satu judul sekunder berlabel bahasa).
12. Paper `affiliationInferred=true` menampilkan penanda "afiliasi perkiraan" di halaman detail.
13. `enrichmentStatus` muncul di halaman admin dan TIDAK muncul di halaman publik mana pun.
