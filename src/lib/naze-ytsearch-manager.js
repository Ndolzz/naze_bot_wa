// Orkestrator Pencarian YouTube NAZE: mencari video lewat paket yt-search,
// menampilkan daftar bernomor, lalu meneruskan pilihan pengguna ke pipeline
// unduhan Sosmed Downloader (video atau MP3).

import config from "../../config.js";
import { logger } from "./naze-logger.js";
import yts from "yt-search";
import { downloadByUrl } from "./naze-sosdown-manager.js";
import { resolveDownloaderLimits } from "./naze-sosdown-utils.js";
import {
  resolveYtsearchLimits,
  validateSearchQuery,
  parseSelection,
  formatViewCount,
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
} from "./naze-ytsearch-utils.js";

// Hasil pencarian terakhir per pengirim, disimpan di memori proses dengan
// masa berlaku terbatas (atur di config.ytsearch.selectionTtlMs).
const lastSearchBySender = new Map();

function ytsearchLimits() {
  return resolveYtsearchLimits(config.ytsearch);
}

function downloaderLimiter() {
  return resolveDownloaderLimits(config.downloader);
}

function senderKey(m) {
  return String(m.sender || m.senderNumber || "anon");
}

function resolveQueryText(m) {
  const ownText = String(m.text || "").trim();
  if (ownText) return ownText;
  const quoted = m.quoted;
  if (quoted && !quoted.isMedia) {
    const quotedText = String(quoted.body || "").trim();
    if (quotedText) return quotedText;
  }
  return "";
}

function reply(m, text) {
  return m.reply(text).catch(() => null);
}

async function sendWaitMessage(m) {
  const template = config.messages?.wait || "*Memproses...* Mohon tunggu sebentar.";
  await reply(m, template);
}

/**
 * Menyimpan hasil pencarian terakhir seorang pengirim untuk dipilih nanti.
 * Dipisah sebagai fungsi tersendiri agar dapat diuji (lihat tests/ytsearch.test.js).
 */
function rememberSearch(key, entry, nowMs = Date.now()) {
  lastSearchBySender.set(key, { ...entry, savedAt: nowMs });
}

/**
 * Mengambil hasil pencarian terakhir yang masih berlaku.
 * @returns {Object|null} Entri cache atau null bila tidak ada/kedaluwarsa
 */
function recallSearch(key, nowMs = Date.now()) {
  const entry = lastSearchBySender.get(key);
  if (!entry) return null;
  const limits = ytsearchLimits();
  if (nowMs - entry.savedAt > limits.selectionTtlMs) {
    lastSearchBySender.delete(key);
    return null;
  }
  return entry;
}

/**
 * Menormalisasi entri hasil yt-search menjadi bentuk yang stabil.
 * Field yt-search dibaca secara defensif agar perubahan kecil pada paket
 * tidak langsung merusak fitur.
 */
function normalizeVideoResult(video, limits) {
  const videoId = String(video?.videoId || "").trim();
  const url =
    String(video?.url || "").trim() ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
  const seconds = Number(video?.duration?.seconds ?? video?.seconds ?? 0) || 0;
  const authorName =
    typeof video?.author?.name === "string" && video.author.name.trim()
      ? video.author.name.trim()
      : typeof video?.author === "string"
        ? video.author.trim()
        : "-";
  return {
    title: truncateTitle(video?.title || "Tanpa judul", limits.maxTitleLength),
    channel: authorName || "-",
    durationLabel: formatDurationLabel(video),
    viewsLabel: formatViewCount(video?.views),
    url,
    videoId: videoId || null,
    seconds,
  };
}

async function searchVideos(query) {
  const search = await yts({ query });
  const videos = Array.isArray(search?.videos) ? search.videos : [];
  return videos.filter((video) => video && (video.videoId || video.url));
}

async function handleSelection(m, parsed, limits) {
  const cached = recallSearch(senderKey(m));
  if (!cached) {
    await reply(m, ytsearchSelectionExpiredMessage());
    return;
  }
  if (parsed.number < 1 || parsed.number > cached.results.length) {
    await reply(m, ytsearchSelectionInvalidMessage(parsed.number, cached.results.length));
    return;
  }
  const chosen = cached.results[parsed.number - 1];
  if (!chosen.url) {
    await reply(m, ytsearchFailedMessage("tautan hasil tidak dapat dibaca"));
    return;
  }
  const downloader = downloaderLimiter();
  if (chosen.seconds > 0 && chosen.seconds > downloader.maxDurationSeconds) {
    await reply(m, ytsearchTooLongMessage(Math.round(downloader.maxDurationSeconds / 60)));
    return;
  }
  await downloadByUrl(m, chosen.url, parsed.mp3 ? "mp3" : "video");
}

async function searchYouTube(m) {
  try {
    const limits = ytsearchLimits();
    const text = resolveQueryText(m);
    const parsed = parseSelection(text);

    if (parsed.mode === "select") {
      await handleSelection(m, parsed, limits);
      return;
    }

    const validation = validateSearchQuery(parsed.query, limits.maxQueryLength);
    if (!validation.ok) {
      if (validation.reason === "too-long") {
        await reply(m, ytsearchQueryTooLongMessage(limits.maxQueryLength));
      } else {
        await reply(m, ytsearchGuideMessage());
      }
      return;
    }

    await sendWaitMessage(m);

    const videos = (await searchVideos(validation.query)).slice(0, limits.maxResults);
    if (videos.length === 0) {
      await reply(m, ytsearchNoResultsMessage(validation.query));
      return;
    }

    const results = videos.map((video) => normalizeVideoResult(video, limits));
    rememberSearch(senderKey(m), {
      results,
      query: validation.query,
    });
    await m.reply(ytsearchListMessage(results, validation.query, limits));
  } catch (error) {
    logger.error("ytsearch", "pencarian YouTube gagal: " + error.message);
    await reply(m, ytsearchFailedMessage("terjadi kesalahan saat mencari"));
  }
}

export {
  ytsearchMenuText,
  rememberSearch,
  recallSearch,
  normalizeVideoResult,
  searchYouTube,
};
