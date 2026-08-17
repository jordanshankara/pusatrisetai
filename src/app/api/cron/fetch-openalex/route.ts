import { prisma } from "@/lib/db";
import { ok, unauthorized, apiError } from "@/lib/api/response";
import { runOpenAlexIngest } from "@/lib/services/openalex-ingest";

export const maxDuration = 60; // batas eksekusi function Vercel — ingest incremental harian jauh lebih kecil dari backfill besar

const SINCE_BUFFER_DAYS = 3; // aman terhadap keterlambatan indexing OpenAlex sendiri
const FALLBACK_LOOKBACK_DAYS = 7; // dipakai kalau belum ada paper hasil fetch sama sekali

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function computeSinceCreatedDate(): Promise<string> {
  const latest = await prisma.paper.findFirst({
    where: { tierReason: "openalex_fetch" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const base = latest?.createdAt ?? new Date(Date.now() - FALLBACK_LOOKBACK_DAYS * 86_400_000);
  return toDateOnly(new Date(base.getTime() - SINCE_BUFFER_DAYS * 86_400_000));
}

/// Dipicu Vercel Cron (lihat vercel.json, jadwal harian) — ingest OpenAlex INCREMENTAL
/// (hanya paper yang baru diindeks OpenAlex sejak run sebelumnya), supaya jurnal baru yang
/// lolos kurasi kata kunci AI otomatis masuk dan langsung terlihat sebagai "belum ada
/// ringkasan" di /admin/jurnal — itu yang jadi notifikasi ke staf.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return unauthorized("Token cron tidak valid.");
  }

  if (process.env.ENABLE_OPENALEX_FETCH !== "true") {
    return apiError(503, "INGEST_DISABLED", "ENABLE_OPENALEX_FETCH belum true — ingest otomatis dinonaktifkan.");
  }

  const sinceCreatedDate = await computeSinceCreatedDate();
  const result = await runOpenAlexIngest({
    countries: "ID",
    sinceCreatedDate,
    limit: 500, // pagar aman — ingest incremental harian normalnya jauh di bawah ini
    onProgress: (line) => console.log(`[cron:fetch-openalex] ${line}`),
  });

  return ok({ sinceCreatedDate, ...result });
}
