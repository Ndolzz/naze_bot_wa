// Orkestrator Sticker Studio NAZE: pembuatan stiker, BRAT statis, BRATVID,
// konversi media, pengubahan metadata, dan pengelolaan stiker tersimpan.

import fs from "fs";
import path from "path";
import config from "../../config.js";
import sharp from "sharp";
import { logger } from "./naze-logger.js";
import { formatBytes } from "./naze-file-utils.js";
import {
  addExifToWebp,
  createStickerFromImage,
  createStickerFromVideo,
  isValidWebp,
  isAnimatedWebp,
  getTempDir,
  ffmpeg,
} from "./naze-exif.js";
import * as stickerStore from "./naze-sticker-store.js";
import {
  renderBratStatic,
  renderBratAnimated,
} from "./naze-sticker-renderer.js";
import {
  resolveStudioLimits,
  validateBratText,
  pickPattern,
  validateStickerName,
  stickerStudioMenuText,
  studioTextEmptyMessage,
  studioTextTooLongMessage,
  studioTextDoesNotFitMessage,
  studioRenderFailedMessage,
  stickerGuideMessage,
  stickerMediaUnsupportedMessage,
  stickerVideoTooLongMessage,
  stickerMediaTooLargeMessage,
  converterGuideMessage,
  converterNotAnimatedMessage,
  converterInvalidStickerMessage,
  converterTooLargeMessage,
  converterFailedMessage,
  takeGuideMessage,
  metadataDoneMessage,
  stealGuideMessage,
  storeInvalidNameMessage,
  storeNameExistsMessage,
  storeFullMessage,
  storeTooLargeMessage,
  storeSavedMessage,
  storeNotFoundMessage,
  storeListEmptyMessage,
  storeListMessage,
  storeDeletedMessage,
  storeDeleteDeniedMessage,
} from "./naze-sticker-utils.js";

// Pola BRATVID terakhir yang dipilih pada proses berjalan. Dipakai untuk
// menghindari pola yang sama dua kali berturut-turut; lihat pickPattern.
let lastPatternId = null;

function studioLimits() {
  return resolveStudioLimits(config.stickerStudio);
}

function stickerMetadata() {
  return {
    packname: config.sticker?.packname || "NAZE",
    author: config.sticker?.author || "NAZE",
    emojis: [],
  };
}

function mediaContentOf(source) {
  if (!source || !source.type) return null;
  return source.message?.[source.type] || null;
}

function resolveImageVideoSource(m) {
  if (m.isImage || m.isVideo) return m;
  if (m.quoted?.isImage || m.quoted?.isVideo) return m.quoted;
  return null;
}

function resolveStickerSource(m) {
  if (m.isSticker) return m;
  if (m.quoted?.isSticker) return m.quoted;
  return null;
}

function resolveBratText(m) {
  const ownText = String(m.text || "").trim();
  if (ownText) return ownText;
  const quoted = m.quoted;
  if (quoted && !quoted.isMedia && quoted.type !== "stickerMessage") {
    const quotedText = String(quoted.body || "").trim();
    if (quotedText) return quotedText;
  }
  return "";
}

function reply(m, text) {
  return m.reply(text).catch(() => null);
}

// ---------------------------------------------------------------------------
// Sticker Maker
// ---------------------------------------------------------------------------

async function createSticker(m) {
  try {
    const limits = studioLimits();
    const source = resolveImageVideoSource(m);
    if (!source) {
      if (m.isMedia || m.hasQuotedMedia) {
        const mediaType =
          m.isMedia ? m.type : m.quoted?.isMedia ? m.quoted.type : "";
        await reply(m, stickerMediaUnsupportedMessage(mediaType));
        return;
      }
      await reply(m, stickerGuideMessage());
      return;
    }

    const content = mediaContentOf(source);
    if (source.isVideo) {
      const seconds = Number(content?.seconds) || 0;
      if (seconds > limits.maxVideoSeconds) {
        await reply(m, stickerVideoTooLongMessage(limits.maxVideoSeconds));
        return;
      }
    }

    let buffer;
    try {
      buffer = await source.download();
    } catch (error) {
      logger.error("sticker", "gagal mengunduh media: " + error.message);
      await reply(m, studioRenderFailedMessage("media gagal diunduh"));
      return;
    }
    if (!buffer || !buffer.length) {
      await reply(m, studioRenderFailedMessage("media kosong"));
      return;
    }
    if (buffer.length > limits.maxMediaBytes) {
      await reply(m, stickerMediaTooLargeMessage(limits.maxMediaBytes));
      return;
    }

    const metadata = stickerMetadata();
    let webp;
    if (source.isImage) {
      webp = await createStickerFromImage(buffer, metadata);
    } else {
      const seconds = Number(content?.seconds) || 0;
      webp = await createStickerFromVideo(buffer, {
        duration: seconds > 0 ? Math.min(seconds, limits.maxVideoSeconds) : 5,
        fps: 15,
        ...metadata,
      });
    }
    if (!isValidWebp(webp)) {
      await reply(m, studioRenderFailedMessage("hasil stiker tidak valid"));
      return;
    }
    await m.replySticker(webp);
  } catch (error) {
    logger.error("sticker", "gagal membuat stiker: " + error.message);
    await reply(m, studioRenderFailedMessage("terjadi kesalahan saat memproses media"));
  }
}

