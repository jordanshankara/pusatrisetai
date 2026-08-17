"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

const RELATION_TYPES = [
  { value: "related_semantic", label: "Riset Serupa" },
  { value: "superseded_by", label: "Digantikan Oleh" },
  { value: "follow_up_same_author", label: "Kelanjutan Penulis yang Sama" },
  { value: "contradicted_by", label: "Dibantah Oleh" },
  { value: "extended_by", label: "Dikembangkan Lebih Lanjut Oleh" },
];

interface CandidatePaper {
  id: string;
  title: string;
  publishedDate: string | null;
}

interface ExistingRelation {
  id: string;
  relationType: string;
  status: string;
  reasoningText: string | null;
  otherTitle: string;
}

/// Combobox floating untuk memilih paper tujuan relasi: panel besar yang bisa dicari,
/// dan SEBELUM diketik apa pun sudah berisi kandidat "mirip topik" (bukan kosong) —
/// lihat GET /api/admin/papers/[id]/relations (mode "similar" vs "search").
function PaperCombobox({
  paperId,
  selected,
  onSelect,
}: {
  paperId: string;
  selected: CandidatePaper | null;
  onSelect: (p: CandidatePaper | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidatePaper[]>([]);
  const [mode, setMode] = useState<"similar" | "search">("similar");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = query.trim().length >= 2 ? `?q=${encodeURIComponent(query.trim())}` : "";
        const res = await adminFetch(`/api/admin/papers/${paperId}/relations${params}`);
        const body = await res.json().catch(() => null);
        if (res.ok) {
          setResults(body?.data?.data ?? []);
          setMode(body?.data?.mode ?? "similar");
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, paperId]);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded border border-border px-2 py-1.5">
        <span className="text-sm text-foreground">{selected.title}</span>
        <button type="button" onClick={() => onSelect(null)} className="text-xs text-accent hover:underline">
          Ganti
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Klik untuk cari paper tujuan..."
        className="w-full rounded border border-border px-2 py-1.5 text-sm"
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 min-w-[380px] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          <p className="sticky top-0 border-b border-border bg-surface px-3 py-2 text-xs font-medium text-muted">
            {loading ? "Memuat..." : mode === "similar" ? "Mirip topik" : "Hasil pencarian"}
          </p>
          {!loading && results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted">Tidak ada kandidat.</p>
          ) : (
            <ul>
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(p);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-background"
                  >
                    {p.title}
                    {p.publishedDate ? <span className="ml-2 text-xs text-muted">{new Date(p.publishedDate).getFullYear()}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AddRelationForm({
  paperId,
  existingRelations,
  onSuccess,
  onError,
}: {
  paperId: string;
  existingRelations: ExistingRelation[];
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<CandidatePaper | null>(null);
  const [relationType, setRelationType] = useState(RELATION_TYPES[0].value);
  const [direction, setDirection] = useState<"this_is_new" | "this_is_old">("this_is_new");
  const [reasoningText, setReasoningText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPaperId: selected.id, relationType, reasoningText, direction }),
      });
      if (res.ok) {
        onSuccess();
        setSelected(null);
        setReasoningText("");
      } else {
        const body = await res.json().catch(() => null);
        onError(body?.error?.message ?? "Gagal menambah relasi.");
      }
    } catch {
      onError("Gagal menambah relasi. Periksa koneksi Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {existingRelations.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {existingRelations.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {RELATION_TYPES.find((t) => t.value === r.relationType)?.label ?? r.relationType} · {r.status}
              </p>
              <p className="text-foreground">{r.otherTitle}</p>
              {r.reasoningText ? <p className="mt-1 text-xs text-muted">{r.reasoningText}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Belum ada relasi ke paper lain.</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-dashed border-border p-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Paper tujuan</label>
          <PaperCombobox paperId={paperId} selected={selected} onSelect={setSelected} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Jenis Relasi</label>
          <select value={relationType} onChange={(e) => setRelationType(e.target.value)} className="w-full rounded border border-border px-2 py-1.5 text-sm">
            {RELATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {relationType !== "related_semantic" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Arah</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as "this_is_new" | "this_is_old")} className="w-full rounded border border-border px-2 py-1.5 text-sm">
              <option value="this_is_new">Paper ini yang lebih baru</option>
              <option value="this_is_old">Paper ini yang lebih lama</option>
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Alasan</label>
          <textarea
            value={reasoningText}
            onChange={(e) => setReasoningText(e.target.value)}
            required
            rows={2}
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selected}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Tambah Relasi"}
        </button>
      </form>
    </div>
  );
}
