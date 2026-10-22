// Pengelola fitur gambar NAZE: peningkatan kualitas, konversi format,
// kompresi di bawah 1 MB, dan status penghapus latar belakang.
//
// Seluruh hasil dikirim sebagai dokumen, bukan pesan gambar, karena
// WhatsApp mengompres ulang pesan gambar dan akan merusak hasil
// pemrosesan serta jaminan ukuran akhir.

import sharp from "sharp";
import { logger } from "./naze-logger.js";
import { formatBytes } from "./naze-file-utils.js";
import * as imageUtils from "./naze-image-utils.js";

function reply(m, text) {
  return m.reply(text).catch(() => null);
}

function resolveImageSource(m) {
  if (m.isImage) return m;
  if (m.quoted?.isImage) return m.quoted;
  return null;
}

async function downloadImage(m, guideMessage) {
  const source = resolveImageSource(m);
  if (!source) {
    if (m.isMedia || m.hasQuotedMedia) {
      const mediaType = m.isMedia ? m.type : m.quoted?.isMedia ? m.quoted.type : "";
      await reply(m, imageUtils.imageSourceUnsupportedMessage(mediaType));
      return null;
    }
    await reply(m, guideMessage);
    return null;
  }

  let buffer;
  try {
    buffer = await source.download();
  } catch (error) {
    logger.error("imagetools", "gagal mengunduh gambar: " + error.message);
    await reply(m, imageUtils.imageDownloadFailedMessage());
    return null;
  }
  if (!buffer || !buffer.length) {
    await reply(m, imageUtils.imageInvalidMessage());
    return null;
  }
  if (buffer.length > imageUtils.MAX_INPUT_BYTES) {
    await reply(m, imageUtils.imageTooLargeMessage(formatBytes(imageUtils.MAX_INPUT_BYTES)));
    return null;
  }

  return buffer;
}

async function readImageMeta(m, buffer) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch (error) {
    logger.error("imagetools", "gagal membaca metadata gambar: " + error.message);
    await reply(m, imageUtils.imageInvalidMessage());
    return null;
  }
  if (!meta.width || !meta.height) {
    await reply(m, imageUtils.imageInvalidMessage());
    return null;
  }
  return {
    buffer,
    width: meta.width,
    height: meta.height,
    format: imageUtils.normalizeFormatName(meta.format) || meta.format,
  };
}

// Enkoder tunggal yang dipakai tangga kompresi. Memeriksa ulang hasil
// dengan sharp agar dimensi keluaran selalu akurat.
async function encodeWithSharp({ buffer, format, quality, targetWidth }) {
  let pipeline = sharp(buffer);
  if (targetWidth) {
    pipeline = pipeline.resize({ width: targetWidth, kernel: "lanczos3" });
  }
  if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality, effort: 4 });
  } else {
    pipeline = pipeline.png({ quality, compressionLevel: 9, palette: true });
  }

  const out = await pipeline.toBuffer();
  const meta = await sharp(out).metadata();
  return { buffer: out, width: meta.width || targetWidth, height: meta.height || 0 };
}

// ---------------------------------------------------------------------------
// Peningkatan kualitas (.hdimg)
// ---------------------------------------------------------------------------

export async function enhanceImage(m) {
  try {
    const parsed = imageUtils.parseEnhanceArgs(m.text);
    if (!parsed.ok) {
      await reply(m, imageUtils.enhanceScaleInvalidMessage());
      return;
    }

    const buffer = await downloadImage(m, imageUtils.enhanceGuideMessage());
    if (!buffer) return;

    const image = await readImageMeta(m, buffer);
    if (!image) return;

    const format = imageUtils.normalizeFormatName(image.format) || "jpeg";
    const targetWidth = Math.min(
      4096,
      Math.max(64, Math.round(image.width * parsed.scale)),
    );

    let pipeline = sharp(buffer)
      .resize({ width: targetWidth, kernel: "lanczos3" })
      .normalize()
      .sharpen()
      .modulate({ saturation: 1.08 });

    if (format === "jpeg") {
      pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
    } else if (format === "webp") {
      pipeline = pipeline.webp({ quality: 90, effort: 4 });
    } else {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }

    const out = await pipeline.toBuffer();
    const outMeta = await sharp(out).metadata();
    const info = imageUtils.FORMAT_INFO[format];

    await m.replyDocument(out, "gambar_hd." + info.ext, info.mime);
    await reply(
      m,
      imageUtils.enhanceDoneMessage(
        image.width + "x" + image.height,
        outMeta.width + "x" + outMeta.height,
        formatBytes(buffer.length),
        formatBytes(out.length),
      ),
    );
  } catch (error) {
    logger.error("imagetools", "gagal meningkatkan gambar: " + error.message);
    await reply(m, imageUtils.processFailedMessage());
  }
}

