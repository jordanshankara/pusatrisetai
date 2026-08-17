"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, BrainCircuit } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/katalog", label: "Archive" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/metodologi", label: "Metodologi" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-warm bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-900">
          <BrainCircuit className="h-6 w-6 text-brand-700" strokeWidth={2} />
          PusatRiset.ai
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 transition-colors ${active ? "bg-brand-100 text-brand-700" : "hover:bg-card-alt hover:text-brand-700"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          className="rounded-md border border-warm p-2 text-primary sm:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <nav className="flex flex-col gap-1 border-t border-warm bg-card px-4 py-3 sm:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${pathname === item.href ? "bg-brand-100 text-brand-700" : "text-primary hover:bg-card-alt"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
