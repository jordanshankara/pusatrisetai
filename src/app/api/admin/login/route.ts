import { z } from "zod";
import { ok, apiError, zodValidationError } from "@/lib/api/response";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "@/lib/auth/admin-session";

/// Bukan bagian dari kontrak Bagian 5 — util dev untuk uji /api/admin/* lewat curl/Postman
/// sebelum halaman login (/admin/login) dibangun. Kredensial dari .env (ADMIN_EMAIL/ADMIN_PASSWORD).
const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Body request harus JSON valid.");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  const { email, password } = parsed.data;
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return apiError(401, "INVALID_CREDENTIALS", "Email atau password admin salah.");
  }

  const { token, expiresAt } = createAdminSession(email);
  const response = ok({ email, expiresAt });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return response;
}
