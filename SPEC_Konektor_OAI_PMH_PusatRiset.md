# SPEC KONEKTOR OAI-PMH — PusatRiset.ai (Tahap Produksi)
### Menggantikan semua asumsi harvesting di PRD v2.1/v2.2. Ditulis SETELAH verifikasi lapangan.
### Bukan bagian dari prototype. Prototype tetap seed-only.

---

## 0. Status Fakta (apa yang sudah terbukti vs masih asumsi)

**TERVERIFIKASI (jangan diperdebatkan lagi):**

| Fakta | Bukti |
|---|---|
| Tidak ada REST API di ITB maupun UGM | HAR 1554 entries: nol hit `/api/v1/`. UGM OJS 2.4.8.1 memang tidak punya fitur itu |
| Tidak ada WAF/bot-protection | HAR: nol `cf-ray`/`x-sucuri`. curl 200 OK dengan User-Agent jujur |
| **Endpoint OAI ada PER JURNAL**, bukan per portal | `/index.php/jets/oai` → 200 OK; pola `/index.php/index/oai` tidak konsisten |
| Infrastruktur heterogen dalam satu institusi | `journals.itb.ac.id` = nginx/1.18.0; `jets.itb.ac.id` = Apache/2.4.52 |
| Versi OJS beragam & hidup berdampingan | ITB 3.3.0.2, UGM 2.4.8.1 |
| UGM: lisensi CC BY-SA ada di `dc:rights` per record | Sampel ListRecords IJCCS |
| UGM: DOI ada di record (`10.22146/...`) | Sampel yang sama |
| UGM: `dc:subject` sering kosong | Sampel yang sama |
| `oai_dc` tidak punya afiliasi penulis / ORCID | Struktur Dublin Core |
| UI Scholarhub = Digital Commons, `deletedRecord=no`, dataPolicy metadata-only | Identify response |
| UGM `deletedRecord=persistent` | Identify response |
| Cookie sesi standar `OJSSID` | curl response |

**MASIH ASUMSI (harus diverifikasi saat implementasi, jangan dijadikan dasar keputusan final):**
- Berapa % record OJS Indonesia yang punya DOI (baru terbukti di 1 jurnal UGM).
- Apakah `dc:rights` konsisten terisi di jurnal lain.
- **KONTRADIKSI TERCATAT:** riset awal melaporkan `ListSets` berhasil di level portal ITB; verifikasi terakhir menunjukkan path portal gagal. Discovery WAJIB mencoba kedua pola dan mencatat mana yang jalan — jangan berasumsi.

---

## 1. Perubahan Arsitektur dari Rencana Lama

| Rencana lama (asumsi) | Rencana baru (terverifikasi) |
|---|---|
| REST API OJS 3.x sebagai jalur kaya, OAI sebagai cadangan | **OAI-PMH satu-satunya jalur.** REST API dicoret; jadi bonus opsional kalau ada kampus memberi API key |
| 1 sumber = 1 portal kampus | **1 sumber = 1 JURNAL.** Ratusan sumber, masing-masing punya watermark & health sendiri |
| Daftar sumber diketik manual | **Discovery otomatis** (Bagian 3) — manual tidak realistis untuk ratusan endpoint |
| Butuh penanganan anti-bot | Tidak perlu. User-Agent jujur + rate limit sopan sudah cukup |
| Topik & afiliasi datang dari sumber | **Tidak datang dari sumber.** Harus diperkaya lewat DOI→OpenAlex, atau diturunkan/diklasifikasi (Bagian 5–6) |

---

## 2. Tambahan Skema (SQL)

```sql
-- Sumber kini = per jurnal, bukan per portal
ALTER TABLE sources
  ADD COLUMN platform VARCHAR(20) CHECK (platform IN ('ojs2','ojs3','digital_commons','dspace','eprints','unknown')),
  ADD COLUMN oai_base_url TEXT,                 -- hasil discovery, mis. https://journals.itb.ac.id/index.php/jets/oai
  ADD COLUMN oai_set_spec TEXT,                 -- opsional: batasi ke section tertentu
  ADD COLUMN institution_id UUID REFERENCES institutions(id),  -- utk derivasi afiliasi (Bagian 6)
  ADD COLUMN deleted_record_policy VARCHAR(15) CHECK (deleted_record_policy IN ('no','persistent','transient')),
  ADD COLUMN harvest_permission_status VARCHAR(20) DEFAULT 'unknown'
      CHECK (harvest_permission_status IN ('open','metadata_only','permission_required','granted','denied')),
  ADD COLUMN data_policy_raw TEXT,              -- teks dataPolicy/description dari Identify — SIMPAN, jangan diabaikan
  ADD COLUMN earliest_datestamp DATE,
  ADD COLUMN granularity VARCHAR(25),           -- 'YYYY-MM-DD' | 'YYYY-MM-DDThh:mm:ssZ'
  ADD COLUMN last_reconciled_at TIMESTAMPTZ;    -- utk sumber deleted_record_policy='no'

-- Lisensi: kini bisa dipastikan dari dc:rights, bukan ditebak
ALTER TABLE papers
  ADD COLUMN license_raw TEXT,                  -- string dc:rights apa adanya (bukti audit)
  ADD COLUMN license_normalized VARCHAR(20) DEFAULT 'unknown'
      CHECK (license_normalized IN ('cc_by','cc_by_sa','cc_by_nc','cc_by_nc_sa','cc0','other_open','restricted','unknown')),
  ADD COLUMN affiliation_inferred BOOLEAN DEFAULT FALSE,   -- TRUE = afiliasi ditebak dari jurnal, bukan terverifikasi
  ADD COLUMN enrichment_status VARCHAR(20) DEFAULT 'pending'
      CHECK (enrichment_status IN ('pending','enriched_openalex','no_doi','not_found_openalex','failed'));

-- Judul dwibahasa (dc:title sering berisi ID + EN dalam satu record)
CREATE TABLE paper_titles (
  paper_id  UUID REFERENCES papers(id) ON DELETE CASCADE,
  language  VARCHAR(5) NOT NULL,
  title     TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (paper_id, language)
);
```

