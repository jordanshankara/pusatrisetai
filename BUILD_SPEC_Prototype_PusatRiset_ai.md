# BUILD SPEC — Prototype PusatRiset.ai
### Dokumen tunggal & self-contained untuk AI coding tool. Tidak perlu dokumen lain.
### Bahasa instruksi: Indonesia. Kode, nama tabel, variabel: English.

---

# BAGIAN 1 — PRODUK DALAM SATU HALAMAN (baca dulu sebelum koding)

**PusatRiset.ai** adalah web app katalog + lapisan interpretasi untuk riset/jurnal ilmiah bertopik AI (BUKAN berita). Pembeda dari Google Scholar/Semantic Scholar:

1. **Indonesia-first**: kelengkapan penuh untuk riset AI Indonesia; riset internasional hanya lapisan konteks terkurasi (venue top + paper fondasi + penerus riset Indonesia).
2. **Dua lapis konten per paper**: (a) DATA ASLI apa adanya — judul, penulis, abstrak (jika lisensi mengizinkan), DOI, link resmi; (b) LAPISAN INTERPRETASI buatan platform — ringkasan awam, ringkasan teknis, relevansi untuk Indonesia.
3. **Arsip hidup**: paper lama tidak dihapus; diberi badge relevansi ("Masih Relevan" / "Perlu Diperbarui" / "Sudah Digantikan" / "Retracted" / "Riset Fondasi") + alasan + kartu tautan ke riset penerus DI DALAM platform.
4. **Dua sumbu kontrol kualitas** (aturan paling penting di seluruh sistem):
   - Sumbu 1 (tier sumber): menentukan paper boleh masuk katalog atau tidak.
   - Sumbu 2 (jenis konten): METADATA faktual auto-tayang; semua KLAIM INTERPRETATIF (summaries, policy tags, badge relevansi, relasi penerus) berstatus draft/suggested sampai editor manusia approve. TIDAK ADA interpretasi tayang tanpa manusia.

Audiens: pembuat kebijakan, akademisi, mahasiswa, jurnalis Indonesia. UI default Bahasa Indonesia.

---

# BAGIAN 2 — SCOPE PROTOTYPE (patuh ketat; jangan bangun di luar ini)

## 2.1 MASUK prototype (harus jalan end-to-end)
- Next.js (App Router, TypeScript) fullstack: halaman publik + API routes + halaman admin.
- PostgreSQL via docker-compose + Prisma (skema LENGKAP di Bagian 4 — semua tabel dibuat meski sebagian belum dipakai UI, supaya tidak ada migrasi ulang).
- Seed script dengan data realistis (Bagian 8): ±60 paper campuran (Indonesia + internasional, beragam status), venues, institutions, topics, summaries, relations, policy tags, users.
- Halaman: Home, Katalog (search + filter), Detail Paper (2 tab + badge + kartu penerus), Dashboard Tren (2 chart sederhana), Metodologi (statis), Admin/Editorial (login sederhana + antrean review + approve/reject).
- Search: **Postgres full-text (tsvector)** — BUKAN Meilisearch di prototype.
- Ekspor BibTeX per paper.
- Script opsional `scripts/fetch-openalex.ts` untuk menarik ±100 paper riil Indonesia dari OpenalEx (feature-flag, boleh gagal tanpa merusak app — seed tetap sumber utama demo).

## 2.2 TIDAK MASUK prototype (stub/skip — jangan implement)
- LLM summarization live → summaries datang dari seed; sediakan stub `lib/ai/summarize.ts` yang return dummy + TODO.
- Embeddings/pgvector & semantic search → kolom TIDAK dibuat di prototype (hindari dependensi ekstensi); tandai TODO di schema comment.
- OAI-PMH harvester, scraping, BullMQ/Redis, Meilisearch, Sentry → tidak ada.
- Auth pembaca publik, bookmark, policy-brief generator → tidak ada.
- Relevance score compute job → nilai relevansi datang dari seed; TIDAK ada cron.
- Multi-negara ekspansi (US/CN dst) → cukup kolom & filter yang sudah mendukungnya; tidak ada harvest negara lain.

