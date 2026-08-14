import { prisma } from "@/lib/db";
import { ok, internalError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/require-admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const [summaries, relations, policyTags, disputes, submissions] = await Promise.all([
      prisma.summary.findMany({
        where: { status: { in: ["draft", "in_review"] } },
        include: { paper: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.paperRelation.findMany({
        where: { status: "suggested" },
        include: {
          old: { select: { id: true, title: true } },
          new: { select: { id: true, title: true } },
        },
      }),
      prisma.paperPolicyTag.findMany({
        where: { status: "suggested" },
        include: { paper: { select: { id: true, title: true } }, tag: true },
      }),
      prisma.dispute.findMany({
        where: { status: "open" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.submission.findMany({
        where: { status: "queued" },
        orderBy: { submittedAt: "desc" },
      }),
    ]);

    // Dispute.paperId & Submission.paperId TIDAK ber-FK di schema (submission.paperId
    // opsional, bisa merujuk identifier yang belum terkonfirmasi) — join manual di sini.
    const paperIds = [...new Set([...disputes.map((d) => d.paperId), ...submissions.map((s) => s.paperId).filter((id): id is string => !!id)])];
    const papers = await prisma.paper.findMany({ where: { id: { in: paperIds } }, select: { id: true, title: true } });
    const paperById = new Map(papers.map((p) => [p.id, p]));

    const disputesWithPaper = disputes.map((d) => ({ ...d, paper: paperById.get(d.paperId) ?? null }));
    const submissionsWithPaper = submissions.map((s) => ({ ...s, paper: s.paperId ? (paperById.get(s.paperId) ?? null) : null }));

    return ok({ summaries, relations, policyTags, disputes: disputesWithPaper, submissions: submissionsWithPaper });
  } catch (error) {
    return internalError(error);
  }
}
