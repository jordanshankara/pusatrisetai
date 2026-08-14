import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getPaperDetail } from "@/lib/services/papers";
import { RelevanceBadge } from "@/components/RelevanceBadge";
import { RetractedBanner } from "@/components/RetractedBanner";
import { OriginFlag } from "@/components/OriginFlag";
import { DisputeModal } from "@/components/DisputeModal";
import { formatDateId, formatYearId } from "@/lib/format";
import { POLICY_TAG_LABELS } from "@/lib/policy-tags";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const IDENTIFIER_LABELS: Record<string, string> = {
  doi: "DOI",
  arxiv_id: "arXiv",
  openalex_id: "OpenAlex",
};

function identifierUrl(idType: string, idValue: string): string | null {
  if (idType === "doi") return `https://doi.org/${idValue}`;
  if (idType === "arxiv_id") return `https://arxiv.org/abs/${idValue}`;
  return null;
}

const RELATION_LABELS: Record<string, string> = {
  superseded_by: "Digantikan oleh",
  extended_by: "Diperluas oleh",
  follow_up_same_author: "Studi lanjutan (penulis sama)",
};

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const lang = first(sp.lang) === "en" ? "en" : "id";
  const result = await getPaperDetail(id, lang);
  if (result.type !== "found") return { title: "Riset — PusatRiset.ai" };

  const description = (result.data.summary?.summaryLayperson ?? result.data.title).slice(0, 160);
  return { title: `${result.data.title} — PusatRiset.ai`, description };
}

