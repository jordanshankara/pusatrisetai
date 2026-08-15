import Link from "next/link";
import type { PaperListItem } from "@/lib/services/papers";
import { RelevanceBadge } from "./RelevanceBadge";
import { RetractedBanner } from "./RetractedBanner";
import { OriginFlag } from "./OriginFlag";
import { formatYearId } from "@/lib/format";
import { POLICY_TAG_LABELS } from "@/lib/policy-tags";

function authorsLine(preview: string[], count: number): string {
  if (preview.length === 0) return "Penulis tidak diketahui";
  const shown = preview.slice(0, 3).join(", ");
  return count > 3 ? `${shown}, dkk.` : shown;
}

export function PaperCard({ paper }: { paper: PaperListItem }) {
  return (
    <article className="rounded-[14px] border border-warm bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-brand-700/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/riset/${paper.id}`} className="text-base font-semibold leading-snug text-primary hover:text-brand-700 hover:underline">
          <OriginFlag origin={paper.origin} /> {paper.title}
        </Link>
        <RelevanceBadge status={paper.relevanceBadge} />
      </div>

      {paper.relevanceBadge === "retracted" ? <div className="mt-1"><RetractedBanner compact /></div> : null}

      <p className="mt-2 text-sm text-secondary">
        {authorsLine(paper.authorsPreview, paper.authorCount)}
        {paper.venueDisplayName ? ` · ${paper.venueDisplayName}` : ""}
        {paper.publishedDate ? ` · ${formatYearId(paper.publishedDate)}` : ""}
      </p>

      {paper.policyTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.policyTags.map((slug) => (
            <span key={slug} className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
              {POLICY_TAG_LABELS[slug] ?? slug}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
