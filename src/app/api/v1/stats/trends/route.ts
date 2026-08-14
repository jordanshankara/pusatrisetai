import { prisma } from "@/lib/db";
import { ok, internalError } from "@/lib/api/response";
import { withPublicPaperFilter } from "@/lib/queries/public";

export async function GET() {
  try {
    const papers = await prisma.paper.findMany({
      where: withPublicPaperFilter({}),
      select: {
        origin: true,
        publishedDate: true,
        topics: { where: { isPrimary: true }, select: { subfield: true } },
      },
    });

    const byYearMap = new Map<number, { local: number; international: number }>();
    const bySubfieldMap = new Map<string, { local: number; international: number }>();

    for (const p of papers) {
      if (p.publishedDate) {
        const year = p.publishedDate.getUTCFullYear();
        const entry = byYearMap.get(year) ?? { local: 0, international: 0 };
        entry[p.origin] += 1;
        byYearMap.set(year, entry);
      }
      const subfield = p.topics[0]?.subfield;
      if (subfield) {
        const entry = bySubfieldMap.get(subfield) ?? { local: 0, international: 0 };
        entry[p.origin] += 1;
        bySubfieldMap.set(subfield, entry);
      }
    }

    const byYear = Array.from(byYearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, counts]) => ({ year, ...counts }));

    const bySubfield = Array.from(bySubfieldMap.entries())
      .sort((a, b) => b[1].local + b[1].international - (a[1].local + a[1].international))
      .map(([subfield, counts]) => ({ subfield, ...counts }));

    return ok({ byYear, bySubfield });
  } catch (error) {
    return internalError(error);
  }
}
