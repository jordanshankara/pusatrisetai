import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, getSession } from "@/lib/auth/admin-session";
import { SettingsClient } from "@/components/admin/SettingsClient";

export const metadata: Metadata = { title: "Settings — Admin PusatRiset.ai" };
export const dynamic = "force-dynamic";

/// Proteksi GANDA (bukan cuma sembunyikan menu di sidebar): layout (protected) hanya memastikan
/// staf LOGIN (admin atau editor), jadi halaman ini cek ULANG role=admin sendiri — editor yang
/// mengetik /admin/settings langsung di address bar tetap ditolak, bukan cuma tidak lihat link-nya.
export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session || session.role !== "admin") redirect("/admin");

  return <SettingsClient />;
}
