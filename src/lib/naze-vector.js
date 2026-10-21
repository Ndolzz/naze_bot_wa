import sharp from "sharp";
import { computeSilhouetteMaskFromPixels } from "./vector/silhouette.js";
import { vectorizeSilhouette } from "./vector/vectorEngine.js";
import { extractCenterlines } from "./vector/centerline.js";
import { sampleComponentColors, sampleContourColors } from "./vector/colorSampling.js";
import { buildAlightMotionXml } from "./vector/amAdapter.js";
import { validateAlightMotionXml } from "./vector/xmlValidation.js";

// Pipeline vektorisasi gambar -> siluet -> XML Alight Motion.
// Modul murni pada src/lib/vector/ dipindahkan dari repositori nazevector
// tanpa perubahan; tahap impor gambar diganti dari canvas (peramban)
// menjadi sharp (Node.js) agar dapat berjalan di sisi server.

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1400;

const VALID_REPRESENTATIONS = ["isi", "garis", "kontur"];

async function decodeImage(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) {
    throw new Error("Gambar tidak dapat dibaca dengan kanal alpha.");
  }
  return { data, width: info.width, height: info.height };
}

/**
 * Mengubah gambar menjadi dokumen XML Alight Motion.
 * @param {Buffer} imageBuffer - Buffer gambar (PNG/JPEG/WebP).
 * @param {Object} options
 * @param {string} [options.representation] - "isi", "garis", atau "kontur".
 * @param {boolean} [options.originalColors] - Sampel warna asli per komponen/kontur.
 * @param {string} [options.mode] - "gelap" (default) atau "terang".
 * @param {number} [options.threshold] - Ambang siluet 1-99 (default 50).
 * @param {string} [options.color] - Warna global dalam format #rrggbb.
 * @returns {Promise<{ok: true, xml: string, stats: Object} | {ok: false, message: string}>}
 */
export async function vectorizeImageToXml(imageBuffer, options = {}) {
  try {
    if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) {
      return { ok: false, message: "Gambar tidak dapat dibaca." };
    }
    if (imageBuffer.length > MAX_INPUT_BYTES) {
      return { ok: false, message: "Ukuran gambar melebihi batas 15 MB." };
    }

    const representation = VALID_REPRESENTATIONS.includes(options.representation)
      ? options.representation
      : "isi";
    const mode = options.mode === "terang" ? "terang" : "gelap";
    const threshold =
      Number.isFinite(options.threshold) &&
      options.threshold >= 1 &&
      options.threshold <= 99
        ? options.threshold
        : 50;

    const pixelData = await decodeImage(imageBuffer);
    const mask = computeSilhouetteMaskFromPixels(
      pixelData.data,
      pixelData.width,
      pixelData.height,
      mode,
      threshold,
    );

    const vectorData = vectorizeSilhouette(mask, { color: options.color });
    if (vectorData.empty) {
      return {
        ok: false,
        message:
          "Tidak ada siluet yang terdeteksi pada ambang saat ini. Ubah ambang (1-99) atau mode (gelap/terang) lalu coba lagi.",
      };
    }

    const exportOptions = { color: options.color, representation };
    if (options.originalColors) {
      const pixelSource = {
        data: pixelData.data,
        width: pixelData.width,
        height: pixelData.height,
      };
      if (representation === "kontur") {
        exportOptions.contourColors = sampleContourColors(
          mask,
          pixelSource,
          vectorData,
        );
      } else {
        exportOptions.componentColors = sampleComponentColors(
          mask,
          pixelSource,
          vectorData,
        );
      }
    }

    if (representation === "garis") {
      const centerlineData = extractCenterlines(mask, vectorData);
      if (centerlineData.empty) {
        return {
          ok: false,
          message:
            "Tidak ada garis yang dapat diekstraksi pada ambang saat ini. Mode garis paling cocok untuk line art dengan goresan tipis; untuk bentuk terisi gunakan mode isi.",
        };
      }
      exportOptions.centerlineData = centerlineData;
    }

    const xml = buildAlightMotionXml(vectorData, exportOptions);
    const validation = validateAlightMotionXml(xml);
    if (!validation.valid) {
      return {
        ok: false,
        message: "XML tidak lolos validasi lokal: " + validation.issues.join(" "),
      };
    }

    return {
      ok: true,
      xml,
      stats: {
        representation,
        mode,
        threshold,
        pathCount: vectorData.pathCount,
        componentCount: vectorData.componentCount,
        vertexCount: vectorData.vertexCount,
        width: vectorData.width,
        height: vectorData.height,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Pemrosesan gambar gagal karena kesalahan yang tidak diketahui.",
    };
  }
}