## 2.3 Definisi selesai (acceptance)
1. `docker compose up -d && npm run db:migrate && npm run db:seed && npm run dev` → app jalan tanpa error.
2. Katalog menampilkan 60 paper, search "diabetes" menemukan paper seed yang relevan, semua filter berfungsi dan bisa dikombinasikan.
3. Halaman detail paper `superseded` menampilkan badge oranye + alasan + kartu penerus yang mengklik ke detail internal penerus.
4. Paper dengan `abstract_display_policy='summary_only'` TIDAK menampilkan abstrak mentah di UI mana pun.
5. Login admin → antrean berisi item `draft/suggested` dari seed → approve satu summary → muncul di halaman publik tanpa restart.
6. `GET /api/v1/papers/{id}/export?format=bibtex` menghasilkan BibTeX valid.
7. Paper yang di-merge (seed punya 1 kasus): akses id lama → redirect 301 ke id kanonik.
8. `npm run build` sukses tanpa type error.

---

# BAGIAN 3 — TECH STACK & STRUKTUR PROYEK (final, jangan diganti)

- Next.js 14+ App Router, TypeScript strict, Tailwind CSS, komponen UI: shadcn/ui (atau komponen tangan sendiri yang setara — JANGAN tambah UI lib lain).
- Prisma ORM + PostgreSQL 16 (docker-compose).
- Chart: recharts. Ikon: lucide-react. JANGAN tambah dependensi di luar kebutuhan nyata.
- Auth admin prototype: NextAuth credentials provider ATAU cookie-session sederhana — user admin dari env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Middleware melindungi `/admin/*` dan `/api/admin/*`.

```
/prisma/schema.prisma        # dari Bagian 4
/prisma/seed.ts              # dari Bagian 8
/src/app/(public)/page.tsx                     # Home
/src/app/(public)/katalog/page.tsx             # Catalog (server component + searchParams)
/src/app/(public)/riset/[id]/page.tsx          # Detail (SSR; handle merge-redirect)
/src/app/(public)/dashboard/page.tsx           # Tren publik
/src/app/(public)/metodologi/page.tsx          # Statis
/src/app/admin/login/page.tsx
/src/app/admin/page.tsx                        # Antrean review
/src/app/api/v1/...                            # Route handlers publik (Bagian 5)
/src/app/api/admin/...                         # Route handlers admin
/src/lib/db.ts                                 # Prisma client singleton
/src/lib/bibtex.ts
/src/lib/ai/summarize.ts                       # STUB
/scripts/fetch-openalex.ts                     # opsional, feature flag
/docker-compose.yml                            # postgres:16 + volume
/.env.example
```

`.env.example`:
```
DATABASE_URL=postgresql://pusatriset:pusatriset@localhost:5432/pusatriset
ADMIN_EMAIL=admin@pusatriset.ai
ADMIN_PASSWORD=changeme-local-only
ENABLE_OPENALEX_FETCH=false
OPENALEX_MAILTO=dev@pusatriset.ai
```

---

# BAGIAN 4 — SKEMA DATABASE FINAL (Prisma; konsolidasi penuh)

Tulis sebagai `schema.prisma`. Semua enum jadi Prisma enum. Komentar `///` dipertahankan — itu aturan bisnis.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Origin { local international }
enum SourceTier { tier_1 tier_2 tier_3 }               /// tier_4 tidak pernah masuk tabel papers
enum MetadataStatus { indexed queued_review rejected withdrawn }
enum AbstractPolicy { full summary_only link_only }
enum SummaryStatus { draft in_review published rejected }
enum SummarySource { manual ai_draft ai_reviewed }
enum Provenance { from_abstract from_fulltext }
enum Lang { id en }
enum RelationType { superseded_by follow_up_same_author related_semantic contradicted_by extended_by }
enum ReviewStatus { suggested approved rejected disputed }
enum RelevanceStatus { too_new_to_score still_relevant needs_update superseded retracted }
enum PublishedRelevance { still_relevant needs_update superseded retracted foundational }
enum RetractionStatus { none retracted expression_of_concern }
enum UserRole { admin editor contributor reader }
enum VenueType { conference journal preprint_repo repository }
enum TagStatus { suggested published rejected }
enum DisputeStatus { open in_review accepted rejected }
enum SubmissionStatus { queued in_review approved rejected_spam rejected_predatory rejected_duplicate rejected_no_credentials }
enum IdType { doi arxiv_id openreview_id openalex_id oai_identifier semantic_scholar_id }

