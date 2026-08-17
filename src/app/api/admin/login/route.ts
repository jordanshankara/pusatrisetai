import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, apiError, zodValidationError } from "@/lib/api/response";
import { ADMIN_SESSION_COOKIE, createSession } from "@/lib/auth/admin-session";
import { verifyPassword } from "@/lib/auth/password";

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
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return apiError(401, "INVALID_CREDENTIALS", "Email atau password salah, atau akun tidak aktif.");
  }

  const { token, expiresAt } = createSession({ id: user.id, email: user.email, role: user.role });
  const response = ok({ email: user.email, role: user.role, expiresAt });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return response;
}
