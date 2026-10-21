import yts from "yt-search";
import { yt } from "@vreden/youtube_scraper";
import axios from "axios";

// Downloader YouTube: mencari video lewat kata kunci (yt-search) bila
// masukan bukan tautan, lalu mengambil tautan unduhan melalui
// @vreden/youtube_scraper dan mengunduhnya dengan axios.
// Batas ukuran menjaga agar berkas tetap aman dikirim sebagai pesan WhatsApp.

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120000;
const YOUTUBE_URL_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/i;

function isYoutubeUrl(text) {
  return YOUTUBE_URL_PATTERN.test(text);
}

async function resolveTarget(text) {
  const input = (text || "").trim();
  if (!input) {
    throw new Error("Berikan tautan YouTube atau kata kunci pencarian.");
  }
  if (isYoutubeUrl(input)) {
    return { url: input, title: null };
  }
  const result = await yts(input);
  const first = (result?.videos || [])[0];
  if (!first?.url) {
    throw new Error("Tidak ditemukan video untuk: " + input);
  }
  return { url: first.url, title: first.title };
}

async function downloadByUrl(url, fetcher, quality, defaultQuality) {
  const parsed = Number.parseInt(String(quality).trim(), 10);
  const effectiveQuality =
    Number.isFinite(parsed) && parsed > 0 ? parsed : defaultQuality;
  const data = await fetcher(url, effectiveQuality);
  if (!data?.status || !data?.download?.url) {
    throw new Error(
      "Tautan unduhan tidak tersedia untuk video ini. Coba kualitas lain.",
    );
  }

  const response = await axios.get(data.download.url, {
    responseType: "arraybuffer",
    maxContentLength: MAX_FILE_BYTES,
    timeout: DOWNLOAD_TIMEOUT_MS,
  });
  const buffer = Buffer.from(response.data);
  if (!buffer.length) {
    throw new Error("Berkas unduhan kosong.");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("Ukuran berkas melebihi batas 64 MB.");
  }
  return {
    buffer,
    title: data?.metadata?.title || null,
    quality: data?.download?.quality || null,
  };
}

/**
 * Mengunduh audio (MP3) dari YouTube.
 * @param {string} text - Tautan YouTube atau kata kunci pencarian.
 * @param {string} quality - Kualitas audio: 92, 128, 256, atau 320 kbps.
 * @returns {Promise<{buffer: Buffer, title: string|null, quality: string|null, queryTitle: string|null}>}
 */
export async function downloadYoutubeAudio(text, quality = "128") {
  const target = await resolveTarget(text);
  const result = await downloadByUrl(
    target.url,
    (url, q) => yt.ytmp3(url, q),
    quality,
    128,
  );
  return { ...result, queryTitle: target.title };
}

/**
 * Mengunduh video (MP4) dari YouTube.
 * @param {string} text - Tautan YouTube atau kata kunci pencarian.
 * @param {string} quality - Kualitas video: 144, 360, 480, 720, atau 1080.
 * @returns {Promise<{buffer: Buffer, title: string|null, quality: string|null, queryTitle: string|null}>}
 */
export async function downloadYoutubeVideo(text, quality = "360") {
  const target = await resolveTarget(text);
  const result = await downloadByUrl(
    target.url,
    (url, q) => yt.ytmp4(url, q),
    quality,
    360,
  );
  return { ...result, queryTitle: target.title };
}
