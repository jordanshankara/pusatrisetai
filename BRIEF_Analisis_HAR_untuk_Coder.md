# BRIEF UNTUK CODER — Analisis File .HAR (Jurnal ITB)

**Status pekerjaan:** RISET PARALEL, bukan blocker.
**Prioritas:** DI BAWAH prototype. Prototype pakai data seed, tidak butuh hasil ini sama sekali.
**Jangan** ubah apa pun di build spec prototype berdasarkan temuan di sini.

---

## 1. Kenapa file ini ada

Kita akan membangun konektor pengambil data jurnal Indonesia (tahap produksi, bukan sekarang). Sebelum menulis konektor, kita perlu tahu **jalur data mana yang tersedia**. File .har adalah rekaman semua lalu lintas jaringan saat sebuah halaman jurnal dibuka di browser sungguhan — dari situ ketahuan endpoint apa saja yang sebenarnya hidup.

**Dua pertanyaan yang harus dijawab file ini:**

- **P1 — Jalur data:** Apakah jurnal ini menyediakan REST API JSON (`/api/v1/...`), atau hanya HTML server-side (artinya konektor kita wajib lewat OAI-PMH)?
- **P2 — Proteksi bot:** Header/cookie apa yang dikirim browser sungguhan, yang tidak dikirim script otomatis? Ini menjawab kenapa `curl` ke endpoint OAI ITB gagal padahal halaman biasa berhasil.

P2 sama pentingnya dengan P1. Jangan diabaikan.

---

## 2. Cara baca file .har

`.har` adalah file JSON biasa. Struktur: `log.entries[]`, tiap entry berisi `request` (url, method, headers) dan `response` (status, headers, content).

Pakai `jq`. Perintah siap pakai:

```bash
HAR=path/ke/file.har

# (a) Semua URL + status + content-type — gambaran umum
jq -r '.log.entries[] | "\(.response.status) \(.request.method) \(.request.url)"' $HAR | sort -u

# (b) P1 — cari REST API OJS
jq -r '.log.entries[] | select(.request.url | test("/api/v1/|/oai\\?|verb=")) | "\(.response.status) \(.request.url)"' $HAR

# (c) Semua response JSON (kandidat endpoint data)
jq -r '.log.entries[] | select(.response.content.mimeType // "" | test("json")) | .request.url' $HAR | sort -u

# (d) Request internal saja (buang CDN/analytics pihak ketiga)
jq -r '.log.entries[] | select(.request.url | test("itb\\.ac\\.id")) | "\(.response.status) \(.request.url)"' $HAR | sort -u

# (e) P2 — header yang dikirim browser ke domain jurnal (nama header saja, jangan nilai sensitifnya)
jq -r '.log.entries[] | select(.request.url | test("itb\\.ac\\.id")) | .request.headers[].name' $HAR | sort -u

# (f) P2 — jejak WAF/bot-protection di response header
jq -r '.log.entries[] | .response.headers[] | select(.name | ascii_downcase | test("server|cf-|x-sucuri|x-cache|set-cookie")) | "\(.name): \(.value)"' $HAR | sort -u | head -40
```

---

## 3. Yang dicari dan artinya

| Temuan | Artinya untuk konektor |
|---|---|
| Ada `/api/v1/submissions` atau `/api/v1/issues` status 200 | REST API OJS aktif → jalur data kaya tersedia (tapi umumnya butuh API key per jurnal) |
| Tidak ada `/api/v1/...` sama sekali | Server-side rendering klasik → **konektor WAJIB lewat OAI-PMH**. Ini hasil yang valid, bukan kegagalan |
| Response header `server: cloudflare` / ada `cf-ray` / `__cf_bm` cookie | Ada WAF Cloudflare → harvester perlu User-Agent jelas + rate limit sopan; kemungkinan perlu minta whitelist ke admin jurnal |
| Header `user-agent`, `accept`, `accept-language` lengkap di request browser | Catat sebagai referensi header yang harus dikirim harvester kita (identitas jujur, bukan menyamar) |
| Ada endpoint XHR internal lain (bukan analytics) | Kandidat sumber data tambahan — catat URL + bentuk responsnya |

---

## 4. Output yang diminta

Tulis **satu file** `docs/riset/har-analysis-itb.md`, isi ringkas (maksimal 1 halaman):

1. **Jawaban P1**: REST API ada / tidak ada. Kalau ada, daftar endpoint + status code.
2. **Jawaban P2**: WAF terdeteksi apa (dari header). Daftar nama header yang dikirim browser ke domain jurnal.
3. **Daftar endpoint internal** yang mengembalikan JSON (kalau ada).
4. **Rekomendasi satu paragraf**: jalur data apa yang dipakai konektor ITB nanti, dan penyesuaian apa yang dibutuhkan agar tidak diblokir.
5. **Catatan keterbatasan**: HAR ini hanya 1 jurnal (JETS/ITB) — tidak mewakili semua jurnal Indonesia. UGM (OJS 2.4.8.1) sudah dipastikan tidak punya REST API.

---

## 5. Larangan

- **Jangan tulis kode konektor sekarang.** Ini riset, output-nya dokumen.
- **Jangan commit file .har ke repo.** Meski "sanitized", HAR bisa membawa sisa data sesi/IP. Simpan di folder lokal yang masuk `.gitignore`. Yang di-commit hanya file analisis `.md`-nya.
- **Jangan salin nilai cookie/token ke dalam laporan.** Cukup tulis nama headernya.
- **Jangan ubah build spec prototype** berdasarkan temuan di sini.
- **Jangan menyamar sebagai browser** di harvester nanti (spoof User-Agent palsu). Prinsip kita: identitas jujur + kontak email + rate limit sopan + kalau perlu minta izin whitelist ke admin jurnal.

---

## 6. Kalau HAR ternyata kosong dari API

Itu jawaban yang sah dan justru menyederhanakan: berarti seluruh strategi harvesting kita bertumpu pada OAI-PMH, satu jalur untuk semua jurnal. Tulis saja temuannya apa adanya di dokumen — jangan dipaksa mencari yang tidak ada.
