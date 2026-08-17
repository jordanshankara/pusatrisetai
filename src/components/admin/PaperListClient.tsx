"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { RelevanceBadge } from "@/components/RelevanceBadge";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { adminFetch } from "@/lib/admin-fetch";

interface PaperRow {
  id: string;
  title: string;
  origin: "local" | "international";
  publishedDate: string | null;
  metadataStatus: string;
  licenseNormalized: string;
  tierReason: string | null;
  sourceTier: string;
  isFoundational: boolean;
  enrichmentStatus: string;
  priorityPinnedAt: string | null;
  isNew: boolean;
  summaryStatus: "none" | "draft" | "published";
  relevancePublishedStatus: string | null;
  relevanceComputedStatus: string | null;
  citationCountTotal: number | null;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru terbit" },
  { value: "oldest", label: "Terlama terbit" },
  { value: "priority", label: "Prioritas (Tier + Sitasi)" },
  { value: "recently_added", label: "Baru masuk sistem" },
  { value: "oldest_added", label: "Terlama menunggu" },
  { value: "title_asc", label: "Judul A-Z" },
];

const SUMMARY_STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "none", label: "Belum ada" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Terbit" },
];

const RELEVANCE_STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "unscored", label: "Belum dinilai" },
  { value: "published", label: "Sudah dinilai" },
];

const METADATA_STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "indexed", label: "Indexed" },
  { value: "queued_review", label: "Antre review" },
  { value: "rejected", label: "Ditolak" },
  { value: "withdrawn", label: "Ditarik" },
];

const ENRICHMENT_STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "enriched_openalex", label: "Terpenuhi (OpenAlex)" },
  { value: "no_doi", label: "Tanpa DOI" },
  { value: "not_found_openalex", label: "Tidak ditemukan" },
  { value: "failed", label: "Gagal" },
];

const SUMMARY_STATUS_BADGE: Record<string, string> = {
  none: "bg-surface text-muted",
  draft: "bg-[var(--badge-needs-update-bg)] text-[var(--badge-needs-update-fg)]",
  published: "bg-[var(--badge-still-relevant-bg)] text-[var(--badge-still-relevant-fg)]",
};
const SUMMARY_STATUS_LABEL: Record<string, string> = {
  none: "Belum ada ringkasan",
  draft: "Draft menunggu review",
  published: "Ringkasan terbit",
};

const selectClass = "rounded border border-border px-2 py-1.5 text-sm";