model Paper {
  id                    String   @id @default(uuid())
  title                 String
  titleLang             String?  @map("title_lang")
  /// HANYA diisi jika lisensi mengizinkan; UI TIDAK BOLEH menampilkan abstractRaw jika policy != full
  abstractRaw           String?  @map("abstract_raw")
  abstractDisplayPolicy AbstractPolicy @default(summary_only) @map("abstract_display_policy") /// default AMAN
  publishedDate         DateTime? @map("published_date") @db.Date
  language              String?
  /// origin = local ⇔ >=1 penulis berafiliasi institusi Indonesia (via AuthorAffiliation)
  origin                Origin
  venueId               String?  @map("venue_id")
  venue                 ApprovedVenue? @relation(fields: [venueId], references: [id])
  venueNameRaw          String?  @map("venue_name_raw")   /// nama venue apa adanya dari sumber (audit)
  venueCountry          String?  @map("venue_country")
  /// denormalisasi utk filter negara (many-to-many; kolaborasi = banyak negara). Di-derive dari AuthorAffiliation saat seed/ingest.
  affiliationCountries  String[] @map("affiliation_countries")
  sourceTier            SourceTier @default(tier_3) @map("source_tier")
  tierReason            String?  @map("tier_reason")
  isFoundational        Boolean  @default(false) @map("is_foundational")
  /// SUMBU 2: status ini HANYA untuk metadata; interpretasi punya gerbang sendiri
  metadataStatus        MetadataStatus @default(indexed) @map("metadata_status")
  inclusionBasis        String?  @map("inclusion_basis")
  canonicalUrl          String?  @map("canonical_url")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  identifiers    PaperIdentifier[]
  topics         PaperTopic[]
  paperAuthors   PaperAuthor[]
  affiliations   AuthorAffiliation[]
  summaries      Summary[]
  citationStats  CitationStats?
  versions       PaperVersion[]
  relationsOld   PaperRelation[] @relation("old")
  relationsNew   PaperRelation[] @relation("new")
  relevance      RelevanceScore?
  policyTags     PaperPolicyTag[]
  mergesAsSurviving PaperMerge[] @relation("surviving")

  @@index([publishedDate])
  @@index([origin])
  @@index([sourceTier])
  @@index([metadataStatus])
  @@map("papers")
}
/// TODO migrasi manual setelah prisma migrate: kolom tsvector FTS + GIN index (lihat Bagian 6.4)

model PaperIdentifier {
  id      String @id @default(uuid())
  paperId String @map("paper_id")
  paper   Paper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  idType  IdType @map("id_type")
  idValue String @map("id_value")
  @@unique([idType, idValue])
  @@index([paperId])
  @@map("paper_identifiers")
}

model PaperMerge {
  survivingId String @map("surviving_id")
  surviving   Paper  @relation("surviving", fields: [survivingId], references: [id])
  mergedId    String @map("merged_id")      /// UUID lama; TIDAK ber-FK (record aslinya sudah dihapus/soft)
  method      String
  mergedAt    DateTime @default(now()) @map("merged_at")
  @@id([survivingId, mergedId])
  @@index([mergedId])                        /// lookup redirect: WHERE merged_id = :requestedId
  @@map("paper_merges")
}

model ApprovedVenue {
  id                String  @id @default(uuid())
  displayName       String  @map("display_name")
  venueType         VenueType @map("venue_type")
  tier              SourceTier
  rankingBasis      String? @map("ranking_basis")
  /// KUNCI PENCOCOKAN — bukan nama. Minimal satu terisi.
  openalexSourceId  String? @unique @map("openalex_source_id")
  issnL             String? @unique @map("issn_l")
  arxivCategories   String[] @map("arxiv_categories")
  country           String?
  active            Boolean @default(true)
  papers            Paper[]
  @@map("approved_venues")
}

model Institution {
  id                    String  @id @default(uuid())
  name                  String
  nameVariants          String[] @map("name_variants")
  country               String?
  institutionType       String? @map("institution_type")
  openalexInstitutionId String? @unique @map("openalex_institution_id")
  rorId                 String? @unique @map("ror_id")
  profileDescription    String? @map("profile_description")
  affiliations          AuthorAffiliation[]
  @@index([country])
  @@map("institutions")
}

model Author {
  id               String  @id @default(uuid())
  name             String
  orcidId          String? @map("orcid_id")
  openalexAuthorId String? @map("openalex_author_id")
  paperAuthors     PaperAuthor[]
  affiliations     AuthorAffiliation[]
  @@map("authors")
}

model PaperAuthor {
  paperId     String @map("paper_id")
  authorId    String @map("author_id")
  authorOrder Int    @map("author_order")
  paper  Paper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  author Author @relation(fields: [authorId], references: [id], onDelete: Cascade)
  @@id([paperId, authorId])
  @@map("paper_authors")
}

model AuthorAffiliation {
  authorId      String @map("author_id")
  institutionId String @map("institution_id")
  paperId       String @map("paper_id")     /// afiliasi PER PAPER — orang pindah institusi
  author      Author      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)
  paper       Paper       @relation(fields: [paperId], references: [id], onDelete: Cascade)
  @@id([authorId, institutionId, paperId])
  @@map("author_affiliations")
}

