"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

const RELEVANCE_OPTIONS = [
  { value: "still_relevant", label: "Masih Relevan" },
  { value: "needs_update", label: "Perlu Pembaruan" },
  { value: "superseded", label: "Sudah Digantikan" },
  { value: "retracted", label: "Ditarik" },
  { value: "foundational", label: "Riset Fondasi" },
];

// Hanya 4 dari 5 nilai computedStatus punya padanan langsung di publishedStatus —
// "too_new_to_score" sengaja tidak dipetakan (itu keputusan editorial "foundational" juga
// tidak pernah datang dari AI, lihat komentar skema RelevanceScore/PublishedRelevance).
const COMPUTED_TO_PUBLISHED: Record<string, string> = {
  still_relevant: "still_relevant",
  needs_update: "needs_update",
  superseded: "superseded",
  retracted: "retracted",
};

interface AiSuggestion {
  computedStatus: string;
  computedScore: number | null;
  computedReasoning: string;
}

export function RelevancePanel({
  paperId: fixedPaperId,
  paperTitle,
  onSuccess,
  onError,
}: {
  paperId?: string;
  paperTitle?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const [freePaperId, setFreePaperId] = useState("");
  const paperId = fixedPaperId ?? freePaperId;
  const [publishedStatus, setPublishedStatus] = useState(RELEVANCE_OPTIONS[0].value);
  const [publishedReasoning, setPublishedReasoning] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);

  async function handleSuggest() {
    if (!paperId) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}/relevance/suggest`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setSuggestion(body.data);
      } else {
        onError(body?.error?.message ?? "Gagal mendapat saran AI.");
      }
    } catch {
      onError("Gagal mendapat saran AI. Periksa koneksi Anda.");
    } finally {
      setSuggesting(false);
    }
  }

  function useSuggestion() {
    if (!suggestion) return;
    const mapped = COMPUTED_TO_PUBLISHED[suggestion.computedStatus];
    if (mapped) setPublishedStatus(mapped);
    setPublishedReasoning(suggestion.computedReasoning);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}/relevance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedStatus, publishedReasoning, overrideReason }),
      });
      if (res.ok) {
        onSuccess();
        setFreePaperId("");
        setPublishedReasoning("");
        setOverrideReason("");
        setSuggestion(null);
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
          onChange={(e) => setFreePaperId(e.target.value)}
          required
          readOnly={!!fixedPaperId}
          placeholder="UUID paper"
          className="w-full rounded border border-border px-2 py-1.5 text-sm read-only:bg-surface read-only:text-muted"
        />
        {paperTitle ? <p className="mt-1 text-xs text-muted">{paperTitle}</p> : null}
      </div>

      {fixedPaperId ? (
        <div className="rounded-md border border-dashed border-border p-3">
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {suggesting ? "Meminta saran AI..." : "Sarankan dengan AI"}
          </button>
          {suggestion ? (
            <div className="mt-2 space-y-1 text-xs">
              <p>
                <span className="font-medium text-foreground">Saran AI:</span> {suggestion.computedStatus}
                {suggestion.computedScore !== null ? ` (skor ${suggestion.computedScore})` : ""}
              </p>
              <p className="text-muted">{suggestion.computedReasoning}</p>
              <button
                type="button"
                onClick={useSuggestion}
                className="mt-1 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Gunakan saran ini
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

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
