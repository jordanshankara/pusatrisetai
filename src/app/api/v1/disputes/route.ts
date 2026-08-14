import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, apiError, internalError, zodValidationError } from "@/lib/api/response";
import { checkRateLimit, requestIp } from "@/lib/api/rate-limit";

const bodySchema = z.object({
  paperId: z.string().min(1),
  disputeType: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email().optional(),
  argument: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = requestIp(request);
  if (!checkRateLimit(`disputes:${ip}`)) {
    return apiError(429, "RATE_LIMITED", "Terlalu banyak permintaan, coba lagi dalam satu menit.");
  }

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

  try {
    const dispute = await prisma.dispute.create({
      data: {
        paperId: parsed.data.paperId,
        disputeType: parsed.data.disputeType,
        submittedByName: parsed.data.name,
        submittedByEmail: parsed.data.email,
        argument: parsed.data.argument,
        status: "open",
      },
    });
    return ok({ id: dispute.id }, undefined, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
