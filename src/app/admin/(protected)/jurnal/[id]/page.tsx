import type { Metadata } from "next";
import { PaperAdminDetail } from "@/components/admin/PaperAdminDetail";

export const metadata: Metadata = { title: "Detail Jurnal — Admin PusatRiset.ai" };
export const dynamic = "force-dynamic";

export default async function AdminJurnalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaperAdminDetail paperId={id} />;
}
