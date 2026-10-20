// Orkestrator Sosmed Downloader NAZE: pengunduhan video/foto TikTok,
// Instagram, dan YouTube, serta konversi audio menjadi MP3 di sisi server.

import fs from "fs";
import path from "path";
import config from "../../config.js";
import { logger } from "./naze-logger.js";
import { sanitizeFileName } from "./naze-file-utils.js";
import { ffmpeg, getTempDir } from "./naze-exif.js";
import {
  resolveSosmedUrl,
  downloadMediaItem,
} from "./naze-sosdown-resolvers.js";
import {
  PLATFORM_LABELS,
  resolveDownloaderLimits,
  findSosmedLink,
  choosePreferredItem,
  chooseAudioSource,
  buildMp3OutputOptions,
  sosmedDownloaderMenuText,
  downloaderGuideMessage,
  platformMismatchMessage,
  resolverFailedMessage,
  mediaTooLargeMessage,
  durationTooLongMessage,
  downloadFailedMessage,
  mp3TooLargeMessage,
  mp3FailedMessage,
  resultCaption,
  photosLimitMessage,
  photosPartialMessage,
} from "./naze-sosdown-utils.js";

const COMMANDS_BY_PLATFORM = {
  tiktok: ".tiktok",
  instagram: ".instagram",
  youtube: ".youtube",
};

function downloaderLimits() {
  return resolveDownloaderLimits(config.downloader);
}