model PaperTopic {
  id        String  @id @default(uuid())
  paperId   String  @map("paper_id")
  paper     Paper   @relation(fields: [paperId], references: [id], onDelete: Cascade)
  domain    String?
  field     String?
  subfield  String?
  topic     String?
  topicId   String? @map("topic_id")
  isPrimary Boolean @default(false) @map("is_primary")
  score     Float?
  @@index([paperId])
  @@index([subfield])
  @@map("paper_topics")
}

model Summary {
  id                 String @id @default(uuid())
  paperId            String @map("paper_id")
  paper              Paper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  language           Lang   @default(id)
  summaryLayperson   String? @map("summary_layperson")
  summaryTechnical   String? @map("summary_technical")
  relevanceIndonesia String? @map("relevance_indonesia")
  sourceType         SummarySource @map("source_type")
  provenance         Provenance @default(from_abstract)
  /// SUMBU 2: gerbang editorial ADA DI SINI. Publik hanya melihat status=published.
  status             SummaryStatus @default(draft)
  authoredById       String? @map("authored_by")
  reviewedById       String? @map("reviewed_by")
  version            Int @default(1)
  createdAt          DateTime @default(now()) @map("created_at")
  @@index([paperId, language, status])
  @@map("summaries")
}
/// ATURAN (enforce di kode + partial unique index manual, Bagian 6.4): max 1 published per (paperId, language)

model CitationStats {
  paperId                      String @id @map("paper_id")
  paper                        Paper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  citationCountTotal           Int    @default(0) @map("citation_count_total")
  citationByYear               Json?  @map("citation_by_year")
  fwci                         Float? /// native OpenAlex — jangan hitung sendiri utk internasional
  citationNormalizedPercentile Float? @map("citation_normalized_percentile")
  localPercentile              Float? @map("local_percentile")   /// hanya utk origin=local
  retractionStatus             RetractionStatus @default(none) @map("retraction_status")
  @@map("citation_stats")
}

model PaperVersion {
  id            String @id @default(uuid())
  paperId       String @map("paper_id")
  paper         Paper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  versionNumber Int    @map("version_number")
  changedSummary String? @map("changed_summary")
  versionDate   DateTime? @map("version_date") @db.Date
  @@unique([paperId, versionNumber])
  @@map("paper_versions")
}

model PaperRelation {
  id              String @id @default(uuid())
  paperIdOld      String @map("paper_id_old")
  paperIdNew      String @map("paper_id_new")
  old             Paper @relation("old", fields: [paperIdOld], references: [id])
  new             Paper @relation("new", fields: [paperIdNew], references: [id])
  relationType    RelationType @map("relation_type")
  confidenceScore Float? @map("confidence_score")
  reasoningText   String? @map("reasoning_text")
  /// SUMBU 2: publik hanya melihat status=approved
  status          ReviewStatus @default(suggested)
  @@unique([paperIdOld, paperIdNew, relationType])
  @@map("paper_relations")
}
/// enforce di kode: paperIdOld !== paperIdNew (tolak di API/seed)

model RelevanceScore {
  paperId            String @id @map("paper_id")
  paper              Paper  @relation(fields: [paperId], references: [id], onDelete: Cascade)
  computedScore      Int?    @map("computed_score")
  computedStatus     RelevanceStatus @default(too_new_to_score) @map("computed_status")
  computedReasoning  String? @map("computed_reasoning")
  /// yang TAMPIL ke publik. NULL = tidak ada badge sama sekali (bukan badge abu-abu).
  publishedStatus    PublishedRelevance? @map("published_status")
  publishedReasoning String? @map("published_reasoning")
  overrideById       String? @map("override_by")   /// terisi = editor mengunci; recompute dilarang menyentuh published_*
  overrideReason     String? @map("override_reason")
  @@map("relevance_scores")
}

model PolicyTag {
  id          String @id @default(uuid())
  slug        String @unique
  labelId     String @map("label_id")
  labelEn     String? @map("label_en")
  tagGroup    String? @map("tag_group")
  active      Boolean @default(true)
  paperTags   PaperPolicyTag[]
  @@map("policy_tags")
}

model PaperPolicyTag {
  paperId String @map("paper_id")
  tagId   String @map("tag_id")
  paper Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  tag   PolicyTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  /// SUMBU 2: publik hanya melihat status=published
  status  TagStatus @default(suggested)
  @@id([paperId, tagId])
  @@map("paper_policy_tags")
}