// ---------------------------------------------------------------------------
// Konversi format (.reformat)
// ---------------------------------------------------------------------------

export async function reformatImage(m) {
  try {
    const parsed = imageUtils.parseReformatArgs(m.text);
    if (!parsed.ok) {
      await reply(m, imageUtils.reformatArgsInvalidMessage(parsed.reason));
      return;
    }

    const buffer = await downloadImage(m, imageUtils.reformatGuideMessage());
    if (!buffer) return;

    const image = await readImageMeta(m, buffer);
    if (!image) return;

    let pipeline = sharp(buffer);
    if (parsed.format === "jpeg") {
      pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({
        quality: parsed.quality ?? 90,
        mozjpeg: true,
      });
    } else if (parsed.format === "webp") {
      pipeline = pipeline.webp({ quality: parsed.quality ?? 90, effort: 4 });
    } else {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }

    const out = await pipeline.toBuffer();
    const info = imageUtils.FORMAT_INFO[parsed.format];

    await m.replyDocument(out, "gambar." + info.ext, info.mime);
    await reply(
      m,
      imageUtils.reformatDoneMessage(
        imageUtils.FORMAT_INFO[imageUtils.normalizeFormatName(image.format)]
          ? imageUtils.FORMAT_INFO[imageUtils.normalizeFormatName(image.format)].label
          : String(image.format || "asli").toUpperCase(),
        info.label,
        formatBytes(buffer.length),
        formatBytes(out.length),
      ),
    );
  } catch (error) {
    logger.error("imagetools", "gagal mengubah format gambar: " + error.message);
    await reply(m, imageUtils.processFailedMessage());
  }
}

// ---------------------------------------------------------------------------
// Kompresi di bawah 1 MB (.kompres)
// ---------------------------------------------------------------------------

export async function compressImage(m) {
  try {
    const buffer = await downloadImage(m, imageUtils.compressGuideMessage());
    if (!buffer) return;

    if (buffer.length < imageUtils.COMPRESS_TARGET_BYTES) {
      await reply(m, imageUtils.compressAlreadySmallMessage(formatBytes(buffer.length)));
      return;
    }

    const image = await readImageMeta(m, buffer);
    if (!image) return;

    const result = await imageUtils.compressUnderLimit(image, {
      encode: encodeWithSharp,
    });
    if (!result.ok) {
      await reply(m, imageUtils.compressFailedMessage());
      return;
    }

    const info = imageUtils.FORMAT_INFO[result.format];
    const inputFormat = imageUtils.normalizeFormatName(image.format);
    const changedFormat = inputFormat !== result.format;

    await m.replyDocument(result.buffer, "gambar_kompres." + info.ext, info.mime);
    await reply(
      m,
      imageUtils.compressDoneMessage(
        formatBytes(buffer.length),
        formatBytes(result.sizeBytes),
        result.quality,
        changedFormat,
      ),
    );
  } catch (error) {
    logger.error("imagetools", "gagal mengompres gambar: " + error.message);
    await reply(m, imageUtils.processFailedMessage());
  }
}

// ---------------------------------------------------------------------------
// Penghapus latar belakang (.removebg) - dalam pengembangan
// ---------------------------------------------------------------------------

export async function removeBackground(m) {
  await reply(m, imageUtils.removebgDevMessage());
}
