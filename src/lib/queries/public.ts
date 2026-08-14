import type { Prisma } from "@prisma/client";

/**
 * Bagian 6.1 BuildSpec — ATURAN PALING PENTING: query publik APA PUN wajib memfilter:
 * papers metadataStatus='indexed'; summaries status='published'; relations status='approved';
 * policyTags status='published'; badge dari publishedStatus (bukan computedStatus).
 *
 * Semua route publik WAJIB pakai konstanta/fungsi di sini, jangan menulis filter status
 * langsung di route handler — supaya tidak bisa lupa di satu endpoint (itulah sebabnya
 * helper ini dipisah terpusat).
 */

export const PUBLIC_PAPER_WHERE = { metadataStatus: "indexed" as const };
export const PUBLIC_SUMMARY_WHERE = { status: "published" as const };
export const PUBLIC_RELATION_WHERE = { status: "approved" as const };
export const PUBLIC_POLICY_TAG_WHERE = { status: "published" as const };

export function withPublicPaperFilter(extra: Prisma.PaperWhereInput): Prisma.PaperWhereInput {
  return { ...extra, ...PUBLIC_PAPER_WHERE };
}

/** Query filter Prisma untuk relasi Paper.summaries yang boleh terlihat publik. */
export const publicSummariesInclude = {
  where: PUBLIC_SUMMARY_WHERE,
} as const;

/** Query filter Prisma untuk relasi Paper.policyTags yang boleh terlihat publik. */
export const publicPolicyTagsInclude = {
  where: PUBLIC_POLICY_TAG_WHERE,
  include: { tag: true },
} as const;
