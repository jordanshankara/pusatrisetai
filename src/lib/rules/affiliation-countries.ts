/**
 * Bagian 8 poin 7 (BuildSpec): affiliationCountries di-derive dari AuthorAffiliation,
 * dipakai baik di seed maupun (nanti) di ingestion produksi — satu sumber kebenaran.
 */
export function deriveAffiliationCountries(
  countries: Array<string | null | undefined>
): string[] {
  const unique = new Set<string>();
  for (const country of countries) {
    if (country) unique.add(country);
  }
  return Array.from(unique).sort();
}
