// Orkestrator fitur Vector NAZE: membaca gambar/stiker dari pesan, menghitung
// mask siluet pada resolusi kerja, menjalankan mesin vektorisasi murni, lalu
// mengirim PNG pratinjau dan berkas SVG hasil. Piksel dibaca lewat sharp;
// mesin vektorisasi itu sendiri murni tanpa dependensi.

import sharp from "sharp";
import config from "../../config.js";
import { logger } from "./naze-logger.js";
import {
  computePreviewDimensions,
  computeSilhouetteMaskFromPixels,
  vectorizeSilhouette,
} from "./naze-vector-engine.js";
import {
  resolveVectorLimits,
  parseVectorArgs,
  parseHexColor,
  vectorMenuText,
  vectorGuideMessage,
  vectorMediaUnsupportedMessage,
  vectorMediaTooLargeMessage,
  vectorInvalidArgsMessage,
  vectorEmptySilhouetteMessage,
  vectorFailedMessage,
  vectorDoneCaption,
} from "./naze-vector-utils.js";

function vectorLimits() {
  return resolveVectorLimits(config.vector);
}

function resolveImageSource(m) {
  if (m.isImage || m.isSticker) return m;
  if (m.quoted?.isImage || m.quoted?.isSticker) return m.quoted;
  return null;
}

function resolveArgsText(m) {
  const ownText = String(m.text || "").trim();
  if (ownText) return ownText;
  return "";
}

function reply(m, text) {
  return m.reply(text).catch(() => null);
}

async function sendWaitMessage(m) {
  const template = config.messages?.wait || "*Memproses...* Mohon tunggu sebentar.";
  await reply(m, template);
}

// Membaca piksel RGBA gambar pada resolusi kerja (tidak pernah memperbesar)
// dengan sharp, sebagai pengganti pembacaan kanvas pada aplikasi peramban.
async function readWorkingPixels(buffer, maxWorkDimension) {
  const metadata = await sharp(buffer).metadata();
  if (
    !Number.isInteger(metadata.width) ||
    !Number.isInteger(metadata.height) ||
    metadata.width <= 0 ||
    metadata.height <= 0
  ) {
    throw new Error("dimensi gambar tidak dapat dibaca");
  }
  const target = computePreviewDimensions(
    metadata.width,
    metadata.height,
    maxWorkDimension,
  );
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize(target.width, target.height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// PNG pratinjau langsung dari mask dengan latar putih. Dipakai sebagai fallback
// bila rasterisasi SVG tidak tersedia pada build sharp yang berjalan.
async function buildPreviewPngFromMask(maskData, colorHex) {
  const { mask, width, height } = maskData;
  const rgb = parseHexColor(colorHex) || { r: 15, g: 23, b: 42 };
  const pixels = Buffer.alloc(width * height * 4);
  for (let px = 0, i = 0; px < mask.length; px += 1, i += 4) {
    if (mask[px] > 0) {
      pixels[i] = rgb.r;
      pixels[i + 1] = rgb.g;
      pixels[i + 2] = rgb.b;
      pixels[i + 3] = 255;
    } else {
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

// PNG pratinjau hasil vektorisasi: merasterisasi SVG pada latar putih; bila
// rasterisasi SVG tidak didukung, jatuh kembali ke pratinjau dari mask yang
// secara geometri setara dengan hasil sebelum penyederhanaan titik.
async function buildPreviewPng(svg, maskData, settings, maxWidth) {
  try {
    return await sharp(Buffer.from(svg))
      .flatten({ background: "#ffffff" })
      .resize({ width: maxWidth, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (error) {
    logger.warn(
      "vector",
      "rasterisasi SVG tidak tersedia, memakai pratinjau mask: " + error.message,
    );
    return buildPreviewPngFromMask(maskData, settings.color);
  }
}

async function createVector(m) {
  try {
    const limits = vectorLimits();
    const source = resolveImageSource(m);
    if (!source) {
      if (m.isMedia || m.hasQuotedMedia) {
        const mediaType = m.isMedia ? m.type : m.quoted?.isMedia ? m.quoted.type : "";
        await reply(m, vectorMediaUnsupportedMessage(mediaType));
        return;
      }
      await reply(m, vectorGuideMessage(limits));
      return;
    }

    const settings = parseVectorArgs(resolveArgsText(m), limits);
    if (settings.invalid.length > 0) {
      await reply(m, vectorInvalidArgsMessage(settings.invalid));
      return;
    }

    let buffer;
    try {
      buffer = await source.download();
    } catch (error) {
      logger.error("vector", "gagal mengunduh media: " + error.message);
      await reply(m, vectorFailedMessage("media gagal diunduh"));
      return;
    }
    if (!buffer || !buffer.length) {
      await reply(m, vectorFailedMessage("media kosong"));
      return;
    }
    if (buffer.length > limits.maxMediaBytes) {
      await reply(m, vectorMediaTooLargeMessage(limits.maxMediaBytes));
      return;
    }

    await sendWaitMessage(m);

    let pixels;
    try {
      pixels = await readWorkingPixels(buffer, limits.maxWorkDimension);
    } catch (error) {
      logger.error("vector", "gagal membaca piksel gambar: " + error.message);
      await reply(m, vectorFailedMessage("gambar tidak dapat dibaca"));
      return;
    }

    const maskData = computeSilhouetteMaskFromPixels(
      pixels.data,
      pixels.width,
      pixels.height,
      settings.mode,
      settings.thresholdPercent,
    );
    const vector = vectorizeSilhouette(maskData, {
      simplification: settings.simplification,
      color: settings.color,
    });
    if (vector.empty || !vector.svg) {
      await reply(m, vectorEmptySilhouetteMessage(settings));
      return;
    }

    const preview = await buildPreviewPng(
      vector.svg,
      maskData,
      settings,
      limits.previewMaxWidth,
    );
    await m.replyImage(preview, vectorDoneCaption(vector, settings));
    await m.replyDocument(Buffer.from(vector.svg), "siluet.svg", "image/svg+xml");
  } catch (error) {
    logger.error("vector", "vektorisasi gagal: " + error.message);
    await reply(m, vectorFailedMessage("terjadi kesalahan saat memproses gambar"));
  }
}

export {
  vectorMenuText,
  createVector,
};
