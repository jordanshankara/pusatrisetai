/**
 * Seed deterministik (Bagian 8 BuildSpec + Patch 1-4). Tidak ada faker/Math.random —
 * semua variasi berasal dari array template + index, supaya hasil selalu sama tiap `npm run db:seed`.
 *
 * PENTING (Patch 1): abstractDisplayPolicy TIDAK PERNAH diketik manual di sini — selalu lewat
 * deriveAbstractPolicy(). PENTING (Patch 2): Paper.title harus sama dengan PaperTitle isPrimary=true.
 */
import { PrismaClient, type License, type EnrichmentStatus } from "@prisma/client";
import { deriveAbstractPolicy, type SourcePermission } from "../src/lib/rules/abstract-policy";
import { deriveAffiliationCountries } from "../src/lib/rules/affiliation-countries";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

// UUID hardcoded (bukan FK — merepresentasikan record lama yang sudah tidak ada). Dicatat di README.
const MERGED_PAPER_UUID = "00000000-0000-4000-8000-000000000099";

// ---------- helpers ----------

let doiSeq = 0;
function nextDemoDoi(): string {
  doiSeq += 1;
  return `10.99999/pusatriset-demo-${String(doiSeq).padStart(3, "0")}`;
}

interface SummaryPlanBilingual {
  kind: "bilingual";
}
interface SummaryPlanIdOnly {
  kind: "id_only";
}
interface SummaryPlanDraft {
  kind: "draft";
}
interface SummaryPlanNone {
  kind: "none";
}
type SummaryPlan = SummaryPlanBilingual | SummaryPlanIdOnly | SummaryPlanDraft | SummaryPlanNone;

interface AuthorSpec {
  authorKey: string;
  institutionKey: string;
}

interface RelevanceSpec {
  computedStatus:
    | "too_new_to_score"
    | "still_relevant"
    | "needs_update"
    | "superseded"
    | "retracted";
  computedScore?: number;
  computedReasoning?: string;
  publishedStatus?:
    | "still_relevant"
    | "needs_update"
    | "superseded"
    | "retracted"
    | "foundational"
    | null; // null eksplisit = tidak ada badge; undefined = field relevance tidak dibuat sama sekali
  publishedReasoning?: string;
}

interface PaperSpec {
  key: string;
  titleId: string;
  titleEn?: string; // Patch 2: kalau ada, PaperTitle dua baris (id + en), Paper.title = titleId (primary)
  abstract: string;
  origin: "local" | "international";
  year: number;
  subfield:
    | "Natural Language Processing"
    | "Computer Vision"
    | "Machine Learning"
    | "AI in Healthcare"
    | "AI in Agriculture"
    | "Speech Processing";
  venueKey: string;
  authors: AuthorSpec[];
  license: License;
  isOpenAccess: boolean;
  sourcePermission?: SourcePermission;
  isFoundational?: boolean;
  affiliationInferred?: boolean;
  enrichmentStatus?: EnrichmentStatus;
  citationCount: number;
  fwci?: number | null;
  retractionStatus?: "none" | "retracted" | "expression_of_concern";
  identifierType?: "doi" | "arxiv_id";
  summaryPlan: SummaryPlan;
  relevance?: RelevanceSpec;
  versionsCount?: number; // >1 = multi-versi (kasus k)
  policyTags?: Array<{ slug: string; status: "suggested" | "published" }>;
}

// ---------- data statis: institutions, venues, authors, policy tags ----------

const INSTITUTIONS = [
  { key: "ui", name: "Universitas Indonesia", country: "ID", type: "university" },
  { key: "itb", name: "Institut Teknologi Bandung", country: "ID", type: "university" },
  { key: "ugm", name: "Universitas Gadjah Mada", country: "ID", type: "university" },
  { key: "its", name: "Institut Teknologi Sepuluh Nopember", country: "ID", type: "university" },
  { key: "telkom", name: "Telkom University", country: "ID", type: "university" },
  { key: "brin", name: "Badan Riset dan Inovasi Nasional", country: "ID", type: "research_institute" },
  { key: "stanford", name: "Stanford University", country: "US", type: "university" },
  { key: "mit", name: "Massachusetts Institute of Technology", country: "US", type: "university" },
  { key: "tsinghua", name: "Tsinghua University", country: "CN", type: "university" },
  { key: "nus", name: "National University of Singapore", country: "SG", type: "university" },
] as const;

const VENUES = [
  { key: "neurips", displayName: "NeurIPS", venueType: "conference", tier: "tier_1", country: "US", openalexSourceId: "S4306420609" },
  { key: "icml", displayName: "ICML", venueType: "conference", tier: "tier_1", country: "US" },
  { key: "iclr", displayName: "ICLR", venueType: "conference", tier: "tier_1", country: "US" },
  { key: "acl", displayName: "ACL", venueType: "conference", tier: "tier_1", country: "US" },
  { key: "arxiv_ai", displayName: "arXiv cs.AI", venueType: "preprint_repo", tier: "tier_2", arxivCategories: ["cs.AI"] },
  { key: "arxiv_lg", displayName: "arXiv cs.LG", venueType: "preprint_repo", tier: "tier_2", arxivCategories: ["cs.LG"] },
  {
    key: "jiki",
    displayName: "Jurnal Ilmu Komputer dan Informasi",
    venueType: "journal",
    tier: "tier_2",
    country: "ID",
    issnL: "2988-1000",
    rankingBasis: "sinta_1_2",
  },
  {
    key: "jrscn",
    displayName: "Jurnal Riset Sistem Cerdas Nusantara",
    venueType: "journal",
    tier: "tier_2",
    country: "ID",
    issnL: "2988-2000",
    rankingBasis: "doaj",
  },
  {
    key: "jrkai",
    displayName: "Jurnal Riset Kecerdasan Buatan Indonesia",
    venueType: "journal",
    tier: "tier_2",
    country: "ID",
    issnL: "2988-3000",
    rankingBasis: "sinta_1_2",
  },
] as const;

const POLICY_TAGS = [
  { slug: "stranas-ai", labelId: "Strategi Nasional AI", labelEn: "National AI Strategy", tagGroup: "kebijakan" },
  { slug: "kesehatan", labelId: "Kesehatan", labelEn: "Health", tagGroup: "sektor" },
  { slug: "birokrasi", labelId: "Birokrasi", labelEn: "Bureaucracy", tagGroup: "sektor" },
  { slug: "pendidikan", labelId: "Pendidikan", labelEn: "Education", tagGroup: "sektor" },
  { slug: "ketahanan-pangan", labelId: "Ketahanan Pangan", labelEn: "Food Security", tagGroup: "sektor" },
  { slug: "mobilitas", labelId: "Mobilitas", labelEn: "Mobility", tagGroup: "sektor" },
] as const;