**ATURAN KERAS — `abstract_display_policy` menjadi TURUNAN, bukan input manual:**
```
license_normalized IN (cc_by, cc_by_sa, cc_by_nc, cc_by_nc_sa, cc0, other_open)  → 'full'
OR OpenAlex is_oa = true                                                          → 'full'
sources.harvest_permission_status = 'metadata_only'                               → 'summary_only' (MENANG atas aturan di atas)
selain itu                                                                        → 'summary_only'
```
Baris ketiga tidak bisa ditawar: untuk sumber seperti UI Scholarhub yang menyatakan metadata-only, abstrak tidak ditampilkan meski lisensinya terbuka — sampai status berubah jadi `granted`.

---

## 3. Discovery Sumber (menggantikan "daftar manual")

Karena endpoint per jurnal, daftar sumber dibangun programatis:

**Langkah 1 — Kumpulkan kandidat jurnal:**
- API DOAJ difilter negara Indonesia → nama jurnal, ISSN, URL homepage.
- Daftar SINTA 1–2 (untuk penentuan `tier`) — sumber terserah (ekspor manual sekali pun cukup).
- Filter awal topik AI/informatika dari nama & scope jurnal (kasar; presisi datang dari classifier per-paper nanti).

**Langkah 2 — Turunkan kandidat endpoint OAI dari URL homepage.** Uji berurutan, ambil yang pertama merespons XML valid untuk `verb=Identify`:
```
{base}/oai
{base}/index.php/{journalPath}/oai
{base}/index.php/index/oai          ← pola portal; CATAT hasilnya (menyelesaikan kontradiksi tercatat)
{base}/do/oai/                      ← Digital Commons
```

**Langkah 3 — Rekam hasil `Identify` ke `sources`:** `platform` (deteksi dari `repositoryName`/`protocolVersion`/pola URL), `deleted_record_policy`, `granularity`, `earliest_datestamp`, dan **`data_policy_raw`** (wajib — kalau teksnya menyebut pembatasan harvesting, set `harvest_permission_status='metadata_only'` atau `'permission_required'` dan JANGAN harvest abstrak).

**Langkah 4 — `ListSets`:** simpan set yang relevan. Untuk portal besar (ITB: 177 set), pilih hanya set jurnal/section bertopik AI/komputer → hemat volume di hulu.

**Langkah 5 — Antrean review manual singkat** sebelum sumber diaktifkan: cek `tier`, `institution_id`, dan status izin. Ini satu-satunya sentuhan manual, dan hanya sekali per jurnal.

---

## 4. Harvest

- Verb: `ListRecords&metadataPrefix=oai_dc` + `from={last_success}` untuk inkremental; paging via `resumptionToken` → `harvest_state.cursor_value`.
- Header wajib: `User-Agent: PusatRisetAI-Harvester/1.0 (+mailto:kontak@pusatriset.ai)`, `Accept: application/xml`.
- Rate limit: **1 request/detik per host** (bukan per jurnal — banyak jurnal berbagi host).
- Backoff eksponensial pada 429/503; circuit breaker per host setelah N kegagalan berturut-turut.
- **Jangan pernah memalsukan User-Agent browser.** Kalau diblokir: hubungi admin jurnal, minta whitelist. Ini keputusan kebijakan, bukan teknis.
- Alert bila `records_fetched = 0` padahal historisnya > 0.
- Jangan scraping HTML sebagai jalan pintas — HAR menunjukkan halaman jurnal penuh skrip ad-tech pihak ketiga; XML OAI jauh bersih.

**Rekonsiliasi untuk `deleted_record_policy='no'`** (mis. UI Scholarhub): tiap 3 bulan jalankan `ListIdentifiers` penuh, bandingkan dengan DB, tandai yang hilang sebagai `metadata_status='withdrawn'` (jangan hapus). Tanpa ini, artikel yang ditarik penerbit akan terus tayang di platform kita.

