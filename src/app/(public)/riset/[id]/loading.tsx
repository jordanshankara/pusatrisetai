export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-8 sm:px-6">
      <div className="h-4 w-24 rounded bg-card-alt" />
      <div className="mt-4 h-8 w-3/4 rounded bg-card-alt" />
      <div className="mt-3 h-4 w-1/2 rounded bg-card-alt" />
      <div className="mt-8 h-40 w-full rounded bg-card-alt" />
    </div>
  );
}
