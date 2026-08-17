import type { Metadata } from "next";
import { BookOpenCheck, Globe2, MapPin, Trophy, BookOpen, FileCheck, Database, Eye, Lock, Globe, MessageSquareWarning, AlertTriangle } from "lucide-react";
import { RelevanceBadge } from "@/components/RelevanceBadge";

export const metadata: Metadata = { title: "Metodologi — PusatRiset.ai" };

const TIERS = [
  { icon: Trophy, label: "Tier 1", desc: "Konferensi/jurnal papan atas dengan reputasi internasional mapan.", gradient: "gradient-card-indigo" },
  { icon: BookOpen, label: "Tier 2", desc: "Jurnal terindeks (SINTA 1–2, DOAJ) atau preprint repository (arXiv).", gradient: "gradient-card-blue" },
  { icon: FileCheck, label: "Tier 3", desc: "Sumber lain yang lolos tinjauan editorial minimal.", gradient: "gradient-card-teal" },
];

const BADGES = [
  { status: "still_relevant", desc: "Temuan masih dianggap relevan/state-of-the-art saat ini." },
  { status: "needs_update", desc: "Masih relevan, namun ada keterbatasan yang perlu diperbarui." },
  { status: "superseded", desc: "Sudah digantikan oleh riset yang lebih baru dan lebih baik." },
  { status: "retracted", desc: "Ditarik oleh penerbit — dibaca dengan kehati-hatian." },
  { status: "foundational", desc: "Riset fondasional dengan pengaruh besar dan tahan lama." },
];

const POLICIES = [
  {
    icon: Lock,
    title: "Kebijakan Abstrak & Lisensi",
    desc: "Abstrak asli hanya ditampilkan penuh bila lisensi sumber terbuka (mis. CC BY, CC0) atau paper berstatus open access dan sumber mengizinkan. Untuk sumber yang membatasi penggunaan metadata, kami hanya menampilkan ringkasan hasil kurasi editor.",
  },
  {
    icon: Globe,
    title: "Kebijakan Inklusi",
    desc: "Riset Indonesia yang kami masukkan berasal dari jurnal terindeks DOAJ, SINTA peringkat 1–4, atau melalui tinjauan editorial manual untuk sumber yang belum terindeks formal namun memenuhi standar kualitas dasar.",
  },
  {
    icon: MessageSquareWarning,
    title: "Cara Mengajukan Sanggahan",
    desc: 'Setiap halaman detail riset memiliki tautan "Keberatan dengan konten ini?" pada tab Ringkasan & Relevansi. Sanggahan Anda akan masuk ke antrean tinjauan editor sebelum ada perubahan pada halaman publik.',
    id: "sanggahan",
  },
];

export default function MetodologiPage() {
  return (
    <div>
      <section className="border-b border-warm bg-card-alt">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-10 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100">
            <BookOpenCheck className="h-5 w-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-900 sm:text-2xl">Metodologi</h1>
            <p className="mt-1 text-sm text-secondary">
              Bagaimana PusatRiset.ai mengumpulkan, mengurasi, dan menyajikan riset AI Indonesia &amp; dunia —
              termasuk batasan dan kebijakan yang kami terapkan.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section id="sumber-data" className="scroll-mt-24">
          <h2 className="text-lg font-semibold text-primary">Sumber Data</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="gradient-card-blue rounded-2xl p-5 text-white shadow-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Globe2 className="h-4 w-4 text-white" />
              </div>
              <p className="mt-3 text-sm font-semibold">Riset Internasional</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                Bersumber dari venue tier-1 (mis. NeurIPS, ICML, ICLR, ACL) dan preprint arXiv (cs.AI, cs.LG).
              </p>
            </div>
            <div className="gradient-card-teal rounded-2xl p-5 text-white shadow-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <p className="mt-3 text-sm font-semibold">Riset Indonesia</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                Bersumber dari jurnal terindeks SINTA atau DOAJ, serta repositori institusi. Metadata diperkaya
                menggunakan OpenAlex bila tersedia.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-primary">Sistem Tier Venue</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {TIERS.map((t) => (
              <div key={t.label} className={`${t.gradient} rounded-2xl p-5 text-white shadow-lg`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <t.icon className="h-4 w-4 text-white" />
                </div>
                <p className="mt-3 text-sm font-semibold">{t.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/80">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-primary">Dua Sumbu Editorial</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            Setiap riset melewati dua lapis kurasi independen sebelum tayang ke publik. Draf yang belum ditinjau
            tidak pernah tampil, meski datanya sudah ada di database.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="glass-card rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-700" />
                <p className="text-sm font-semibold text-primary">Status Metadata</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">Apakah riset ini layak diindeks sama sekali.</p>
            </div>
            <div className="glass-card rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-brand-700" />
                <p className="text-sm font-semibold text-primary">Status Interpretasi</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                Apakah ringkasan, relasi, dan tag kebijakan sudah ditinjau editor sebelum tayang ke publik.
              </p>
            </div>
          </div>
        </section>

        <section id="badge" className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-semibold text-primary">Arti Setiap Badge</h2>
          <div className="glass-card mt-3 space-y-2.5 rounded-2xl p-5 shadow-[var(--shadow-card)]">
            {BADGES.map((b) => (
              <div key={b.status} className="flex items-center gap-3">
                <RelevanceBadge status={b.status} />
                <span className="text-sm text-secondary">{b.desc}</span>
              </div>
            ))}
            <p className="border-t border-warm pt-2.5 text-xs text-muted-warm">
              Paper tanpa badge berarti belum ditinjau editor — bukan berarti tidak relevan.
            </p>
          </div>
        </section>

        <section className="mt-10 grid gap-4">
          {POLICIES.map((policy) => (
            <div key={policy.title} id={policy.id} className="glass-card scroll-mt-24 rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <policy.icon className="h-4 w-4 text-brand-700" />
                <p className="text-sm font-semibold text-primary">{policy.title}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">{policy.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[14px] border border-[var(--badge-needs-update-fg)]/30 bg-[var(--badge-needs-update-bg)] p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--badge-needs-update-fg)]" />
            <p className="text-sm font-semibold text-[var(--badge-needs-update-fg)]">Disclaimer</p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--badge-needs-update-fg)]">
            Ringkasan dan label relevansi di situs ini dibantu oleh kecerdasan buatan dan ditinjau oleh editor
            manusia sebelum tayang, namun tetap dapat mengandung kesalahan interpretasi. Selalu rujuk ke sumber asli
            untuk keputusan yang bersifat kritis.
          </p>
        </section>
      </div>
    </div>
  );
}
