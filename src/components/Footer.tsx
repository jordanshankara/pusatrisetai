import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
        <p>
          Ringkasan &amp; interpretasi di situs ini dibantu AI dan ditinjau editor sebelum tayang. Abstrak asli
          ditampilkan sesuai kebijakan lisensi masing-masing sumber.
        </p>
        <p className="mt-2">
          <Link href="/metodologi" className="text-accent hover:underline">
            Baca metodologi selengkapnya →
          </Link>
        </p>
      </div>
    </footer>
  );
}
