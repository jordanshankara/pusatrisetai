"use client";

import { useState } from "react";

const RELEVANCE_OPTIONS = [
  { value: "still_relevant", label: "Masih Relevan" },
  { value: "needs_update", label: "Perlu Pembaruan" },
  { value: "superseded", label: "Sudah Digantikan" },
  { value: "retracted", label: "Ditarik" },
  { value: "foundational", label: "Riset Fondasi" },
];

export function RelevancePanel({ onSuccess, onError }: { onSuccess: () => void; onError: (message: string) => void }) {
  const [paperId, setPaperId] = useState("");
  const [publishedStatus, setPublishedStatus] = useState(RELEVANCE_OPTIONS[0].value);
  const [publishedReasoning, setPublishedReasoning] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/papers/${paperId}/relevance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedStatus, publishedReasoning, overrideReason }),
      });
      if (res.ok) {
        onSuccess();
        setPaperId("");
        setPublishedReasoning("");
        setOverrideReason("");
      } else {
        const body = await res.json().catch(() => null);
        onError(body?.error?.message ?? "Gagal memperbarui relevansi.");
      }
    } catch {
      onError("Gagal memperbarui relevansi. Periksa koneksi Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-lg space-y-3 rounded-lg border border-border p-4 text-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">ID Paper</label>
        <input
          value={paperId}
          onChange={(e) => setPaperId(e.target.value)}
          required
          placeholder="UUID paper"
          className="w-full rounded border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Status Relevansi</label>
        <select value={publishedStatus} onChange={(e) => setPublishedStatus(e.target.value)} className="w-full rounded border border-border px-2 py-1.5 text-sm">
          {RELEVANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Alasan (publik)</label>
        <textarea
          value={publishedReasoning}
          onChange={(e) => setPublishedReasoning(e.target.value)}
          required
          rows={2}
          className="w-full rounded border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Alasan Override (internal)</label>
        <textarea
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          required
          rows={2}
          className="w-full rounded border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Menyimpan..." : "Simpan Relevansi"}
      </button>
    </form>
  );
}
