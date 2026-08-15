import Link from "next/link";
import { getHomeStats } from "@/lib/services/papers";
import { PaperCard } from "@/components/PaperCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getHomeStats();

  const statCards = [
    { label: "Total Riset", value: stats.totalPapers },
    { label: "Riset Indonesia", value: stats.localPapers },
    { label: "Institusi Terlibat", value: stats.institutionCount },
    { label: "Ringkasan Terkurasi", value: stats.curatedSummaryCount },
  ];

  return (
    <div>
      <section className="border-b border-warm bg-card-alt">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h1 className="font-serif text-3xl font-bold text-brand-900 sm:text-4xl">
            Pusat kurasi riset AI Indonesia &amp; dunia — abstrak asli, makna nyata
          </h1>
          <p className="mt-3 text-secondary">
            Temukan riset kecerdasan buatan dengan ringkasan terkurasi, relevansi untuk Indonesia, dan sumber asli yang bisa dipertanggungjawabkan.
          </p>
          <form action="/katalog" method="GET" className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              type="text"
              name="q"
              placeholder="Cari judul, topik, atau kata kunci riset..."
              className="flex-1 rounded-md border border-warm bg-card px-4 py-3 text-sm focus:border-brand-700 focus:outline-none"
            />
            <button type="submit" className="rounded-md bg-brand-700 px-6 py-3 text-sm font-medium text-white hover:bg-brand-900">
              Cari
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">Statistik</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-[14px] border border-warm bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <p className="text-2xl font-bold text-brand-700">{card.value.toLocaleString("id-ID")}</p>
              <p className="mt-1 text-xs text-secondary">{card.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-brand-900">Riset Terbaru</h2>
          <Link href="/katalog" className="text-sm font-medium text-brand-700 hover:underline">
            Lihat semua →
          </Link>
        </div>
        {stats.recentPapers.length === 0 ? (
          <p className="text-sm text-secondary">Belum ada riset yang tayang.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.recentPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-warm bg-card-alt">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
          <h2 className="font-serif text-xl font-semibold text-brand-900">Lihat tren riset AI Indonesia vs dunia</h2>
          <p className="mt-2 text-sm text-secondary">Bandingkan pertumbuhan riset per tahun dan per subbidang lewat Dashboard.</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-md bg-brand-700 px-6 py-3 text-sm font-medium text-white hover:bg-brand-900"
          >
            Buka Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