const ID_FIRST = ["Budi", "Siti", "Andi", "Dewi", "Agus", "Rina", "Hendra", "Fitri", "Bambang", "Sri", "Eko", "Wulan", "Joko", "Ratna", "Dedi", "Yuli", "Hadi", "Indra", "Wati", "Rudi", "Agung", "Lestari", "Bayu", "Ayu", "Fajar", "Nanda", "Putri", "Rizal", "Mega", "Tono"];
const ID_LAST = ["Santoso", "Wijaya", "Kusuma", "Pratama", "Saputra", "Hidayat", "Nugroho", "Setiawan", "Permana", "Wibowo"];
const FOREIGN_NAMES = ["John Carter", "Emily Chen", "Michael Zhang", "Sarah Johnson", "David Lee", "Anna Kowalski", "Robert Wang", "Laura Martinez", "James Wilson", "Wei Liu"];

const idAuthorKeys: string[] = [];
const foreignAuthorKeys: string[] = [];
for (let i = 0; i < 30; i++) {
  idAuthorKeys.push(`id_author_${i}`);
}
for (let i = 0; i < FOREIGN_NAMES.length; i++) {
  foreignAuthorKeys.push(`foreign_author_${i}`);
}

function idAuthorName(i: number): string {
  const first = ID_FIRST[i % ID_FIRST.length];
  const last = ID_LAST[(i * 7 + 3) % ID_LAST.length];
  return `${first} ${last}`;
}

// ---------- filler paper generation (deterministik, template x index) ----------

const METHODS = ["LSTM", "Random Forest", "CNN", "BERT", "Gradient Boosting", "SVM", "Transformer", "YOLOv8", "ResNet-50", "Naive Bayes", "XGBoost", "GRU"];
const DOMAINS_NLP = ["E-Commerce", "Layanan Publik", "Perbankan Digital", "Transportasi Online", "Pariwisata"];
const CROPS = ["Kelapa Sawit", "Padi", "Kopi", "Tembakau", "Karet"];
const DISEASES = ["Retinopati Diabetik", "Pneumonia", "Kanker Kulit", "Anemia", "Hipertensi"];
const LANGS_LOCAL = ["Jawa", "Sunda", "Bali", "Minang", "Bugis"];
const ML_METHODS2 = ["Contrastive Learning", "Self-Supervised Pretraining", "Diffusion Models", "Sparse Attention", "Meta-Learning", "Federated Averaging"];
const CONDITIONS = ["Non-Convex Objectives", "Distribution Shift", "Limited Supervision", "Noisy Labels"];

function localInstitutionForIndex(i: number): string {
  const pool = ["ui", "itb", "ugm", "its", "telkom", "brin"];
  return pool[i % pool.length];
}

function buildLocalFillerPapers(): PaperSpec[] {
  const papers: PaperSpec[] = [];
  let idx = 0;

  const categories: Array<{
    subfield: PaperSpec["subfield"];
    count: number;
    build: (i: number) => { titleId: string; abstract: string };
  }> = [
    {
      subfield: "Natural Language Processing",
      count: 5,
      build: (i) => {
        const domain = DOMAINS_NLP[i % DOMAINS_NLP.length];
        const method = METHODS[i % METHODS.length];
        return {
          titleId: `Analisis Sentimen Ulasan ${domain} Berbahasa Indonesia Menggunakan ${method}`,
          abstract: `Penelitian ini menganalisis sentimen ulasan pengguna pada domain ${domain} berbahasa Indonesia menggunakan pendekatan ${method}. Dataset dikumpulkan dari platform lokal dan diberi label sentimen positif, negatif, dan netral. Hasil menunjukkan akurasi kompetitif dibanding baseline leksikon.`,
        };
      },
    },
    {
      subfield: "AI in Agriculture",
      count: 5,
      build: (i) => {
        const crop = CROPS[i % CROPS.length];
        const method = METHODS[(i + 2) % METHODS.length];
        return {
          titleId: `Klasifikasi Kondisi Tanaman ${crop} Menggunakan ${method} Berbasis Citra Drone`,
          abstract: `Studi ini mengembangkan model klasifikasi kondisi tanaman ${crop} dari citra drone menggunakan ${method}, untuk membantu petani memantau kesehatan lahan perkebunan secara efisien tanpa survei manual.`,
        };
      },
    },
    {
      subfield: "AI in Healthcare",
      count: 5,
      build: (i) => {
        const disease = DISEASES[i % DISEASES.length];
        const method = METHODS[(i + 4) % METHODS.length];
        return {
          titleId: `Deteksi Dini ${disease} Menggunakan ${method} pada Data Rekam Medis`,
          abstract: `Penelitian ini mengusulkan model deteksi dini ${disease} dari data rekam medis elektronik menggunakan ${method}. Evaluasi dilakukan pada data dari fasilitas kesehatan di Indonesia dengan mempertimbangkan keterbatasan data berlabel.`,
        };
      },
    },
    {
      subfield: "Machine Learning",
      count: 5,
      build: (i) => {
        const method = METHODS[(i + 6) % METHODS.length];
        return {
          titleId: `Sistem Klasifikasi Otomatis Pengaduan Masyarakat Menggunakan ${method}`,
          abstract: `Riset ini membangun sistem klasifikasi otomatis pengaduan masyarakat pada layanan birokrasi digital menggunakan ${method}, untuk mempercepat triase pengaduan ke instansi yang relevan.`,
        };
      },
    },
    {
      subfield: "Speech Processing",
      count: 4,
      build: (i) => {
        const lang = LANGS_LOCAL[i % LANGS_LOCAL.length];
        const method = METHODS[(i + 8) % METHODS.length];
        return {
          titleId: `Pengenalan Ucapan Bahasa ${lang} Menggunakan ${method}`,
          abstract: `Penelitian ini membangun model pengenalan ucapan (speech recognition) untuk bahasa daerah ${lang} menggunakan ${method}, sebagai upaya pelestarian dan digitalisasi bahasa daerah di Indonesia.`,
        };
      },
    },
  ];

  for (const cat of categories) {
    for (let i = 0; i < cat.count; i++) {
      const { titleId, abstract } = cat.build(i);
      const year = 2016 + (idx % 11); // sebar 2016-2026
      const authorCount = 2 + (idx % 3);
      const authors: AuthorSpec[] = [];
      for (let a = 0; a < authorCount; a++) {
        const authorIndex = (idx * 2 + a) % idAuthorKeys.length;
        authors.push({ authorKey: idAuthorKeys[authorIndex], institutionKey: localInstitutionForIndex(idx + a) });
      }
      // sebagian kolaborasi ID+asing (tiap kelipatan 6)
      if (idx % 6 === 0) {
        authors.push({ authorKey: foreignAuthorKeys[idx % foreignAuthorKeys.length], institutionKey: "nus" });
      }

      const licenses: License[] = ["cc_by_sa", "cc_by", "cc0", "unknown", "restricted"];
      const license = licenses[idx % licenses.length];
      const isOpenAccess = license !== "restricted";

      const enrichmentCycle: EnrichmentStatus[] = ["enriched_openalex", "pending", "no_doi", "enriched_openalex", "not_found_openalex", "pending", "failed"];

      const summaryCycle: SummaryPlan[] = [{ kind: "bilingual" }, { kind: "id_only" }, { kind: "none" }];

      papers.push({
        key: `local_filler_${idx}`,
        titleId,
        titleEn: idx % 5 === 0 ? `${titleId} (English translation for demo)` : undefined,
        abstract,
        origin: "local",
        year,
        subfield: cat.subfield,
        venueKey: ["jiki", "jrscn", "jrkai"][idx % 3],
        authors,
        license,
        isOpenAccess,
        affiliationInferred: idx % 9 === 0,
        enrichmentStatus: enrichmentCycle[idx % enrichmentCycle.length],
        citationCount: 2 + (idx % 40),
        fwci: null,
        summaryPlan: summaryCycle[idx % summaryCycle.length],
        policyTags:
          cat.subfield === "AI in Healthcare"
            ? [{ slug: "kesehatan", status: idx % 4 === 0 ? "suggested" : "published" }]
            : cat.subfield === "AI in Agriculture"
              ? [{ slug: "ketahanan-pangan", status: "published" }]
              : cat.subfield === "Machine Learning"
                ? [{ slug: "birokrasi", status: "published" }]
                : undefined,
      });
      idx += 1;
    }
  }

  return papers;
}

