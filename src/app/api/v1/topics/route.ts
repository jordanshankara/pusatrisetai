import { ok, internalError } from "@/lib/api/response";
import { getTopicsWithCounts } from "@/lib/services/papers";

export async function GET() {
  try {
    const data = await getTopicsWithCounts();
    return ok(data);
  } catch (error) {
    return internalError(error);
  }
}