model User {
  id          String @id @default(uuid())
  email       String @unique
  displayName String? @map("display_name")
  role        UserRole
  active      Boolean @default(true)
  @@map("users")
}

model Dispute {
  id               String @id @default(uuid())
  paperId          String @map("paper_id")
  disputeType      String @map("dispute_type")
  submittedByName  String? @map("submitted_by_name")
  submittedByEmail String? @map("submitted_by_email")
  argument         String
  status           DisputeStatus @default(open)
  resolution       String?
  createdAt        DateTime @default(now()) @map("created_at")
  @@map("disputes")
}

model Submission {
  id                String @id @default(uuid())
  submittedByName   String? @map("submitted_by_name")
  submittedByEmail  String @map("submitted_by_email")
  claimedIdentifier String? @map("claimed_identifier")
  paperId           String? @map("paper_id")
  status            SubmissionStatus @default(queued)
  submittedAt       DateTime @default(now()) @map("submitted_at")
  @@map("submissions")
}
```

Catatan: tabel `sources/harvest_state/harvest_runs/rejected_records/author_credentials/takedown_requests` dari PRD produksi SENGAJA tidak dibuat di prototype (tidak ada harvester). Jangan tambahkan.

---

# BAGIAN 5 — KONTRAK API (route handlers Next.js)

Semua respons sukses: `{ data, meta? }`. Semua error: `{ error: { code, message } }` dengan HTTP status benar. Validasi query/body dengan zod; input tak valid → 400, id tak ditemukan → 404, error tak terduga → 500 + `console.error` (jangan bocorkan stack ke klien).

```
GET /api/v1/papers
  Query: q, origin(local|international), yearFrom, yearTo, subfield, tier, relevance(still_relevant|needs_update|superseded|retracted|foundational|none),
         openAccess(bool→policy=full), country(kode ISO, match affiliationCountries), policyTag(slug),
         hideSuperseded(bool, default FALSE — arsip lengkap adalah default), page(default 1), perPage(default 20, max 50)
  Hanya papers metadataStatus=indexed.
  q → Postgres FTS (raw query, Bagian 6.4); tanpa q → order publishedDate desc.
  Respons: { data: PaperListItem[], meta:{total,page,perPage}, facets:{ origin:{local:n,international:n}, years:{...}, subfields:{...} } }
  PaperListItem: { id, title, publishedDate, origin, venueDisplayName, authorsPreview:[max 3 nama]+authorCount,
                   primarySubfield, relevanceBadge: publishedStatus|null, policyTags:[slug yang published],
                   hasPublishedSummary: bool }

GET /api/v1/papers/:id
  1) Jika tidak ada di papers → cek paper_merges WHERE merged_id=:id → ada? respons 301/308 redirect ke /api/v1/papers/{survivingId} (dan halaman UI melakukan hal sama dgn redirect()).
  2) Respons detail: { id, title, abstract: (policy==='full' ? abstractRaw : null), abstractDisplayPolicy,
     canonicalUrl, identifiers[], authors:[{name, institutions:[{id,name,country}]}], topics[], venue,
     origin, affiliationCountries, isFoundational,
     summary: Summary status=published utk ?lang (default id; fallback: jika lang diminta tidak ada → null, JANGAN fallback diam-diam ke bahasa lain),
     relevance: { publishedStatus, publishedReasoning } | null,
     successors: PaperRelation approved dgn paperIdOld=:id, tipe superseded_by|extended_by|follow_up_same_author,
                 masing2 { relationType, reasoningText, paper:{id,title,publishedDate} },
     versions[], citationStats:{citationCountTotal, fwci, retractionStatus} }
  ATURAN KERAS: JANGAN pernah menyertakan abstractRaw bila policy!=full; JANGAN sertakan summaries non-published; JANGAN sertakan relations non-approved.

GET /api/v1/papers/:id/export?format=bibtex   → text/plain BibTeX (Bagian 6.5). format lain → 400.
GET /api/v1/topics                            → daftar subfield unik + count (dari paper published/indexed)
GET /api/v1/stats/trends                      → { byYear:[{year, local, international}], bySubfield:[{subfield, local, international}] }
POST /api/v1/disputes    body:{paperId, disputeType, name?, email?, argument} → insert status open → 201. Rate limit sederhana in-memory (per IP, 5/menit).
POST /api/v1/submissions body:{name?, email, claimedIdentifier} → insert queued → 201. Rate limit sama.

