import { prisma } from "@/lib/db";
import { badRequest, notFound, internalError } from "@/lib/api/response";
import { withPublicPaperFilter } from "@/lib/queries/public";
import { buildBibtex } from "@/lib/bibtex";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format !== "bibtex") {
    return badRequest("Parameter format hanya mendukung 'bibtex'.");
  }

  try {
    const paper = await prisma.paper.findFirst({
      where: withPublicPaperFilter({ id }),
      include: {
        venue: { select: { displayName: true, venueType: true } },
        identifiers: { where: { idType: "doi" } },
        paperAuthors: { orderBy: { authorOrder: "asc" }, include: { author: { select: { name: true } } } },
      },
    });

    if (!paper) {
      return notFound("Paper tidak ditemukan.");
    }

    const bibtex = buildBibtex({
      title: paper.title,
      authors: paper.paperAuthors.map((pa) => ({ name: pa.author.name })),
      year: paper.publishedDate ? paper.publishedDate.getUTCFullYear() : null,
      venueDisplayName: paper.venue?.displayName ?? null,
      venueType: paper.venue?.venueType ?? null,
      doi: paper.identifiers[0]?.idValue ?? null,
      canonicalUrl: paper.canonicalUrl,
    });

    return new Response(bibtex, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return internalError(error);
  }
}
