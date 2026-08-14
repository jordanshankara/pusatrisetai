import { describe, expect, it } from "vitest";
import { deriveAbstractPolicy } from "./abstract-policy";

describe("deriveAbstractPolicy (Patch 1)", () => {
  it("rule 1: sourcePermission='metadata_only' menang atas lisensi terbuka", () => {
    expect(
      deriveAbstractPolicy({
        licenseNormalized: "cc_by",
        isOpenAccess: true,
        sourcePermission: "metadata_only",
      })
    ).toBe("summary_only");
  });

  it("rule 2: lisensi terbuka (cc_by_sa) -> full", () => {
    expect(
      deriveAbstractPolicy({
        licenseNormalized: "cc_by_sa",
        sourcePermission: null,
      })
    ).toBe("full");
  });

  it("rule 3: isOpenAccess=true dengan lisensi tidak diketahui -> full", () => {
    expect(
      deriveAbstractPolicy({
        licenseNormalized: "unknown",
        isOpenAccess: true,
        sourcePermission: null,
      })
    ).toBe("full");
  });

  it("rule 4 (default): lisensi restricted, bukan open access -> summary_only", () => {
    expect(
      deriveAbstractPolicy({
        licenseNormalized: "restricted",
        isOpenAccess: false,
        sourcePermission: null,
      })
    ).toBe("summary_only");
  });

  it("licenseNormalized='unknown' tanpa isOpenAccess -> summary_only (default aman)", () => {
    expect(
      deriveAbstractPolicy({
        licenseNormalized: "unknown",
      })
    ).toBe("summary_only");
  });

  it("semua lisensi terbuka menghasilkan full", () => {
    const openLicenses: Array<Parameters<typeof deriveAbstractPolicy>[0]["licenseNormalized"]> = [
      "cc_by",
      "cc_by_sa",
      "cc_by_nc",
      "cc_by_nc_sa",
      "cc0",
      "other_open",
    ];
    for (const license of openLicenses) {
      expect(deriveAbstractPolicy({ licenseNormalized: license })).toBe("full");
    }
  });

  it("rule 1 menang meski isOpenAccess true dan lisensi cc0", () => {
    expect(
      deriveAbstractPolicy({
        licenseNormalized: "cc0",
        isOpenAccess: true,
        sourcePermission: "metadata_only",
      })
    ).toBe("summary_only");
  });
});
