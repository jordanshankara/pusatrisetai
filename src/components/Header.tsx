import Link from "next/link";

const NAV_ITEMS = [
  { href: "/katalog", label: "Katalog" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/metodologi", label: "Metodologi" },
];

export function Header() {
  return (
    <header className="border-b border-warm bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-lg font-semibold text-brand-900">
          PusatRiset.ai
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-primary">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-brand-700">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
