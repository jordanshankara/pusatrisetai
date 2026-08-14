import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Auth admin prototype (Bagian 3: "cookie-session sederhana"). Token stateless yang
 * ditandatangani (HMAC-SHA256) — BUKAN Map in-memory (dicoba awalnya, gagal: Turbopack dev
 * mengisolasi module graph per-route, jadi Map di satu request handler tidak selalu sama
 * instance-nya dengan handler lain, sesi jadi hilang sewaktu-waktu). Pendekatan stateless ini
 * juga lebih siap untuk multi-instance/serverless dibanding Map. Login UI di /admin/login;
 * endpoint login/logout murni util dev untuk curl/Postman, bukan bagian dari kontrak Bagian 5.
 */
export const ADMIN_SESSION_COOKIE = "pusatriset_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 jam

interface AdminSession {
  email: string;
  expiresAt: number;
}

function secret(): string {
  return process.env.ADMIN_PASSWORD ?? "dev-only-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createAdminSession(email: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payloadB64 = Buffer.from(`${email}:${expiresAt}`, "utf8").toString("base64url");
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt };
}

export function getAdminSession(token: string | undefined | null): AdminSession | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  const [email, expiresAtStr] = Buffer.from(payloadB64, "base64url").toString("utf8").split(":");
  const expiresAt = Number(expiresAtStr);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return { email, expiresAt };
}

export function destroyAdminSession(_token: string | undefined | null): void {
  // Stateless — tidak ada state server untuk dihapus; cookie dihapus di route /api/admin/logout.
}
