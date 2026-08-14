import Link from "next/link";

export function Pagination({ page, perPage, total, buildHref }: { page: number; perPage: number; total: number; buildHref: (page: number) => string }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav className="mt-8 flex items-center justify-center gap-4 text-sm">
      {prevDisabled ? (
        <span className="text-muted">← Sebelumnya</span>
      ) : (
        <Link href={buildHref(page - 1)} className="text-accent hover:underline">
          ← Sebelumnya
        </Link>
      )}
      <span className="text-muted">
        Halaman {page} dari {totalPages}
      </span>
      {nextDisabled ? (
        <span className="text-muted">Selanjutnya →</span>
      ) : (
        <Link href={buildHref(page + 1)} className="text-accent hover:underline">
          Selanjutnya →
        </Link>
      )}
    </nav>
  );
}
