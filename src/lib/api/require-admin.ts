import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, getAdminSession } from "@/lib/auth/admin-session";
import { unauthorized } from "./response";

export async function requireAdmin(): Promise<
  { ok: true; email: string } | { ok: false; response: Response }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = getAdminSession(token);
  if (!session) {
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, email: session.email };
}
