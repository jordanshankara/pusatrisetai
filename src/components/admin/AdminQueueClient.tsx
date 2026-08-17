"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/Toast";
import { RelevancePanel } from "@/components/admin/RelevancePanel";
import { AdminCard } from "@/components/admin/AdminCard";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { adminFetch } from "@/lib/admin-fetch";

type PaperRef = { id: string; title: string };

interface SummaryItem {
  id: string;
  paperId: string;
  language: "id" | "en";
  content: string | null;
  sourceType: string;
  status: string;
  paper: PaperRef;
}

interface RelationItem {
  id: string;
  relationType: string;
  reasoningText: string | null;
  status: string;
  old: PaperRef;
  new: PaperRef;
}

interface PolicyTagItem {
  paperId: string;
  tagId: string;
  status: string;
  paper: PaperRef;
  tag: { id: string; slug: string; labelId: string };
}

interface DisputeItem {
  id: string;
  paperId: string;
  disputeType: string;
  submittedByName: string | null;
  submittedByEmail: string | null;
  argument: string;
  status: string;
  paper: PaperRef | null;
}

interface SubmissionItem {
  id: string;
  submittedByName: string | null;
  submittedByEmail: string;
  claimedIdentifier: string | null;
  status: string;
  paper: PaperRef | null;
}

interface QueueData {
  summaries: SummaryItem[];
  relations: RelationItem[];
  policyTags: PolicyTagItem[];
  disputes: DisputeItem[];
  submissions: SubmissionItem[];
}

