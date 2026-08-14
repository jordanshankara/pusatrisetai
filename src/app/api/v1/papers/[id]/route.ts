import { NextResponse } from "next/server";
import { notFound, ok, internalError } from "@/lib/api/response";
import { getPaperDetail } from "@/lib/services/papers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") === "en" ? "en" : "id";

  try {
    const result = await getPaperDetail(id, lang);

    if (result.type === "not_found") {
      return notFound("Paper tidak ditemukan.");
    }
    if (result.type === "redirect") {
      const url = new URL(request.url);
      url.pathname = url.pathname.replace(id, result.survivingId);
      return NextResponse.redirect(url, 308);
    }

    return ok(result.data);
  } catch (error) {
    return internalError(error);
  }
}
