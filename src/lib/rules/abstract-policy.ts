import type { AbstractPolicy, License } from "@prisma/client";

/// PATCH 1 — sourcePermission datang dari tabel `sources` di tahap produksi (belum ada di prototype).
/// Terima sebagai parameter opsional supaya aturan ini tidak perlu ditulis ulang nanti.
export type SourcePermission = "open" | "metadata_only" | null;

const OPEN_LICENSES: ReadonlySet<License> = new Set([
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc0",
  "other_open",
]);

export interface DeriveAbstractPolicyInput {
  licenseNormalized: License;
  isOpenAccess?: boolean;
  sourcePermission?: SourcePermission;
}

/**
 * Turunkan abstractDisplayPolicy dari lisensi/status akses (Patch 1, BuildSpec Bagian 4/6.2).
 * Urutan aturan wajib dipatuhi persis — rule 1 menang atas semua rule lain.
 */
export function deriveAbstractPolicy({
  licenseNormalized,
  isOpenAccess,
  sourcePermission = null,
}: DeriveAbstractPolicyInput): AbstractPolicy {
  if (sourcePermission === "metadata_only") {
    return "summary_only";
  }
  if (OPEN_LICENSES.has(licenseNormalized)) {
    return "full";
  }
  if (isOpenAccess === true) {
    return "full";
  }
  return "summary_only";
}