const TABS = [
  { key: "summaries", label: "Ringkasan" },
  { key: "relations", label: "Relasi" },
  { key: "policyTags", label: "Policy Tag" },
  { key: "disputes", label: "Sanggahan" },
  { key: "submissions", label: "Submission" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SUBMISSION_REJECT_REASONS = [
  { value: "rejected_spam", label: "Spam" },
  { value: "rejected_predatory", label: "Venue predator" },
  { value: "rejected_duplicate", label: "Duplikat" },
  { value: "rejected_no_credentials", label: "Tanpa kredensial" },
];

export function AdminQueueClient() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("summaries");
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/queue");
      if (!res.ok) throw new Error("gagal memuat antrean");
      const body = await res.json();
      setData(body.data);
    } catch {
      setError("Gagal memuat antrean. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function reviewItem(url: string, body: Record<string, unknown>, itemId: string, removeFn: () => void, successMsg: string) {
    setBusyId(itemId);
    try {
      const res = await adminFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        removeFn();
        showToast(successMsg);
      } else {
        const errBody = await res.json().catch(() => null);
        showToast(errBody?.error?.message ?? "Aksi gagal. Coba lagi.");
      }
    } catch {
      showToast("Aksi gagal. Periksa koneksi Anda.");
    } finally {
      setBusyId(null);
    }
  }

  function removeItem<K extends keyof QueueData>(key: K, predicate: (item: QueueData[K][number]) => boolean) {
    setData((prev) => (prev ? { ...prev, [key]: (prev[key] as QueueData[K]).filter((item) => !predicate(item)) } : prev));
  }

  if (loading) {
    return <p className="text-sm text-muted">Memuat antrean...</p>;
  }

  if (error || !data) {
    return (
      <div>
        <p className="text-sm text-[var(--badge-retracted-fg)]">{error ?? "Data tidak tersedia."}</p>
        <button onClick={loadQueue} className="mt-3 rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover">
          Coba lagi
        </button>
      </div>
    );
  }

  const counts: Record<TabKey, number> = {
    summaries: data.summaries.length,
    relations: data.relations.length,
    policyTags: data.policyTags.length,
    disputes: data.disputes.length,
    submissions: data.submissions.length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Panel Editorial</h1>
      <p className="mt-1 text-sm text-muted">Item yang menunggu tinjauan Anda.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TABS.map((t) => (
          <AdminCard key={t.key} className="text-center">
            <p className="text-2xl font-bold text-foreground">{counts[t.key]}</p>
            <p className="mt-1 text-xs text-muted">{t.label}</p>
          </AdminCard>
        ))}
      </div>

      <AdminCard className="mt-6 p-0">
        <div className="border-b border-border px-5 pt-4">
          <nav className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                  tab === t.key ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label} <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs">{counts[t.key]}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-4 p-5">
          {tab === "summaries" &&
          (data.summaries.length === 0 ? (
            <EmptyState />
          ) : (
            data.summaries.map((s) => (
              <SummaryReviewCard
                key={s.id}
                item={s}
                busy={busyId === s.id}
                onReview={(action, edits) =>
                  reviewItem(
                    `/api/admin/summaries/${s.id}/review`,
                    { action, ...(edits ? { edits } : {}) },
                    s.id,
                    () => removeItem("summaries", (x) => x.id === s.id),
                    action === "approve" ? "Ringkasan disetujui dan tayang." : "Ringkasan ditolak."
                  )
                }
              />
            ))
          ))}

        {tab === "relations" &&
          (data.relations.length === 0 ? (
            <EmptyState />
          ) : (
            data.relations.map((r) => (
              <RelationReviewCard
                key={r.id}
                item={r}
                busy={busyId === r.id}
                onReview={(action) =>
                  reviewItem(
                    `/api/admin/relations/${r.id}/review`,
                    { action },
                    r.id,
                    () => removeItem("relations", (x) => x.id === r.id),
                    action === "approve" ? "Relasi disetujui." : "Relasi ditolak."
                  )
                }
              />
            ))
          ))}

        {tab === "policyTags" &&
          (data.policyTags.length === 0 ? (
            <EmptyState />
          ) : (
            data.policyTags.map((p) => (
              <PolicyTagReviewCard
                key={`${p.paperId}-${p.tagId}`}
                item={p}
                busy={busyId === `${p.paperId}-${p.tagId}`}
                onReview={(action) =>
                  reviewItem(
                    "/api/admin/policy-tags/review",
                    { paperId: p.paperId, tagId: p.tagId, action },
                    `${p.paperId}-${p.tagId}`,
                    () => removeItem("policyTags", (x) => x.paperId === p.paperId && x.tagId === p.tagId),
                    action === "approve" ? "Tag disetujui." : "Tag ditolak."
                  )
                }
              />
            ))
          ))}

        {tab === "disputes" &&
          (data.disputes.length === 0 ? (
            <EmptyState />
          ) : (
            data.disputes.map((d) => (
              <DisputeReviewCard
                key={d.id}
                item={d}
                busy={busyId === d.id}
                onReview={(action, resolution) =>
                  reviewItem(
                    `/api/admin/disputes/${d.id}/review`,
                    { action, ...(resolution ? { resolution } : {}) },
                    d.id,
                    () => removeItem("disputes", (x) => x.id === d.id),
                    action === "approve" ? "Sanggahan diterima." : "Sanggahan ditolak."
                  )
                }
              />
            ))
          ))}

        {tab === "submissions" &&
          (data.submissions.length === 0 ? (
            <EmptyState />
          ) : (
            data.submissions.map((s) => (
              <SubmissionReviewCard
                key={s.id}
                item={s}
                busy={busyId === s.id}
                onReview={(action, reason) =>
                  reviewItem(
                    `/api/admin/submissions/${s.id}/review`,
                    action === "approve" ? { action } : { action, reason },
                    s.id,
                    () => removeItem("submissions", (x) => x.id === s.id),
                    action === "approve" ? "Submission disetujui." : "Submission ditolak."
                  )
                }
              />
            ))
          ))}
        </div>
      </AdminCard>

      <AdminCard className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Set Relevansi Manual</h2>
        <p className="mt-1 text-sm text-muted">Tetapkan status relevansi publik untuk satu paper (dengan alasan override).</p>
        <RelevancePanel onSuccess={() => showToast("Relevansi paper diperbarui.")} onError={(msg) => showToast(msg)} />
      </AdminCard>

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function EmptyState() {
  return <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">Antrean kosong.</p>;
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border p-4">{children}</div>;
}

