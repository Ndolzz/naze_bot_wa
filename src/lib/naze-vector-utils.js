// Utilitas murni fitur Vector NAZE: penguraian argumen perintah, resolusi
// batas, teks menu, dan templat pesan. Modul ini hanya mengimpor modul murni
// lain agar logika intinya dapat diuji secara terisolasi (lihat
// tests/vector.test.js).

import { messageHeader, formatBytes } from "./naze-file-utils.js";

// ---------------------------------------------------------------------------
// Batas bawaan
// ---------------------------------------------------------------------------

const VECTOR_MODES = ["gelap", "terang"];
const VECTOR_SIMPLIFICATIONS = ["rendah", "sedang", "tinggi"];
const VECTOR_REPRESENTATIONS = ["isi", "garis"];

const DEFAULT_VECTOR_LIMITS = {
  maxMediaBytes: 15728640, // 15 MB ukuran maksimal gambar sumber
  maxWorkDimension: 1024, // sisi terpanjang resolusi kerja (tanpa memperbesar)
  defaultThresholdPercent: 50, // ambang luminansi bawaan (persen)
  defaultMode: "gelap", // objek gelap menjadi siluet
  defaultSimplification: "sedang", // penyederhanaan titik bawaan
  defaultRepresentation: "isi", // bentuk hasil: area terisi atau garis tunggal
  defaultColor: "#0F172A", // warna isi siluet bawaan
  previewMaxWidth: 1280, // lebar maksimal PNG pratinjau
};

