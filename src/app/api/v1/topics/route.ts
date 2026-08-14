import { prisma } from "@/lib/db";
import { ok, internalError } from "@/lib/api/response";

export async function GET() {
  try {
    const rows = await prisma.paperTopic.groupBy({
      by: ["subfield"],
      where: { subfield: { not: null }, paper: { metadataStatus: "indexed" } },
      _count: { _all: true },
    });

    const data = rows
      .filter((r) => r.subfield !== null)
      .map((r) => ({ subfield: r.subfield as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    return ok(data);
  } catch (error) {
    return internalError(error);
  }
}
