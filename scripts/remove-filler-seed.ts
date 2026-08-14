/**
 * Menghapus paper "filler" dari db:seed (Bagian 8: buildLocalFillerPapers +
 * buildInternationalFillerPapers) — paper pengisi generik yang tidak membawa skenario uji
 * spesifik. TETAP MEMPERTAHANKAN 26 paper "hand-special" (Bagian 8 poin 6, kasus a-m: pasangan
 * superseded, retracted, restricted-license, foundational, merge, dsb) karena itu satu-satunya
 * cara mendemokan sistem editorial dua-sumbu — dan tetap mempertahankan semua paper hasil
 * `npm run fetch:openalex` (tidak disentuh sama sekali, dikenali lewat identifier openalex_id).
 *
 * Dijalankan manual sekali: `npx tsx scripts/remove-filler-seed.ts`. TIDAK idempotent dalam
 * arti "aman dijalankan berkali-kali tanpa efek" — setelah filler terhapus, jalan lagi hanya
 * akan melaporkan 0 terhapus (query berbasis judul, bukan re-seed).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Persis 26 titleId dari buildHandSpecialPapers() (prisma/seed.ts) — paper ini WAJIB tetap ada
// supaya semua kasus uji Bagian 8 poin 6 & acceptance checklist Bagian 2.3 tetap bisa didemokan.
const KEEP_TITLES = [
  "Deep Convolutional Feature Learning for Large-Scale Visual Recognition",
  "Deteksi Dini Tuberkulosis dari Citra Rontgen Dada Menggunakan CNN",
  "Deteksi Dini Tuberkulosis dari Citra Rontgen Dada Menggunakan Vision Transformer dengan Augmentasi Data Minim",
  "Universal Approximation Bounds for Sparse Transformer Architectures",
  "Klasifikasi Penyakit Daun Kelapa Sawit Menggunakan Random Forest",
  "Analisis Prediktif Kebutuhan Pangan Nasional Berbasis Machine Learning",
  "Efficient Graph Neural Networks for Large-Scale Molecular Property Prediction",
  "Peringkasan Otomatis Berita Bahasa Indonesia Menggunakan Transformer",
  "Pengenalan Ujaran Bahasa Jawa untuk Aplikasi Asisten Virtual",
  "Prediksi Kemacetan Lalu Lintas Perkotaan dengan Graph Neural Network",
  "Deteksi Hoaks Politik pada Media Sosial Indonesia",
  "Analisis Curah Hujan untuk Mitigasi Bencana Menggunakan LSTM",
  "Scaling Laws for Instruction-Tuned Language Models on Low-Resource Languages",
  "Optimasi Rute Distribusi Logistik Perkotaan Menggunakan Reinforcement Learning",
  "Model Peramalan Harga Komoditas Pertanian Menggunakan Prophet dan LSTM Hybrid",
  "Analisis Grafik Pengetahuan untuk Sistem Rekomendasi E-Commerce Indonesia",
  "Reinforcement Learning untuk Optimasi Jaringan Listrik Pintar",
  "Prediksi Risiko Diabetes Tipe 2 pada Populasi Urban Indonesia Menggunakan Gradient Boosting",
  "Panduan Kebijakan Adopsi AI di Sektor Publik: Studi Kasus Tiga Kementerian",
  "Ekstraksi Informasi Struktur Dokumen Perizinan Digital Menggunakan NER",
  "Segmentasi Lahan Pertanian dari Citra Satelit Menggunakan U-Net",
  "Personalisasi Materi Belajar Daring Menggunakan Collaborative Filtering",
  "Deteksi Anomali Transaksi Keuangan Menggunakan Autoencoder",
  "Klasifikasi Citra Satelit Kebakaran Hutan Menggunakan CNN",
  "Chatbot Layanan Publik Berbasis Retrieval-Augmented Generation",
  "Prediksi Putus Sekolah Menggunakan Model Klasifikasi Berimbang",
];

async function main() {
  const openAlexPaperIds = (
    await prisma.paperIdentifier.findMany({
      where: { idType: "openalex_id" },
      select: { paperId: true },
    })
  ).map((row) => row.paperId);

  const fillerPapers = await prisma.paper.findMany({
    where: {
      title: { notIn: KEEP_TITLES },
      id: { notIn: openAlexPaperIds },
    },
    select: { id: true, title: true },
  });

  if (fillerPapers.length === 0) {
    console.log("Tidak ada paper filler tersisa untuk dihapus.");
    return;
  }

  console.log(`Menghapus ${fillerPapers.length} paper filler seed...`);
  const { count } = await prisma.paper.deleteMany({
    where: { id: { in: fillerPapers.map((p) => p.id) } },
  });
  // onDelete: Cascade di schema (paper_titles, paper_identifiers, paper_topics, paper_authors,
  // author_affiliations, paper_affiliation_countries, summaries, citation_stats, paper_versions,
  // paper_policy_tags, relevance_scores) otomatis ikut terhapus.

  const [remainingTotal, remainingOpenAlex, remainingKept] = await Promise.all([
    prisma.paper.count(),
    prisma.paper.count({ where: { id: { in: openAlexPaperIds } } }),
    prisma.paper.count({ where: { title: { in: KEEP_TITLES } } }),
  ]);

  console.log(`Terhapus: ${count}.`);
  console.log(`Sisa total paper: ${remainingTotal} (${remainingKept} contoh kurasi seed + ${remainingOpenAlex} dari OpenAlex).`);
}

main()
  .catch((error) => {
    console.error("Gagal menghapus filler seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
