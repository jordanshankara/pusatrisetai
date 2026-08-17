import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PusatRiset.ai — Kurasi Riset AI Indonesia & Dunia",
  description: "Pusat kurasi riset AI Indonesia & dunia — abstrak asli, makna nyata.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}>
      {/* Body TIDAK boleh bawa warna/token editorial (bg-page/text-primary) — /admin/* pakai
          palet netral sendiri (lihat AdminSidebar/layout admin), warna editorial cukup di
          src/app/(public)/layout.tsx yang membungkus wrapper flex-nya sendiri. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
