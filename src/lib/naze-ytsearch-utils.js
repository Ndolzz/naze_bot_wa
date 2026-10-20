// Utilitas murni Pencarian YouTube NAZE: validasi kueri, penguraian pilihan
// hasil, pemformatan daftar, templat pesan, dan teks menu.
// Modul ini hanya mengimpor modul murni lain agar logika intinya dapat
// diuji secara terisolasi (lihat tests/ytsearch.test.js).

import { messageHeader } from "./naze-file-utils.js";

// ---------------------------------------------------------------------------
// Batas bawaan
// ---------------------------------------------------------------------------

const DEFAULT_YTSEARCH_LIMITS = {
  maxResults: 8, // jumlah hasil maksimal per pencarian
  maxQueryLength: 100, // panjang kueri maksimal
  selectionTtlMs: 600000, // 10 menit masa berlaku pilihan hasil
  maxTitleLength: 70, // panjang judul pada daftar hasil
};

function resolveYtsearchLimits(overrides = {}) {
  const merged = { ...DEFAULT_YTSEARCH_LIMITS };
  for (const key of Object.keys(DEFAULT_YTSEARCH_LIMITS)) {
    const value = Number(overrides?.[key]);
    if (Number.isFinite(value) && value > 0) merged[key] = value;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Validasi kueri dan penguraian pilihan hasil
// ---------------------------------------------------------------------------

/**
 * Memvalidasi teks kueri pencarian.
 * @param {string} text - Teks mentah dari pesan
 * @param {number} maxQueryLength - Panjang maksimal kueri
 * @returns {Object} { ok, reason: "empty"|"too-long"|null, query }
 */
function validateSearchQuery(text, maxQueryLength) {
  const query = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!query) return { ok: false, reason: "empty", query: "" };
  if (query.length > maxQueryLength) {
    return { ok: false, reason: "too-long", query };
  }
  return { ok: true, reason: null, query };
}

/**
 * Membedakan teks kueri pencarian dengan pilihan hasil lewat nomor.
 * ".ytsearch 3" dan ".ytsearch 3 mp3" memilih hasil; teks lain dianggap
 * kueri pencarian.
 * @param {string} text - Teks setelah perintah
 * @returns {Object} { mode: "select"|"search", number, mp3, query }
 */
function parseSelection(text) {
  const raw = String(text ?? "").trim();
  const match = raw.match(/^(\d{1,3})(\s+mp3)$/i);
  if (match) {
    return { mode: "select", number: Number(match[1]), mp3: true, query: "" };
  }
  if (/^\d{1,3}$/.test(raw)) {
    return { mode: "select", number: Number(raw), mp3: false, query: "" };
  }
  return { mode: "search", number: null, mp3: false, query: raw };
}

// ---------------------------------------------------------------------------
// Pemformatan hasil
// ---------------------------------------------------------------------------

/**
 * Meringkas jumlah tayangan dalam singkatan Indonesia.
 * Contoh: 38878009 -> "38,9 jt", 880000 -> "880 rb", 1200000000 -> "1,2 M".
 */
function formatViewCount(views) {
  const value = Number(views);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1000) return String(value);

  const compact = (divisor, suffix) => {
    const scaled = value / divisor;
    const text = scaled >= 100 ? String(Math.round(scaled)) : scaled.toFixed(1);
    return text.replace(/\.0$/, "").replace(".", ",") + " " + suffix;
  };

  if (value >= 1e9) return compact(1e9, "M");
  if (value >= 1e6) return compact(1e6, "jt");
  return compact(1e3, "rb");
}

/**
 * Memformat durasi dalam detik menjadi "M:SS" atau "H:MM:SS".
 */
