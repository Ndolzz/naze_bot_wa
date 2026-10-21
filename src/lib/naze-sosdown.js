import { resolveTikTok } from "./sosdown/tiktok.js";
import { resolveInstagram } from "./sosdown/instagram.js";
import { downloadMediaBytes } from "./sosdown/download.js";

// Orkestrator unduhan media sosial (TikTok dan Instagram).
// Resolver dipindahkan dari repositori naze-sosdown dan berjalan mandiri
// di dalam bot tanpa API resmi platform dan tanpa server tambahan.

const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i;
const TIKTOK_SHORT_HOST_PATTERN = /(^|\.)(vt|vm)\.tiktok\.com$/i;
const INSTAGRAM_HOST_PATTERN = /(^|\.)instagram\.com$/i;
const INSTAGRAM_PATH_PATTERN = /^\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
const MAX_MEDIA_PER_POST = 10;

function parseUrl(rawUrl) {
  try {
    const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * Mendeteksi platform dari sebuah tautan.
 * @returns {{platform: "tiktok"|"instagram", normalizedUrl: string} | null}
 */
export function detectSosdownPlatform(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (trimmed.length === 0) return null;

  const parsed = parseUrl(trimmed);
  if (!parsed) return null;

  const host = parsed.hostname;

  if (TIKTOK_HOST_PATTERN.test(host) || TIKTOK_SHORT_HOST_PATTERN.test(host)) {
    return { platform: "tiktok", normalizedUrl: parsed.toString() };
  }

  if (
    INSTAGRAM_HOST_PATTERN.test(host) &&
    INSTAGRAM_PATH_PATTERN.test(parsed.pathname)
  ) {
    return { platform: "instagram", normalizedUrl: parsed.toString() };
  }

  return null;
}

/**
 * Mengurai tautan TikTok atau Instagram menjadi daftar media.
 * @param {string} rawUrl - Tautan postingan.
 * @returns {Promise<{ok: true, data: Object} | {ok: false, error: {code: string, message: string}}>}
 */
export async function resolveSosdownLink(rawUrl) {
  const detected = detectSosdownPlatform(rawUrl);
  if (!detected) {
    return {
      ok: false,
      error: {
        code: "unsupported_platform",
        message:
          "Tautan tidak dikenali sebagai tautan TikTok atau Instagram.",
      },
    };
  }

  return detected.platform === "tiktok"
    ? resolveTikTok(detected.normalizedUrl)
    : resolveInstagram(detected.normalizedUrl);
}

function buildCaption(data, suffix) {
  const lines = [];
  if (data.author) lines.push("@" + String(data.author).replace(/^@/, ""));
  if (data.caption) lines.push(String(data.caption).slice(0, 800));
  if (data.sourceUrl) lines.push("Sumber: " + data.sourceUrl);
  return lines.join("\n\n").slice(0, 1000) + suffix;
}

/**
 * Mengunduh dan mengirim setiap item media hasil resolve ke chat.
 * @param {Object} m - Pesan terserialisasi.
 * @param {Object} data - Hasil resolve ({platform, type, items, author, caption, sourceUrl}).
 * @param {Object[]} items - Item terpilih untuk dikirim.
 * @returns {Promise<number>} Jumlah media yang berhasil dikirim.
 * @throws {Error} Bila satu item gagal diunduh atau dikirim.
 */
export async function sendSosdownMedia(m, data, items) {
  const selected = (items || []).slice(0, MAX_MEDIA_PER_POST);
  if (selected.length === 0) {
    throw new Error("Tidak ada media yang dapat dikirim dari tautan ini.");
  }

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const media = await downloadMediaBytes(item.url, data.platform, data.sourceUrl);
    if (!media.ok) {
      throw new Error(media.message);
    }

    const suffix = selected.length > 1 ? `\n(${i + 1}/${selected.length})` : "";
    const caption = buildCaption(data, suffix);

    if (item.mimeType.startsWith("video/")) {
      await m.replyVideo(media.buffer, caption);
    } else {
      await m.replyImage(media.buffer, caption);
    }
  }

  return selected.length;
}
