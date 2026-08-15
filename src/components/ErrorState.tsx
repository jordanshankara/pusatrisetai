"use client";

export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-lg font-semibold text-primary">Terjadi kesalahan saat memuat halaman.</p>
      <p className="mt-2 text-sm text-secondary">{error.message || "Silakan coba lagi."}</p>
      <button onClick={reset} className="mt-6 rounded-md bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900">
        Coba lagi
      </button>
    </div>
  );
}
