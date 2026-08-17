import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdminRole } from "@/lib/api/require-admin";

const SETTING_KEYS = ["GEMINI_API_KEYS", "GEMINI_MODEL_PRIMARY", "GEMINI_MODEL_FALLBACK", "OPENROUTER_API_KEY"] as const;
const SECRET_KEYS = new Set(["GEMINI_API_KEYS", "OPENROUTER_API_KEY"]);

/// Nilai rahasia (API key) ditampilkan TERMASKING (4 karakter terakhir saja) — admin tidak
/// pernah melihat kembali key penuh lewat GET, cuma bisa menimpanya dengan nilai baru.
function mask(value: string): string {
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export async function GET() {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;

  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const data = SETTING_KEYS.map((key) => {
      const raw = byKey.get(key);
      const envFallback = process.env[key] ?? "";
      const effective = raw ?? envFallback;
      return {
        key,
        source: raw !== undefined ? "settings" : envFallback ? "env" : "none",
        maskedValue: effective ? (SECRET_KEYS.has(key) ? mask(effective) : effective) : "",
      };
    });
    return ok(data);
  } catch (error) {
    return internalError(error);
  }
}

const bodySchema = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.string().min(1),
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
    await prisma.appSetting.upsert({
      where: { key: parsed.data.key },
      update: { value: parsed.data.value, updatedById: auth.email },
      create: { key: parsed.data.key, value: parsed.data.value, updatedById: auth.email },
    });
    return ok({ key: parsed.data.key, saved: true });
  } catch (error) {
    return internalError(error);
  }
}
