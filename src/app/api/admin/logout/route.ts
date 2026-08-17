import { cookies } from "next/headers";
import { ok } from "@/lib/api/response";
import { ADMIN_SESSION_COOKIE, destroySession } from "@/lib/auth/admin-session";

/// Util dev, sama seperti /api/admin/login — bukan bagian dari kontrak Bagian 5.
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  destroySession(token);

  const response = ok({ loggedOut: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
