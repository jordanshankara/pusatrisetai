import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, getSession } from "@/lib/auth/admin-session";
import { unauthorized, forbidden } from "./response";

type AuthOk = { ok: true; userId: string; email: string; role: string };
type AuthFail = { ok: false; response: Response };

/// Staf mana pun yang login sah (admin ATAU editor) — dipakai oleh SEMUA route admin yang
/// sudah ada, TIDAK berubah perilaku meski sekarang multi-user (editor dapat akses penuh
/// kecuali Settings/manajemen user/pin prioritas, lihat requireAdminRole di bawah).
export async function requireAdmin(): Promise<AuthOk | AuthFail> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = getSession(token);
  if (!session) {
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, userId: session.userId, email: session.email, role: session.role };
}

/// Strict — HANYA role "admin" (Settings, manajemen user, pin prioritas). Editor kena 403.
export async function requireAdminRole(): Promise<AuthOk | AuthFail> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (auth.role !== "admin") {
    return { ok: false, response: forbidden("Hanya admin yang boleh mengakses ini.") };
  }
  return auth;
}
