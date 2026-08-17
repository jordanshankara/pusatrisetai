import Link from "next/link";
import { Search, FileStack, Flag, Building2, Sparkles, TrendingUp, Flame, BarChart3, BookMarked, Languages, UserCheck, Quote } from "lucide-react";
import { getHomeStats } from "@/lib/services/papers";
import { PaperCard } from "@/components/PaperCard";
import { HeroIllustration } from "@/components/HeroIllustration";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Quote,
    title: "Abstrak Asli, Bukan Karangan",
    desc: "Setiap klaim ditelusuri balik ke abstrak sumber — kami tidak pernah mengarang angka atau temuan yang tidak tertulis di sana.",
  },
  {
    icon: Languages,
    title: "Relevansi untuk Indonesia",
    desc: "Bukan sekadar terjemahan — tiap riset dinilai konkret: sektor apa di Indonesia yang bisa memakainya, dan kenapa penting.",
  },
  {
    icon: UserCheck,
    title: "Ditinjau Editor Manusia",
    desc: "AI cuma membantu draf awal. Setiap ringkasan yang tayang sudah melewati tinjauan editor sebelum publik membacanya.",
  },
  {
    icon: BookMarked,
    title: "Transparan Soal Sumber",
    desc: "Tier venue, lisensi, dan status metadata ditampilkan apa adanya — Anda tahu persis seberapa bisa diandalkan sumbernya.",
  },
];

export default async function HomePage() {
  const stats = await getHomeStats();

  const statCards = [
    { label: "Total Riset", value: stats.totalPapers, icon: FileStack, gradient: "gradient-card-blue" },
    { label: "Riset Indonesia", value: stats.localPapers, icon: Flag, gradient: "gradient-card-teal" },
    { label: "Institusi Terlibat", value: stats.institutionCount, icon: Building2, gradient: "gradient-card-indigo" },
    { label: "Ringkasan Terkurasi", value: stats.curatedSummaryCount, icon: Sparkles, gradient: "gradient-card-blue" },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-warm bg-card-alt">
        <div className="absolute inset-0 -z-10 [background-image:radial-gradient(var(--brand-blue-700)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.05]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              Kurasi manusia, bukan cuma AI mentah
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-brand-900 sm:text-4xl lg:text-5xl">
              Pusat kurasi riset AI Indonesia &amp; dunia
            </h1>
            <p className="mt-4 text-base text-secondary sm:text-lg">
              Temukan riset kecerdasan buatan dengan ringkasan terkurasi, relevansi untuk Indonesia, dan sumber asli
              yang bisa dipertanggungjawabkan — abstrak asli, makna nyata.
            </p>
            <form action="/katalog" method="GET" className="mx-auto mt-8 flex max-w-xl gap-2 lg:mx-0">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-warm" />
                <input
                  type="text"
                  name="q"
                  placeholder="Cari judul, topik, atau kata kunci riset..."
                  className="w-full rounded-md border border-warm bg-card py-3 pl-10 pr-4 text-sm shadow-[var(--shadow-card)] focus:border-brand-700 focus:outline-none"
                />
              </div>
              <button type="submit" className="rounded-md bg-brand-700 px-6 py-3 text-sm font-medium text-white hover:bg-brand-900">
                Cari
              </button>
            </form>
          </div>

          <HeroIllustration />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`${card.gradient} rounded-2xl p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <card.icon className="h-5 w-5 text-white" />
              </div>
              <p className="mt-3 text-2xl font-bold">{card.value.toLocaleString("id-ID")}</p>
              <p className="mt-1 text-xs text-white/80">{card.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-warm bg-card-alt">
        <div className="pointer-events-none absolute -left-20 top-0 -z-10 h-64 w-64 rounded-full bg-gradient-to-br from-teal-200/40 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-64 w-64 rounded-full bg-gradient-to-tr from-indigo-200/40 to-transparent blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Kenapa PusatRiset.ai</p>
            <h2 className="mt-2 text-2xl font-bold text-brand-900">Bukan agregator riset biasa</h2>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass-card rounded-2xl p-5 shadow-[var(--shadow-card)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100">
                  <f.icon className="h-[18px] w-[18px] text-brand-700" />
                </div>
                <p className="mt-3 text-sm font-semibold text-primary">{f.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900">
            <TrendingUp className="h-5 w-5 text-brand-700" />
            Riset Terbaru
          </h2>
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

      {stats.popularPapers.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900">
              <Flame className="h-5 w-5 text-brand-700" />
              Riset Terpopuler
            </h2>
            <Link href="/katalog" className="text-sm font-medium text-brand-700 hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.popularPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden bg-brand-900">
        <div className="absolute inset-0 -z-0 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.06]" />
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white sm:text-2xl">Lihat tren riset AI Indonesia vs dunia</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Bandingkan pertumbuhan riset per tahun dan per subbidang lewat Dashboard — lihat area yang masih jarang
            diteliti di Indonesia dibanding tren global.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-md bg-white px-6 py-3 text-sm font-medium text-brand-900 hover:bg-brand-100"
          >
            Buka Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