function resolveVectorLimits(overrides = {}) {
  const merged = { ...DEFAULT_VECTOR_LIMITS };
  for (const key of ["maxMediaBytes", "maxWorkDimension", "previewMaxWidth"]) {
    const value = Number(overrides?.[key]);
    if (Number.isFinite(value) && value > 0) merged[key] = value;
  }
  const threshold = Number(overrides?.defaultThresholdPercent);
  if (Number.isFinite(threshold) && threshold >= 1 && threshold <= 99) {
    merged.defaultThresholdPercent = threshold;
  }
  if (VECTOR_MODES.includes(overrides?.defaultMode)) {
    merged.defaultMode = overrides.defaultMode;
  }
  if (VECTOR_SIMPLIFICATIONS.includes(overrides?.defaultSimplification)) {
    merged.defaultSimplification = overrides.defaultSimplification;
  }
  if (VECTOR_REPRESENTATIONS.includes(overrides?.defaultRepresentation)) {
    merged.defaultRepresentation = overrides.defaultRepresentation;
  }
  if (isColorHex(overrides?.defaultColor)) {
    merged.defaultColor = overrides.defaultColor.toUpperCase();
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Penguraian argumen perintah
// ---------------------------------------------------------------------------

function isColorHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Mengurai argumen perintah .vector. Argumen boleh dikirim dalam urutan bebas
 * dan token terakhir menang bila ada pengulangan.
 * @param {string} text - Teks setelah perintah
 * @param {Object} limits - Batas hasil resolveVectorLimits
 * @returns {Object} { mode, thresholdPercent, simplification, representation, color, invalid }
 */
function parseVectorArgs(text, limits) {
  const settings = {
    mode: limits.defaultMode,
    thresholdPercent: limits.defaultThresholdPercent,
    simplification: limits.defaultSimplification,
    representation: limits.defaultRepresentation,
    color: limits.defaultColor,
    invalid: [],
  };
  const tokens = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (VECTOR_MODES.includes(lower)) {
      settings.mode = lower;
      continue;
    }
    if (VECTOR_SIMPLIFICATIONS.includes(lower)) {
      settings.simplification = lower;
      continue;
    }
    if (VECTOR_REPRESENTATIONS.includes(lower)) {
      settings.representation = lower;
      continue;
    }
    if (isColorHex(token)) {
      settings.color = token.toUpperCase();
      continue;
    }
    if (/^\d{1,2}$/.test(token)) {
      const value = Number(token);
      if (value >= 1 && value <= 99) {
        settings.thresholdPercent = value;
        continue;
      }
    }
    settings.invalid.push(token);
  }
  return settings;
}

/**
 * Merangkai ringkasan pengaturan untuk keterangan hasil.
 * @returns {string} Contoh: "representasi isi, mode gelap, ambang 50%, penyederhanaan sedang, warna #0F172A"
 */
function formatVectorSettings(settings) {
  return (
    "representasi " +
    settings.representation +
    ", mode " +
    settings.mode +
    ", ambang " +
    settings.thresholdPercent +
    "%, penyederhanaan " +
    settings.simplification +
    ", warna " +
    settings.color
  );
}

/**
 * Mengurai warna heksadesimal #RRGGBB menjadi komponen RGB.
 * @returns {Object|null} { r, g, b } atau null bila format tidak sah
 */
function parseHexColor(colorHex) {
  if (!isColorHex(colorHex)) return null;
  const value = Number.parseInt(colorHex.replace("#", ""), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

// ---------------------------------------------------------------------------
// Teks menu
// ---------------------------------------------------------------------------

function vectorMenuText() {
  return [
    "*VECTOR*",
    "",
    '1. ".vector" / ".vektor"',
    "   Fungsi: mengubah gambar menjadi vektor XML Alight Motion",
    "   Cara pakai: balas gambar atau stiker dengan \".vector\", atau kirim gambar dengan teks \".vector\"",
    "   Opsi: \"terang\" (objek terang), angka 1-99 (ambang), \"rendah\"/\"sedang\"/\"tinggi\" (penyederhanaan), \"#RRGGBB\" (warna), \"garis\" (garis tunggal per goresan, untuk line art)",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Templat pesan
// ---------------------------------------------------------------------------

function vectorGuideMessage(limits) {
  return [
    messageHeader("VECTOR"),
    "",
    'Kirim atau balas gambar/stiker dengan ".vector" untuk mengubahnya menjadi vektor XML Alight Motion.',
    "",
    "Opsi yang tersedia (boleh digabung, urutan bebas):",
    "",
    '1. "gelap" atau "terang" - bagian gambar yang menjadi siluet (bawaan: ' +
      limits.defaultMode +
      ")",
    "2. Angka 1-99 - ambang luminansi dalam persen (bawaan: " +
      limits.defaultThresholdPercent +
      ")",
    '3. "rendah", "sedang", atau "tinggi" - tingkat penyederhanaan titik (bawaan: ' +
      limits.defaultSimplification +
      ")",
    '4. Warna heksadesimal, contoh "#2563EB" (bawaan: ' +
      limits.defaultColor +
      ")",
    '5. "isi" atau "garis" - bentuk hasil: area terisi, atau satu garis di tengah setiap goresan untuk line art (bawaan: ' +
      limits.defaultRepresentation +
      ")",
    "",
    "Contoh: .vector terang 70 sedang #2563EB",
    "Contoh line art: .vector garis",
    "",
    'Hasil dikirim sebagai berkas "siluet.xml" (XML Alight Motion) yang dapat diimpor ke aplikasi Alight Motion.',
  ].join("\n");
}

function vectorMediaUnsupportedMessage(mediaType) {
  return [
    messageHeader("VECTOR"),
    "",
    'Berkas jenis "' + String(mediaType || "tidak diketahui") + '" tidak dapat diubah menjadi vektor.',
    "",
    "Fitur ini hanya menerima gambar dan stiker.",
    "",
    "Kirim ulang perintah dengan foto atau balas pesan gambar/stiker.",
  ].join("\n");
}

function vectorMediaTooLargeMessage(maxBytes) {
  return [
    messageHeader("VECTOR"),
    "",
    "Ukuran gambar melebihi batas maksimal " + formatBytes(maxBytes) + ".",
    "",
    "Kirim gambar yang lebih kecil, lalu coba lagi.",
  ].join("\n");
}

function vectorInvalidArgsMessage(invalidTokens) {
  const shown = invalidTokens
    .slice(0, 5)
    .map((token) => '"' + token + '"')
    .join(", ");
  return [
    messageHeader("VECTOR"),
    "",
    "Argumen tidak dikenali: " + shown + ".",
    "",
    'Gunakan "gelap"/"terang", angka 1-99, "rendah"/"sedang"/"tinggi", "isi"/"garis", atau warna "#RRGGBB".',
    "",
    "Contoh: .vector terang 70 sedang #2563EB",
  ].join("\n");
}

function vectorEmptySilhouetteMessage(settings) {
  return [
    messageHeader("VECTOR"),
    "",
    "Tidak ada bagian gambar yang lolos ambang sehingga siluet kosong.",
    "",
    "Pengaturan saat ini: " + formatVectorSettings(settings) + ".",
    "",
    'Coba ubah mode dengan "gelap"/"terang", atau sesuaikan angka ambang.',
  ].join("\n");
}

function vectorFailedMessage(reason) {
  return [
    messageHeader("VECTOR"),
    "",
    "Vektorisasi gagal: " + String(reason || "kesalahan tidak diketahui"),
    "",
    "Silakan coba lagi beberapa saat.",
  ].join("\n");
}

function vectorDoneCaption(vectorData, settings) {
  return [
    "Siluet vektor berhasil dibuat.",
    "",
    "Ukuran kerja: " + vectorData.width + " x " + vectorData.height + " piksel",
    "Komponen: " + vectorData.componentCount,
    "Kontur: " + vectorData.pathCount,
    "Titik: " + vectorData.vertexCount,
    "Pengaturan: " + formatVectorSettings(settings),
    "",
    'Berkas "siluet.xml" (XML Alight Motion) dikirim pada pesan berikutnya.',
  ].join("\n");
}

function vectorLineDoneCaption(centerlineData, settings) {
  const vertexCount = centerlineData.lines.reduce(
    (count, line) => count + line.points.length,
    0
  );
  return [
    "Garis vektor berhasil diekstraksi.",
    "",
    "Ukuran kerja: " + centerlineData.width + " x " + centerlineData.height + " piksel",
    "Garis: " + centerlineData.lines.length,
    "Titik: " + vertexCount,
    "Pengaturan: " + formatVectorSettings(settings),
    "",
    'Berkas "siluet.xml" (XML Alight Motion) dikirim pada pesan berikutnya.',
  ].join("\n");
}

function vectorLineEmptyMessage(settings) {
  return [
    messageHeader("VECTOR"),
    "",
    "Tidak ada goresan garis yang dapat diekstraksi dari gambar ini.",
    "",
    "Mode garis paling sesuai untuk line art: goresan-goresan tipis di atas latar terang.",
    "",
    "Pengaturan saat ini: " + formatVectorSettings(settings) + ".",
    "",
    'Coba gunakan "isi", atau ubah mode "gelap"/"terang" dan angka ambang agar goresan terbaca.',
  ].join("\n");
}

export {
  VECTOR_MODES,
  VECTOR_SIMPLIFICATIONS,
  VECTOR_REPRESENTATIONS,
  DEFAULT_VECTOR_LIMITS,
  resolveVectorLimits,
  parseVectorArgs,
  formatVectorSettings,
  parseHexColor,
  isColorHex,
  vectorMenuText,
  vectorGuideMessage,
  vectorMediaUnsupportedMessage,
  vectorMediaTooLargeMessage,
  vectorInvalidArgsMessage,
  vectorEmptySilhouetteMessage,
  vectorFailedMessage,
  vectorDoneCaption,
  vectorLineDoneCaption,
  vectorLineEmptyMessage,
};
