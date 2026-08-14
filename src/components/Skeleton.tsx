export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border p-5">
      <div className="h-4 w-3/4 rounded bg-surface" />
      <div className="mt-3 h-3 w-1/2 rounded bg-surface" />
      <div className="mt-4 h-3 w-1/3 rounded bg-surface" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
