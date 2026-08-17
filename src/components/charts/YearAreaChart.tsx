import type { TrendsResult } from "@/lib/services/papers";

/// Area chart SVG custom dengan gradient fill (gaya referensi dashboard analitik) —
/// menggantikan bar chart polos sebelumnya. Dua layer: Indonesia (teal) & Internasional (navy).
export function YearAreaChart({ data }: { data: TrendsResult["byYear"] }) {
  if (data.length === 0) return <p className="text-sm text-secondary">Belum ada data.</p>;

  const width = 600;
  const height = 220;
  const padX = 8;
  const padY = 12;
  const max = Math.max(1, ...data.map((d) => Math.max(d.local, d.international)));

  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const yFor = (v: number) => height - padY - (v / max) * (height - padY * 2);
  const xFor = (i: number) => padX + i * stepX;

  function linePath(key: "local" | "international") {
    return data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`).join(" ");
  }
  function areaPath(key: "local" | "international") {
    const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`).join(" ");
    return `${line} L ${xFor(data.length - 1)} ${height - padY} L ${xFor(0)} ${height - padY} Z`;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 220 }}>
        <defs>
          <linearGradient id="areaTeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-blue-700)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--brand-blue-700)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath("international")} fill="url(#areaBlue)" />
        <path d={linePath("international")} fill="none" stroke="var(--brand-blue-700)" strokeWidth="2.5" />

        <path d={areaPath("local")} fill="url(#areaTeal)" />
        <path d={linePath("local")} fill="none" stroke="#0f766e" strokeWidth="2.5" />

        {data.map((d, i) => (
          <g key={d.year}>
            <circle cx={xFor(i)} cy={yFor(d.local)} r="3" fill="#0f766e" />
            <circle cx={xFor(i)} cy={yFor(d.international)} r="3" fill="var(--brand-blue-700)" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-warm">
        {data.map((d, i) => (
          <span key={d.year} className={data.length > 10 && i % 2 !== 0 ? "hidden sm:inline" : ""}>
            {d.year}
          </span>
        ))}
      </div>
    </div>
  );
}
