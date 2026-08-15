import { CardGridSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto h-10 w-2/3 animate-pulse rounded bg-card-alt" />
      <div className="mx-auto mt-4 h-11 w-full max-w-xl animate-pulse rounded-md bg-card-alt" />
      <div className="mt-12">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
