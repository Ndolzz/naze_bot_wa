// Utilitas murni Sosmed Downloader NAZE: deteksi platform dari tautan,
// batas unduhan, pemilihan varian media, penyusun opsi ffmpeg MP3,
// templat pesan, dan teks menu.
// Modul ini hanya mengimpor modul murni lain agar logika intinya dapat
// diuji secara terisolasi (lihat tests/sosdown.test.js).

import { messageHeader } from "./naze-file-utils.js";

// ---------------------------------------------------------------------------
// Batas bawaan
// ---------------------------------------------------------------------------

const DEFAULT_DOWNLOADER_LIMITS = {
  maxMediaBytes: 100 * 1024 * 1024, // 100 MB media maksimal yang diunduh
  maxDurationSeconds: 1800, // 30 menit durasi video sumber
  maxPhotosPerPost: 5, // foto maksimal per postingan foto/carousel
  mediaMessageMaxBytes: 64 * 1024 * 1024, // 64 MB batas kirim sebagai pesan media
  requestTimeoutMs: 30000, // batas waktu permintaan ke platform
  mp3BitrateKbps: 192, // bitrate MP3 bawaan
  mp3MinBitrateKbps: 128, // bitrate percobaan ulang bila hasil terlalu besar
  mp3MaxBytes: 50 * 1024 * 1024, // 50 MB ukuran maksimal hasil MP3
  audioMessageMaxBytes: 16 * 1024 * 1024, // 16 MB batas kirim sebagai pesan audio
};

