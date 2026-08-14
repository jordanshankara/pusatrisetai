/// Bagian 6.3: retracted juga tampil sebagai banner peringatan penuh di halaman detail.
export function RetractedBanner({ reasoning, compact = false }: { reasoning?: string | null; compact?: boolean }) {
  if (compact) {
    return <p className="text-xs font-medium text-[var(--badge-retracted-fg)]">⚠ Paper ini telah ditarik (retracted)</p>;
  }
  return (
    <div className="mb-6 rounded-md border border-[var(--badge-retracted-fg)]/30 bg-[var(--badge-retracted-bg)] p-4">
      <p className="font-semibold text-[var(--badge-retracted-fg)]">⚠ Paper ini telah ditarik (retracted)</p>
      {reasoning ? <p className="mt-1 text-sm text-[var(--badge-retracted-fg)]">{reasoning}</p> : null}
    </div>
  );
}
