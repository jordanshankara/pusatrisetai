import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, notFound, badRequest, internalError, zodValidationError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

const bodySchema = z.object({
  paperId: z.string().min(1),
  tagId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Body request harus JSON valid.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return zodValidationError(parsed.error);

  const { paperId, tagId, action } = parsed.data;

  try {
    const existing = await prisma.paperPolicyTag.findUnique({
      where: { paperId_tagId: { paperId, tagId } },
    });
    if (!existing) return notFound("Policy tag pada paper ini tidak ditemukan.");

    const status = action === "approve" ? "published" : "rejected";
    await prisma.paperPolicyTag.update({
      where: { paperId_tagId: { paperId, tagId } },
      data: { status },
    });
    return ok({ paperId, tagId, status });
  } catch (error) {
    return internalError(error);
  }
}
