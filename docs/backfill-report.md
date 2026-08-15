# Laporan Backfill Konten (Bagian B.2-B.4)

Dijalankan: 2026-08-14T23:59:59.125Z
Provider/model terakhir dipakai: openrouter:nvidia/nemotron-3-super-120b-a12b:free

## Ringkasan
- Total paper dikandidatkan (belum punya summary ai_draft bahasa Indonesia): 45
- Published (lolos validasi angka B.4, langsung tayang — sourceType='ai_draft', B.0): 1
- Di-flag (ada angka tak terverifikasi, status TETAP draft, masuk backfill-flagged.csv): 0
- Dilewati (abstrak kosong/kurang dari 50 kata): 21
- Error (gagal total di SEMUA provider — network/timeout/kuota Gemini+OpenRouter habis): 23

## Detail
Daftar paper yang di-flag ada di `docs/backfill-flagged.csv` (0 baris) — ini
yang perlu direview manusia sebelum diputuskan publish manual atau diedit.

## Catatan
- Semua summary hasil script ini memakai sourceType='ai_draft' (BUKAN 'ai_reviewed') sesuai
  pengecualian B.0 — status published TIDAK berarti sudah ditinjau editor sungguhan.
- Jalankan ulang script ini aman (resume-safe): paper yang sudah punya summary ai_draft
  bahasa Indonesia (published atau ter-flag) tidak diproses ulang.

## Bagian B.5 — Keterkaitan Antar Paper

Dijalankan: 2026-08-15T01:12:24.309Z
Provider/model terakhir dipakai: openrouter:nvidia/nemotron-nano-12b-v2-vl:free

- Pool paper diproses (punya summary, layak jadi kandidat): 89
- Paper tanpa kandidat sesubbidang (dilewati, tidak ada panggilan LLM): 4
- Error (gagal total di semua provider): 59
- Total relasi tersimpan: 32
  - related_semantic ("Riset Serupa"): 32
  - superseded_by ("Riset Penerus"): 0

Semua relasi hasil script ini langsung status='approved' sesuai pengecualian demo B.0 —
produksi normal harus lewat antrean admin ('suggested' -> approve).