function buildInternationalFillerPapers(): PaperSpec[] {
  const papers: PaperSpec[] = [];
  let idx = 0;
  const venueCycle = ["neurips", "icml", "iclr", "acl", "arxiv_ai", "arxiv_lg"];

  const categories: Array<{
    subfield: PaperSpec["subfield"];
    count: number;
    build: (i: number) => { titleId: string; abstract: string };
  }> = [
    {
      subfield: "Machine Learning",
      count: 4,
      build: (i) => {
        const method = ML_METHODS2[i % ML_METHODS2.length];
        const cond = CONDITIONS[i % CONDITIONS.length];
        return {
          titleId: `Convergence Properties of ${method} under ${cond}`,
          abstract: `We study the convergence behavior of ${method} under ${cond} and provide empirical evidence across several benchmark tasks, comparing against standard optimization baselines.`,
        };
      },
    },
    {
      subfield: "Computer Vision",
      count: 4,
      build: (i) => {
        const method = ML_METHODS2[(i + 2) % ML_METHODS2.length];
        return {
          titleId: `Benchmarking ${method} for Cross-Domain Image Classification`,
          abstract: `This work benchmarks ${method} across multiple cross-domain image classification datasets, analyzing robustness under domain shift and limited labeled target data.`,
        };
      },
    },
    {
      subfield: "Natural Language Processing",
      count: 4,
      build: (i) => {
        const method = ML_METHODS2[(i + 4) % ML_METHODS2.length];
        return {
          titleId: `Multilingual ${method} for Low-Resource Language Understanding`,
          abstract: `We propose a multilingual ${method} approach for low-resource language understanding, evaluated on a diverse set of typologically distinct languages including several from Southeast Asia.`,
        };
      },
    },
    {
      subfield: "Machine Learning",
      count: 4,
      build: (i) => {
        const method = ML_METHODS2[(i + 1) % ML_METHODS2.length];
        return {
          titleId: `Sample-Efficient ${method} for Continuous Control Tasks`,
          abstract: `This paper introduces a sample-efficient variant of ${method} for continuous control, reducing the number of environment interactions required to reach comparable policy performance.`,
        };
      },
    },
  ];

  for (const cat of categories) {
    for (let i = 0; i < cat.count; i++) {
      const { titleId, abstract } = cat.build(i);
      const year = 2017 + (idx % 10);
      const foreignInstitutions = ["stanford", "mit", "tsinghua", "nus"];
      const authors: AuthorSpec[] = [
        { authorKey: foreignAuthorKeys[idx % foreignAuthorKeys.length], institutionKey: foreignInstitutions[idx % foreignInstitutions.length] },
        { authorKey: foreignAuthorKeys[(idx + 3) % foreignAuthorKeys.length], institutionKey: foreignInstitutions[(idx + 1) % foreignInstitutions.length] },
      ];
      const licenses: License[] = ["cc_by", "other_open", "unknown", "restricted"];
      const license = licenses[idx % licenses.length];
      const isOpenAccess = license !== "restricted" && license !== "unknown";

      const enrichmentCycle: EnrichmentStatus[] = ["enriched_openalex", "enriched_openalex", "pending", "not_found_openalex", "enriched_openalex"];
      const summaryCycle: SummaryPlan[] = [{ kind: "id_only" }, { kind: "none" }, { kind: "bilingual" }];

      papers.push({
        key: `intl_filler_${idx}`,
        titleId,
        abstract,
        origin: "international",
        year,
        subfield: cat.subfield,
        venueKey: venueCycle[idx % venueCycle.length],
        authors,
        license,
        isOpenAccess,
        enrichmentStatus: enrichmentCycle[idx % enrichmentCycle.length],
        citationCount: 20 + (idx % 15) * 37,
        fwci: 0.8 + (idx % 10) * 0.15,
        identifierType: venueCycle[idx % venueCycle.length].startsWith("arxiv") ? "arxiv_id" : "doi",
        summaryPlan: summaryCycle[idx % summaryCycle.length],
      });
      idx += 1;
    }
  }

  return papers;
}

// ---------- 23 paper "hand-special" (mencakup semua kasus uji wajib Bagian 8 poin 6) ----------

