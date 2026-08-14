import { randomUUID } from "node:crypto";

/**
 * Auth admin prototype (Bagian 3: "cookie-session sederhana"). Session disimpan in-memory —
 * cukup untuk single-process dev/prototype, TIDAK untuk deployment multi-instance/serverless.
 * Login UI (halaman /admin/login) menyusul di tahap berikutnya; endpoint login/logout di sini
 * murni util dev untuk keperluan curl/Postman, bukan bagian dari kontrak Bagian 5.
 */
export const ADMIN_SESSION_COOKIE = "pusatriset_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 jam

interface AdminSession {
  email: string;
  expiresAt: number;
}

const sessions = new Map<string, AdminSession>();

export function createAdminSession(email: string): { token: string; expiresAt: number } {
  const token = randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { email, expiresAt });
  return { token, expiresAt };
}

export function getAdminSession(token: string | undefined | null): AdminSession | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroyAdminSession(token: string | undefined | null): void {
  if (token) sessions.delete(token);
}