function resolveLinkText(m) {
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

function tempStamp() {
  return Date.now() + "_" + Math.random().toString(16).slice(2, 8);
}

function cleanupFiles(paths) {
  for (const filePath of paths) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Konversi MP3 (ffmpeg di sisi server, menggantikan konversi peramban
// pada aplikasi web naze-sosdown yang tidak memiliki ffmpeg)
// ---------------------------------------------------------------------------

/**
 * Mengonversi berkas audio/video menjadi MP3 dengan metadata ID3.
 * @param {string} inputPath - Berkas sumber (m4a, webm, atau mp4)
 * @param {string} outputPath - Berkas MP3 hasil
 * @param {Object} [options]
 * @returns {Promise<Buffer>} Isi berkas MP3 hasil
 */
function convertToMp3File(inputPath, outputPath, options = {}) {
  const outputOptions = buildMp3OutputOptions({
    bitrateKbps: options.bitrateKbps,
    withCover: Boolean(options.coverPath),
    title: options.title,
    artist: options.artist,
  });

  let command = ffmpeg(inputPath);
  if (options.coverPath) {
    command = command.input(options.coverPath);
  }

  return new Promise((resolve, reject) => {
    command
      .outputOptions(outputOptions)
      .toFormat("mp3")
      .on("end", () => {
        try {
          resolve(fs.readFileSync(outputPath));
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => reject(error))
      .save(outputPath);
  });
}

async function downloadCover(url, timeoutMs) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/jpeg,image/png,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    // ffmpeg menempelkan sampul tanpa transkode (-c:v copy), sehingga hanya
    // gambar JPEG dan PNG yang didukung sebagai attached picture.
    if (contentType !== "image/jpeg" && contentType !== "image/png") return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;

    return { buffer, extension: contentType === "image/png" ? ".png" : ".jpg" };
  } catch {
    return null;
  }
}

async function reportDownloadFailure(m, result, limits) {
  if (result.reason === "too-large") {
    await reply(m, mediaTooLargeMessage(limits.maxMediaBytes));
  } else {
    logger.error(
      "sosdown",
      "gagal mengunduh media: " +
        (result.error?.message || result.reason || result.status || "tidak diketahui"),
    );
    await reply(m, downloadFailedMessage());
  }
}

// ---------------------------------------------------------------------------
// Pengunduhan video/foto per platform
// ---------------------------------------------------------------------------

async function sendVideoResult(m, downloaded, data, item, limits) {
  const caption = resultCaption(data, {
    quality: item.quality,
    formatLabel: `Ukuran: ${Math.round(downloaded.buffer.length / (1024 * 1024))} MB`,
  });
  const fileName =
    (sanitizeFileName(data.caption || data.author || "video").slice(0, 60) ||
      "video") + downloaded.extension;

  if (downloaded.buffer.length <= limits.mediaMessageMaxBytes) {
    await m.replyVideo(downloaded.buffer, caption);
  } else {
    await m.replyDocument(downloaded.buffer, fileName, downloaded.mimeType);
  }
}

async function sendPhotoResults(m, data, limits) {
  const items = data.items.slice(0, limits.maxPhotosPerPost);
  const caption = resultCaption(data, {});

  let sentCount = 0;
  let failedCount = 0;
  for (const item of items) {
    const downloaded = await downloadMediaItem(item, {
      platform: data.platform,
      maxBytes: limits.maxMediaBytes,
      timeoutMs: limits.requestTimeoutMs,
    });
    if (!downloaded.ok) {
      failedCount++;
      continue;
    }
    await m.replyImage(downloaded.buffer, sentCount === 0 ? caption : "");
    sentCount++;
  }

  if (sentCount === 0) {
    await reportDownloadFailure(m, { reason: "network" }, limits);
    return;
  }
  if (failedCount > 0) {
    await reply(m, photosPartialMessage(sentCount, items.length));
  }
  if (data.items.length > items.length) {
    await reply(m, photosLimitMessage(items.length));
  }
}

/**
 * Menjalankan pipeline unduhan video/foto dari URL yang sudah divalidasi.
 * Dipakai bersama oleh perintah .tiktok/.instagram/.youtube dan oleh
 * fitur lain yang sudah memiliki URL (mis. Pencarian YouTube).
 */
async function performSosmedDownload(m, url, limits) {
  await sendWaitMessage(m);

  const resolved = await resolveSosmedUrl(url, {
    timeoutMs: limits.requestTimeoutMs,
  });
  if (!resolved.ok) {
    await reply(m, resolverFailedMessage(resolved.error.message));
    return;
  }

  const data = resolved.data;
  if (data.durationSeconds && data.durationSeconds > limits.maxDurationSeconds) {
    await reply(m, durationTooLongMessage(limits.maxDurationSeconds));
    return;
  }

  if (data.type === "video") {
    const item = choosePreferredItem(data.items);
    if (!item) {
      await reply(m, resolverFailedMessage("varian video tidak ditemukan"));
      return;
    }
    const downloaded = await downloadMediaItem(item, {
      platform: data.platform,
      maxBytes: limits.maxMediaBytes,
      timeoutMs: limits.requestTimeoutMs,
    });
    if (!downloaded.ok) {
      await reportDownloadFailure(m, downloaded, limits);
      return;
    }
    await sendVideoResult(m, downloaded, data, item, limits);
    return;
  }

  await sendPhotoResults(m, data, limits);
}

/**
 * Menjalankan pipeline MP3 dari URL yang sudah divalidasi.
 * Berkas sementara selalu dibersihkan bila terjadi kegagalan.
 */
async function performMp3Download(m, url, limits) {
  const tempFiles = [];
  try {
    await sendWaitMessage(m);

    const resolved = await resolveSosmedUrl(url, {
      timeoutMs: limits.requestTimeoutMs,
    });
    if (!resolved.ok) {
      await reply(m, resolverFailedMessage(resolved.error.message));
      return;
    }

    const data = resolved.data;
    const source = chooseAudioSource(data);
    if (!source) {
      await reply(m, resolverFailedMessage("sumber audio tidak ditemukan"));
      return;
    }
    if (String(source.mimeType || "").startsWith("image/")) {
      await reply(m, resolverFailedMessage("konten foto tidak memiliki audio"));
      return;
    }
    if (data.durationSeconds && data.durationSeconds > limits.maxDurationSeconds) {
      await reply(m, durationTooLongMessage(limits.maxDurationSeconds));
      return;
    }

    const downloaded = await downloadMediaItem(source, {
      platform: data.platform,
      maxBytes: limits.maxMediaBytes,
      timeoutMs: limits.requestTimeoutMs,
    });
    if (!downloaded.ok) {
      await reportDownloadFailure(m, downloaded, limits);
      return;
    }

    const tmpDir = getTempDir();
    const stamp = tempStamp();
    const inputPath = path.join(tmpDir, `sosmp3_${stamp}${downloaded.extension}`);
    fs.writeFileSync(inputPath, downloaded.buffer);
    tempFiles.push(inputPath);

    let coverPath = null;
    const coverUrl = source.thumbnailUrl || data.items?.[0]?.thumbnailUrl;
    const cover = await downloadCover(coverUrl, limits.requestTimeoutMs);
    if (cover) {
      coverPath = path.join(tmpDir, `sosmp3_${stamp}_cover${cover.extension}`);
      fs.writeFileSync(coverPath, cover.buffer);
      tempFiles.push(coverPath);
    }

    const conversionOptions = {
      coverPath,
      title: data.caption || undefined,
      artist: data.author || undefined,
    };

    let outputPath = path.join(tmpDir, `sosmp3_${stamp}.mp3`);
    tempFiles.push(outputPath);
    let mp3 = await convertToMp3File(inputPath, outputPath, {
      bitrateKbps: limits.mp3BitrateKbps,
      ...conversionOptions,
    });

    // Percobaan ulang sekali dengan bitrate lebih rendah bila hasil melebihi
    // batas ukuran (mengikuti pola kompresi ulang pada Sticker Studio).
    if (
      mp3.length > limits.mp3MaxBytes &&
      limits.mp3MinBitrateKbps < limits.mp3BitrateKbps
    ) {
      const retryPath = path.join(tmpDir, `sosmp3_${stamp}_r.mp3`);
      tempFiles.push(retryPath);
      mp3 = await convertToMp3File(inputPath, retryPath, {
        bitrateKbps: limits.mp3MinBitrateKbps,
        ...conversionOptions,
      });
    }

    if (mp3.length > limits.mp3MaxBytes) {
      await reply(m, mp3TooLargeMessage(limits.mp3MaxBytes));
      return;
    }

    const fileName =
      (sanitizeFileName(data.caption || data.author || "audio").slice(0, 60) ||
        "audio") + ".mp3";
    if (mp3.length <= limits.audioMessageMaxBytes) {
      await m.replyAudio(mp3, false);
    } else {
      await m.replyDocument(mp3, fileName, "audio/mpeg");
    }
  } finally {
    cleanupFiles(tempFiles);
  }
}

async function downloadSosmed(m, platform, command) {
  try {
    const limits = downloaderLimits();
    const link = findSosmedLink(resolveLinkText(m));
    if (!link) {
      await reply(m, downloaderGuideMessage(command));
      return;
    }
    if (link.platform !== platform) {
      await reply(
        m,
        platformMismatchMessage(
          command,
          PLATFORM_LABELS[link.platform],
          COMMANDS_BY_PLATFORM[link.platform],
        ),
      );
      return;
    }
    await performSosmedDownload(m, link.normalizedUrl, limits);
  } catch (error) {
    logger.error("sosdown", `gagal mengunduh ${platform}: ` + error.message);
    await reply(m, downloadFailedMessage());
  }
}

// ---------------------------------------------------------------------------
// Pengunduhan MP3 lintas platform
// ---------------------------------------------------------------------------

async function downloadMp3(m) {
  try {
    const limits = downloaderLimits();
    const link = findSosmedLink(resolveLinkText(m));
    if (!link) {
      await reply(m, downloaderGuideMessage(".mp3"));
      return;
    }
    await performMp3Download(m, link.normalizedUrl, limits);
  } catch (error) {
    logger.error("sosdown", "gagal membuat MP3: " + error.message);
    await reply(m, mp3FailedMessage("terjadi kesalahan saat memproses audio"));
  }
}

// ---------------------------------------------------------------------------
// Unduhan dari URL langsung (dipakai Pencarian YouTube)
// ---------------------------------------------------------------------------

/**
 * Mengunduh media dari URL sosmed yang sudah diketahui tanpa membaca teks
 * pesan. Dipakai fitur lain (mis. .ytsearch) yang sudah memiliki URL.
 * @param {Object} m - Pesan WhatsApp
 * @param {string} url - URL konten TikTok/Instagram/YouTube
 * @param {"video"|"mp3"} intent - Jenis hasil yang diinginkan
 */
async function downloadByUrl(m, url, intent) {
  const isMp3 = intent === "mp3";
  try {
    const limits = downloaderLimits();
    const link = findSosmedLink(String(url || ""));
    if (!link) {
      await reply(m, resolverFailedMessage("tautan tidak dikenali"));
      return;
    }
    if (isMp3) {
      await performMp3Download(m, link.normalizedUrl, limits);
    } else {
      await performSosmedDownload(m, link.normalizedUrl, limits);
    }
  } catch (error) {
    logger.error("sosdown", "gagal mengunduh dari URL: " + error.message);
    await reply(
      m,
      isMp3
        ? mp3FailedMessage("terjadi kesalahan saat memproses audio")
        : downloadFailedMessage(),
    );
  }
}

// ---------------------------------------------------------------------------
// Titik masuk perintah
// ---------------------------------------------------------------------------

async function downloadTikTok(m) {
  await downloadSosmed(m, "tiktok", ".tiktok");
}

async function downloadInstagram(m) {
  await downloadSosmed(m, "instagram", ".instagram");
}

async function downloadYouTube(m) {
  await downloadSosmed(m, "youtube", ".youtube");
}

export {
  sosmedDownloaderMenuText,
  convertToMp3File,
  downloadTikTok,
  downloadInstagram,
  downloadYouTube,
  downloadMp3,
  downloadByUrl,
};
