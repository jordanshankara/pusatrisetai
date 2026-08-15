import type { Metadata } from "next";
import { RelevanceBadge } from "@/components/RelevanceBadge";

export const metadata: Metadata = { title: "Metodologi — PusatRiset.ai" };

export default function MetodologiPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-2xl font-bold text-brand-900">Metodologi</h1>
      <p className="mt-2 text-sm text-secondary">
        Halaman ini menjelaskan bagaimana PusatRiset.ai mengumpulkan, mengurasi, dan menyajikan riset AI Indonesia
        &amp; dunia — termasuk batasan dan kebijakan yang kami terapkan.
      </p>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold text-primary">Sumber Data</h2>
        <p className="text-sm leading-relaxed text-secondary">
          Riset internasional bersumber dari venue tier-1 (mis. NeurIPS, ICML, ICLR, ACL) dan preprint arXiv
          (cs.AI, cs.LG). Riset Indonesia bersumber dari jurnal yang terindeks SINTA atau DOAJ, serta repositori
          institusi. Metadata diperkaya menggunakan OpenAlex bila tersedia.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold text-primary">Sistem Tier Venue</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-secondary">
          <li><strong className="text-primary">Tier 1</strong> — konferensi/jurnal papan atas dengan reputasi internasional mapan.</li>
          <li><strong className="text-primary">Tier 2</strong> — jurnal terindeks (SINTA 1–2, DOAJ) atau preprint repository (arXiv).</li>
          <li><strong className="text-primary">Tier 3</strong> — sumber lain yang lolos tinjauan editorial minimal.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold text-primary">Dua Sumbu Editorial</h2>
        <p className="text-sm leading-relaxed text-secondary">
          Setiap riset melewati dua lapis kurasi independen: <strong className="text-primary">status metadata</strong>
          {" "}(apakah riset ini layak diindeks sama sekali) dan <strong className="text-primary">status interpretasi</strong>
          {" "}(apakah ringkasan, relasi, dan tag kebijakan sudah ditinjau editor sebelum tayang ke publik). Draf yang
          belum ditinjau tidak pernah tampil di halaman publik, meski datanya sudah ada di database.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-primary">Arti Setiap Badge</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <RelevanceBadge status="still_relevant" /> <span className="text-secondary">Temuan masih dianggap relevan/state-of-the-art saat ini.</span>
          </div>
          <div className="flex items-center gap-3">
            <RelevanceBadge status="needs_update" /> <span className="text-secondary">Masih relevan, namun ada keterbatasan yang perlu diperbarui.</span>
          </div>
          <div className="flex items-center gap-3">
            <RelevanceBadge status="superseded" /> <span className="text-secondary">Sudah digantikan oleh riset yang lebih baru dan lebih baik.</span>
          </div>
          <div className="flex items-center gap-3">
            <RelevanceBadge status="retracted" /> <span className="text-secondary">Ditarik oleh penerbit — dibaca dengan kehati-hatian.</span>
          </div>
          <div className="flex items-center gap-3">
            <RelevanceBadge status="foundational" /> <span className="text-secondary">Riset fondasional dengan pengaruh besar dan tahan lama.</span>
          </div>
          <p className="text-secondary">Paper tanpa badge berarti belum ditinjau editor — bukan berarti tidak relevan.</p>
        </div>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold text-primary">Kebijakan Abstrak &amp; Lisensi</h2>
        <p className="text-sm leading-relaxed text-secondary">
          Abstrak asli hanya ditampilkan penuh bila lisensi sumber terbuka (mis. CC BY, CC0) atau paper berstatus
          open access dan sumber mengizinkan. Untuk sumber yang membatasi penggunaan metadata, kami hanya
          menampilkan ringkasan hasil kurasi editor, dan mengarahkan pembaca ke sumber resmi untuk membaca abstrak
          lengkap.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold text-primary">Kebijakan Inklusi</h2>
        <p className="text-sm leading-relaxed text-secondary">
          Riset Indonesia yang kami masukkan berasal dari jurnal terindeks DOAJ, SINTA peringkat 1–4, atau melalui
          tinjauan editorial manual untuk sumber yang belum terindeks formal namun memenuhi standar kualitas dasar.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold text-primary">Cara Mengajukan Sanggahan</h2>
        <p className="text-sm leading-relaxed text-secondary">
          Setiap halaman detail riset memiliki tautan &quot;Keberatan dengan konten ini?&quot; pada tab Ringkasan
          &amp; Relevansi. Sanggahan Anda akan masuk ke antrean tinjauan editor sebelum ada perubahan pada halaman
          publik.
        </p>
      </section>

      <section className="mt-8 space-y-2 border-t border-warm pt-6">
        <h2 className="text-lg font-semibold text-primary">Disclaimer</h2>
        <p className="text-sm leading-relaxed text-secondary">
          Ringkasan dan label relevansi di situs ini dibantu oleh kecerdasan buatan dan ditinjau oleh editor manusia
          sebelum tayang, namun tetap dapat mengandung kesalahan interpretasi. Selalu rujuk ke sumber asli untuk
          keputusan yang bersifat kritis.
        </p>
      </section>
    </div>
  );
}
