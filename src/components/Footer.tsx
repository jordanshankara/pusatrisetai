import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-warm bg-card-alt">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-secondary sm:px-6">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          Ringkasan &amp; interpretasi di situs ini dibantu AI dan ditinjau editor sebelum tayang. Abstrak asli
          ditampilkan sesuai kebijakan lisensi masing-masing sumber.
        </p>
        <p className="mt-2">
          <Link href="/metodologi" className="font-medium text-brand-700 hover:underline">
            Baca metodologi selengkapnya →
          </Link>
        </p>
      </div>
    </footer>
  );
}