export default async function PaperDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const sp = await searchParams;
  const lang = first(sp.lang) === "en" ? "en" : "id";
  const tab = first(sp.tab) === "ringkasan" ? "ringkasan" : "data";

  const result = await getPaperDetail(id, lang);

  if (result.type === "not_found") notFound();
  if (result.type === "redirect") permanentRedirect(`/riset/${result.survivingId}`);

  const paper = result.data;
  const secondaryTitle = paper.titles.find((t) => !t.isPrimary);
  const isRetracted = paper.relevance?.publishedStatus === "retracted";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/katalog" className="hover:text-accent">
          Katalog
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{paper.title.length > 60 ? `${paper.title.slice(0, 60)}...` : paper.title}</span>
      </nav>

      {isRetracted ? <RetractedBanner reasoning={paper.relevance?.publishedReasoning} /> : null}

      <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
        <OriginFlag origin={paper.origin} /> {paper.title}
      </h1>
      {secondaryTitle ? <p className="mt-1 text-base italic text-muted">{secondaryTitle.title}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>
          {paper.authors.length > 0 ? (
            <span className="cursor-default text-foreground">{paper.authors.map((a) => a.name).join(", ")}</span>
          ) : (
            "Penulis tidak diketahui"
          )}
        </span>
        {paper.venue ? <span>{paper.venue.displayName}</span> : null}
        {paper.publishedDate ? <span>{formatDateId(paper.publishedDate)}</span> : null}
        {paper.affiliationCountries.length > 0 ? <span>Afiliasi: {paper.affiliationCountries.join(", ")}</span> : null}
      </div>

      {paper.affiliationInferred ? (
        <p className="mt-1 text-xs text-muted">⚑ Afiliasi institusi merupakan perkiraan (belum dikonfirmasi penulis)</p>
      ) : null}

      {(paper.relevance?.publishedStatus && paper.relevance.publishedStatus !== "retracted") || paper.isFoundational ? (
        <div className="mt-5 rounded-lg border border-border bg-surface p-4">
          <RelevanceBadge status={paper.relevance?.publishedStatus} size="lg" />
          {paper.relevance?.publishedReasoning ? <p className="mt-2 text-sm text-foreground">{paper.relevance.publishedReasoning}</p> : null}
        </div>
      ) : null}

      {paper.policyTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {paper.policyTags.map((slug) => (
            <span key={slug} className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted">
              {POLICY_TAG_LABELS[slug] ?? slug}
            </span>
          ))}
        </div>
      ) : null}

      {paper.successors.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Riset Penerus</h2>
          {paper.successors.map((s, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-accent">{RELATION_LABELS[s.relationType] ?? s.relationType}</p>
              <Link href={`/riset/${s.paper.id}`} className="mt-1 block font-medium text-foreground hover:text-accent hover:underline">
                {s.paper.title} {s.paper.publishedDate ? `(${formatYearId(s.paper.publishedDate)})` : ""}
              </Link>
              {s.reasoningText ? <p className="mt-1 text-sm text-muted">{s.reasoningText}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 border-b border-border">
        <nav className="flex gap-6">
          <Link
            href={`/riset/${id}?tab=data${lang === "en" ? "&lang=en" : ""}`}
            className={`border-b-2 pb-3 text-sm font-medium ${tab === "data" ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            Data Asli
          </Link>
          <Link
            href={`/riset/${id}?tab=ringkasan${lang === "en" ? "&lang=en" : ""}`}
            className={`border-b-2 pb-3 text-sm font-medium ${tab === "ringkasan" ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            Ringkasan &amp; Relevansi
          </Link>
        </nav>
      </div>

      {tab === "data" ? (
        <div className="mt-6 space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Abstrak</h2>
            {paper.abstract ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{paper.abstract}</p>
            ) : (
              <p className="text-sm italic text-muted">
                Abstrak tidak ditampilkan karena kebijakan lisensi — baca di sumber resmi →
              </p>
            )}
          </div>

          {paper.identifiers.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-foreground">Identifier</h2>
              <ul className="space-y-1 text-sm">
                {paper.identifiers.map((idf, i) => {
                  const url = identifierUrl(idf.idType, idf.idValue);
                  return (
                    <li key={i}>
                      <span className="text-muted">{IDENTIFIER_LABELS[idf.idType] ?? idf.idType}: </span>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {idf.idValue}
                        </a>
                      ) : (
                        <span>{idf.idValue}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {(() => {
              const primaryIdf = paper.identifiers[0];
              const sourceUrl = paper.canonicalUrl ?? (primaryIdf ? identifierUrl(primaryIdf.idType, primaryIdf.idValue) : null);
              return sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                >
                  Buka Sumber Resmi
                </a>
              ) : null;
            })()}
            <a
              href={`/api/v1/papers/${id}/export?format=bibtex`}
              download={`${id}.bib`}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
            >
              Ekspor BibTeX
            </a>
          </div>

          {paper.versions.length > 1 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-foreground">Riwayat Versi</h2>
              <ul className="space-y-2 border-l-2 border-border pl-4">
                {paper.versions.map((v) => (
                  <li key={v.versionNumber} className="text-sm">
                    <span className="font-medium text-foreground">v{v.versionNumber}</span>
                    {v.versionDate ? <span className="text-muted"> · {formatDateId(v.versionDate)}</span> : null}
                    {v.changedSummary ? <p className="text-muted">{v.changedSummary}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex gap-2 text-sm">
            <Link
              href={`/riset/${id}?tab=ringkasan`}
              className={`rounded px-3 py-1 ${lang === "id" ? "bg-accent text-white" : "border border-border text-muted hover:text-foreground"}`}
            >
              Indonesia
            </Link>
            <Link
              href={`/riset/${id}?tab=ringkasan&lang=en`}
              className={`rounded px-3 py-1 ${lang === "en" ? "bg-accent text-white" : "border border-border text-muted hover:text-foreground"}`}
            >
              English
            </Link>
          </div>

          {paper.summary ? (
            <>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Ringkasan Sederhana</h2>
                <p className="text-sm leading-relaxed text-foreground">{paper.summary.summaryLayperson}</p>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Ringkasan Teknis</h2>
                <p className="text-sm leading-relaxed text-foreground">{paper.summary.summaryTechnical}</p>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Relevansi untuk Indonesia</h2>
                <p className="text-sm leading-relaxed text-foreground">{paper.summary.relevanceIndonesia}</p>
              </div>
              <p className="text-xs text-muted">
                {paper.summary.provenance === "from_full_text" ? "Dibuat dari teks lengkap" : "Dibuat dari abstrak"} — ringkasan dibantu AI, ditinjau editor
                sebelum tayang.
              </p>
            </>
          ) : (
            <p className="text-sm italic text-muted">Ringkasan dalam bahasa ini belum tersedia.</p>
          )}

          <div className="border-t border-border pt-4">
            <DisputeModal paperId={paper.id} />
          </div>
        </div>
      )}
    </div>
  );
}