-- ADMIN (dilindungi middleware) --
GET  /api/admin/queue        → { summaries:[draft|in_review], relations:[suggested], policyTags:[suggested], disputes:[open], submissions:[queued] } masing2 + info paper terkait
POST /api/admin/summaries/:id/review     body:{action:'approve'|'reject', edits?:{summaryLayperson?,summaryTechnical?,relevanceIndonesia?}}
     approve: terapkan edits bila ada, lalu SATU transaksi: set published lain (paperId,language) yg sedang published → rejected, set ini → published, sourceType ai_draft→ai_reviewed.
POST /api/admin/relations/:id/review     body:{action:'approve'|'reject'}
POST /api/admin/policy-tags/review       body:{paperId, tagId, action}
POST /api/admin/papers/:id/relevance     body:{publishedStatus, publishedReasoning, overrideReason}
     → set published_*, overrideById=admin. (foundational: sekalian set papers.isFoundational=true bila publishedStatus='foundational')
```

---

# BAGIAN 6 — ATURAN BISNIS & JEBAKAN (masing-masing pernah/berpotensi jadi bug — patuhi persis)

## 6.1 Dua Sumbu (ulangi karena paling sering dilanggar)
Query publik APA PUN wajib memfilter: papers `metadataStatus='indexed'`; summaries `status='published'`; relations `status='approved'`; policyTags `status='published'`; badge dari `publishedStatus` (bukan `computedStatus`). Buat helper query terpusat (mis. `lib/queries/public.ts`) supaya filter ini tidak bisa terlupa di satu endpoint.

## 6.2 Kebijakan abstrak (legal)
`abstractRaw` boleh terisi di DB tapi HARUS disensor di lapisan API bila `abstractDisplayPolicy !== 'full'`. Jangan andalkan UI untuk menyembunyikan — API-lah yang tidak mengirim. UI menampilkan pengganti: "Abstrak tidak ditampilkan karena kebijakan lisensi — baca di sumber resmi →".

## 6.3 Badge relevansi
- `publishedStatus` NULL → TIDAK render badge (bukan badge abu-abu/"unknown").
- Warna: still_relevant hijau, needs_update kuning, superseded oranye, retracted merah + banner peringatan penuh di atas halaman detail, foundational biru.
- `retracted` juga menampilkan banner di item katalog (teks kecil merah).

## 6.4 SQL manual sesudah `prisma migrate dev` (taruh sebagai migration SQL tambahan)
```sql
ALTER TABLE papers ADD COLUMN fts tsvector GENERATED ALWAYS AS
  (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(abstract_raw,''))) STORED;
CREATE INDEX ix_papers_fts ON papers USING GIN(fts);
CREATE UNIQUE INDEX ux_summary_published ON summaries(paper_id, language) WHERE status = 'published';
```
Search pakai `plainto_tsquery('simple', $q)` via `prisma.$queryRaw` — JANGAN interpolasi string (SQL injection).
Catatan: FTS mengindeks abstrak termasuk yang policy summary_only — itu boleh (mencari ≠ menampilkan); yang dilarang hanya MENAMPILKAN.

## 6.5 BibTeX
Escape karakter khusus (`{ } & % $ # _`), key = `{lastnamePenulisPertama}{tahun}{kataPertamaJudul}`, entry `@article` utk journal / `@inproceedings` utk conference / `@misc` utk lainnya, sertakan `doi` & `url` bila ada. Paper tanpa penulis (data buruk) → key pakai `unknown{tahun}`.

## 6.6 Merge & redirect
Halaman `riset/[id]`: fetch paper; jika null → cek PaperMerge by mergedId → ada? `redirect('/riset/'+survivingId)` (Next `permanentRedirect`); tidak ada? `notFound()`.

## 6.7 Negara & origin
`affiliationCountries` adalah array (kolaborasi multinegara) — filter `country=SG` pakai `has`. `origin` sudah final di seed; jangan hitung ulang di runtime. Ekspansi negara (fase berikut, bukan prototype): US+CN lalu SG/MY/KR lalu UK/IT*/FR — *IT dicatat "Italia (menunggu konfirmasi: atau India/IN?)" — cukup pastikan filter country generik, tanpa hardcode daftar negara.

## 6.8 Jangan sampai (daftar larangan eksplisit)
- Jangan render `computedStatus/computedScore` di halaman publik (hanya admin yang melihatnya, sebagai referensi keputusan).
- Jangan auto-approve apa pun di seed KECUALI yang memang di-seed berstatus published/approved (seed mensimulasikan hasil kerja editor).
- Jangan fallback ringkasan en→id atau id→en secara diam-diam (tampilkan "Ringkasan dalam bahasa ini belum tersedia").
- Jangan panggil API eksternal saat render halaman (OpenAlex hanya lewat script terpisah).
- Jangan pakai `dangerouslySetInnerHTML` untuk konten apa pun dari DB.
- Semua tanggal render lokal id-ID; simpan UTC.
- Halaman katalog & detail harus tetap render bila field opsional null (summary null, venue null, citationStats null, penulis kosong) — setiap section punya empty state, bukan crash.