async function createBrat(m) {
  try {
    const limits = studioLimits();
    const validation = validateBratText(resolveBratText(m), limits.maxTextLength);
    if (!validation.ok) {
      if (validation.reason === "too-long") {
        await reply(m, studioTextTooLongMessage(limits.maxTextLength));
      } else {
        await reply(m, studioTextEmptyMessage(".brat"));
      }
      return;
    }

    const result = await renderBratStatic(validation.text, stickerMetadata());
    if (!result.ok) {
      if (result.reason === "layout") {
        await reply(m, studioTextDoesNotFitMessage());
      } else {
        logger.error("sticker", "render BRAT gagal: " + (result.error?.message || result.reason));
        await reply(m, studioRenderFailedMessage("render teks gagal"));
      }
      return;
    }
    await m.replySticker(result.buffer);
  } catch (error) {
    logger.error("sticker", "gagal membuat BRAT: " + error.message);
    await reply(m, studioRenderFailedMessage("terjadi kesalahan saat memproses teks"));
  }
}

async function createBratVid(m) {
  try {
    const limits = studioLimits();
    const validation = validateBratText(resolveBratText(m), limits.maxTextLength);
    if (!validation.ok) {
      if (validation.reason === "too-long") {
        await reply(m, studioTextTooLongMessage(limits.maxTextLength));
      } else {
        await reply(m, studioTextEmptyMessage(".bratvid"));
      }
      return;
    }

    const pattern = pickPattern(lastPatternId);
    const result = await renderBratAnimated(validation.text, {
      pattern,
      duration: limits.bratvidDurationSeconds,
      fps: limits.bratvidFps,
      maxBytes: limits.bratvidMaxBytes,
      ...stickerMetadata(),
    });
    if (!result.ok) {
      if (result.reason === "layout") {
        await reply(m, studioTextDoesNotFitMessage());
      } else if (result.reason === "too-large") {
        await reply(m, studioRenderFailedMessage("hasil animasi melebihi batas ukuran"));
      } else {
        logger.error("sticker", "render BRATVID gagal: " + (result.error?.message || result.reason));
        await reply(m, studioRenderFailedMessage("render animasi gagal"));
      }
      return;
    }
    lastPatternId = pattern;
    await m.replySticker(result.buffer);
  } catch (error) {
    logger.error("sticker", "gagal membuat BRATVID: " + error.message);
    await reply(m, studioRenderFailedMessage("terjadi kesalahan saat memproses teks"));
  }
}

// ---------------------------------------------------------------------------
// Media Converter
// ---------------------------------------------------------------------------

async function downloadStickerBuffer(m, command, guideMessage = null) {
  const source = resolveStickerSource(m);
  if (!source) {
    await reply(m, guideMessage || converterGuideMessage(command));
    return null;
  }
  let buffer;
  try {
    buffer = await source.download();
  } catch (error) {
    logger.error("sticker", "gagal mengunduh stiker: " + error.message);
    await reply(m, converterFailedMessage("stiker gagal diunduh"));
    return null;
  }
  if (!buffer || !buffer.length || !isValidWebp(buffer)) {
    await reply(m, converterInvalidStickerMessage());
    return null;
  }
  return { buffer, animated: await isAnimatedWebp(buffer) };
}

