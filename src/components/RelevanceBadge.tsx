const LABELS: Record<string, string> = {
  still_relevant: "Masih Relevan",
  needs_update: "Perlu Pembaruan",
  superseded: "Sudah Digantikan",
  retracted: "Ditarik",
  foundational: "Riset Fondasi",
};

const CLASSES: Record<string, string> = {
  still_relevant: "bg-[var(--badge-still-relevant-bg)] text-[var(--badge-still-relevant-fg)]",
  needs_update: "bg-[var(--badge-needs-update-bg)] text-[var(--badge-needs-update-fg)]",
  superseded: "bg-[var(--badge-superseded-bg)] text-[var(--badge-superseded-fg)]",
  retracted: "bg-[var(--badge-retracted-bg)] text-[var(--badge-retracted-fg)]",
  foundational: "bg-[var(--badge-foundational-bg)] text-[var(--badge-foundational-fg)]",
};

/// Bagian 6.3: publishedStatus NULL -> TIDAK render badge sama sekali (bukan badge "unknown").
export function RelevanceBadge({ status, size = "sm" }: { status: string | null | undefined; size?: "sm" | "lg" }) {
  if (!status || !(status in LABELS)) return null;

  const sizeClasses = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${CLASSES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