---

# BAGIAN 7 — SPESIFIKASI HALAMAN

Umum: layout dengan header (logo teks "PusatRiset.ai", nav: Katalog, Dashboard, Metodologi) + footer (disclaimer AI-assisted + link Metodologi). Bahasa UI: Indonesia. Desain bersih akademik, putih, aksen satu warna (biru tua), tipografi jelas; badge berwarna sesuai 6.3. Responsif (katalog jadi 1 kolom di mobile). Setiap halaman punya loading state (skeleton) dan error state (pesan + tombol coba lagi).

**Home** `/`: hero (tagline: "Pusat kurasi riset AI Indonesia & dunia — abstrak asli, makna nyata"), search bar besar (submit → /katalog?q=), 4 kartu statistik dari DB (total riset, riset Indonesia, institusi, ringkasan terkurasi), 6 riset terbaru (published), CTA ke Dashboard.

**Katalog** `/katalog`: search bar; sidebar filter (origin radio; rentang tahun; subfield checkbox; badge relevansi; policy tag; toggle "Sembunyikan yang sudah digantikan" default OFF; toggle "Hanya akses terbuka"); daftar kartu paper (judul → detail, penulis ≤3 +"dkk", venue+tahun, badge kecil bila ada, chip policy tag, ikon 🇮🇩 utk origin local); pagination; empty state "Tidak ada hasil — coba longgarkan filter"; jumlah hasil. Filter → URL searchParams (shareable), server component fetch.

