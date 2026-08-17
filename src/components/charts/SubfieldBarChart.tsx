import type { TrendsResult } from "@/lib/services/papers";

export function SubfieldBarChart({ data }: { data: TrendsResult["bySubfield"] }) {
  if (data.length === 0) return <p className="text-sm text-secondary">Belum ada data.</p>;

  const max = Math.max(1, ...data.map((d) => d.local + d.international));

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.subfield}>
          <div className="mb-1 flex justify-between text-xs text-secondary">
            <span>{d.subfield}</span>
            <span>{d.local + d.international}</span>
          </div>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-card-alt">
            <div className="gradient-card-teal" style={{ width: `${(d.local / max) * 100}%` }} title={`Indonesia: ${d.local}`} />
            <div className="gradient-card-blue" style={{ width: `${(d.international / max) * 100}%` }} title={`Internasional: ${d.international}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
