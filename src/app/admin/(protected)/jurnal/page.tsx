import type { Metadata } from "next";
import { PaperListClient } from "@/components/admin/PaperListClient";

export const metadata: Metadata = { title: "Jurnal — Admin PusatRiset.ai" };
export const dynamic = "force-dynamic";

export default function AdminJurnalPage() {
  return <PaperListClient />;
}
