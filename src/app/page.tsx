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
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Pusat kurasi riset AI Indonesia &amp; dunia — abstrak asli, makna nyata
          </h1>
          <p className="mt-3 text-muted">
            Temukan riset kecerdasan buatan dengan ringkasan terkurasi, relevansi untuk Indonesia, dan sumber asli yang bisa dipertanggungjawabkan.
          </p>
          <form action="/katalog" method="GET" className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              type="text"
              name="q"
              placeholder="Cari judul, topik, atau kata kunci riset..."
              className="flex-1 rounded-md border border-border bg-background px-4 py-3 text-sm focus:border-accent focus:outline-none"
            />
            <button type="submit" className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover">
              Cari
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold text-accent">{card.value.toLocaleString("id-ID")}</p>
              <p className="mt-1 text-xs text-muted">{card.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Riset Terbaru</h2>
          <Link href="/katalog" className="text-sm font-medium text-accent hover:underline">
            Lihat semua →
          </Link>
        </div>
        {stats.recentPapers.length === 0 ? (
          <p className="text-sm text-muted">Belum ada riset yang tayang.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.recentPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
          <h2 className="text-xl font-semibold">Lihat tren riset AI Indonesia vs dunia</h2>
          <p className="mt-2 text-sm text-muted">Bandingkan pertumbuhan riset per tahun dan per subbidang lewat Dashboard.</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Buka Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
