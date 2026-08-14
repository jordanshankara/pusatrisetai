import type { Metadata } from "next";
import { listPapers, getTopicsWithCounts, type RelevanceFilterValue, RELEVANCE_FILTER_VALUES } from "@/lib/services/papers";
import { PaperCard } from "@/components/PaperCard";
import { FilterForm } from "@/components/FilterForm";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = {
  title: "Katalog Riset — PusatRiset.ai",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function KatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  const q = first(sp.q);
  const origin = first(sp.origin) as "local" | "international" | undefined;
  const yearFrom = first(sp.yearFrom);
  const yearTo = first(sp.yearTo);
  const subfields = toList(sp.subfield);
  const relevanceRaw = first(sp.relevance);
  const relevance = RELEVANCE_FILTER_VALUES.includes(relevanceRaw as RelevanceFilterValue) ? (relevanceRaw as RelevanceFilterValue) : undefined;
  const policyTag = first(sp.policyTag);
  const hideSuperseded = first(sp.hideSuperseded) === "true";
  const openAccess = first(sp.openAccess) === "true";
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const perPage = 20;

  const [result, subfieldOptions] = await Promise.all([
    listPapers({
      q,
      origin: origin === "local" || origin === "international" ? origin : undefined,
      yearFrom: yearFrom ? Number(yearFrom) : undefined,
      yearTo: yearTo ? Number(yearTo) : undefined,
      subfield: subfields.length > 0 ? subfields : undefined,
      relevance,
      policyTag: policyTag || undefined,
      hideSuperseded,
      openAccess: openAccess || undefined,
      page,
      perPage,
    }),
    getTopicsWithCounts(),
  ]);

  function buildHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (origin) params.set("origin", origin);
    if (yearFrom) params.set("yearFrom", yearFrom);
    if (yearTo) params.set("yearTo", yearTo);
    for (const s of subfields) params.append("subfield", s);
    if (relevance) params.set("relevance", relevance);
    if (policyTag) params.set("policyTag", policyTag);
    if (hideSuperseded) params.set("hideSuperseded", "true");
    if (openAccess) params.set("openAccess", "true");
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/katalog?${qs}` : "/katalog";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <form action="/katalog" method="GET" className="mb-6 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Cari judul, topik, atau kata kunci riset..."
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm focus:border-accent focus:outline-none"
        />
        <button type="submit" className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">
          Cari
        </button>
      </form>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="order-2 lg:order-1">
          <FilterForm
            q={q}
            origin={origin}
            yearFrom={yearFrom}
            yearTo={yearTo}
            subfields={subfields}
            relevance={relevance}
            policyTag={policyTag}
            hideSuperseded={hideSuperseded}
            openAccess={openAccess}
            subfieldOptions={subfieldOptions}
          />
        </aside>

        <div className="order-1 lg:order-2">
          <p className="mb-4 text-sm text-muted">
            {result.total.toLocaleString("id-ID")} riset ditemukan
          </p>

          {result.data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted">
              Tidak ada hasil — coba longgarkan filter.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.data.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          )}

          <Pagination page={result.page} perPage={result.perPage} total={result.total} buildHref={buildHref} />
        </div>
      </div>
    </div>
  );
}
