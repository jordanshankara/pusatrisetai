import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

/// Tidak ada di kontrak Bagian 5 eksplisit, tapi diperlukan tab "Submission" (Bagian 7).
/// reject butuh alasan spesifik (SubmissionStatus enum punya 4 varian rejected_*).
const REJECT_REASONS = ["rejected_spam", "rejected_predatory", "rejected_duplicate", "rejected_no_credentials"] as const;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.enum(REJECT_REASONS) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Body request harus JSON valid.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return zodValidationError(parsed.error);

  try {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) return notFound("Submission tidak ditemukan.");

    const status = parsed.data.action === "approve" ? "approved" : parsed.data.reason;
    await prisma.submission.update({ where: { id }, data: { status } });
    return ok({ id, status });
  } catch (error) {
    return internalError(error);
  }
}
