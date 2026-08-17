import type { Metadata } from "next";
import { LineChart, TrendingUp, Flag, Globe2, PieChart } from "lucide-react";
import { getTrends } from "@/lib/services/papers";
import { YearAreaChart } from "@/components/charts/YearAreaChart";
import { SubfieldBarChart } from "@/components/charts/SubfieldBarChart";
import { DonutChart } from "@/components/charts/DonutChart";

export const metadata: Metadata = { title: "Dashboard — PusatRiset.ai" };
export const dynamic = "force-dynamic";

function Legend() {
  return (
    <div className="mt-4 flex gap-4 border-t border-warm pt-3 text-xs text-secondary">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0f766e" }} /> Indonesia
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-700" /> Internasional
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const trends = await getTrends();

  const totalLocal = trends.byYear.reduce((sum, d) => sum + d.local, 0);
  const totalInternational = trends.byYear.reduce((sum, d) => sum + d.international, 0);
  const total = totalLocal + totalInternational;
  const localShare = total > 0 ? Math.round((totalLocal / total) * 100) : 0;

  const kpiCards = [
    { label: "Riset Indonesia", value: totalLocal, icon: Flag, gradient: "gradient-card-teal" },
    { label: "Riset Internasional", value: totalInternational, icon: Globe2, gradient: "gradient-card-blue" },
    { label: "Porsi Riset Indonesia", value: `${localShare}%`, icon: PieChart, gradient: "gradient-card-indigo" },
  ];

  return (
    <div>
      <section className="border-b border-warm bg-card-alt">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-10 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100">
            <LineChart className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-900 sm:text-2xl">Dashboard Tren Riset</h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              Perbandingan pertumbuhan riset AI Indonesia dengan riset internasional dari waktu ke waktu dan per
              subbidang — gambaran awal area yang masih jarang diteliti di Indonesia dibanding tren global.
            </p>
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-100/50 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-24 top-10 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-teal-200/40 to-transparent blur-3xl" />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {kpiCards.map((k) => (
            <div key={k.label} className={`${k.gradient} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <k.icon className="h-4 w-4 text-white" />
                </div>
                <TrendingUp className="h-4 w-4 text-white/70" />
              </div>
              <p className="mt-3 text-2xl font-bold">{typeof k.value === "number" ? k.value.toLocaleString("id-ID") : k.value}</p>
              <p className="mt-1 text-xs text-white/80">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
          <section className="glass-card rounded-2xl p-6 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
              <TrendingUp className="h-5 w-5 text-brand-700" />
              Jumlah Riset per Tahun
            </h2>
            <div className="mt-4">
              <YearAreaChart data={trends.byYear} />
            </div>
            <Legend />
          </section>

          <section className="glass-card flex flex-col items-center justify-center rounded-2xl p-6 shadow-[var(--shadow-card)]">
            <h2 className="self-start flex items-center gap-2 text-sm font-semibold text-primary">
              <PieChart className="h-4 w-4 text-brand-700" />
              Proporsi Total
            </h2>
            <div className="mt-4">
              <DonutChart local={totalLocal} international={totalInternational} />
            </div>
            <Legend />
          </section>
        </div>

        <section className="mt-6 glass-card rounded-2xl p-6 shadow-[var(--shadow-card)]">
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
      </div>
    </div>
  );
}
