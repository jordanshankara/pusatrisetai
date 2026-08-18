#!/bin/bash
set -uo pipefail
cd "F:\0. Code\pusatriset"

attempt=0
while true; do
  attempt=$((attempt+1))
  echo "=== [US|CN] Percobaan ke-$attempt — $(date) ===" >> docs/fetch-openalex-intl.log
  ENABLE_OPENALEX_FETCH=true npx tsx scripts/fetch-openalex.ts --countries=US\|CN >> docs/fetch-openalex-intl.log 2>&1

  last_selesai=$(grep "^Selesai\." docs/fetch-openalex-intl.log | tail -1)
  diproses=$(echo "$last_selesai" | grep -oP 'diproses=\K[0-9]+')
  inserted=$(echo "$last_selesai" | grep -oP 'inserted=\K[0-9]+')

  if [ -n "$diproses" ]; then
    echo "=== [US|CN] Run selesai: $last_selesai ===" >> docs/fetch-openalex-intl.log
    if [ "$inserted" = "0" ] && [ "$diproses" -gt "0" ]; then
      echo "=== [US|CN] inserted=0 pada run lengkap — dianggap TUNTAS/jenuh, berhenti ===" >> docs/fetch-openalex-intl.log
      break
    fi
  fi

  echo "=== [US|CN] Tunggu 30s lalu ulangi (attempt $attempt) ===" >> docs/fetch-openalex-intl.log
  sleep 30
done

echo "=== [US|CN] LOOP BERHENTI — $(date) ===" >> docs/fetch-openalex-intl.log
