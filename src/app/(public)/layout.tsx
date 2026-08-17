import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

/// Chrome situs publik (Header/Footer) — dipisah dari root layout supaya /admin/* TIDAK ikut
/// kebawa nav/footer publik (itu penyebab admin panel terlihat "nyempil" di bawah header situs).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-page text-primary">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
