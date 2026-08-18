"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Toast } from "@/components/Toast";
import { AdminCard } from "@/components/admin/AdminCard";
import { RelevancePanel } from "@/components/admin/RelevancePanel";
import { AddRelationForm } from "@/components/admin/AddRelationForm";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { QuartileBadge } from "@/components/QuartileBadge";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { adminFetch } from "@/lib/admin-fetch";

interface SummaryRow {
  id: string;
  language: string;
  status: string;
  sourceType: string;
  content: string | null;
}

interface RelationRow {
  id: string;
  relationType: string;
  status: string;
  reasoningText: string | null;
  new?: { id: string; title: string };
  old?: { id: string; title: string };
}

interface PaperDetail {
  id: string;
  title: string;
  origin: "local" | "international";
  abstractRaw: string | null;
  abstractDisplayPolicy: string;
  metadataStatus: string;
  licenseNormalized: string;
  priorityPinnedAt: string | null;
  sjrQuartile: string | null;
  sjrScore: number | null;
  summaries: SummaryRow[];
  relationsOld: RelationRow[];
  relationsNew: RelationRow[];
}

export function PaperAdminDetail({ paperId }: { paperId: string }) {
  const role = useAdminRole();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [togglingPin, setTogglingPin] = useState(false);
  const isDirty = content !== savedContent;

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}`);
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setPaper(body.data);
        const published = (body.data.summaries as SummaryRow[]).find((s: SummaryRow) => s.language === "id" && s.status === "published");
        setContent(published?.content ?? "");
        setSavedContent(published?.content ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [paperId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Peringatkan sebelum menutup/reload tab kalau ada perubahan ringkasan yang belum
  // di-"Simpan & Terbitkan" — mencegah kerja editor hilang tanpa sadar.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}/summary/suggest`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setContent(body.data.content);
        showToast("Draf AI terisi — tinjau dan edit sebelum menerbitkan.");
      } else {
        showToast(body?.error?.message ?? "Gagal mendapat bantuan AI.");
      }
    } catch {
      showToast("Gagal mendapat bantuan AI. Periksa koneksi Anda.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        showToast("Ringkasan diterbitkan.");
        setSavedContent(content);
        load();
      } else {
        showToast(body?.error?.message ?? "Gagal menerbitkan ringkasan.");
      }
    } catch {
      showToast("Gagal menerbitkan ringkasan. Periksa koneksi Anda.");
    } finally {
      setPublishing(false);
    }
  }

  async function togglePin() {
    setTogglingPin(true);
    try {
      const res = await adminFetch(`/api/admin/papers/${paperId}/priority`, { method: "POST" });
      if (res.ok) load();
    } finally {
      setTogglingPin(false);
    }
  }

  if (loading || !paper) {
    return <p className="text-sm text-muted">Memuat...</p>;
  }

  const existingRelations = [
    ...paper.relationsOld.map((r) => ({ id: r.id, relationType: r.relationType, status: r.status, reasoningText: r.reasoningText, otherTitle: r.new!.title })),
    ...paper.relationsNew.map((r) => ({ id: r.id, relationType: r.relationType, status: r.status, reasoningText: r.reasoningText, otherTitle: r.old!.title })),
  ];

  return (
    <div>
      <Link
        href="/admin/jurnal"
        onClick={(e) => {
          if (isDirty && !confirm("Ada perubahan ringkasan yang belum disimpan. Tinggalkan halaman ini?")) e.preventDefault();
        }}
        className="text-sm text-accent hover:underline"
      >
        ← Daftar Jurnal
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{paper.title}</h1>
        {role === "admin" ? (
          <button
            type="button"
            onClick={togglePin}
            disabled={togglingPin}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
              paper.priorityPinnedAt ? "border-accent text-accent" : "border-border text-muted hover:bg-surface"
            }`}
          >
            {togglingPin ? "..." : paper.priorityPinnedAt ? "📌 Lepas prioritas" : "📌 Tandai prioritas"}
          </button>
        ) : paper.priorityPinnedAt ? (
          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">📌 Prioritas</span>
        ) : null}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {paper.origin === "local" ? "Indonesia" : "Internasional"} · lisensi: {paper.licenseNormalized} · abstrak: {paper.abstractDisplayPolicy}
        {paper.sjrQuartile ? (
          <QuartileBadge quartile={paper.sjrQuartile} />
        ) : (
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">Kuartil: belum dicek</span>
        )}
        {paper.sjrScore !== null ? <span className="text-xs text-muted">SJR {paper.sjrScore.toFixed(3)}</span> : null}
      </p>
      <Link href={`/riset/${paper.id}`} target="_blank" className="mt-1 inline-block text-xs text-accent hover:underline">
        Lihat halaman publik →
      </Link>

      <AdminCard className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Ringkasan</h2>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {suggesting ? "Meminta bantuan AI..." : "Isi dengan bantuan AI"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Tulis ringkasan sendiri (atur struktur bebas pakai heading/list), atau isi awal dengan AI lalu tinjau/edit sebelum menerbitkan.</p>

        <div className="mt-3">
          <RichTextEditor content={content} onChange={setContent} />
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing || !content.replace(/<[^>]+>/g, "").trim()}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {publishing ? "Menerbitkan..." : "Simpan & Terbitkan"}
        </button>
      </AdminCard>

      <AdminCard className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Relasi ke Jurnal Lain</h2>
        <div className="mt-2">
          <AddRelationForm paperId={paper.id} existingRelations={existingRelations} onSuccess={() => { showToast("Relasi ditambahkan."); load(); }} onError={showToast} />
        </div>
      </AdminCard>

      <AdminCard className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Relevansi</h2>
        <RelevancePanel paperId={paper.id} paperTitle={paper.title} onSuccess={() => showToast("Relevansi diperbarui.")} onError={showToast} />
      </AdminCard>

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}
