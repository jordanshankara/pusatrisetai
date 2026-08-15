import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-lg font-semibold text-primary">Paper tidak ditemukan.</p>
      <p className="mt-2 text-sm text-secondary">Paper mungkin sudah dihapus atau belum diindeks.</p>
      <Link href="/katalog" className="mt-6 inline-block rounded-md bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900">
        Kembali ke Katalog
      </Link>
    </div>
  );
}
