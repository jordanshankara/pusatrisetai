#!/bin/bash
set -uo pipefail
cd "F:\0. Code\pusatriset"

TOTAL_CANDIDATES=63014

# --- Bagian 1: lanjutkan fetch Indonesia sampai benar-benar tuntas (auto-retry kalau DB blip) ---
attempt=0
while true; do
  attempt=$((attempt+1))
  echo "=== [ID] Percobaan ke-$attempt — $(date) ===" >> docs/fetch-openalex.log
  ENABLE_OPENALEX_FETCH=true npx tsx scripts/fetch-openalex.ts --countries=ID >> docs/fetch-openalex.log 2>&1

  last_selesai=$(grep "^Selesai\." docs/fetch-openalex.log | tail -1)
  diproses=$(echo "$last_selesai" | grep -oP 'diproses=\K[0-9]+')

  if [ -n "$diproses" ] && [ "$diproses" -ge "$TOTAL_CANDIDATES" ]; then
    echo "=== [ID] BENAR-BENAR SELESAI: $last_selesai ===" >> docs/fetch-openalex.log
    break
  fi

  echo "=== [ID] Berhenti prematur (diproses=$diproses dari $TOTAL_CANDIDATES) — tunggu 30s lalu ulangi ===" >> docs/fetch-openalex.log
  sleep 30
done

echo "=== [ID] FETCH INDONESIA TUNTAS — $(date) ===" >> docs/fetch-openalex.log

# --- Bagian 2: lanjut otomatis ke US+CN (filter kata kunci sama, tidak diubah) ---
attempt=0
while true; do
  attempt=$((attempt+1))
  echo "=== [US|CN] Percobaan ke-$attempt — $(date) ===" >> docs/fetch-openalex-intl.log
  ENABLE_OPENALEX_FETCH=true npx tsx scripts/fetch-openalex.ts --countries=US\|CN >> docs/fetch-openalex-intl.log 2>&1

  last_selesai=$(grep "^Selesai\." docs/fetch-openalex-intl.log | tail -1)
  if [ -n "$last_selesai" ] && ! grep -q "gagal permanen" <<< "$(tail -5 docs/fetch-openalex-intl.log)"; then
    echo "=== [US|CN] SELESAI: $last_selesai ===" >> docs/fetch-openalex-intl.log
    break
  fi

  echo "=== [US|CN] Berhenti prematur — tunggu 30s lalu ulangi ===" >> docs/fetch-openalex-intl.log
  sleep 30
done

echo "=== SEMUA TUNTAS (ID + US|CN) — $(date) ===" >> docs/fetch-openalex-intl.log