**Detail** `/riset/[id]`: breadcrumb; judul; baris meta (penulis + institusi klikable-nonaktif utk prototype, venue, tanggal, negara afiliasi); badge relevansi besar + `publishedReasoning` + (bila retracted) banner merah penuh; kartu "Riset Penerus" per relasi approved (judul, tahun, alasan, → link internal); dua TAB:
- Tab "Data Asli": abstrak sesuai policy (6.2), identifiers (DOI klik → https://doi.org/... target _blank rel noopener), tombol "Buka Sumber Resmi", tombol "Ekspor BibTeX" (download), timeline versi bila >1.
- Tab "Ringkasan & Relevansi": switcher id/en; summaryLayperson (heading "Ringkasan Sederhana"), summaryTechnical ("Ringkasan Teknis"), relevanceIndonesia ("Relevansi untuk Indonesia"); label provenance ("Dibuat dari abstrak" / "Dibuat dari teks lengkap"); disclaimer kecil; link "Keberatan dengan konten ini?" → modal form dispute (POST /api/v1/disputes, sukses → toast).
Metadata SEO: title = judul paper, description = 160 char pertama ringkasan-atau-judul.

**Dashboard** `/dashboard`: chart 1 = bar/line jumlah paper per tahun split local vs international; chart 2 = bar horizontal per subfield split sama (embrio gap analysis); teks penjelas singkat. Data dari /api/v1/stats/trends.

**Metodologi** `/metodologi`: konten statis: sumber data, sistem tier, dua sumbu editorial, arti tiap badge, kebijakan abstrak/lisensi, kebijakan inklusi (DOAJ/SINTA 1-4/editorial), cara sanggah, disclaimer.

**Admin** `/admin` (login dulu): tab antrean [Ringkasan | Relasi | Policy Tag | Sanggahan | Submission] + counter; item ringkasan: konteks paper + 3 field editable → Approve/Reject; relasi: paper lama vs baru + reasoning → Approve/Reject; panel per paper utk set relevansi manual (dropdown publishedStatus + reasoning + alasan override); aksi sukses → item hilang dari antrean + toast; tanpa refresh manual.

---

# BAGIAN 8 — SEED DATA (deterministik; kualitas seed = kualitas demo)

Buat `prisma/seed.ts` deterministik (tanpa faker random). Konten realistis, boleh paper fiktif-tapi-masuk-akal; JANGAN mengarang DOI milik paper nyata — pakai pola `10.99999/pusatriset-demo-xxx` utk yang fiktif.

1. **Users**: 1 admin (dari env), 1 editor.
2. **ApprovedVenues** (≥8): NeurIPS (tier_1, openalexSourceId "S4306420609"), ICML, ICLR, ACL (tier_1); arXiv cs.AI/cs.LG (tier_2, preprint_repo, arxivCategories); 3 jurnal Indonesia fiktif-realistis tier_2 (mis. "Jurnal Ilmu Komputer dan Informasi" issnL fiktif, basis sinta_1_2/doaj).
3. **Institutions** (≥10): UI, ITB, UGM, ITS, Telkom University, BRIN (ID) + Stanford, MIT, Tsinghua, NUS (asing), lengkap country + tipe.
4. **PolicyTags**: stranas-ai, kesehatan, birokrasi, pendidikan, ketahanan-pangan, mobilitas.
5. **Authors** ±40, nama Indonesia realistis utk paper lokal.
6. **Papers ±60** dengan komposisi WAJIB mencakup semua kasus uji:
   - ±35 origin local (2016–2026): NLP Bahasa Indonesia, computer vision pertanian/sawit, AI kesehatan (deteksi TB/diabetes — pastikan kata "diabetes" ada utk uji search), AI birokrasi, speech Jawa/Sunda; afiliasi institusi ID; beberapa kolaborasi ID+asing (affiliationCountries ganda).
   - ±20 international tier_1 terkenal-fiktif + beberapa yang mewakili paper fondasi.
   - Kasus khusus (masing-masing minimal 1): (a) foundational: isFoundational=true + relevance publishedStatus='foundational'; (b) pasangan superseded: paper 2019 publishedStatus='superseded' + PaperRelation approved superseded_by → paper 2024 + reasoningText jelas; (c) retracted (retractionStatus + publishedStatus='retracted'); (d) needs_update; (e) abstractDisplayPolicy='summary_only' DENGAN abstractRaw terisi (menguji sensor API); (f) paper tanpa summary sama sekali; (g) summary draft menunggu review (utk antrean admin, ±5 buah); (h) PaperRelation suggested (±4, utk antrean); (i) PaperPolicyTag suggested (±4) dan published (±10); (j) 1 kasus merge: PaperMerge dengan mergedId UUID hardcoded yang dikenal (tulis di README utk uji redirect); (k) paper multi-versi arXiv (3 versi); (l) beberapa relevance computedStatus terisi tapi publishedStatus NULL (uji: tak ada badge); (m) 2 disputes open + 2 submissions queued.
   - Semua paper: ≥1 identifier; topics dgn subfield dari set {Natural Language Processing, Computer Vision, Machine Learning, AI in Healthcare, AI in Agriculture, Speech Processing}; citationStats masuk akal (fondasi ribuan sitasi, baru sedikit); summaries published dwibahasa utk ±15 paper, id-only utk ±20 (uji pesan "belum tersedia" saat pilih en).
7. Derivasi `affiliationCountries` dihitung dari AuthorAffiliation di seed (tulis util yang sama yang kelak dipakai ingestion).

**README.md** wajib: cara run (4 perintah), kredensial admin, UUID kasus merge utk uji redirect, daftar fitur + acceptance list Bagian 2.3 sebagai checklist.

---

# BAGIAN 9 — SCRIPT OPSIONAL OPENALEX (hanya jika ENABLE_OPENALEX_FETCH=true)

`scripts/fetch-openalex.ts` (dijalankan manual, `npx tsx`):
- GET `https://api.openalex.org/works?filter=institutions.country_code:ID,primary_topic.field.id:https://openalex.org/fields/17&per-page=100&mailto=${OPENALEX_MAILTO}` (field 17 = Computer Science; cukup utk prototype).
- Map → papers (origin local, sourceTier tier_2, tierReason 'openalex_fetch_prototype', metadataStatus indexed, abstractDisplayPolicy: is_oa? full: summary_only; abstract dari inverted index: rekonstruksi `abstract_inverted_index` → string), identifiers (openalex_id wajib; doi bila ada — cek dulu UNIQUE agar tidak duplikat dgn seed), authors+institutions (upsert by openalexId), topics, citationStats (cited_by_count, counts_by_year, fwci, citation_normalized_percentile.value).
- TANPA summaries/relevance (biar terlihat kontras antara paper terkurasi vs baru masuk — itu justru mendemokan nilai produk).
- Error handling: timeout 30s, satu kegagalan record → skip + log, jangan gagalkan seluruh run.

---

# BAGIAN 10 — YANG DIKETAHUI BELUM DIPUTUSKAN (jangan diselesaikan sendiri oleh coder)
1. Model keberlanjutan/monetisasi — tidak memengaruhi prototype.
2. "IT" pada rencana ekspansi = Italia atau India — tidak memengaruhi prototype (filter negara generik).
3. Copywriting final halaman Metodologi — pakai draft Bagian 7, tandai sebagai draft.