function buildHandSpecialPapers(): PaperSpec[] {
  return [
    // (a) foundational
    {
      key: "foundational_cv",
      titleId: "Deep Convolutional Feature Learning for Large-Scale Visual Recognition",
      abstract:
        "We introduce a deep convolutional architecture trained end-to-end on a large-scale image classification benchmark, establishing a new baseline that influenced a generation of follow-up computer vision research.",
      origin: "international",
      year: 2012,
      subfield: "Computer Vision",
      venueKey: "neurips",
      authors: [
        { authorKey: foreignAuthorKeys[0], institutionKey: "stanford" },
        { authorKey: foreignAuthorKeys[1], institutionKey: "mit" },
      ],
      license: "cc_by",
      isOpenAccess: true,
      isFoundational: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 48210,
      fwci: 12.4,
      summaryPlan: { kind: "bilingual" },
      relevance: {
        computedStatus: "still_relevant",
        computedScore: 98,
        computedReasoning: "Paper fondasi dengan sitasi sangat tinggi dan pengaruh berkelanjutan.",
        publishedStatus: "foundational",
        publishedReasoning: "Salah satu arsitektur dasar yang membentuk riset visi komputer modern.",
      },
      policyTags: [{ slug: "stranas-ai", status: "published" }],
    },

    // (b) pasangan superseded
    {
      key: "tb_2019",
      titleId: "Deteksi Dini Tuberkulosis dari Citra Rontgen Dada Menggunakan CNN",
      abstract:
        "Penelitian ini mengembangkan model CNN untuk mendeteksi tanda-tanda tuberkulosis dari citra rontgen dada, dilatih pada dataset rumah sakit rujukan di Indonesia.",
      origin: "local",
      year: 2019,
      subfield: "AI in Healthcare",
      venueKey: "jiki",
      authors: [
        { authorKey: idAuthorKeys[0], institutionKey: "ui" },
        { authorKey: idAuthorKeys[1], institutionKey: "ui" },
      ],
      license: "cc_by_sa",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 34,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      relevance: {
        computedStatus: "superseded",
        computedReasoning: "Akurasi jauh di bawah model penerus tahun 2024 pada dataset yang sama.",
        publishedStatus: "superseded",
        publishedReasoning: "Digantikan oleh model Vision Transformer 2024 dengan akurasi jauh lebih tinggi.",
      },
      policyTags: [{ slug: "kesehatan", status: "published" }],
    },
    {
      key: "tb_2024",
      titleId: "Deteksi Dini Tuberkulosis dari Citra Rontgen Dada Menggunakan Vision Transformer dengan Augmentasi Data Minim",
      abstract:
        "Studi ini mengusulkan pendekatan Vision Transformer dengan strategi augmentasi data minim untuk deteksi tuberkulosis, mencapai akurasi 96% pada dataset validasi yang sama dengan studi 2019.",
      origin: "local",
      year: 2024,
      subfield: "AI in Healthcare",
      venueKey: "jiki",
      authors: [
        { authorKey: idAuthorKeys[0], institutionKey: "ui" },
        { authorKey: idAuthorKeys[2], institutionKey: "brin" },
      ],
      license: "cc_by_sa",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 6,
      fwci: null,
      summaryPlan: { kind: "bilingual" },
      relevance: {
        computedStatus: "still_relevant",
        computedReasoning: "Publikasi baru dengan metodologi lebih kuat, belum ada penerus lain.",
        publishedStatus: "still_relevant",
        publishedReasoning: "Model saat ini dengan akurasi tertinggi untuk kasus ini di korpus kami.",
      },
      policyTags: [{ slug: "kesehatan", status: "published" }],
    },

    // (c) retracted
    {
      key: "retracted_paper",
      titleId: "Universal Approximation Bounds for Sparse Transformer Architectures",
      abstract:
        "We derive theoretical bounds on the approximation capacity of sparse transformer architectures and validate them through a series of controlled experiments.",
      origin: "international",
      year: 2021,
      subfield: "Machine Learning",
      venueKey: "icml",
      authors: [{ authorKey: foreignAuthorKeys[2], institutionKey: "tsinghua" }],
      license: "unknown",
      isOpenAccess: false,
      enrichmentStatus: "enriched_openalex",
      citationCount: 112,
      fwci: 1.1,
      retractionStatus: "retracted",
      summaryPlan: { kind: "id_only" },
      relevance: {
        computedStatus: "retracted",
        computedReasoning: "Ditarik oleh penerbit; ditemukan duplikasi data eksperimen oleh reviewer independen.",
        publishedStatus: "retracted",
        publishedReasoning: "Ditarik oleh penerbit karena ditemukan duplikasi data eksperimen.",
      },
    },

    // (d) needs_update
    {
      key: "needs_update_paper",
      titleId: "Klasifikasi Penyakit Daun Kelapa Sawit Menggunakan Random Forest",
      abstract:
        "Penelitian ini mengklasifikasikan penyakit daun kelapa sawit dari citra menggunakan Random Forest, dengan dataset yang dikumpulkan dari satu wilayah perkebunan di Sumatra.",
      origin: "local",
      year: 2018,
      subfield: "AI in Agriculture",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[3], institutionKey: "its" }],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "no_doi",
      citationCount: 19,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      relevance: {
        computedStatus: "needs_update",
        computedReasoning: "Dataset training terbatas pada satu wilayah, generalisasi belum teruji.",
        publishedStatus: "needs_update",
        publishedReasoning: "Dataset training terbatas pada satu wilayah perkebunan; validasi ulang pada kondisi wilayah lain diperlukan.",
      },
      policyTags: [{ slug: "ketahanan-pangan", status: "published" }],
    },

    // (e) summary_only DENGAN abstractRaw terisi (rule 2/3 gagal -> default aman)
    {
      key: "restricted_with_abstract",
      titleId: "Analisis Prediktif Kebutuhan Pangan Nasional Berbasis Machine Learning",
      titleEn: "Predictive Analysis of National Food Demand Based on Machine Learning",
      abstract:
        "Kajian ini membangun model prediktif kebutuhan pangan nasional lima tahun ke depan menggunakan data historis produksi, konsumsi, dan indikator makroekonomi, sebagai masukan bagi perencanaan ketahanan pangan.",
      origin: "local",
      year: 2022,
      subfield: "AI in Agriculture",
      venueKey: "jrkai",
      authors: [{ authorKey: idAuthorKeys[4], institutionKey: "ugm" }],
      license: "restricted",
      isOpenAccess: false,
      enrichmentStatus: "pending",
      citationCount: 8,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "ketahanan-pangan", status: "published" }],
    },

    // (f) tanpa summary sama sekali
    {
      key: "no_summary_paper",
      titleId: "Efficient Graph Neural Networks for Large-Scale Molecular Property Prediction",
      abstract:
        "We present an efficient graph neural network architecture for predicting molecular properties at scale, reducing training cost while preserving predictive accuracy on standard benchmarks.",
      origin: "international",
      year: 2023,
      subfield: "Machine Learning",
      venueKey: "iclr",
      authors: [{ authorKey: foreignAuthorKeys[5], institutionKey: "mit" }],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "pending",
      citationCount: 5,
      fwci: 0.4,
      summaryPlan: { kind: "none" },
    },

    // (g) 5 draft summary (antrean admin)
    {
      key: "draft_1",
      titleId: "Peringkasan Otomatis Berita Bahasa Indonesia Menggunakan Transformer",
      abstract: "Penelitian ini membangun model peringkasan otomatis abstraktif untuk berita berbahasa Indonesia menggunakan arsitektur Transformer.",
      origin: "local",
      year: 2023,
      subfield: "Natural Language Processing",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[5], institutionKey: "telkom" }],
      license: "cc_by_sa",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 3,
      fwci: null,
      summaryPlan: { kind: "draft" },
    },
    {
      key: "draft_2",
      titleId: "Pengenalan Ujaran Bahasa Jawa untuk Aplikasi Asisten Virtual",
      abstract: "Studi ini mengembangkan model pengenalan ujaran bahasa Jawa untuk mendukung aplikasi asisten virtual berbasis suara.",
      origin: "local",
      year: 2022,
      subfield: "Speech Processing",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[6], institutionKey: "ugm" }],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "pending",
      citationCount: 7,
      fwci: null,
      summaryPlan: { kind: "draft" },
    },
    {
      key: "draft_3",
      titleId: "Prediksi Kemacetan Lalu Lintas Perkotaan dengan Graph Neural Network",
      abstract: "Penelitian ini memprediksi kemacetan lalu lintas perkotaan menggunakan graph neural network pada data sensor jalan raya.",
      origin: "local",
      year: 2024,
      subfield: "Machine Learning",
      venueKey: "jrkai",
      authors: [{ authorKey: idAuthorKeys[7], institutionKey: "its" }],
      license: "cc0",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 1,
      fwci: null,
      summaryPlan: { kind: "draft" },
      policyTags: [{ slug: "mobilitas", status: "published" }],
    },
    {
      key: "draft_4",
      titleId: "Deteksi Hoaks Politik pada Media Sosial Indonesia",
      abstract: "Studi ini membangun model deteksi hoaks bertema politik pada media sosial Indonesia menggunakan pendekatan klasifikasi teks.",
      origin: "local",
      year: 2023,
      subfield: "Natural Language Processing",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[8], institutionKey: "ui" }],
      license: "cc_by_sa",
      isOpenAccess: true,
      enrichmentStatus: "not_found_openalex",
      citationCount: 4,
      fwci: null,
      summaryPlan: { kind: "draft" },
    },
    {
      key: "draft_5",
      titleId: "Analisis Curah Hujan untuk Mitigasi Bencana Menggunakan LSTM",
      abstract: "Penelitian ini memprediksi pola curah hujan ekstrem untuk mendukung mitigasi bencana banjir menggunakan model LSTM.",
      origin: "local",
      year: 2021,
      subfield: "Machine Learning",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[9], institutionKey: "brin" }],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "pending",
      citationCount: 11,
      fwci: null,
      summaryPlan: { kind: "draft" },
    },

    // (k) multi-versi arXiv (3 versi)
    {
      key: "multi_version",
      titleId: "Scaling Laws for Instruction-Tuned Language Models on Low-Resource Languages",
      abstract:
        "We study scaling laws for instruction-tuned language models when applied to low-resource languages, including experiments on Indonesian and Vietnamese.",
      origin: "international",
      year: 2022,
      subfield: "Natural Language Processing",
      venueKey: "arxiv_lg",
      authors: [
        { authorKey: foreignAuthorKeys[6], institutionKey: "nus" },
        { authorKey: idAuthorKeys[10], institutionKey: "ui" },
      ],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 88,
      fwci: 2.1,
      identifierType: "arxiv_id",
      summaryPlan: { kind: "bilingual" },
      versionsCount: 3,
    },

    // (j) merge case (surviving paper)
    {
      key: "merge_surviving",
      titleId: "Optimasi Rute Distribusi Logistik Perkotaan Menggunakan Reinforcement Learning",
      abstract:
        "Penelitian ini mengoptimalkan rute distribusi logistik perkotaan menggunakan reinforcement learning, dievaluasi pada simulasi jaringan jalan salah satu kota besar di Indonesia.",
      origin: "local",
      year: 2020,
      subfield: "Machine Learning",
      venueKey: "jrkai",
      authors: [{ authorKey: idAuthorKeys[11], institutionKey: "itb" }],
      license: "cc_by_sa",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 22,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "mobilitas", status: "published" }],
    },

    // (l) computedStatus terisi, publishedStatus NULL eksplisit -> tanpa badge (3 paper)
    {
      key: "computed_only_1",
      titleId: "Model Peramalan Harga Komoditas Pertanian Menggunakan Prophet dan LSTM Hybrid",
      abstract: "Studi ini membangun model hybrid Prophet-LSTM untuk meramalkan harga komoditas pertanian jangka pendek.",
      origin: "local",
      year: 2024,
      subfield: "AI in Agriculture",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[12], institutionKey: "ugm" }],
      license: "unknown",
      isOpenAccess: false,
      enrichmentStatus: "pending",
      citationCount: 0,
      fwci: null,
      summaryPlan: { kind: "none" },
      relevance: {
        computedStatus: "too_new_to_score",
        computedReasoning: "Terlalu baru untuk dinilai relevansinya secara otomatis.",
        publishedStatus: null,
      },
    },
    {
      key: "computed_only_2",
      titleId: "Analisis Grafik Pengetahuan untuk Sistem Rekomendasi E-Commerce Indonesia",
      abstract: "Penelitian ini menerapkan knowledge graph untuk meningkatkan relevansi sistem rekomendasi e-commerce di Indonesia.",
      origin: "local",
      year: 2024,
      subfield: "Machine Learning",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[13], institutionKey: "telkom" }],
      license: "unknown",
      isOpenAccess: false,
      enrichmentStatus: "pending",
      citationCount: 1,
      fwci: null,
      summaryPlan: { kind: "none" },
      relevance: {
        computedStatus: "too_new_to_score",
        computedReasoning: "Terlalu baru untuk dinilai relevansinya secara otomatis.",
        publishedStatus: null,
      },
    },
    {
      key: "computed_only_3",
      titleId: "Reinforcement Learning untuk Optimasi Jaringan Listrik Pintar",
      abstract: "Studi ini menerapkan reinforcement learning untuk mengoptimalkan distribusi beban pada jaringan listrik pintar (smart grid).",
      origin: "local",
      year: 2025,
      subfield: "Machine Learning",
      venueKey: "jrkai",
      authors: [{ authorKey: idAuthorKeys[14], institutionKey: "its" }],
      license: "unknown",
      isOpenAccess: false,
      enrichmentStatus: "pending",
      citationCount: 0,
      fwci: null,
      summaryPlan: { kind: "none" },
      relevance: {
        computedStatus: "too_new_to_score",
        computedReasoning: "Terlalu baru untuk dinilai relevansinya secara otomatis.",
        publishedStatus: null,
      },
    },

    // Kata kunci "diabetes" wajib bisa ditemukan search + affiliationInferred=true
    {
      key: "diabetes_paper",
      titleId: "Prediksi Risiko Diabetes Tipe 2 pada Populasi Urban Indonesia Menggunakan Gradient Boosting",
      titleEn: "Predicting Type 2 Diabetes Risk in Urban Indonesian Populations Using Gradient Boosting",
      abstract:
        "Penelitian ini membangun model prediksi risiko diabetes tipe 2 pada populasi urban Indonesia menggunakan gradient boosting, dilatih pada data survei kesehatan berskala kota besar.",
      origin: "local",
      year: 2021,
      subfield: "AI in Healthcare",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[15], institutionKey: "ugm" }],
      license: "cc_by_sa",
      isOpenAccess: true,
      affiliationInferred: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 41,
      fwci: null,
      summaryPlan: { kind: "bilingual" },
      policyTags: [{ slug: "kesehatan", status: "published" }],
    },

    // Uji Patch 1 rule 1 (sourcePermission='metadata_only' menang atas lisensi terbuka)
    {
      key: "metadata_only_rule_test",
      titleId: "Panduan Kebijakan Adopsi AI di Sektor Publik: Studi Kasus Tiga Kementerian",
      titleEn: "AI Adoption Policy Guidelines in the Public Sector: A Three-Ministry Case Study",
      abstract:
        "Studi ini meninjau kebijakan adopsi AI di tiga kementerian di Indonesia dan mengusulkan kerangka tata kelola yang dapat direplikasi oleh instansi lain.",
      origin: "local",
      year: 2023,
      subfield: "Machine Learning",
      venueKey: "jrkai",
      authors: [{ authorKey: idAuthorKeys[16], institutionKey: "brin" }],
      license: "cc_by", // lisensi terbuka, TAPI sourcePermission='metadata_only' harus tetap menang (rule 1)
      isOpenAccess: true,
      sourcePermission: "metadata_only",
      affiliationInferred: true,
      enrichmentStatus: "no_doi",
      citationCount: 9,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "stranas-ai", status: "published" }, { slug: "birokrasi", status: "suggested" }],
    },

    // afiliasi perkiraan tambahan (Patch 3 butuh minimal 5 total — sudah ada 2 di atas, tambah 3 lagi)
    {
      key: "affiliation_inferred_1",
      titleId: "Ekstraksi Informasi Struktur Dokumen Perizinan Digital Menggunakan NER",
      abstract: "Penelitian ini mengekstraksi informasi terstruktur dari dokumen perizinan digital menggunakan named entity recognition.",
      origin: "local",
      year: 2022,
      subfield: "Natural Language Processing",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[17], institutionKey: "its" }],
      license: "unknown",
      isOpenAccess: true,
      affiliationInferred: true,
      enrichmentStatus: "not_found_openalex",
      citationCount: 5,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "birokrasi", status: "published" }],
    },
    {
      key: "affiliation_inferred_2",
      titleId: "Segmentasi Lahan Pertanian dari Citra Satelit Menggunakan U-Net",
      abstract: "Studi ini melakukan segmentasi lahan pertanian dari citra satelit resolusi menengah menggunakan arsitektur U-Net.",
      origin: "local",
      year: 2023,
      subfield: "AI in Agriculture",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[18], institutionKey: "ugm" }],
      license: "cc_by",
      isOpenAccess: true,
      affiliationInferred: true,
      enrichmentStatus: "pending",
      citationCount: 3,
      fwci: null,
      summaryPlan: { kind: "none" },
      policyTags: [{ slug: "ketahanan-pangan", status: "suggested" }],
    },
    {
      key: "affiliation_inferred_3",
      titleId: "Personalisasi Materi Belajar Daring Menggunakan Collaborative Filtering",
      abstract: "Penelitian ini mempersonalisasi rekomendasi materi belajar daring untuk siswa sekolah menengah menggunakan collaborative filtering.",
      origin: "local",
      year: 2022,
      subfield: "Machine Learning",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[19], institutionKey: "telkom" }],
      license: "cc_by_sa",
      isOpenAccess: true,
      affiliationInferred: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 6,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "pendidikan", status: "published" }],
    },

    // target untuk 4 relasi "suggested" (kasus h)
    {
      key: "relation_target_1",
      titleId: "Deteksi Anomali Transaksi Keuangan Menggunakan Autoencoder",
      abstract: "Penelitian ini mendeteksi anomali transaksi keuangan menggunakan pendekatan autoencoder tanpa supervisi.",
      origin: "local",
      year: 2023,
      subfield: "Machine Learning",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[20], institutionKey: "ui" }],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 14,
      fwci: null,
      summaryPlan: { kind: "id_only" },
    },
    {
      key: "relation_target_2",
      titleId: "Klasifikasi Citra Satelit Kebakaran Hutan Menggunakan CNN",
      abstract: "Studi ini mengklasifikasikan citra satelit untuk deteksi dini titik kebakaran hutan menggunakan CNN.",
      origin: "local",
      year: 2021,
      subfield: "Computer Vision",
      venueKey: "jrkai",
      authors: [{ authorKey: idAuthorKeys[21], institutionKey: "brin" }],
      license: "cc_by_sa",
      isOpenAccess: true,
      enrichmentStatus: "enriched_openalex",
      citationCount: 27,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "ketahanan-pangan", status: "suggested" }],
    },
    {
      key: "relation_target_3",
      titleId: "Chatbot Layanan Publik Berbasis Retrieval-Augmented Generation",
      abstract: "Penelitian ini membangun chatbot layanan publik berbasis retrieval-augmented generation untuk menjawab pertanyaan warga.",
      origin: "local",
      year: 2024,
      subfield: "Natural Language Processing",
      venueKey: "jrscn",
      authors: [{ authorKey: idAuthorKeys[22], institutionKey: "ugm" }],
      license: "cc0",
      isOpenAccess: true,
      enrichmentStatus: "pending",
      citationCount: 2,
      fwci: null,
      summaryPlan: { kind: "none" },
      policyTags: [{ slug: "birokrasi", status: "suggested" }],
    },
    {
      key: "relation_target_4",
      titleId: "Prediksi Putus Sekolah Menggunakan Model Klasifikasi Berimbang",
      abstract: "Studi ini memprediksi risiko putus sekolah siswa menggunakan model klasifikasi dengan penanganan data tidak seimbang.",
      origin: "local",
      year: 2022,
      subfield: "Machine Learning",
      venueKey: "jiki",
      authors: [{ authorKey: idAuthorKeys[23], institutionKey: "its" }],
      license: "cc_by",
      isOpenAccess: true,
      enrichmentStatus: "no_doi",
      citationCount: 9,
      fwci: null,
      summaryPlan: { kind: "id_only" },
      policyTags: [{ slug: "pendidikan", status: "suggested" }],
    },
  ];
}

