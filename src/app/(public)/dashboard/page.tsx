import type { Metadata } from "next";
import { BarChart3, PieChart } from "lucide-react";
import { getTrends } from "@/lib/services/papers";
import { YearBarChart } from "@/components/charts/YearBarChart";
import { SubfieldBarChart } from "@/components/charts/SubfieldBarChart";

export const metadata: Metadata = { title: "Dashboard — PusatRiset.ai" };
export const dynamic = "force-dynamic";

function Legend() {
  return (
    <div className="mt-3 flex gap-4 text-xs text-secondary">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-700" /> Indonesia
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-warm bg-card-alt" /> Internasional
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const trends = await getTrends();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-900">Dashboard Tren Riset</h1>
      <p className="mt-2 max-w-2xl text-sm text-secondary">
        Perbandingan pertumbuhan riset AI Indonesia dengan riset internasional dari waktu ke waktu dan per subbidang —
        gambaran awal untuk melihat area yang masih jarang diteliti di Indonesia dibanding tren global.
      </p>

      <section className="mt-8 rounded-[14px] border border-warm bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <BarChart3 className="h-5 w-5 text-brand-700" />
          Jumlah Riset per Tahun
        </h2>
        <div className="mt-4">
          <YearBarChart data={trends.byYear} />
        </div>
        <Legend />
      </section>

      <section className="mt-8 rounded-[14px] border border-warm bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <PieChart className="h-5 w-5 text-brand-700" />
          Riset per Subbidang
        </h2>
        <div className="mt-4">
          <SubfieldBarChart data={trends.bySubfield} />
        </div>
        <Legend />
      </section>
    </div>
  );
}
