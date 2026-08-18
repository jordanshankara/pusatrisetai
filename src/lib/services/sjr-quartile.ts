/**
 * Kuartil SJR (Scimago Journal Rank) per venue paper — dihitung sendiri karena
 * scimagojr.com tidak punya API resmi (situsnya diproteksi bot-detection). Sumber data:
 * Elsevier Scopus "Serial Title API" (resmi, butuh ELSEVIER_API_KEY, kuota 20.000 req/minggu).
 *
 * Metode: rank SJR jurnal (via ISSN) dalam populasi seluruh jurnal kategori Computer Science
 * (subj=COMP di Elsevier) — top 25% = Q1, 25-50% = Q2, 50-75% = Q3, sisanya = Q4. Ini metode
 * yang sama dipakai layanan sejenis (lihat riwayat riset: ekstensi "Rapid Journal Quality
 * Check" menyebutkan persis "Q1: top 25% - Q4: bottom 25%" dari data scimagojr.com).
 *
 * unindexed = ISSN tidak ditemukan di Scopus sama sekali (di luar cakupan Scimago).
 */
import type { SjrQuartile } from "@prisma/client";

const ELSEVIER_BASE = "https://api.elsevier.com/content/serial/title";

export interface SjrLookupResult {
  quartile: SjrQuartile;
  sjrScore: number | null;
  sjrYear: number | null;
}

interface ElsevierEntry {
  "dc:title"?: string;
  SJRList?: { SJR?: Array<{ "@year": string; $?: string }> };
  error?: string;
}

function apiKey(): string {
  const key = process.env.ELSEVIER_API_KEY;
  if (!key) throw new Error("ELSEVIER_API_KEY belum diset di .env");
  return key;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Elsevier API HTTP ${res.status}`);
  }
  return res.json();
}

function latestSjr(entry: ElsevierEntry): { score: number; year: number } | null {
  const list = entry.SJRList?.SJR ?? [];
  const withScore = list.filter((s) => s.$).map((s) => ({ score: Number(s.$), year: Number(s["@year"]) }));
  if (withScore.length === 0) return null;
  return withScore.sort((a, b) => b.year - a.year)[0];
}

/// Lookup satu ISSN -> skor SJR terbaru (atau null kalau ISSN tidak ada di Scopus).
export async function lookupSjrScore(issn: string): Promise<{ score: number; year: number } | null> {
  const issnClean = issn.replace(/-/g, "");
  const url = `${ELSEVIER_BASE}?issn=${issnClean}&apikey=${apiKey()}&httpAccept=application/json`;
  const data = await fetchJson(url);
  const entry: ElsevierEntry | undefined = data?.["serial-metadata-response"]?.entry?.[0];
  if (!entry || entry.error) return null;
  return latestSjr(entry);
}

/// Ambil skor SJR SELURUH jurnal kategori Computer Science (subj=COMP) dari Elsevier —
/// dipakai sebagai basis rank utk bucketing quartile. ~3.500 jurnal, ~18 request halaman (count=200).
export async function fetchComputerScienceSjrDistribution(): Promise<number[]> {
  const scores: number[] = [];
  let start = 0;
  const count = 200;
  let total: number | null = null;

  while (true) {
    const url = `${ELSEVIER_BASE}?subj=COMP&apikey=${apiKey()}&httpAccept=application/json&count=${count}&start=${start}`;
    const data = await fetchJson(url);
    const root = data?.["serial-metadata-response"];
    if (!root) break;

    if (total === null) {
      const lastLink = (root.link ?? []).find((l: any) => l["@ref"] === "last")?.["@href"];
      const match = lastLink?.match(/[?&]start=(\d+)/);
      total = match ? Number(match[1]) + count : null;
    }

    const entries: ElsevierEntry[] = root.entry ?? [];
    if (entries.length === 0) break;
    for (const e of entries) {
      const latest = latestSjr(e);
      if (latest) scores.push(latest.score);
    }

    start += count;
    if (total !== null && start >= total) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  return scores.sort((a, b) => b - a);
}

/// Bucket satu skor SJR ke kuartil, berdasar distribusi (sudah di-sort desc) yang di-fetch sekali via fetchComputerScienceSjrDistribution().
export function bucketQuartile(score: number, sortedDistributionDesc: number[]): SjrQuartile {
  const n = sortedDistributionDesc.length;
  if (n === 0) return "unindexed"; // seharusnya tak terjadi; fallback aman
  let idx = 0;
  while (idx < n && sortedDistributionDesc[idx] > score) idx++;
  const pctFromTop = idx / n;
  if (pctFromTop <= 0.25) return "q1";
  if (pctFromTop <= 0.5) return "q2";
  if (pctFromTop <= 0.75) return "q3";
  return "q4";
}

/// Lookup lengkap 1 ISSN -> hasil kuartil siap simpan ke Paper. Butuh distribusi yang sudah di-fetch (reuse antar paper, jangan fetch ulang per paper).
export async function resolveQuartileForIssn(issn: string, sortedDistributionDesc: number[]): Promise<SjrLookupResult> {
  const latest = await lookupSjrScore(issn);
  if (!latest) return { quartile: "unindexed", sjrScore: null, sjrYear: null };
  return { quartile: bucketQuartile(latest.score, sortedDistributionDesc), sjrScore: latest.score, sjrYear: latest.year };
}
