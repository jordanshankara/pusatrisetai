/// Rate limit sederhana in-memory per IP (Bagian 5: 5/menit untuk POST /disputes & /submissions).
/// Cukup untuk prototype single-process; TIDAK cocok untuk deployment multi-instance.
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

export function checkRateLimit(key: string, max: number = MAX_PER_WINDOW): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= max) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