function formatDurationSeconds(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Memilih label durasi dari entri hasil yt-search: label bawaan platform
 * dipakai bila ada, jika tidak durasi dihitung dari detik.
 */
function formatDurationLabel(video) {
  const timestamp = String(video?.timestamp || video?.duration?.timestamp || "").trim();
  if (timestamp) return timestamp;
  const seconds = Number(video?.duration?.seconds ?? video?.seconds ?? 0);
  if (seconds > 0) return formatDurationSeconds(seconds);
  return "-";
}

/**
 * Memotong judul yang terlalu panjang untuk daftar hasil.
 */
function truncateTitle(title, maxTitleLength) {
  const text = String(title ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxTitleLength) return text;
  return text.slice(0, maxTitleLength - 3).trimEnd() + "...";
}

// ---------------------------------------------------------------------------
// Teks menu Pencarian YouTube
// ---------------------------------------------------------------------------

function ytsearchMenuText() {
  return [
    "*YOUTUBE SEARCH*",
    "",
    '1. ".ytsearch"',
    "   Fungsi: mencari video YouTube lalu mengunduhnya",
    '2. ".yts"',
    '   Fungsi: alias dari ".ytsearch"',
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Templat pesan
// ---------------------------------------------------------------------------

function ytsearchGuideMessage() {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    "Kirim \".ytsearch\" diikuti kata kunci, atau balas pesan teks dengan \".ytsearch\".",
    "",
    'Untuk mengunduh salah satu hasil, kirim ".ytsearch <nomor>"',
    'atau ".ytsearch <nomor> mp3" untuk audionya.',
  ].join("\n");
}

function ytsearchQueryTooLongMessage(maxQueryLength) {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    `Kata kunci melebihi batas ${maxQueryLength} karakter.`,
    "",
    "Gunakan kata kunci yang lebih pendek.",
  ].join("\n");
}

function ytsearchNoResultsMessage(query) {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    `Tidak ada hasil untuk "${query}".`,
    "",
    "Coba kata kunci lain.",
  ].join("\n");
}

function ytsearchFailedMessage(reason) {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    `Pencarian gagal: ${reason}`,
    "",
    "Silakan coba lagi beberapa saat.",
  ].join("\n");
}

function ytsearchSelectionInvalidMessage(number, maxResults) {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    `Pilihan ${number} tidak ada pada daftar hasil terakhir.`,
    "",
    `Pilih nomor 1 sampai ${maxResults}, atau cari ulang dengan ".ytsearch <kata kunci>".`,
  ].join("\n");
}

function ytsearchSelectionExpiredMessage() {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    "Daftar hasil terakhir sudah kedaluwarsa.",
    "",
    'Cari ulang dengan ".ytsearch <kata kunci>" lalu pilih nomornya.',
  ].join("\n");
}

function ytsearchTooLongMessage(maxDurationMinutes) {
  return [
    messageHeader("YOUTUBE SEARCH"),
    "",
    `Durasi video melebihi batas maksimal ${maxDurationMinutes} menit.`,
    "",
    "Pilih video yang lebih pendek.",
  ].join("\n");
}

/**
 * Menyusun daftar hasil pencarian bernomor beserta panduan pilihan.
 * @param {Array<Object>} results - Hasil ternormalisasi
 * @param {string} query - Kata kunci pencarian
 * @param {Object} limits - Batas ytsearch
 * @returns {string} Isi pesan daftar hasil
 */
function ytsearchListMessage(results, query, limits) {
  const lines = [
    messageHeader("YOUTUBE SEARCH"),
    "",
    `Hasil untuk "${query}":`,
    "",
  ];
  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(
      `   ${result.channel} | ${result.durationLabel} | ${result.viewsLabel} tayangan`,
    );
    lines.push(`   ${result.url}`);
  });
  lines.push("");
  lines.push(
    `Kirim ".ytsearch <nomor>" untuk mengunduh video, atau ".ytsearch <nomor> mp3" untuk audionya.`,
  );
  lines.push(`Pilihan berlaku ${Math.round(limits.selectionTtlMs / 60000)} menit.`);
  return lines.join("\n");
}

export {
  DEFAULT_YTSEARCH_LIMITS,
  resolveYtsearchLimits,
  validateSearchQuery,
  parseSelection,
  formatViewCount,
  formatDurationSeconds,
  formatDurationLabel,
  truncateTitle,
  ytsearchMenuText,
  ytsearchGuideMessage,
  ytsearchQueryTooLongMessage,
  ytsearchNoResultsMessage,
  ytsearchFailedMessage,
  ytsearchSelectionInvalidMessage,
  ytsearchSelectionExpiredMessage,
  ytsearchTooLongMessage,
  ytsearchListMessage,
};