// ---------- main ----------

async function main() {
  console.log("Membersihkan data lama (idempotent reseed)...");
  await prisma.paperPolicyTag.deleteMany();
  await prisma.paperRelation.deleteMany();
  await prisma.relevanceScore.deleteMany();
  await prisma.citationStats.deleteMany();
  await prisma.paperVersion.deleteMany();
  await prisma.summary.deleteMany();
  await prisma.paperTopic.deleteMany();
  await prisma.authorAffiliation.deleteMany();
  await prisma.paperAffiliationCountry.deleteMany();
  await prisma.paperAuthor.deleteMany();
  await prisma.paperIdentifier.deleteMany();
  await prisma.paperTitle.deleteMany();
  await prisma.paperMerge.deleteMany();
  await prisma.institutionNameVariant.deleteMany();
  await prisma.venueArxivCategory.deleteMany();
  await prisma.paper.deleteMany();
  await prisma.policyTag.deleteMany();
  await prisma.author.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.approvedVenue.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seed users...");
  await prisma.user.create({
    data: {
      email: process.env.ADMIN_EMAIL ?? "admin@pusatriset.ai",
      displayName: "Admin PusatRiset",
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? "changeme-local-only"),
      role: "admin",
    },
  });
  await prisma.user.create({
    data: {
      email: "editor@pusatriset.ai",
      displayName: "Editor PusatRiset",
      passwordHash: hashPassword("editor-local-only"),
      role: "editor",
    },
  });

  console.log("Seed institutions...");
  const institutionByKey = new Map<string, string>();
  for (const inst of INSTITUTIONS) {
    const row = await prisma.institution.create({
      data: { name: inst.name, country: inst.country, institutionType: inst.type },
    });
    institutionByKey.set(inst.key, row.id);
  }
  console.log("Seed venues...");
  const venueByKey = new Map<string, string>();
  for (const venue of VENUES) {
    const row = await prisma.approvedVenue.create({
      data: {
        displayName: venue.displayName,
        venueType: venue.venueType as never,
        tier: venue.tier as never,
        country: "country" in venue ? venue.country : undefined,
        openalexSourceId: "openalexSourceId" in venue ? venue.openalexSourceId : undefined,
        issnL: "issnL" in venue ? venue.issnL : undefined,
        rankingBasis: "rankingBasis" in venue ? venue.rankingBasis : undefined,
      },
    });
    venueByKey.set(venue.key, row.id);
    if ("arxivCategories" in venue && venue.arxivCategories) {
      for (const category of venue.arxivCategories) {
        await prisma.venueArxivCategory.create({ data: { venueId: row.id, category } });
      }
    }
  }

  console.log("Seed policy tags...");
  const tagBySlug = new Map<string, string>();
  for (const tag of POLICY_TAGS) {
    const row = await prisma.policyTag.create({
      data: { slug: tag.slug, labelId: tag.labelId, labelEn: tag.labelEn, tagGroup: tag.tagGroup },
    });
    tagBySlug.set(tag.slug, row.id);
  }

  console.log("Seed authors...");
  const authorByKey = new Map<string, string>();
  for (let i = 0; i < idAuthorKeys.length; i++) {
    const row = await prisma.author.create({ data: { name: idAuthorName(i) } });
    authorByKey.set(idAuthorKeys[i], row.id);
  }
  for (let i = 0; i < foreignAuthorKeys.length; i++) {
    const row = await prisma.author.create({ data: { name: FOREIGN_NAMES[i] } });
    authorByKey.set(foreignAuthorKeys[i], row.id);
  }

  console.log("Menyusun daftar paper (hand-special + filler)...");
  const allPapers: PaperSpec[] = [
    ...buildHandSpecialPapers(),
    ...buildLocalFillerPapers(),
    ...buildInternationalFillerPapers(),
  ];
  console.log(`Total paper: ${allPapers.length}`);

  const paperIdByKey = new Map<string, string>();

  for (const spec of allPapers) {
    // Patch 1: abstractDisplayPolicy WAJIB lewat deriveAbstractPolicy(), tidak pernah manual.
    const abstractDisplayPolicy = deriveAbstractPolicy({
      licenseNormalized: spec.license,
      isOpenAccess: spec.isOpenAccess,
      sourcePermission: spec.sourcePermission ?? null,
    });

    // Derive affiliationCountries dari institusi tiap author (util yang sama dipakai ingestion nanti)
    const authorCountries = spec.authors.map((a) => {
      const inst = INSTITUTIONS.find((i) => i.key === a.institutionKey);
      return inst?.country ?? null;
    });
    const affiliationCountries = deriveAffiliationCountries(authorCountries);

    const venueId = venueByKey.get(spec.venueKey);
    const venue = VENUES.find((v) => v.key === spec.venueKey);

    const paper = await prisma.paper.create({
      data: {
        title: spec.titleId, // Patch 2: title = judul primary
        abstractRaw: spec.abstract,
        abstractDisplayPolicy,
        publishedDate: new Date(Date.UTC(spec.year, 5, 15)),
        language: spec.origin === "local" ? "id" : "en",
        origin: spec.origin,
        venueId,
        venueNameRaw: venue?.displayName,
        venueCountry: venue && "country" in venue ? venue.country : undefined,
        sourceTier: (venue?.tier ?? "tier_3") as never,
        isFoundational: spec.isFoundational ?? false,
        metadataStatus: "indexed",
        licenseRaw: spec.license === "unknown" ? null : spec.license,
        licenseNormalized: spec.license,
        affiliationInferred: spec.affiliationInferred ?? false,
        enrichmentStatus: spec.enrichmentStatus ?? "pending",
      },
    });
    paperIdByKey.set(spec.key, paper.id);

    // Patch 2: PaperTitle — primary (id) selalu ada, EN kalau disediakan
    await prisma.paperTitle.create({
      data: { paperId: paper.id, language: spec.origin === "local" ? "id" : "en", title: spec.titleId, isPrimary: true },
    });
    if (spec.titleEn) {
      await prisma.paperTitle.create({
        data: { paperId: paper.id, language: "en", title: spec.titleEn, isPrimary: false },
      });
    }

    // Identifier (>=1 wajib)
    const idType = spec.identifierType ?? "doi";
    await prisma.paperIdentifier.create({
      data: {
        paperId: paper.id,
        idType,
        idValue: idType === "arxiv_id" ? `${2000 + spec.year}.${String(doiSeq + 1).padStart(5, "0")}` : nextDemoDoi(),
      },
    });

    // Topic (subfield primary)
    await prisma.paperTopic.create({
      data: {
        paperId: paper.id,
        domain: "Computer Science",
        field: "Artificial Intelligence",
        subfield: spec.subfield,
        topic: spec.subfield,
        isPrimary: true,
        score: 0.9,
      },
    });

    // Authors + affiliations
    for (let order = 0; order < spec.authors.length; order++) {
      const a = spec.authors[order];
      const authorId = authorByKey.get(a.authorKey)!;
      const institutionId = institutionByKey.get(a.institutionKey)!;
      await prisma.paperAuthor.create({
        data: { paperId: paper.id, authorId, authorOrder: order + 1 },
      });
      await prisma.authorAffiliation.create({
        data: { authorId, institutionId, paperId: paper.id },
      });
    }

    // affiliationCountries (junction, ADAPTASI MYSQL)
    for (const code of affiliationCountries) {
      await prisma.paperAffiliationCountry.create({ data: { paperId: paper.id, countryCode: code } });
    }

    // CitationStats
    await prisma.citationStats.create({
      data: {
        paperId: paper.id,
        citationCountTotal: spec.citationCount,
        fwci: spec.origin === "international" ? (spec.fwci ?? null) : null,
        localPercentile: spec.origin === "local" ? Math.min(99, 40 + (spec.citationCount % 60)) : null,
        retractionStatus: spec.retractionStatus ?? "none",
      },
    });

    // Versions (default 1 baris; multi-versi utk kasus k)
    const versionsCount = spec.versionsCount ?? 1;
    for (let v = 1; v <= versionsCount; v++) {
      await prisma.paperVersion.create({
        data: {
          paperId: paper.id,
          versionNumber: v,
          changedSummary:
            v === 1
              ? "Versi awal."
              : v === 2
                ? "Menambahkan eksperimen pada bahasa Indonesia dan Vietnam."
                : "Revisi metodologi evaluasi dan penambahan baseline.",
          versionDate: new Date(Date.UTC(spec.year, v - 1, 1)),
        },
      });
    }

    // Summaries sesuai plan
    if (spec.summaryPlan.kind !== "none") {
      const content = `<p>Studi "${spec.titleId}" menjelaskan temuan penelitian ini dengan bahasa yang mudah dipahami, menyoroti manfaat praktisnya.</p><p>Penelitian ini mengevaluasi pendekatan yang diusulkan pada data terkait subbidang ${spec.subfield}, dengan hasil yang kompetitif dibanding baseline yang umum digunakan.</p><p>Temuan ini relevan bagi konteks Indonesia karena berkaitan langsung dengan kebutuhan riset dan kebijakan di subbidang ${spec.subfield}.</p>`;

      const status = spec.summaryPlan.kind === "draft" ? "draft" : "published";
      const sourceType = spec.summaryPlan.kind === "draft" ? "ai_draft" : "manual";

      await prisma.summary.create({
        data: {
          paperId: paper.id,
          language: "id",
          content,
          sourceType,
          provenance: "from_abstract",
          status,
        },
      });

      if (spec.summaryPlan.kind === "bilingual") {
        await prisma.summary.create({
          data: {
            paperId: paper.id,
            language: "en",
            content: `<p>This study, "${spec.titleId}", explains the research findings in accessible language, highlighting practical benefits.</p><p>This work evaluates the proposed approach on data related to ${spec.subfield}, showing competitive results against common baselines.</p><p>These findings are relevant to the Indonesian context given ongoing research and policy needs in ${spec.subfield}.</p>`,
            sourceType: "manual",
            provenance: "from_abstract",
            status: "published",
          },
        });
      }
    }

    // Relevance
    if (spec.relevance) {
      await prisma.relevanceScore.create({
        data: {
          paperId: paper.id,
          computedStatus: spec.relevance.computedStatus,
          computedScore: spec.relevance.computedScore,
          computedReasoning: spec.relevance.computedReasoning,
          publishedStatus: spec.relevance.publishedStatus ?? undefined,
          publishedReasoning: spec.relevance.publishedReasoning,
        },
      });
    }

    // Policy tags
    if (spec.policyTags) {
      for (const pt of spec.policyTags) {
        const tagId = tagBySlug.get(pt.slug);
        if (!tagId) continue;
        await prisma.paperPolicyTag.create({
          data: { paperId: paper.id, tagId, status: pt.status },
        });
      }
    }
  }

  console.log("Seed relasi antar-paper...");

  // (b) superseded_by, approved
  await prisma.paperRelation.create({
    data: {
      paperIdOld: paperIdByKey.get("tb_2019")!,
      paperIdNew: paperIdByKey.get("tb_2024")!,
      relationType: "superseded_by",
      confidenceScore: 0.95,
      reasoningText:
        "Model Vision Transformer pada studi 2024 mencapai akurasi 96% dibanding 84% pada model CNN 2019, dengan dataset validasi yang sama.",
      status: "approved",
    },
  });

  // (h) 4 relasi suggested (antrean admin)
  const suggestedRelations: Array<{ old: string; new: string; type: "related_semantic" | "follow_up_same_author" | "extended_by" | "contradicted_by"; reasoning: string }> = [
    { old: "merge_surviving", new: "relation_target_1", type: "related_semantic", reasoning: "Kedua studi sama-sama menerapkan pembelajaran mesin pada domain operasional perkotaan." },
    { old: "needs_update_paper", new: "relation_target_2", type: "related_semantic", reasoning: "Domain aplikasi serupa (pertanian/kehutanan berbasis citra)." },
    { old: "draft_4", new: "relation_target_3", type: "follow_up_same_author", reasoning: "Kandidat follow-up oleh kelompok riset yang sama pada topik NLP layanan publik." },
    { old: "affiliation_inferred_3", new: "relation_target_4", type: "extended_by", reasoning: "Studi lanjutan memperluas cakupan ke prediksi putus sekolah pada populasi berbeda." },
  ];
  for (const rel of suggestedRelations) {
    await prisma.paperRelation.create({
      data: {
        paperIdOld: paperIdByKey.get(rel.old)!,
        paperIdNew: paperIdByKey.get(rel.new)!,
        relationType: rel.type,
        reasoningText: rel.reasoning,
        status: "suggested",
      },
    });
  }

  // (j) merge case
  await prisma.paperMerge.create({
    data: {
      survivingId: paperIdByKey.get("merge_surviving")!,
      mergedId: MERGED_PAPER_UUID,
      method: "duplicate_detected_manual",
    },
  });

  console.log("Seed disputes & submissions...");
  await prisma.dispute.create({
    data: {
      paperId: paperIdByKey.get("tb_2019")!,
      disputeType: "relevance_badge",
      submittedByName: "Pembaca Anonim",
      submittedByEmail: "pembaca1@example.com",
      argument: "Badge 'Sudah Digantikan' menurut saya terlalu dini, model 2019 masih dipakai di beberapa fasilitas kesehatan.",
      status: "open",
    },
  });
  await prisma.dispute.create({
    data: {
      paperId: paperIdByKey.get("restricted_with_abstract")!,
      disputeType: "abstract_policy",
      submittedByName: "Peneliti Independen",
      submittedByEmail: "peneliti2@example.com",
      argument: "Saya penulis paper ini dan lisensinya sebenarnya CC BY, mohon ditinjau ulang kebijakan abstraknya.",
      status: "open",
    },
  });
  await prisma.submission.create({
    data: {
      submittedByName: "Calon Kontributor 1",
      submittedByEmail: "kontributor1@example.com",
      claimedIdentifier: "10.99999/pusatriset-demo-999",
      status: "queued",
    },
  });
  await prisma.submission.create({
    data: {
      submittedByName: "Calon Kontributor 2",
      submittedByEmail: "kontributor2@example.com",
      claimedIdentifier: "arXiv:2401.99999",
      status: "queued",
    },
  });

  console.log("Seed selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
