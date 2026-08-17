import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdminRole } from "@/lib/api/require-admin";
import { hashPassword } from "@/lib/auth/password";

export async function GET() {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, displayName: true, role: true, active: true, createdAt: true },
    });
    return ok(users);
  } catch (error) {
    return internalError(error);
  }
}

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password minimal 8 karakter."),
  displayName: z.string().trim().min(1).optional(),
  role: z.enum(["admin", "editor"]).default("editor"),
});

export async function POST(request: Request) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Body request harus JSON valid.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return zodValidationError(parsed.error);

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return badRequest("Email sudah terdaftar.", "EMAIL_TAKEN");

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        displayName: parsed.data.displayName ?? null,
        passwordHash: hashPassword(parsed.data.password),
        role: parsed.data.role,
        active: true,
      },
      select: { id: true, email: true, displayName: true, role: true, active: true },
    });
    return ok(user, undefined, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
