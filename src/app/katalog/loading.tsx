import { CardGridSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 h-11 animate-pulse rounded-md bg-surface" />
      <CardGridSkeleton count={8} />
    </div>
  );
}
