"use client";

import { POLICY_TAGS } from "@/lib/policy-tags";

const RELEVANCE_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "still_relevant", label: "Masih Relevan" },
  { value: "needs_update", label: "Perlu Pembaruan" },
  { value: "superseded", label: "Sudah Digantikan" },
  { value: "retracted", label: "Ditarik" },
  { value: "foundational", label: "Riset Fondasi" },
  { value: "none", label: "Tanpa Badge" },
];

function autoSubmit(e: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.form?.requestSubmit();
}

interface FilterFormProps {
  q?: string;
  origin?: string;
  yearFrom?: string;
  yearTo?: string;
  subfields: string[];
  relevance?: string;
  policyTag?: string;
  hideSuperseded: boolean;
  openAccess: boolean;
  subfieldOptions: Array<{ subfield: string; count: number }>;
}

export function FilterForm({
  q,
  origin,
  yearFrom,
  yearTo,
  subfields,
  relevance,
  policyTag,
  hideSuperseded,
  openAccess,
  subfieldOptions,
}: FilterFormProps) {
  return (
    <form method="GET" action="/katalog" className="space-y-6 text-sm text-primary">
      {q ? <input type="hidden" name="q" value={q} /> : null}

      <fieldset>
        <legend className="mb-2 font-semibold text-primary">Asal Riset</legend>
        <div className="space-y-1.5">
          {[
            { value: "", label: "Semua" },
            { value: "local", label: "Indonesia" },
            { value: "international", label: "Internasional" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2">
              <input type="radio" name="origin" value={opt.value} defaultChecked={(origin ?? "") === opt.value} onChange={autoSubmit} />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-primary">Rentang Tahun</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="yearFrom"
            defaultValue={yearFrom}
            onBlur={autoSubmit}
            placeholder="Dari"
            className="w-full rounded border border-warm bg-card px-2 py-1"
          />
          <span className="text-muted-warm">—</span>
          <input
            type="number"
            name="yearTo"
            defaultValue={yearTo}
            onBlur={autoSubmit}
            placeholder="Sampai"
            className="w-full rounded border border-warm bg-card px-2 py-1"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-primary">Subbidang</legend>
        <div className="space-y-1.5">
          {subfieldOptions.map((opt) => (
            <label key={opt.subfield} className="flex items-center gap-2">
              <input type="checkbox" name="subfield" value={opt.subfield} defaultChecked={subfields.includes(opt.subfield)} onChange={autoSubmit} />
              {opt.subfield}
              <span className="text-muted-warm">({opt.count})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-primary">Badge Relevansi</legend>
        <select name="relevance" defaultValue={relevance ?? ""} onChange={autoSubmit} className="w-full rounded border border-warm bg-card px-2 py-1.5">
          {RELEVANCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold text-primary">Tag Kebijakan</legend>
        <select name="policyTag" defaultValue={policyTag ?? ""} onChange={autoSubmit} className="w-full rounded border border-warm bg-card px-2 py-1.5">
          <option value="">Semua</option>
          {POLICY_TAGS.map((tag) => (
            <option key={tag.slug} value={tag.slug}>
              {tag.labelId}
            </option>
          ))}
        </select>
      </fieldset>

      <div className="space-y-2 border-t border-warm pt-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hideSuperseded" value="true" defaultChecked={hideSuperseded} onChange={autoSubmit} />
          Sembunyikan yang sudah digantikan
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="openAccess" value="true" defaultChecked={openAccess} onChange={autoSubmit} />
          Hanya akses terbuka
        </label>
      </div>

      <noscript>
        <button type="submit" className="w-full rounded-md bg-brand-700 px-4 py-2 text-white">
          Terapkan Filter
        </button>
      </noscript>
      <a href="/katalog" className="block text-center text-brand-700 hover:underline">
        Reset semua filter
      </a>
    </form>
  );
}
