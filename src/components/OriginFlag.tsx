export function OriginFlag({ origin }: { origin: "local" | "international" }) {
  if (origin !== "local") return null;
  return (
    <span title="Riset Indonesia" aria-label="Riset Indonesia">
      🇮🇩
    </span>
  );
}
