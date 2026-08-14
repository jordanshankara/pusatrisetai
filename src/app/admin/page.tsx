import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ADMIN_SESSION_COOKIE, getAdminSession } from "@/lib/auth/admin-session";
import { AdminQueueClient } from "@/components/admin/AdminQueueClient";

export const metadata: Metadata = { title: "Admin — PusatRiset.ai" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = getAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  return <AdminQueueClient adminEmail={session.email} />;
}
