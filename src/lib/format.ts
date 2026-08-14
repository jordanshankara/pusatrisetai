/// Bagian 6.8: semua tanggal render lokal id-ID; simpan UTC (DB tetap UTC, ini hanya lapisan tampilan).
export function formatDateId(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(d);
}

export function formatYearId(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", { year: "numeric", timeZone: "UTC" }).format(d);
}