function resolveDownloaderLimits(overrides = {}) {
  const merged = { ...DEFAULT_DOWNLOADER_LIMITS };
  for (const key of Object.keys(DEFAULT_DOWNLOADER_LIMITS)) {
    const value = Number(overrides?.[key]);
    if (Number.isFinite(value) && value > 0) merged[key] = value;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Deteksi platform (dipindahkan dari naze-sosdown lib/resolvers/detect-platform.ts)
// ---------------------------------------------------------------------------

const PLATFORMS = ["tiktok", "instagram", "youtube"];

const PLATFORM_LABELS = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i;
const TIKTOK_SHORT_HOST_PATTERN = /(^|\.)(vt|vm)\.tiktok\.com$/i;
const INSTAGRAM_HOST_PATTERN = /(^|\.)instagram\.com$/i;
const INSTAGRAM_PATH_PATTERN = /^\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$/i;
const YOUTUBE_SHORT_HOST_PATTERN = /^youtu\.be$/i;
const YOUTUBE_PATH_PATTERN = /^\/(shorts|embed|live|v)\/[A-Za-z0-9_-]{5,}/;

function parseUrl(rawUrl) {
  try {
    const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

// Tautan YouTube valid bila membawa parameter v (halaman watch) atau berada
// pada jalur shorts/embed/live yang memuat id video.
function isYouTubeContentUrl(parsed) {
  if (parsed.searchParams.has("v")) return true;
  return YOUTUBE_PATH_PATTERN.test(parsed.pathname);
}

function detectPlatform(rawUrl) {
  const trimmed = String(rawUrl ?? "").trim();
  if (trimmed.length === 0) return null;

  const parsed = parseUrl(trimmed);
  if (!parsed) return null;

  const host = parsed.hostname;

  if (TIKTOK_HOST_PATTERN.test(host) || TIKTOK_SHORT_HOST_PATTERN.test(host)) {
    return { platform: "tiktok", normalizedUrl: parsed.toString() };
  }

  if (INSTAGRAM_HOST_PATTERN.test(host) && INSTAGRAM_PATH_PATTERN.test(parsed.pathname)) {
    return { platform: "instagram", normalizedUrl: parsed.toString() };
  }

  if (
    YOUTUBE_SHORT_HOST_PATTERN.test(host) ||
    (YOUTUBE_HOST_PATTERN.test(host) && isYouTubeContentUrl(parsed))
  ) {
    return { platform: "youtube", normalizedUrl: parsed.toString() };
  }

  return null;
}

/**
 * Mencari tautan sosmed pertama yang dikenali di dalam sebuah teks.
 * Teks perintah boleh memuat teks lain di sekeliling tautan.
 * @param {string} text - Teks pesan
 * @returns {Object|null} Hasil deteksi (platform, normalizedUrl) atau null
 */
function findSosmedLink(text) {
  for (const token of String(text ?? "").split(/\s+/)) {
    const candidate = token.replace(/^[<(\["']+|[>)\]"',.]+$/g, "");
    if (!candidate) continue;
    const detected = detectPlatform(candidate);
    if (detected) return detected;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pemilihan varian media
// ---------------------------------------------------------------------------

/**
 * Memilih item unduhan terbaik: tanpa watermark, berlabel hd, paling awal.
 * @param {Array<Object>} items - Daftar item hasil resolver
 * @returns {Object|null} Item terpilih atau null
 */
function choosePreferredItem(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const item of list) {
    let score = 0;
    if (!item.hasWatermark) score += 2;
    if (item.label === "hd") score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

/**
 * Memilih sumber audio untuk konversi MP3: trek audio terpisah bila ada,
 * atau varian video terbaik untuk platform tanpa trek audio terpisah.
 * @param {Object} data - Hasil resolver
 * @returns {Object|null} Item sumber audio
 */
function chooseAudioSource(data) {
  if (!data) return null;
  if (data.audio) return data.audio;
  return choosePreferredItem(data.items);
}

// ---------------------------------------------------------------------------
// Penyusun opsi ffmpeg untuk MP3
// ---------------------------------------------------------------------------

/**
 * Menyusun opsi output ffmpeg untuk konversi MP3 dengan metadata ID3v2.3.
 * @param {Object} options
 * @param {number} options.bitrateKbps - Bitrate target dalam kbps
 * @param {boolean} [options.withCover] - Tambahkan sampul sebagai attached picture
 * @param {string} [options.title] - Judul untuk tag ID3
 * @param {string} [options.artist] - Penulis untuk tag ID3
 * @returns {string[]} Daftar opsi output ffmpeg
 */
function buildMp3OutputOptions(options = {}) {
  const bitrate = Math.max(32, Math.round(Number(options.bitrateKbps) || 192));
  const args = [];

  if (options.withCover) {
    // Sampul disertakan sebagai attached picture; peta audio dari input
    // pertama dan gambar dari input kedua.
    args.push("-map", "0:a", "-map", "1:v");
    args.push("-c:v", "copy", "-disposition:v", "attached_pic");
    args.push("-metadata:s:v", "title=Album cover");
    args.push("-metadata:s:v", "comment=Cover (front)");
  } else {
    args.push("-vn");
  }

  args.push(
    "-c:a", "libmp3lame",
    "-b:a", `${bitrate}k`,
    "-id3v2_version", "3",
    "-write_id3v1", "1",
  );

  if (options.title) args.push("-metadata", `title=${options.title}`);
  if (options.artist) args.push("-metadata", `artist=${options.artist}`);

  return args;
}

// Ekstensi berkas sementara berdasarkan MIME type item.
const MIME_EXTENSIONS = {
  "video/mp4": ".mp4",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/webm": ".webm",
  "video/webm": ".webm",
};

function extensionForMime(mimeType) {
  const base = String(mimeType || "").split(";")[0].trim().toLowerCase();
  return MIME_EXTENSIONS[base] || ".bin";
}

// ---------------------------------------------------------------------------
// Teks menu Sosmed Downloader
// ---------------------------------------------------------------------------

function sosmedDownloaderMenuText() {
  return [
    "*SOSMED DOWNLOADER*",
    "",
    '1. ".tiktok"',
    "   Fungsi: mengunduh video atau foto TikTok",
    '2. ".instagram"',
    "   Fungsi: mengunduh video, foto, atau carousel Instagram",
    '3. ".ig"',
    "   Fungsi: alias dari \".instagram\"",
    '4. ".youtube"',
    "   Fungsi: mengunduh video YouTube",
    '5. ".yt"',
    "   Fungsi: alias dari \".youtube\"",
    '6. ".mp3"',
    "   Fungsi: mengunduh audio TikTok, Instagram, atau YouTube sebagai MP3",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Templat pesan
// ---------------------------------------------------------------------------

function downloaderGuideMessage(command) {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    "Tautan tidak ditemukan.",
    "",
    `Kirim "${command}" diikuti tautannya, atau balas pesan berisi tautan dengan "${command}".`,
    "",
    "Platform yang didukung: TikTok, Instagram, YouTube.",
  ].join("\n");
}

function platformMismatchMessage(command, platformLabel, suggestedCommand) {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Tautan ini adalah tautan ${platformLabel}.`,
    "",
    `Gunakan "${suggestedCommand}" untuk mengunduhnya, atau kirim "${command}" dengan tautan yang sesuai.`,
  ].join("\n");
}

function unsupportedLinkMessage() {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    "Tautan tidak dikenali atau platformnya belum didukung.",
    "",
    "Platform yang didukung: TikTok, Instagram, YouTube.",
  ].join("\n");
}

function resolverFailedMessage(reason) {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Konten tidak dapat diambil: ${reason}`,
    "",
    "Periksa tautan lalu coba lagi. Jika masalah berlanjut, kemungkinan struktur platform berubah.",
  ].join("\n");
}

function mediaTooLargeMessage(maxBytes) {
  const mb = Math.round(maxBytes / (1024 * 1024));
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Ukuran media melebihi batas maksimal ${mb} MB.`,
    "",
    "Gunakan konten dengan ukuran lebih kecil.",
  ].join("\n");
}

function durationTooLongMessage(maxSeconds) {
  const minutes = Math.round(maxSeconds / 60);
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Durasi video melebihi batas maksimal ${minutes} menit.`,
    "",
    "Gunakan video yang lebih pendek.",
  ].join("\n");
}

function downloadFailedMessage() {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    "Media gagal diunduh dari server platform.",
    "",
    "Silakan coba lagi beberapa saat.",
  ].join("\n");
}

function mp3TooLargeMessage(maxBytes) {
  const mb = Math.round(maxBytes / (1024 * 1024));
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Hasil MP3 melebihi batas ${mb} MB meskipun sudah dikompresi ulang.`,
    "",
    "Gunakan video yang lebih pendek.",
  ].join("\n");
}

function mp3FailedMessage(reason) {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Konversi MP3 gagal: ${reason}`,
    "",
    "Silakan coba lagi. Jika masalah berlanjut, pastikan ffmpeg tersedia di server.",
  ].join("\n");
}

function photosPartialMessage(sentCount, totalCount) {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `${sentCount} dari ${totalCount} foto berhasil dikirim; sisanya gagal diunduh.`,
  ].join("\n");
}

function photosLimitMessage(limit) {
  return [
    messageHeader("SOSMED DOWNLOADER"),
    "",
    `Postingan ini memuat lebih banyak foto; hanya ${limit} foto pertama yang dikirim.`,
  ].join("\n");
}

function resultCaption(data, options = {}) {
  const lines = [];
  if (data.caption) lines.push(data.caption);
  if (data.author) lines.push(`@${data.author}`);
  if (options.quality) lines.push(`Kualitas: ${options.quality}`);
  if (options.formatLabel) lines.push(options.formatLabel);
  lines.push(`Sumber: ${data.sourceUrl}`);
  return lines.join("\n");
}

export {
  PLATFORMS,
  PLATFORM_LABELS,
  DEFAULT_DOWNLOADER_LIMITS,
  resolveDownloaderLimits,
  detectPlatform,
  findSosmedLink,
  choosePreferredItem,
  chooseAudioSource,
  buildMp3OutputOptions,
  extensionForMime,
  sosmedDownloaderMenuText,
  downloaderGuideMessage,
  platformMismatchMessage,
  unsupportedLinkMessage,
  resolverFailedMessage,
  mediaTooLargeMessage,
  durationTooLongMessage,
  downloadFailedMessage,
  mp3TooLargeMessage,
  mp3FailedMessage,
  photosPartialMessage,
  photosLimitMessage,
  resultCaption,
};
