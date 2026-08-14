import { ok, internalError } from "@/lib/api/response";
import { getTrends } from "@/lib/services/papers";

export async function GET() {
  try {
    const data = await getTrends();
    return ok(data);
  } catch (error) {
    return internalError(error);
  }
}
