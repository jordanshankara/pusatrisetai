import Link from "next/link";
import { BrainCircuit, ShieldCheck } from "lucide-react";

const LINK_COLUMNS = [
  {
    title: "Jelajahi",
    links: [
      { href: "/katalog", label: "Archive Riset" },
      { href: "/dashboard", label: "Dashboard Tren" },
      { href: "/metodologi", label: "Metodologi" },
    ],
  },
  {
    title: "Tentang Kurasi",
    links: [
      { href: "/metodologi#sumber-data", label: "Sumber Data" },
      { href: "/metodologi#badge", label: "Arti Badge Relevansi" },
      { href: "/metodologi#sanggahan", label: "Ajukan Sanggahan" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-warm bg-card-alt">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-900">
              <BrainCircuit className="h-6 w-6 text-brand-700" />
              PusatRiset.ai
            </Link>
            <p className="mt-3 flex items-start gap-2 text-sm text-secondary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              Ringkasan &amp; interpretasi di situs ini dibantu AI dan ditinjau editor sebelum tayang. Abstrak asli
              ditampilkan sesuai kebijakan lisensi masing-masing sumber.
            </p>
          </div>

          {LINK_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-secondary hover:text-brand-700 hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-warm pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-muted-warm">© {new Date().getFullYear()} PusatRiset.ai. Sebagian hak dilindungi.</p>
          <p className="text-xs font-medium text-muted-warm">
            Didukung oleh <span className="text-brand-700">Asosiasi AI Indonesia</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
