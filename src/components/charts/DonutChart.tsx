/// Donut chart SVG custom (tanpa dependency chart eksternal) — proporsi 2 kategori
/// (Indonesia vs Internasional), gaya kartu KPI glassmorphic di referensi.
export function DonutChart({ local, international }: { local: number; international: number }) {
  const total = local + international;
  const localPct = total > 0 ? local / total : 0;

  const size = 160;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const localLength = circumference * localPct;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-card-alt)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand-blue-700)"
          strokeWidth={stroke}
          strokeDasharray={`${localLength} ${circumference - localLength}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-[100px] flex h-[100px] flex-col items-center justify-center">
        <p className="text-2xl font-bold text-primary">{Math.round(localPct * 100)}%</p>
        <p className="text-[11px] text-secondary">Indonesia</p>
      </div>
    </div>
  );
}
