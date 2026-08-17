import type { Metadata } from "next";
import { AdminQueueClient } from "@/components/admin/AdminQueueClient";

export const metadata: Metadata = { title: "Admin — PusatRiset.ai" };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  // Sesi sudah dipastikan valid oleh src/app/admin/(protected)/layout.tsx (yang juga
  // merender identitas/logout lewat AdminSidebar) — halaman ini tinggal render konten.
  return <AdminQueueClient />;
}
