import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, apiError, internalError, zodValidationError } from "@/lib/api/response";
import { checkRateLimit, requestIp } from "@/lib/api/rate-limit";

const bodySchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  claimedIdentifier: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = requestIp(request);
  if (!checkRateLimit(`submissions:${ip}`)) {
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
    const submission = await prisma.submission.create({
      data: {
        submittedByName: parsed.data.name,
        submittedByEmail: parsed.data.email,
        claimedIdentifier: parsed.data.claimedIdentifier,
        status: "queued",
      },
    });
    return ok({ id: submission.id }, undefined, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
