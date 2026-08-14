# Analisis HAR — Jurnal JETS (journals.itb.ac.id)

Sumber: `jets.itb.ac.id.har` (1554 entries jaringan, sesi browser nyata menjelajah artikel + pencarian + halaman admin/login). File `.har` **tidak** disertakan di repo (lihat `.gitignore`).

## P1 — Jalur data: REST API atau HTML server-side?

**Tidak ada REST API.** Nol hit ke pola `/api/v1/...` atau `/oai?verb=...` di seluruh 1554 entries. Semua 106 request internal ke `itb.ac.id` adalah:

- Halaman HTML server-rendered klasik OJS: `/jets/article/view/{id}`, `/jets/search/search?query=...`, `/jets/index`, `/jets/reviewers`, `/jets/guide`, `/jets/copyright`, dll.
- Aset statis (gambar cover, CSS, JS, font) dari `/public/...`, `/lib/pkp/...`, `/plugins/generic/ojtPlugin/...` (tema "Noble").
- Redirect `index.php/jets/...` → `jets/...` (301, url rewrite standar OJS).
- Halaman login (`/jets/login`) saat mencoba akses panel admin tanpa sesi.

Satu-satunya JSON yang muncul di seluruh HAR berasal dari **domain pihak ketiga** (ad-tech/analytics: Criteo, id5-sync, Rubicon, OpenX, Google Ads, scimagojr.com) — nol JSON dari domain `itb.ac.id`.

**Kesimpulan P1**: OJS di sini berjalan sebagai server-side rendering klasik, tanpa REST API OJS aktif (fitur REST API OJS 3.x memang defaultnya off/perlu API key manual). Konektor produksi **wajib lewat OAI-PMH**, sama seperti UGM.

## P2 — Proteksi bot

Tidak ditemukan WAF pihak ketiga (Cloudflare, Sucuri, dll). Bukti:

- `Server` response header (yang tidak diredaksi) = `Apache/2.4.52 (Ubuntu)` konsisten di semua 706 response internal berstatus 200 (nilai yang tampak diredaksi di sebagian response ternyata panjang string-nya sama persis, 22 karakter — sangat mungkin nilai yang sama, hanya disensor oleh tool perekam HAR untuk sebagian response).
- Tidak ada header `cf-ray`, `cf-cache-status`, `x-sucuri-*`, atau `server: cloudflare`.
- Header keamanan **ada dan kuat**: `Content-Security-Policy`, `Strict-Transport-Security` (HSTS, 1 tahun + preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy` — ini hardening aplikasi/server standar, bukan indikasi bot-blocking aktif.
- `Set-Cookie` dan `Cookie` sepenuhnya kosong di rekaman ini (kemungkinan diredaksi oleh tool sanitisasi HAR — konsisten dengan catatan di brief bahwa nilai sesi/cookie tidak boleh disalin). Tidak bisa disimpulkan apakah ada cookie sesi PHP standar; asumsikan OJS pakai `OJSSID` (default PHP session) seperti instalasi OJS pada umumnya.

Header yang **dikirim browser** ke domain `itb.ac.id` (nama saja): `Host, User-Agent, Accept, Accept-Encoding, Accept-Language, Connection, Referer, Upgrade-Insecure-Requests, Sec-Fetch-Dest/Mode/Site/User/Storage-Access, Sec-Browsing-Topics, Sec-Purpose, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, Origin, Cache-Control, Content-Length, Priority` — kombinasi header `Sec-Fetch-*` dan `sec-ch-ua*` standar Chrome modern, bukan sesuatu yang bisa/perlu ditiru harvester (harvester semestinya jujur mengidentifikasi diri, bukan memalsukan browser).

**Kesimpulan P2**: Tidak ada bukti WAF/bot-protection agresif di JETS/ITB — tidak seperti dugaan awal soal kenapa `curl` OAI ITB sempat gagal. Kemungkinan penyebab kegagalan curl sebelumnya lebih ke arah rate-limit sederhana, User-Agent kosong/default ditolak, atau masalah jaringan sesaat — bukan WAF khusus. **Perlu diverifikasi ulang dengan curl + User-Agent eksplisit** sebelum menyimpulkan lebih jauh (di luar scope HAR ini).

## Daftar endpoint internal yang mengembalikan JSON

**Tidak ada.** Nol endpoint `itb.ac.id` mengembalikan `content-type` JSON di seluruh HAR.

## Rekomendasi

Konektor ITB (dan kemungkinan besar mayoritas jurnal OJS Indonesia lain) **harus dibangun di atas OAI-PMH**, bukan REST API — selaras dengan temuan UGM (OJS 2.4.8.1, juga tanpa REST). Karena tidak ada WAF terdeteksi, tidak perlu header/cookie penyamaran khusus; cukup: (1) `User-Agent` jujur yang menyebut nama proyek + kontak email (mis. `PusatRisetAI-Harvester/1.0 (+mailto:dev@pusatriset.ai)`), (2) `Accept: application/xml`, (3) rate limit sopan (misal 1 request/detik, backoff pada 429/503), dan (4) siap menangani `resumptionToken` untuk paging (terlihat di sampel ITB `ListSets` sebelumnya — 177 set, dipaging). Kalau `curl` polos ke endpoint OAI ITB tetap gagal setelah pakai User-Agent yang jelas, kemungkinan besar itu soal rate-limit/geo-block sesaat, bukan WAF terstruktur — perlu dicoba ulang dan dicatat status code + body error-nya sebelum berasumsi lebih jauh.

## Catatan keterbatasan

HAR ini hanya merekam **satu jurnal** (JETS/ITB, OJS 3.3.0.2, tema Noble) dari satu platform (`journals.itb.ac.id`) — tidak mewakili seluruh ekosistem jurnal Indonesia, yang mencakup ratusan instalasi OJS versi berbeda (2.x sampai 3.x), tema berbeda, dan kebijakan hosting/keamanan berbeda per institusi. UGM (OJS 2.4.8.1) sudah dipastikan terpisah tidak punya REST API. Temuan "tidak ada WAF" di sini **tidak bisa digeneralisasi** — jurnal lain (terutama yang di-hosting Elsevier/Digital Commons seperti UI Scholarhub, atau di belakang CDN kampus) bisa punya proteksi berbeda dan wajib dicek HAR-nya masing-masing sebelum konektor produksi ditulis.