export function PaperListClient() {
  const role = useAdminRole();
  const [q, setQ] = useState("");
  const [origin, setOrigin] = useState("");
  const [sort, setSort] = useState("newest");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [summaryStatus, setSummaryStatus] = useState("");
  const [relevanceStatus, setRelevanceStatus] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState("");
  const [enrichmentStatus, setEnrichmentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);

  const [data, setData] = useState<PaperRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reset ke halaman 1 tiap kali salah satu filter/sort berubah (bukan pagination itu sendiri) —
  // disesuaikan saat render (bukan di useEffect) mengikuti pola React "adjusting state during
  // render" supaya tidak memicu render tambahan yang tidak perlu.
  const filterKey = JSON.stringify([q, origin, sort, yearFrom, yearTo, summaryStatus, relevanceStatus, newOnly, pinnedOnly, metadataStatus, enrichmentStatus]);
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  async function loadPapers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ perPage: "50", page: String(page), sort });
      if (q.trim()) params.set("q", q.trim());
      if (origin) params.set("origin", origin);
      if (yearFrom.trim()) params.set("yearFrom", yearFrom.trim());
      if (yearTo.trim()) params.set("yearTo", yearTo.trim());
      if (summaryStatus) params.set("summaryStatus", summaryStatus);
      if (relevanceStatus) params.set("relevanceStatus", relevanceStatus);
      if (newOnly) params.set("newOnly", "true");
      if (pinnedOnly) params.set("pinnedOnly", "true");
      if (metadataStatus) params.set("metadataStatus", metadataStatus);
      if (enrichmentStatus) params.set("enrichmentStatus", enrichmentStatus);
      const res = await adminFetch(`/api/admin/papers?${params}`);
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setData(body.data);
        setTotal(body.meta?.total ?? body.data.length);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const debounce = setTimeout(loadPapers, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, origin, sort, yearFrom, yearTo, summaryStatus, relevanceStatus, newOnly, pinnedOnly, metadataStatus, enrichmentStatus, page]);

  async function togglePin(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setTogglingPinId(id);
    try {
      const res = await adminFetch(`/api/admin/papers/${id}/priority`, { method: "POST" });
      if (res.ok) loadPapers();
    } finally {
      setTogglingPinId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Jurnal</h1>
      <p className="mt-1 text-sm text-muted">Jurnal masuk otomatis lewat fetch OpenAlex — kerjakan ringkasan &amp; relasi di sini.</p>

      <AdminCard className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari judul..."
            className="w-64 rounded border border-border px-3 py-1.5 text-sm"
          />
          <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={selectClass}>
            <option value="">Semua asal</option>
            <option value="local">Indonesia</option>
            <option value="international">Internasional</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <span>Tahun</span>
            <input
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="dari"
              inputMode="numeric"
              className="w-20 rounded border border-border px-2 py-1.5 text-sm"
            />
            <span>–</span>
            <input
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="sampai"
              inputMode="numeric"
              className="w-20 rounded border border-border px-2 py-1.5 text-sm"
            />
          </div>
          <select value={summaryStatus} onChange={(e) => setSummaryStatus(e.target.value)} className={selectClass}>
            {SUMMARY_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Ringkasan: {o.label}
              </option>
            ))}
          </select>
          <select value={relevanceStatus} onChange={(e) => setRelevanceStatus(e.target.value)} className={selectClass}>
            {RELEVANCE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Relevansi: {o.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} />
            Baru (7 hari)
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={pinnedOnly} onChange={(e) => setPinnedOnly(e.target.checked)} />
            📌 Ditandai admin
          </label>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Filter data lanjutan {advancedOpen ? "▴" : "▾"}
          </button>
          {advancedOpen ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-3">
              <select value={metadataStatus} onChange={(e) => setMetadataStatus(e.target.value)} className={selectClass}>
                {METADATA_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Metadata: {o.label}
                  </option>
                ))}
              </select>
              <select value={enrichmentStatus} onChange={(e) => setEnrichmentStatus(e.target.value)} className={selectClass}>
                {ENRICHMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Pengayaan data: {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted">
          {loading ? "Memuat..." : `Menampilkan ${data?.length ?? 0} dari ${total} paper`}
        </p>

        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted">Memuat...</p>
          ) : !data || data.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">Tidak ada paper yang cocok.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/jurnal/${p.id}`} className="block rounded-lg border border-border p-3 hover:bg-background">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{p.title}</p>
                      {role === "admin" ? (
                        <button
                          type="button"
                          onClick={(e) => togglePin(e, p.id)}
                          disabled={togglingPinId === p.id}
                          title={p.priorityPinnedAt ? "Lepas tanda prioritas" : "Tandai prioritas"}
                          className={`shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
                            p.priorityPinnedAt ? "border-accent text-accent" : "border-border text-muted hover:bg-surface"
                          }`}
                        >
                          📌
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {p.origin === "local" ? "Indonesia" : "Internasional"} · {p.publishedDate ? new Date(p.publishedDate).getFullYear() : "tahun ?"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.priorityPinnedAt ? (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">📌 Prioritas</span>
                      ) : null}
                      {p.isNew ? (
                        <span className="rounded-full bg-[var(--badge-needs-update-bg)] px-2 py-0.5 text-xs font-medium text-[var(--badge-needs-update-fg)]">
                          Baru
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUMMARY_STATUS_BADGE[p.summaryStatus]}`}>
                        {SUMMARY_STATUS_LABEL[p.summaryStatus]}
                      </span>
                      {p.relevancePublishedStatus ? (
                        <RelevanceBadge status={p.relevancePublishedStatus} />
                      ) : (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">Relevansi belum dinilai</span>
                      )}
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                        {p.sourceTier.replace("tier_", "T")}
                        {p.isFoundational ? " ⭐" : ""}
                      </span>
                      {p.citationCountTotal !== null ? (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{p.citationCountTotal} sitasi</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && data && data.length > 0 ? (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-muted">
              Halaman {page} dari {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
