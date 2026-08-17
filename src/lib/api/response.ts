import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/// Bagian 5 BuildSpec: semua respons sukses {data, meta?}; semua error {error:{code,message}}.
export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(meta ? { data, meta } : { data }, init);
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function badRequest(message: string, code = "VALIDATION_ERROR") {
  return apiError(400, code, message);
}

export function notFound(message = "Data tidak ditemukan.") {
  return apiError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "Sesi admin tidak valid atau kedaluwarsa.") {
  return apiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Anda tidak punya akses untuk aksi ini.") {
  return apiError(403, "FORBIDDEN", message);
}

/// error tak terduga: console.error di server, jangan bocorkan stack ke klien (Bagian 5)
export function internalError(error: unknown) {
  console.error(error);
  return apiError(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server.");
}

export function zodValidationError(error: ZodError) {
  return badRequest(error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
}
