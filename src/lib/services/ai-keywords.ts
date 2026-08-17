/**
 * Lapis 2 filter topik AI — diterapkan di kode (bukan cuma filter OpenAlex) supaya:
 * - bebas dari batas 5 operator OR yang dikenakan OpenAlex ke filter search di sisi mereka,
 * - bisa diaudit & disetel ulang kapan saja tanpa menarik ulang data,
 * - memeriksa judul MAUPUN abstrak (bukan cuma judul).
 *
 * Diuji manual terhadap sampel nyata OpenAlex (lihat riwayat kerja) — tingkat lolos ~57% untuk
 * kandidat Indonesia yang sudah difilter Lapis 1 (subbidang Artificial Intelligence + Computer
 * Vision di src/lib/services/openalex-ingest.ts). Sisa yang tidak lolos dicek manual dan memang
 * bukan riset AI (mis. statistik umum, library komputasi generik, metodologi kuesioner).
 *
 * "expert system"/"sistem pakar" SENGAJA DIKELUARKAN (per keputusan founder): sistem pakar
 * rule-based klasik (certainty factor, forward chaining, dst — tanpa ML/DL) membanjiri corpus
 * riset Indonesia tapi dianggap bukan "AI" yang dimaksud platform ini. Paper yang genuinely
 * pakai ML/DL tetap lolos lewat kata kunci lain di daftar ini (neural network, machine
 * learning, dst), jadi menghapus dua pola ini tidak membuang riset ML/DL yang sungguhan.
 *
 * Dipakai oleh scripts/fetch-openalex.ts (CLI, backfill besar) dan
 * src/app/api/cron/fetch-openalex/route.ts (ingest incremental harian) lewat
 * src/lib/services/openalex-ingest.ts.
 */
export const AI_KEYWORD_PATTERNS: string[] = [
  // --- Inti AI/ML ---
  "artificial intelligence", "machine learning", "deep learning", "neural network",
  "natural language processing", "\\bNLP\\b", "computer vision", "reinforcement learning",
  "large language model", "\\bLLM\\b", "generative AI", "transformer", "diffusion model",
  "\\bGPT\\b", "\\bBERT\\b", "supervised learning", "unsupervised learning", "semi-supervised",
  "transfer learning", "federated learning", "few-shot", "zero-shot",
  "explainable AI", "\\bXAI\\b", "AI safety", "AI alignment", "AI fairness",
  // --- Aplikasi ---
  "chatbot", "autonomous vehicle", "self-driving", "smart city", "deepfake",
  "hoax detection", "fraud detection", "predictive analytic", "predictive maintenance",
  "precision agriculture", "medical diagnosis", "clinical decision support",
  "AI[\\s-]in[\\s-]education", "AI[\\s-]in[\\s-]healthcare", "AI[\\s-]in[\\s-]finance", "AI[\\s-]in[\\s-]agriculture",
  "AI ethics", "AI governance", "AI regulation", "AI polic", "algorithmic bias",
  "responsible AI", "trustworthy AI", "human-AI", "human-in-the-loop",
  "AI[\\s-]?(assisted|powered|based|driven|generated)",
  "robotic", "intelligent system", "decision support system",
  // --- Infrastruktur ---
  "\\bGPU\\b", "\\bTPU\\b", "\\bNPU\\b", "edge AI", "MLOps", "model serving", "AI infrastructure", "green AI", "AI readiness",
  // --- Teknik/arsitektur ---
  "convolutional", "recurrent neural", "support[\\s-]?vector", "\\bSVM\\b",
  "random forest", "naive bayes", "k-means", "k-nearest", "clustering algorithm",
  "sentiment analysis", "image classification", "object detection", "image recognition",
  "speech recognition", "text mining", "data mining", "pattern recognition",
  "genetic algorithm", "evolutionary algorithm", "fuzzy logic", "fuzzy system",
  "fuzzy[\\s-]?(appearance|inference|nearest)",
  "swarm optimization", "particle swarm", "ant colony", "simulated annealing",
  "\\bLSTM\\b", "\\bCNN\\b", "\\bRNN\\b", "\\bGAN\\b", "generative adversarial",
  "adversarial network", "adversarial[\\s-]?(loss|training|example)",
  "autoencoder", "attention mechanism", "self-attention", "ensemble learning",
  "gradient boosting", "\\bXGBoost\\b", "\\bLightGBM\\b", "decision tree", "\\bYOLO\\b",
  "feature extraction", "feature selection", "dimensionality reduction", "principal component analysis",
  "anomaly detection", "recommender system", "recommendation system", "time series forecast",
  "image segmentation", "semantic segmentation", "word embedding", "word2vec",
  "summarization", "pathfinding",
  "kernel[\\s-]based", "classifier", "classification model", "clustering",
  // --- Dataset/model/paper terkenal ---
  "ImageNet", "\\bCOCO\\b", "\\bResNet\\b", "\\bVGG\\b", "AlexNet", "MobileNet", "EfficientNet",
  "RoBERTa", "\\bT5\\b", "LLaMA", "Stable Diffusion", "GrabCut", "histogram of oriented gradient",
  "random sample consensus", "\\bRANSAC\\b", "gaussian mixture model",
  // --- Indonesia ---
  "kecerdasan buatan", "pembelajaran mesin", "pembelajaran mendalam", "jaringan saraf",
  "penambangan data", "pengolahan citra", "pengenalan citra", "klasifikasi citra",
  "klasifikasi", "prediksi", "peramalan", "deteksi", "sistem cerdas",
  "logika fuzzy", "algoritma genetika", "algoritma evolusi", "optimasi",
  "pengenalan pola", "temu kembali informasi", "analisis sentimen", "pengenalan suara",
  "jaringan saraf tiruan", "pembelajaran terawasi", "pembelajaran tak terawasi",
];

export const AI_TOPIC_REGEX = new RegExp("(" + AI_KEYWORD_PATTERNS.join("|") + ")", "i");

/// true kalau judul ATAU abstrak menyinggung topik AI/ML sesuai daftar di atas.
export function isAiRelated(title: string | null | undefined, abstract: string | null | undefined): boolean {
  const text = `${title ?? ""} ${abstract ?? ""}`;
  return AI_TOPIC_REGEX.test(text);
}