---

## 5. Mapping `oai_dc` → Skema

| Field OAI | Tujuan | Aturan |
|---|---|---|
| `dc:title` | `paper_titles` | Bisa muncul >1× (ID + EN). Deteksi bahasa tiap nilai; `is_primary` = bahasa asli jurnal. `papers.title` = judul primary |
| `dc:creator` | `authors` | Nama polos. Format bisa "Nama, Depan" atau "Depan Nama" — normalisasi. **Jangan parse institusi dari string ini** |
| `dc:description` | `abstract_raw` | Bisa >1× (abstrak dwibahasa) — simpan primary; ambil yang terpanjang bila ambigu |
| `dc:date` | `published_date` | Format bervariasi; parse toleran, fallback ke tahun saja |
| `dc:identifier` | `paper_identifiers` | **Bisa >1× dan campur.** Regex `10\.\d{4,9}/\S+` → DOI; `https?://` → `canonical_url`; sisanya `oai_identifier` |
| `dc:rights` | `license_raw` + `license_normalized` | Cocokkan pola "creativecommons.org/licenses/by-sa" dst. Tidak cocok → `unknown` |
| `dc:source` | `venue_name_raw`, ISSN | ISSN → cocokkan ke `approved_venues.issn_l` untuk penentuan tier |
| `dc:language` | `papers.language` | — |
| `dc:subject` | `paper_topics` | **Sering kosong.** Kalau ada, simpan sebagai keyword mentah — BUKAN sebagai subfield resmi |
| `dc:type` | — | Filter: buang `editorial`, `book review`, dsb bila terdeteksi |
| header `datestamp` | watermark | — |
| header `status="deleted"` | `metadata_status='withdrawn'` | Hanya tersedia pada sumber `persistent` |

---

## 6. Pengayaan (menutup lubang topik & afiliasi)

**Alur wajib setelah harvest, per record:**

1. **Ada DOI?** → query OpenAlex `https://api.openalex.org/works/doi:{doi}?mailto=...`
   - **Ketemu** → ambil `topics` (subfield resmi), `authorships[].institutions` (afiliasi TERVERIFIKASI, `affiliation_inferred=false`), `cited_by_count`, `counts_by_year`, `fwci`, `citation_normalized_percentile`, `open_access.is_oa`. Set `enrichment_status='enriched_openalex'`.
   - Bonus: dedup ke record OpenAlex yang sudah ada terjadi otomatis lewat exact-match DOI.
   - **Tidak ketemu** → `enrichment_status='not_found_openalex'`, lanjut ke langkah 2 & 3.
2. **Tidak ada DOI / tidak ketemu** → afiliasi diturunkan dari `sources.institution_id` (jurnal ITB → penulis diasumsikan ITB), **`affiliation_inferred=true`**. Jangan pernah tebak dari nama penulis.
3. **Topik** → klasifikasi sendiri dari judul+abstrak ke taksonomi subfield internal (embedding/classifier), plus blocklist "inseminasi buatan"/AI non-kecerdasan-buatan. Hasil klasifikasi ini adalah klaim internal, bukan fakta sumber.

**Konsekuensi UI:** halaman profil institusi wajib membedakan "terverifikasi" vs "perkiraan". Jangan gabungkan diam-diam.

---

## 7. Pilot (langkah nyata berikutnya)

**Fase A — Discovery (1–2 hari):** jalankan Bagian 3 atas daftar DOAJ Indonesia. Output: tabel `sources` terisi + laporan berapa % kandidat yang endpoint OAI-nya hidup, dan pola URL mana yang menang. **Ini sekaligus menyelesaikan kontradiksi ListSets ITB.**

**Fase B — Pilot 10–20 jurnal (1 minggu):** pilih jurnal AI/informatika SINTA 1–2 atau DOAJ dari ≥5 institusi berbeda, minimal 1 OJS 2.x dan 1 OJS 3.x. Jalankan harvest penuh + inkremental 2 siklus.

**Metrik yang harus dilaporkan Fase B** (ini yang mengubah asumsi jadi fakta):
- % record punya DOI → menentukan seberapa besar ketergantungan pada klasifikasi mandiri.
- % record punya `dc:rights` terisi → menentukan berapa banyak abstrak bisa tampil penuh.
- % record ketemu di OpenAlex → menentukan biaya pengayaan.
- % record `dc:subject` kosong, jumlah judul dwibahasa, jumlah kegagalan parsing tanggal.
- Jumlah host yang butuh whitelist.

**Fase C:** berdasarkan angka Fase B, putuskan skala harvest penuh dan anggaran klasifikasi.

---

## 8. Yang TIDAK dibangun

- REST API OJS connector — dicoret.
- Scraping HTML — hanya kalau ada jurnal penting tanpa OAI sama sekali, dan itu keputusan terpisah.
- Harvest UI Scholarhub di luar metadata — tunggu izin tertulis.
- Endpoint OAI keluaran PusatRiset.ai sendiri — ditunda, bukan prioritas pembuatan.
