/**
 * Klien LLM multi-provider bersama — dipakai scripts/backfill-content.ts (B.2-B.4),
 * scripts/backfill-relations.ts (B.5), dan route admin di src/app/api/admin/papers/*
 * (draft ringkasan & saran relevansi on-demand).
 *
 * Dua tingkat provider, dicoba berurutan per panggilan:
 * 1. Gemini API (GEMINI_API_KEYS) — beberapa key dirotasi round-robin, model utama lalu
 *    model fallback kalau model utama gagal di SEMUA key (indikasi kuota harian habis).
 * 2. OpenRouter (OPENROUTER_API_KEY) — beberapa model GRATIS dirotasi dengan pola yang sama,
 *    dipakai kalau Gemini benar-benar habis (semua key, semua model). Model dipilih dari hasil
 *    uji manual (lihat catatan di bawah) — diprioritaskan yang konsisten Bahasa Indonesia
 *    penuh dan JSON valid; model yang kadang beralih ke Inggris di tengah respons TIDAK dipakai.
 *
 * Kedua tingkat pakai strategi sama: round-robin berbasis "kapan slot ini boleh dipakai lagi"
 * (bukan urutan tetap) supaya throughput naik seiring jumlah key/model tanpa melanggar rate
 * limit tiap slot, dan retry 2 putaran penuh sebelum menyerah ke tingkat berikutnya.
 *
 * Return null kalau BENAR-BENAR semua provider gagal — caller wajib skip + log paper itu,
 * jangan lempar exception yang menghentikan seluruh batch (Bagian B.6).
 */

process.loadEnvFile?.(".env");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SlotState {
  id: string; // nama key/model buat logging
  nextAvailableAt: number;
}

function pickSlot(slots: SlotState[]): SlotState {
  return slots.reduce((a, b) => (a.nextAvailableAt <= b.nextAvailableAt ? a : b));
}

async function waitForSlot(slot: SlotState): Promise<void> {
  const waitMs = slot.nextAvailableAt - Date.now();
  if (waitMs > 0) await sleep(waitMs);
}

/// Ekstrak blok JSON dari teks — beberapa model membungkus JSON dengan ```json...``` meski
/// sudah diminta tidak, atau menambah teks sebelum/sesudahnya.
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ============================== Tingkat 1: Gemini ==============================

const GEMINI_RPM: Record<string, number> = {
  "gemini-2.5-flash": 10,
  "gemini-2.5-flash-lite": 15,
  "gemini-3-flash-preview": 10,
};

class GeminiTier {
  private keys: SlotState[];
  private primaryModel: string;
  private fallbackModel: string;
  private activeModel: string;
  private fallbackEngaged = false;

  constructor(rawKeys: string[], primaryModel?: string, fallbackModel?: string) {
    this.keys = rawKeys.map((key, i) => ({ id: `gemini key#${i}:${key}`, nextAvailableAt: 0 }));
    this.primaryModel = primaryModel ?? process.env.GEMINI_MODEL_PRIMARY ?? "gemini-2.5-flash";
    this.fallbackModel = fallbackModel ?? process.env.GEMINI_MODEL_FALLBACK ?? "gemini-3-flash-preview";
    this.activeModel = this.primaryModel;
  }

  get modelInUse(): string {
    return this.activeModel;
  }

  private keyOf(slot: SlotState): string {
    return slot.id.split(":")[1];
  }

  private rpm(): number {
    return GEMINI_RPM[this.activeModel] ?? 10;
  }

