import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Auth staf (admin & editor) — token stateless yang ditandatangani (HMAC-SHA256), BUKAN Map
 * in-memory (dicoba awalnya, gagal: Turbopack dev mengisolasi module graph per-route, jadi Map
 * di satu request handler tidak selalu sama instance-nya dengan handler lain, sesi jadi hilang
 * sewaktu-waktu). Pendekatan stateless ini juga lebih siap untuk multi-instance/serverless.
 *
 * PATCH multi-user: payload sekarang bawa userId+role (bukan cuma email), dan secret HMAC
 * pindah dari ADMIN_PASSWORD (bug lama: secret = password SATU akun, tidak bisa dipakai lagi
 * begitu ada banyak user dengan password berbeda-beda) ke SESSION_SECRET khusus.
 */
export const ADMIN_SESSION_COOKIE = "pusatriset_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 jam

export interface StaffSession {
  userId: string;
  email: string;
  role: string;
  expiresAt: number;
}

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSession(user: { id: string; email: string; role: string }): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payloadB64 = Buffer.from(`${user.id}:${user.email}:${user.role}:${expiresAt}`, "utf8").toString("base64url");
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt };
}

export function getSession(token: string | undefined | null): StaffSession | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  const [userId, email, role, expiresAtStr] = Buffer.from(payloadB64, "base64url").toString("utf8").split(":");
  const expiresAt = Number(expiresAtStr);
  if (!userId || !email || !role || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return { userId, email, role, expiresAt };
}

export function destroySession(_token: string | undefined | null): void {
  // Stateless — tidak ada state server untuk dihapus; cookie dihapus di route /api/admin/logout.
}
