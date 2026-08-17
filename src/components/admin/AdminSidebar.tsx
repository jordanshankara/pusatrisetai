"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "Antrean" },
  { href: "/admin/jurnal", label: "Jurnal" },
] as const;

/// Shell sidebar admin — satu-satunya tempat nav/identitas/logout admin dirender (dipakai
/// oleh src/app/admin/(protected)/layout.tsx untuk SEMUA halaman /admin/* yang butuh login),
/// supaya tidak ada lagi header duplikat per-halaman. Item "Settings" HANYA tampil untuk
/// role=admin — editor dapat akses penuh ke fitur lain tapi tidak ke Settings.
export function AdminSidebar({ adminEmail, role }: { adminEmail: string; role: string }) {
  const pathname = usePathname();
  const [missingSummaryCount, setMissingSummaryCount] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/papers?missingSummary=true&perPage=1")
      .then((res) => res.json())
      .then((body) => setMissingSummaryCount(body?.meta?.total ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const navItems = role === "admin" ? [...NAV_ITEMS, { href: "/admin/settings", label: "Settings" }] : NAV_ITEMS;

  const sidebarContent = (
    <>
      <div className="border-b border-border px-5 py-5">
        <Link href="/admin" className="text-base font-bold text-foreground">
          PusatRiset.ai
        </Link>
        <p className="mt-0.5 text-xs text-muted">Panel Editorial</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-accent text-white" : "text-foreground hover:bg-background"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/admin/jurnal" && missingSummaryCount ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    active ? "bg-white/20 text-white" : "bg-[var(--badge-retracted-fg)] text-white"
                  }`}
                >
                  {missingSummaryCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="truncate text-xs text-muted" title={adminEmail}>
          {adminEmail} · <span className="capitalize">{role}</span>
        </p>
        <button onClick={handleLogout} className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background">
          Keluar
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Header mobile: hamburger, cuma tampil di layar sempit */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Link href="/admin" className="text-base font-bold text-foreground">
          PusatRiset.ai
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Buka menu"
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-30 flex md:hidden">
          <aside className="flex h-full w-64 flex-col border-r border-border bg-surface">{sidebarContent}</aside>
          <button
            type="button"
            aria-label="Tutup menu"
            className="flex-1 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