  async generateJson(prompt: string): Promise<Record<string, unknown> | null> {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < this.keys.length; i++) {
        const slot = pickSlot(this.keys);
        await waitForSlot(slot);
        slot.nextAvailableAt = Date.now() + Math.ceil(60_000 / this.rpm());

        const result = await this.callOnce(slot, prompt);
        if (result.ok) return result.json;
        if (result.rateLimited) slot.nextAvailableAt = Date.now() + 30_000;
      }
      if (!this.fallbackEngaged && this.activeModel === this.primaryModel && this.fallbackModel !== this.primaryModel) {
        console.warn(`[gemini] Semua key gagal dengan model ${this.primaryModel} — pindah ke fallback ${this.fallbackModel}.`);
        this.activeModel = this.fallbackModel;
        this.fallbackEngaged = true;
      }
    }
    return null;
  }

  private async callOnce(slot: SlotState, prompt: string): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; rateLimited: boolean }> {
    const key = this.keyOf(slot);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.activeModel}:generateContent?key=${key}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000); // 45s: model preview kadang "berpikir" lama sebelum jawab
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });

      if (res.status === 429) return { ok: false, rateLimited: true };
      if (!res.ok) {
        console.error(`[gemini] ${slot.id.split(":")[0]} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return { ok: false, rateLimited: false };
      }

      const body = await res.json();
      const finishReason = body?.candidates?.[0]?.finishReason;
      const text = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (!text) {
        // BUG lama: kasus ini dulu gagal SENYAP tanpa log — biasanya model kehabisan
        // token budget di fase "thinking" sebelum sempat menulis jawaban (finishReason MAX_TOKENS).
        console.error(`[gemini] ${slot.id.split(":")[0]} respons kosong (finishReason: ${finishReason ?? "?"}), skip.`);
        return { ok: false, rateLimited: false };
      }

      const json = extractJson(text);
      if (!json) {
        console.error(`[gemini] ${slot.id.split(":")[0]} respons bukan JSON valid, skip: ${text.slice(0, 150)}`);
        return { ok: false, rateLimited: false };
      }
      return { ok: true, json };
    } catch (error) {
      console.error(`[gemini] ${slot.id.split(":")[0]} error jaringan/timeout: ${error instanceof Error ? error.message : String(error)}`);
      return { ok: false, rateLimited: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ============================== Tingkat 2: OpenRouter (model gratis) ==============================

/// Diurutkan dari hasil uji manual (lihat riwayat percakapan) — hanya model yang konsisten
/// Bahasa Indonesia penuh + JSON valid yang masuk daftar. google/gemma-4-31b-it:free dan
/// openai/gpt-oss-20b:free DIBUANG: gemma sering 429 upstream shared-pool, gpt-oss kadang
/// beralih ke Inggris di tengah respons (melanggar B.2 "bahasa Indonesia sehari-hari").
const OPENROUTER_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

class OpenRouterTier {
  private key: string;
  private models: SlotState[];
  private lastModelUsed = "";

  constructor(key: string) {
    this.key = key;
    this.models = OPENROUTER_FREE_MODELS.map((m) => ({ id: m, nextAvailableAt: 0 }));
  }

  get modelInUse(): string {
    return this.lastModelUsed;
  }

  async generateJson(prompt: string): Promise<Record<string, unknown> | null> {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < this.models.length; i++) {
        const slot = pickSlot(this.models);
        await waitForSlot(slot);
        slot.nextAvailableAt = Date.now() + Math.ceil(60_000 / 12); // konservatif: 12 req/menit per model gratis

        const result = await this.callOnce(slot, prompt);
        if (result.ok) {
          this.lastModelUsed = slot.id;
          return result.json;
        }
        if (result.rateLimited) slot.nextAvailableAt = Date.now() + 30_000;
      }
    }
    return null;
  }

  private async callOnce(slot: SlotState, prompt: string): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; rateLimited: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          model: slot.id,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 3000, // naikkan dari default provider — respons sempat kepotong di tengah kalimat
        }),
      });

      if (res.status === 429) return { ok: false, rateLimited: true };
      const body = await res.json();
      if (body.error) {
        const isRateLimit = body.error.code === 429 || /rate.?limit/i.test(String(body.error.message ?? ""));
        console.error(`[openrouter] ${slot.id} error: ${JSON.stringify(body.error).slice(0, 200)}`);
        return { ok: false, rateLimited: isRateLimit };
      }

      const text = body?.choices?.[0]?.message?.content ?? "";
      if (!text) {
        console.error(`[openrouter] ${slot.id} respons kosong, skip.`);
        return { ok: false, rateLimited: false };
      }

      const json = extractJson(text);
      if (!json) {
        console.error(`[openrouter] ${slot.id} respons bukan JSON valid, skip: ${text.slice(0, 150)}`);
        return { ok: false, rateLimited: false };
      }
      return { ok: true, json };
    } catch (error) {
      console.error(`[openrouter] ${slot.id} error jaringan/timeout: ${error instanceof Error ? error.message : String(error)}`);
      return { ok: false, rateLimited: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ============================== Client gabungan ==============================

/// Override opsional dipakai HANYA oleh LLMClient.fromSettings() (2 route web summary/relevance
/// suggest) — kalau field tidak diisi, jatuh balik ke .env seperti biasa. Script CLI
/// (backfill-content.ts, fetch-openalex.ts) TETAP pakai `new LLMClient()` tanpa override.
export interface LLMClientOverrides {
  geminiApiKeys?: string;
  geminiModelPrimary?: string;
  geminiModelFallback?: string;
  openrouterApiKey?: string;
}

export class LLMClient {
  private gemini: GeminiTier | null = null;
  private openrouter: OpenRouterTier | null = null;
  private lastProvider = "";

  constructor(overrides?: LLMClientOverrides) {
    const rawKeys = (overrides?.geminiApiKeys ?? process.env.GEMINI_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (rawKeys.length > 0) this.gemini = new GeminiTier(rawKeys, overrides?.geminiModelPrimary, overrides?.geminiModelFallback);

    const orKey = (overrides?.openrouterApiKey ?? process.env.OPENROUTER_API_KEY ?? "").trim();
    if (orKey) this.openrouter = new OpenRouterTier(orKey);

    if (!this.gemini && !this.openrouter) {
      throw new Error("Tidak ada provider LLM terkonfigurasi — isi GEMINI_API_KEYS dan/atau OPENROUTER_API_KEY di .env atau menu Settings.");
    }
    console.log(
      `[llm] Provider aktif: ${this.gemini ? `Gemini (${rawKeys.length} key)` : ""}${this.gemini && this.openrouter ? " + " : ""}${
        this.openrouter ? `OpenRouter (${OPENROUTER_FREE_MODELS.length} model gratis)` : ""
      }.`
    );
  }

  /// Dipakai HANYA oleh route web (bukan script CLI) — cek AppSetting dulu (diisi admin lewat
  /// menu Settings), field yang kosong di DB jatuh balik ke .env lewat constructor di atas.
  static async fromSettings(): Promise<LLMClient> {
    const { prisma } = await import("@/lib/db");
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: ["GEMINI_API_KEYS", "GEMINI_MODEL_PRIMARY", "GEMINI_MODEL_FALLBACK", "OPENROUTER_API_KEY"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return new LLMClient({
      geminiApiKeys: map.GEMINI_API_KEYS,
      geminiModelPrimary: map.GEMINI_MODEL_PRIMARY,
      geminiModelFallback: map.GEMINI_MODEL_FALLBACK,
      openrouterApiKey: map.OPENROUTER_API_KEY,
    });
  }

  get modelInUse(): string {
    return this.lastProvider;
  }

  async generateJson(prompt: string): Promise<Record<string, unknown> | null> {
    if (this.gemini) {
      const result = await this.gemini.generateJson(prompt);
      if (result) {
        this.lastProvider = `gemini:${this.gemini.modelInUse}`;
        return result;
      }
    }
    if (this.openrouter) {
      const result = await this.openrouter.generateJson(prompt);
      if (result) {
        this.lastProvider = `openrouter:${this.openrouter.modelInUse}`;
        return result;
      }
    }
    return null;
  }
}
