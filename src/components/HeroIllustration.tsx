import { BarChart3, GraduationCap, Cpu, Sparkles } from "lucide-react";

/// Grafis dekoratif hero — jaringan node/garis (merepresentasikan AI/data) + kartu ikon
/// mengambang di sekelilingnya, terinspirasi referensi desain (globe + floating badge icons)
/// tapi digambar sendiri sebagai SVG inline (tanpa aset gambar eksternal) supaya ringan dan
/// ikut palet brand biru.
export function HeroIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm sm:max-w-md" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-100 via-brand-100/60 to-transparent" />

      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <g stroke="var(--brand-blue-700)" strokeOpacity="0.35" strokeWidth="1.5" fill="none">
          <line x1="90" y1="120" x2="200" y2="80" />
          <line x1="200" y1="80" x2="310" y2="130" />
          <line x1="90" y1="120" x2="140" y2="230" />
          <line x1="200" y1="80" x2="200" y2="200" />
          <line x1="310" y1="130" x2="270" y2="240" />
          <line x1="140" y1="230" x2="200" y2="200" />
          <line x1="200" y1="200" x2="270" y2="240" />
          <line x1="140" y1="230" x2="180" y2="320" />
          <line x1="270" y1="240" x2="240" y2="320" />
          <line x1="180" y1="320" x2="240" y2="320" />
        </g>
        <g fill="var(--brand-blue-700)">
          <circle cx="90" cy="120" r="6" />
          <circle cx="200" cy="80" r="8" />
          <circle cx="310" cy="130" r="6" />
          <circle cx="140" cy="230" r="7" />
          <circle cx="200" cy="200" r="10" />
          <circle cx="270" cy="240" r="7" />
          <circle cx="180" cy="320" r="5" />
          <circle cx="240" cy="320" r="5" />
        </g>
      </svg>

      <div className="absolute left-2 top-6 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-lg sm:left-4 sm:top-10">
        <BarChart3 className="h-4 w-4 text-brand-700" />
        <span className="text-xs font-medium text-primary">Tren Riset</span>
      </div>

      <div className="absolute right-0 top-1/3 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-lg sm:-right-2">
        <GraduationCap className="h-4 w-4 text-brand-700" />
        <span className="text-xs font-medium text-primary">Akademik</span>
      </div>

      <div className="absolute bottom-8 left-0 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-lg sm:-left-4">
        <Cpu className="h-4 w-4 text-brand-700" />
        <span className="text-xs font-medium text-primary">Kecerdasan Buatan</span>
      </div>

      <div className="absolute bottom-2 right-6 flex items-center gap-2 rounded-xl bg-brand-700 px-3 py-2 shadow-lg sm:right-10">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="text-xs font-medium text-white">Terkurasi</span>
      </div>
    </div>
  );
}
