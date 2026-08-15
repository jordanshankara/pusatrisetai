"use client";

import { useState } from "react";

const DISPUTE_TYPES = [
  { value: "relevance_badge", label: "Badge relevansi tidak tepat" },
  { value: "abstract_policy", label: "Kebijakan abstrak/lisensi salah" },
  { value: "summary_accuracy", label: "Ringkasan tidak akurat" },
  { value: "other", label: "Lainnya" },
];

export function DisputeModal({ paperId }: { paperId: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/v1/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          disputeType: form.get("disputeType"),
          name: form.get("name") || undefined,
          email: form.get("email") || undefined,
          argument: form.get("argument"),
        }),
      });

      if (res.ok) {
        setOpen(false);
        setToast("Terima kasih — sanggahan Anda sudah kami terima dan akan ditinjau editor.");
      } else {
        const body = await res.json().catch(() => null);
        setToast(body?.error?.message ?? "Gagal mengirim sanggahan. Coba lagi.");
      }
    } catch {
      setToast("Gagal mengirim sanggahan. Periksa koneksi Anda.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-brand-700 hover:underline">
        Keberatan dengan konten ini?
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Ajukan Sanggahan</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium">Jenis sanggahan</label>
                <select name="disputeType" required className="w-full rounded border border-border px-3 py-2">
                  {DISPUTE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium">Nama (opsional)</label>
                <input name="name" className="w-full rounded border border-border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block font-medium">Email (opsional)</label>
                <input name="email" type="email" className="w-full rounded border border-border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block font-medium">Penjelasan</label>
                <textarea name="argument" required rows={4} className="w-full rounded border border-border px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-muted hover:bg-surface">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="rounded-md bg-accent px-4 py-2 text-white hover:bg-accent-hover disabled:opacity-50">
                  {submitting ? "Mengirim..." : "Kirim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          {toast}
        </div>
      ) : null}
    </>
  );
}
