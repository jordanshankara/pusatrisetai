import type { TrendsResult } from "@/lib/services/papers";

export function YearBarChart({ data }: { data: TrendsResult["byYear"] }) {
  if (data.length === 0) return <p className="text-sm text-secondary">Belum ada data.</p>;

  const max = Math.max(1, ...data.map((d) => d.local + d.international));

  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ minHeight: 220 }}>
      {data.map((d) => (
        <div key={d.year} className="flex flex-col items-center gap-1">
          <div className="flex h-44 items-end gap-1">
            <div
              className="w-5 rounded-t bg-brand-700"
              style={{ height: `${(d.local / max) * 100}%` }}
              title={`Indonesia: ${d.local}`}
            />
            <div
              className="w-5 rounded-t border border-warm bg-card-alt"
              style={{ height: `${(d.international / max) * 100}%` }}
              title={`Internasional: ${d.international}`}
            />
          </div>
          <span className="text-xs text-secondary">{d.year}</span>
        </div>
      ))}
    </div>
  );
}
