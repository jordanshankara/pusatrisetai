import type { Metadata } from "next";
import { Search, LayoutGrid, LibraryBig, SearchX } from "lucide-react";
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
    <div>
      <section className="relative overflow-hidden border-b border-warm bg-card-alt">
        <div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-gradient-to-br from-teal-200/40 to-transparent blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100">
              <LibraryBig className="h-5 w-5 text-brand-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900 sm:text-2xl">Katalog Riset</h1>
              <p className="text-sm text-secondary">{result.total.toLocaleString("id-ID")} riset AI Indonesia &amp; dunia siap dijelajahi</p>
            </div>
          </div>

          {/* Filter aktif dibawa lewat hidden input supaya mengetik pencarian baru TIDAK menghapus
              filter lain yang sedang aktif (dulu form ini terpisah dari FilterForm dan cuma bawa
              `q`, jadi submit di sini menimpa origin/subfield/relevance/dst). */}
          <form action="/katalog" method="GET" className="mt-6 flex gap-2">
            {origin ? <input type="hidden" name="origin" value={origin} /> : null}
            {yearFrom ? <input type="hidden" name="yearFrom" value={yearFrom} /> : null}
            {yearTo ? <input type="hidden" name="yearTo" value={yearTo} /> : null}
            {subfields.map((s) => (
              <input key={s} type="hidden" name="subfield" value={s} />
            ))}
            {relevance ? <input type="hidden" name="relevance" value={relevance} /> : null}
            {policyTag ? <input type="hidden" name="policyTag" value={policyTag} /> : null}
            {hideSuperseded ? <input type="hidden" name="hideSuperseded" value="true" /> : null}
            {openAccess ? <input type="hidden" name="openAccess" value="true" /> : null}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-warm" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Cari judul, topik, atau kata kunci riset..."
                className="w-full rounded-md border border-warm bg-card py-2.5 pl-10 pr-4 text-sm shadow-[var(--shadow-card)] focus:border-brand-700 focus:outline-none"
              />
            </div>
            <button type="submit" className="rounded-md bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900">
              Cari
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="order-2 h-fit rounded-[14px] border border-warm bg-card p-4 shadow-[var(--shadow-card)] lg:sticky lg:top-20 lg:order-1">
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
            <p className="mb-4 flex items-center gap-1.5 text-sm text-secondary">
              <LayoutGrid className="h-4 w-4 text-brand-700" />
              {result.total.toLocaleString("id-ID")} riset ditemukan
            </p>

            {result.data.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-warm bg-card-alt p-12 text-center">
                <SearchX className="mx-auto h-8 w-8 text-muted-warm" />
                <p className="mt-3 text-sm text-secondary">Tidak ada hasil — coba longgarkan filter.</p>
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
    </div>
  );
}
