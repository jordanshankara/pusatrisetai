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
    <article className="rounded-lg border border-border bg-background p-5 transition hover:border-accent/40 hover:shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/riset/${paper.id}`} className="text-base font-semibold leading-snug text-foreground hover:text-accent hover:underline">
          <OriginFlag origin={paper.origin} /> {paper.title}
        </Link>
        <RelevanceBadge status={paper.relevanceBadge} />
      </div>

      {paper.relevanceBadge === "retracted" ? <div className="mt-1"><RetractedBanner compact /></div> : null}

      <p className="mt-2 text-sm text-muted">
        {authorsLine(paper.authorsPreview, paper.authorCount)}
        {paper.venueDisplayName ? ` · ${paper.venueDisplayName}` : ""}
        {paper.publishedDate ? ` · ${formatYearId(paper.publishedDate)}` : ""}
      </p>

      {paper.policyTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.policyTags.map((slug) => (
            <span key={slug} className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
              {POLICY_TAG_LABELS[slug] ?? slug}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
