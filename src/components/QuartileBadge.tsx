const LABELS: Record<string, string> = {
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  unindexed: "Non-Scopus",
};

const CLASSES: Record<string, string> = {
  q1: "bg-emerald-100 text-emerald-800",
  q2: "bg-sky-100 text-sky-800",
  q3: "bg-amber-100 text-amber-800",
  q4: "bg-orange-100 text-orange-800",
  unindexed: "bg-slate-100 text-slate-600",
};

/// quartile NULL = belum pernah dicek (beda dari "unindexed") -> TIDAK render badge sama sekali,
/// sama seperti pola RelevanceBadge.
export function QuartileBadge({ quartile, size = "sm" }: { quartile: string | null | undefined; size?: "sm" | "lg" }) {
  if (!quartile || !(quartile in LABELS)) return null;

  const sizeClasses = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${CLASSES[quartile]}`} title="Kuartil SJR (Scimago Journal Rank)">
      {LABELS[quartile]}
    </span>
  );
}
