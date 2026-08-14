import { badRequest, notFound, internalError } from "@/lib/api/response";
import { getBibtexForPaper } from "@/lib/services/papers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format !== "bibtex") {
    return badRequest("Parameter format hanya mendukung 'bibtex'.");
  }

  try {
    const bibtex = await getBibtexForPaper(id);
    if (!bibtex) return notFound("Paper tidak ditemukan.");

    return new Response(bibtex, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    return internalError(error);
  }
}
