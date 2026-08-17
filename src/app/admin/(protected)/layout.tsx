import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, getSession } from "@/lib/auth/admin-session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminRoleProvider } from "@/components/admin/AdminRoleContext";

export const dynamic = "force-dynamic";

/// Cek sesi staf terpusat untuk semua halaman /admin/* yang butuh login (dashboard, /jurnal,
/// /jurnal/[id], /settings). Route group (protected) tidak menambah segmen ke URL — /admin/login
/// TETAP di luar group ini (lihat src/app/admin/login/page.tsx), jadi tidak ikut kena redirect
/// loop. Shell app (sidebar + area konten) dirender SEKALI di sini — halaman di bawahnya tidak
/// lagi menggambar header/nav sendiri (lihat AdminQueueClient/PaperListClient/PaperAdminDetail).
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = getSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  return (
    <AdminRoleProvider role={session.role}>
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminSidebar adminEmail={session.email} role={session.role} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
        </main>
      </div>
    </AdminRoleProvider>
  );
}