function ActionButtons({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? "..." : "Approve"}
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
      >
        {busy ? "..." : "Reject"}
      </button>
    </div>
  );
}

function SummaryReviewCard({
  item,
  busy,
  onReview,
}: {
  item: SummaryItem;
  busy: boolean;
  onReview: (action: "approve" | "reject", edits?: Record<string, string>) => void;
}) {
  const [content, setContent] = useState(item.content ?? "");

  return (
    <CardShell>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{item.paper.title}</p>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{item.language} · {item.status}</span>
      </div>
      <div className="mt-3 text-sm">
        <RichTextEditor content={content} onChange={setContent} />
      </div>
      <ActionButtons busy={busy} onApprove={() => onReview("approve", { content })} onReject={() => onReview("reject")} />
    </CardShell>
  );
}

function RelationReviewCard({ item, busy, onReview }: { item: RelationItem; busy: boolean; onReview: (action: "approve" | "reject") => void }) {
  return (
    <CardShell>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{item.relationType}</p>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="text-muted">{item.old.title}</span>
        <span className="text-muted">→</span>
        <span className="font-medium text-foreground">{item.new.title}</span>
      </div>
      {item.reasoningText ? <p className="mt-2 text-sm text-muted">{item.reasoningText}</p> : null}
      <ActionButtons busy={busy} onApprove={() => onReview("approve")} onReject={() => onReview("reject")} />
    </CardShell>
  );
}

function PolicyTagReviewCard({ item, busy, onReview }: { item: PolicyTagItem; busy: boolean; onReview: (action: "approve" | "reject") => void }) {
  return (
    <CardShell>
      <p className="text-sm font-medium text-foreground">{item.paper.title}</p>
      <p className="mt-1 text-sm text-muted">Tag: {item.tag.labelId}</p>
      <ActionButtons busy={busy} onApprove={() => onReview("approve")} onReject={() => onReview("reject")} />
    </CardShell>
  );
}

function DisputeReviewCard({
  item,
  busy,
  onReview,
}: {
  item: DisputeItem;
  busy: boolean;
  onReview: (action: "approve" | "reject", resolution?: string) => void;
}) {
  const [resolution, setResolution] = useState("");
  return (
    <CardShell>
      <p className="text-sm font-medium text-foreground">{item.paper?.title ?? "(paper tidak ditemukan)"}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">{item.disputeType}</p>
      <p className="mt-2 text-sm text-muted">{item.argument}</p>
      {(item.submittedByName || item.submittedByEmail) && (
        <p className="mt-1 text-xs text-muted">
          Dari: {item.submittedByName ?? "anonim"} {item.submittedByEmail ? `(${item.submittedByEmail})` : ""}
        </p>
      )}
      <div className="mt-2">
        <label className="mb-1 block text-xs font-medium text-muted">Resolusi (opsional)</label>
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={2}
          className="w-full rounded border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <ActionButtons busy={busy} onApprove={() => onReview("approve", resolution || undefined)} onReject={() => onReview("reject", resolution || undefined)} />
    </CardShell>
  );
}

function SubmissionReviewCard({
  item,
  busy,
  onReview,
}: {
  item: SubmissionItem;
  busy: boolean;
  onReview: (action: "approve" | "reject", reason?: string) => void;
}) {
  const [reason, setReason] = useState(SUBMISSION_REJECT_REASONS[0].value);
  return (
    <CardShell>
      <p className="text-sm font-medium text-foreground">{item.paper?.title ?? item.claimedIdentifier ?? "(identifier tidak dikenal)"}</p>
      <p className="mt-1 text-xs text-muted">
        Dari: {item.submittedByName ?? "anonim"} ({item.submittedByEmail})
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onReview("approve")}
          disabled={busy}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "..." : "Approve"}
        </button>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border border-border px-2 py-1.5 text-sm">
          {SUBMISSION_REJECT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onReview("reject", reason)}
          disabled={busy}
          className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
        >
          {busy ? "..." : "Reject"}
        </button>
      </div>
    </CardShell>
  );
}
