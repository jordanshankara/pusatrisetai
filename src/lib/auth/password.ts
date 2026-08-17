import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/// Hash password staf (admin/editor) — scrypt bawaan node:crypto, TANPA dependency baru,
/// konsisten dengan HMAC session yang juga pakai node:crypto. Format tersimpan: "salt:hash"
/// (keduanya hex) supaya verifyPassword tidak perlu tabel/kolom salt terpisah.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const candidateBuf = scryptSync(password, salt, KEY_LENGTH);
  if (hashBuf.length !== candidateBuf.length) return false;
  return timingSafeEqual(hashBuf, candidateBuf);
}
