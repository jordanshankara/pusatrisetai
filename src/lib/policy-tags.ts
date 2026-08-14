/// Taksonomi tag kebijakan tetap (Bagian 8 poin 4 BuildSpec) — bukan user-editable di prototype ini.
export const POLICY_TAGS = [
  { slug: "stranas-ai", labelId: "Strategi Nasional AI" },
  { slug: "kesehatan", labelId: "Kesehatan" },
  { slug: "birokrasi", labelId: "Birokrasi" },
  { slug: "pendidikan", labelId: "Pendidikan" },
  { slug: "ketahanan-pangan", labelId: "Ketahanan Pangan" },
  { slug: "mobilitas", labelId: "Mobilitas" },
] as const;

export const POLICY_TAG_LABELS: Record<string, string> = Object.fromEntries(POLICY_TAGS.map((t) => [t.slug, t.labelId]));