async function runFfmpeg(inputPath, outputOptions, outputFormat, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(outputOptions)
      .toFormat(outputFormat)
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

async function stickerToImage(m) {
  try {
    const sticker = await downloadStickerBuffer(m, ".toimg");
    if (!sticker) return;

    let png;
    try {
      png = await sharp(sticker.buffer).png().toBuffer();
    } catch (error) {
      logger.error("sticker", "konversi ke gambar gagal: " + error.message);
      await reply(m, converterFailedMessage("stiker tidak dapat dibaca"));
      return;
    }
    const caption = sticker.animated
      ? "Stiker animasi dikonversi dari bingkai pertama."
      : "";
    await m.replyImage(png, caption);
  } catch (error) {
    logger.error("sticker", "gagal mengubah stiker ke gambar: " + error.message);
    await reply(m, converterFailedMessage("terjadi kesalahan saat memproses stiker"));
  }
}

async function stickerToGif(m) {
  try {
    const limits = studioLimits();
    const sticker = await downloadStickerBuffer(m, ".togif");
    if (!sticker) return;
    if (!sticker.animated) {
      await reply(m, converterNotAnimatedMessage(".togif"));
      return;
    }

    const tmpDir = getTempDir();
    const stamp = Date.now() + "_" + Math.random().toString(16).slice(2, 8);
    const inputPath = path.join(tmpDir, `conv_${stamp}.webp`);
    const outputPath = path.join(tmpDir, `conv_${stamp}.gif`);
    fs.writeFileSync(inputPath, sticker.buffer);
    try {
      const gif = await runFfmpeg(
        inputPath,
        [
          "-vf",
          "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1",
          "-loop", "0",
          "-an",
        ],
        "gif",
        outputPath,
      );
      if (gif.length > limits.gifMaxBytes) {
        await reply(m, converterTooLargeMessage("GIF", limits.gifMaxBytes));
        return;
      }
      await m.replyDocument(gif, "sticker.gif", "image/gif");
    } finally {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }
  } catch (error) {
    logger.error("sticker", "gagal mengubah stiker ke GIF: " + error.message);
    await reply(m, converterFailedMessage("terjadi kesalahan saat memproses stiker"));
  }
}

async function stickerToVideo(m) {
  try {
    const sticker = await downloadStickerBuffer(m, ".tovideo");
    if (!sticker) return;
    if (!sticker.animated) {
      await reply(m, converterNotAnimatedMessage(".tovideo"));
      return;
    }

    const tmpDir = getTempDir();
    const stamp = Date.now() + "_" + Math.random().toString(16).slice(2, 8);
    const inputPath = path.join(tmpDir, `conv_${stamp}.webp`);
    const outputPath = path.join(tmpDir, `conv_${stamp}.mp4`);
    fs.writeFileSync(inputPath, sticker.buffer);
    try {
      const mp4 = await runFfmpeg(
        inputPath,
        [
          "-vf",
          "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,format=yuv420p",
          "-movflags", "+faststart",
          "-an",
        ],
        "mp4",
        outputPath,
      );
      await m.replyVideo(mp4);
    } finally {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }
  } catch (error) {
    logger.error("sticker", "gagal mengubah stiker ke video: " + error.message);
    await reply(m, converterFailedMessage("terjadi kesalahan saat memproses stiker"));
  }
}

// ---------------------------------------------------------------------------
// Sticker Management
// ---------------------------------------------------------------------------

function parseMetadataArgs(text) {
  const raw = String(text || "").trim();
  if (!raw) return { packname: null, author: null };
  const parts = raw.split("|").map((part) => part.trim());
  return { packname: parts[0] || null, author: parts[1] || null };
}

async function restampSticker(m, command, guideMessage, metadata) {
  const sticker = await downloadStickerBuffer(m, command, guideMessage);
  if (!sticker) {
    return null;
  }
  try {
    const webp = await addExifToWebp(sticker.buffer, {
      packname: metadata.packname,
      author: metadata.author,
      emojis: [],
    });
    if (!isValidWebp(webp)) {
      await reply(m, converterFailedMessage("metadata stiker tidak dapat diubah"));
      return null;
    }
    return webp;
  } catch (error) {
    logger.error("sticker", "gagal mengubah metadata stiker: " + error.message);
    await reply(m, converterFailedMessage("metadata stiker tidak dapat diubah"));
    return null;
  }
}

async function takeSticker(m) {
  try {
    const args = parseMetadataArgs(m.text);
    const metadata = {
      packname: args.packname || stickerMetadata().packname,
      author: args.author || stickerMetadata().author,
    };
    const webp = await restampSticker(m, ".take", takeGuideMessage(".take"), metadata);
    if (!webp) return;
    await m.replySticker(webp);
    await reply(m, metadataDoneMessage(metadata.packname, metadata.author));
  } catch (error) {
    logger.error("sticker", "gagal menjalankan take: " + error.message);
    await reply(m, converterFailedMessage("terjadi kesalahan saat memproses stiker"));
  }
}

async function stealSticker(m) {
  try {
    const limits = studioLimits();
    const tokens = String(m.text || "").trim().split(/\s+/).filter(Boolean);
    let saveName = null;
    if (tokens.length > 0) {
      const nameCheck = validateStickerName(tokens[0]);
      if (nameCheck.ok) {
        saveName = nameCheck.name;
      }
    }

    const metadata = {
      packname: stickerMetadata().packname,
      author: m.pushName && m.pushName !== "~ User" ? m.pushName : stickerMetadata().author,
    };
    const webp = await restampSticker(m, ".steal", stealGuideMessage(), metadata);
    if (!webp) return;
    await m.replySticker(webp);
    await reply(m, metadataDoneMessage(metadata.packname, metadata.author));

    if (saveName) {
      if (webp.length > limits.store.maxStickerBytes) {
        await reply(m, storeTooLargeMessage(limits.store.maxStickerBytes));
        return;
      }
      const result = stickerStore.saveSticker({
        name: saveName,
        buffer: webp,
        sender: m.sender,
        senderNumber: m.senderNumber,
        maxStickers: limits.store.maxStickers,
        maxStickerBytes: limits.store.maxStickerBytes,
        createdLabel: new Date().toISOString().slice(0, 10),
      });
      if (result.ok) {
        await reply(m, storeSavedMessage(saveName));
      } else if (result.reason === "exists") {
        await reply(m, storeNameExistsMessage(saveName));
      } else if (result.reason === "full") {
        await reply(m, storeFullMessage(limits.store.maxStickers));
      } else if (result.reason === "too-large") {
        await reply(m, storeTooLargeMessage(limits.store.maxStickerBytes));
      } else {
        await reply(m, converterFailedMessage("stiker gagal disimpan"));
      }
    }
  } catch (error) {
    logger.error("sticker", "gagal menjalankan steal: " + error.message);
    await reply(m, converterFailedMessage("terjadi kesalahan saat memproses stiker"));
  }
}

async function getStoredSticker(m) {
  try {
    const nameCheck = validateStickerName(m.text);
    if (!nameCheck.ok) {
      await reply(m, storeInvalidNameMessage());
      return;
    }
    const found = stickerStore.getSticker(nameCheck.name);
    if (!found) {
      await reply(m, storeNotFoundMessage(nameCheck.name));
      return;
    }
    await m.replySticker(found.buffer);
  } catch (error) {
    logger.error("sticker", "gagal mengambil stiker tersimpan: " + error.message);
    await reply(m, converterFailedMessage("stiker gagal diambil"));
  }
}

async function listStoredStickers(m) {
  try {
    const limits = studioLimits();
    const entries = stickerStore.listStickers();
    if (entries.length === 0) {
      await reply(m, storeListEmptyMessage());
      return;
    }
    const mapped = entries.map((entry) => ({
      name: entry.name,
      senderNumber: entry.senderNumber,
      createdLabel: entry.createdLabel || new Date(entry.createdAt).toISOString().slice(0, 10),
      sizeLabel: formatBytes(entry.sizeBytes),
    }));
    await reply(m, storeListMessage(mapped, limits.store.maxStickers));
  } catch (error) {
    logger.error("sticker", "gagal menampilkan daftar stiker: " + error.message);
    await reply(m, converterFailedMessage("daftar stiker tidak dapat dibaca"));
  }
}

async function deleteStoredSticker(m) {
  try {
    const nameCheck = validateStickerName(m.text);
    if (!nameCheck.ok) {
      await reply(m, storeInvalidNameMessage());
      return;
    }
    const result = stickerStore.deleteSticker(nameCheck.name, m.sender, m.isOwner);
    if (result.ok) {
      await reply(m, storeDeletedMessage(nameCheck.name));
    } else if (result.reason === "not-found") {
      await reply(m, storeNotFoundMessage(nameCheck.name));
    } else if (result.reason === "denied") {
      await reply(m, storeDeleteDeniedMessage());
    } else {
      await reply(m, converterFailedMessage("stiker gagal dihapus"));
    }
  } catch (error) {
    logger.error("sticker", "gagal menghapus stiker: " + error.message);
    await reply(m, converterFailedMessage("stiker gagal dihapus"));
  }
}

export {
  stickerStudioMenuText,
  createSticker,
  createBrat,
  createBratVid,
  stickerToImage,
  stickerToGif,
  stickerToVideo,
  takeSticker,
  stealSticker,
  getStoredSticker,
  listStoredStickers,
  deleteStoredSticker,
};
