// Renderer Sticker Studio NAZE: menggambar frame BRAT (statis dan animasi)
// di atas kanvas persegi 512 piksel dengan background putih dan teks hitam,
// lalu menyandikannya menjadi WebP stiker WhatsApp.

import fs from "fs";
import path from "path";
import Crypto from "crypto";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import {
  addExifToWebp,
  createStickerFromImage,
  isValidWebp,
  isAnimatedWebp,
  getWebpDimensions,
  getTempDir,
  ffmpeg,
} from "./naze-exif.js";
import { computeBratLayout, patternFrameTransforms } from "./naze-sticker-utils.js";

const FONT_FAMILY_NAME = "NAZESans";

// Kandidat font sans-serif umum di server Linux, Windows, dan macOS.
// Font pertama yang ditemukan dipakai agar hasil render konsisten.
const CANDIDATE_FONTS = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  "/usr/share/fonts/OTF/NotoSans-Regular.otf",
  "C:/Windows/Fonts/arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
];

let resolvedFamily = null;

function resolveFontFamily() {
  if (resolvedFamily) return resolvedFamily;
  try {
    for (const fontPath of CANDIDATE_FONTS) {
      if (fs.existsSync(fontPath)) {
        const registered = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY_NAME);
        if (registered) {
          resolvedFamily = FONT_FAMILY_NAME;
          return resolvedFamily;
        }
      }
    }
  } catch {}
  resolvedFamily = "sans-serif";
  return resolvedFamily;
}

/**
 * Membuat fungsi pengukur lebar teks untuk perhitungan tata letak.
 * @returns {Function} (text, fontSize) => lebar dalam piksel
 */
function createMeasure() {
  const family = resolveFontFamily();
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext("2d");
  return (text, fontSize) => {
    ctx.font = `${fontSize}px ${family}`;
    return ctx.measureText(String(text)).width;
  };
}

function drawBratLines(ctx, layout, lineTransforms) {
  const centerX = layout.canvasSize / 2;
  for (let i = 0; i < layout.lines.length; i++) {
    const transform = lineTransforms[i] || null;
    const lineY = layout.blockTop + layout.lineHeight * (i + 0.5);
    ctx.save();
    if (transform) {
      ctx.translate(centerX, lineY);
      if (transform.rotate) ctx.rotate(transform.rotate);
      if (transform.scale && transform.scale !== 1) {
        ctx.scale(transform.scale, transform.scale);
      }
      ctx.translate((transform.dx || 0), (transform.dy || 0));
      ctx.translate(-centerX, -lineY);
    }
    ctx.fillText(layout.lines[i], centerX, lineY);
    ctx.restore();
  }
}

/**
 * Menggambar satu frame BRAT: background putih solid dan teks hitam.
 * @param {Object} layout - Hasil computeBratLayout
 * @param {Object|null} frame - Transformasi frame (block/lines/halves)
 * @returns {Buffer} Buffer PNG frame
 */
function drawBratFrame(layout, frame = null) {
  const canvas = createCanvas(layout.canvasSize, layout.canvasSize);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, layout.canvasSize, layout.canvasSize);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${layout.fontSize}px ${resolveFontFamily()}`;

  const block = frame?.block || null;
  const centerX = layout.canvasSize / 2;

  ctx.save();
  if (block) {
    ctx.translate(centerX, centerX);
    if (block.rotate) ctx.rotate(block.rotate);
    if (block.scale && block.scale !== 1) {
      ctx.scale(block.scale, block.scale);
    }
    ctx.translate((block.dx || 0), (block.dy || 0));
    ctx.translate(-centerX, -centerX);
  }

  if (frame?.halves && frame.halves.length === 2) {
    const halfWidth = layout.canvasSize / 2;
    const clipRects = [
      [-layout.canvasSize, -layout.canvasSize, layout.canvasSize + halfWidth, layout.canvasSize * 3],
      [halfWidth, -layout.canvasSize, layout.canvasSize * 1.5, layout.canvasSize * 3],
    ];
    frame.halves.forEach((half, index) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(...clipRects[index]);
      ctx.clip();
      ctx.translate((half.dx || 0), (half.dy || 0));
      if (half.rotate) {
        ctx.translate(halfWidth, centerX);
        ctx.rotate(half.rotate);
        ctx.translate(-halfWidth, -centerX);
      }
      drawBratLines(ctx, layout, []);
      ctx.restore();
    });
  } else {
    drawBratLines(ctx, layout, frame?.lines || []);
  }
  ctx.restore();

  return canvas.toBuffer("image/png");
}

/**
 * Merender stiker BRAT statis: teks hitam besar di atas kanvas putih.
 * Hasil akhir berupa WebP statis 512 x 512 yang siap dikirim.
 * @param {string} text - Teks sumber
 * @param {Object} [options] - { measure, packname, author, emojis }
 * @returns {Object} { ok, reason, buffer, layout }
 */
async function renderBratStatic(text, options = {}) {
  const measure = options.measure || createMeasure();
  const layout = computeBratLayout(text, measure);
  if (!layout) return { ok: false, reason: "layout", buffer: null, layout: null };

  const framePng = drawBratFrame(layout, null);
  let webp;
  try {
    webp = await createStickerFromImage(framePng, {
      packname: options.packname,
      author: options.author,
      emojis: options.emojis,
    });
  } catch (error) {
    return { ok: false, reason: "encode", error, buffer: null, layout };
  }
  if (!isValidWebp(webp)) {
    return { ok: false, reason: "encode", buffer: null, layout };
  }
  const dimensions = getWebpDimensions(webp);
  if (!dimensions || dimensions.width !== 512 || dimensions.height !== 512) {
    return { ok: false, reason: "encode", buffer: null, layout };
  }
  return { ok: true, reason: null, buffer: webp, layout };
}

function encodeFramesToAnimatedWebp(frameDir, frameCount, fps, outPath, quality) {
  return new Promise((resolve, reject) => {
    ffmpeg(path.join(frameDir, "frame_%03d.png"))
      .inputOptions(["-framerate " + fps])
      .outputOptions([
        "-vcodec", "libwebp",
        "-lossless", "0",
        "-q:v", String(quality),
        "-loop", "0",
        "-an",
        "-vsync", "0",
        "-vf", "setsar=1",
      ])
      .toFormat("webp")
      .on("end", () => {
        try {
          resolve(fs.readFileSync(outPath));
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => reject(error))
      .save(outPath);
  });
}

/**
 * Merender stiker BRAT animasi dengan sistem keyframe lima pola.
 * Hasil akhir berupa animated WebP 512 x 512 yang divalidasi sebelum dikirim.
 * @param {string} text - Teks sumber
 * @param {Object} options - { measure, pattern, duration, fps, maxBytes, packname, author, emojis }
 * @returns {Object} { ok, reason, buffer, pattern, frameCount, duration, fps }
 */
async function renderBratAnimated(text, options = {}) {
  const measure = options.measure || createMeasure();
  const layout = computeBratLayout(text, measure);
  if (!layout) {
    return { ok: false, reason: "layout", buffer: null };
  }

  const duration = Math.max(1, Number(options.duration) || 3);
  const fps = Math.max(2, Number(options.fps) || 10);
  const maxBytes = Number(options.maxBytes) || 1024 * 1024;
  const frameCount = Math.max(2, Math.round(duration * fps));
  const pattern = options.pattern || "beat-pulse";

  const tmpDir = getTempDir();
  const frameDir = path.join(tmpDir, "bratvid_" + Date.now() + "_" + Crypto.randomBytes(4).toString("hex"));
  const outPath = path.join(frameDir, "animated.webp");
  fs.mkdirSync(frameDir, { recursive: true });

  try {
    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount;
      const frame = patternFrameTransforms(pattern, t, { lineCount: layout.lineCount });
      const framePng = drawBratFrame(layout, frame);
      fs.writeFileSync(path.join(frameDir, "frame_" + String(i).padStart(3, "0") + ".png"), framePng);
    }

    let webp;
    try {
      webp = await encodeFramesToAnimatedWebp(frameDir, frameCount, fps, outPath, 75);
    } catch (error) {
      return { ok: false, reason: "encode", error, buffer: null, pattern, frameCount, duration, fps };
    }

    const animated = await isAnimatedWebp(webp);
    if (!isValidWebp(webp) || !animated) {
      return { ok: false, reason: "encode", buffer: null, pattern, frameCount, duration, fps };
    }
    if (webp.length > maxBytes) {
      try {
        webp = await encodeFramesToAnimatedWebp(frameDir, frameCount, fps, outPath, 60);
      } catch (error) {
        return { ok: false, reason: "too-large", error, buffer: null, pattern, frameCount, duration, fps };
      }
      if (webp.length > maxBytes) {
        return { ok: false, reason: "too-large", buffer: null, pattern, frameCount, duration, fps };
      }
    }

    let finalBuffer;
    try {
      finalBuffer = await addExifToWebp(webp, {
        packname: options.packname,
        author: options.author,
        emojis: options.emojis,
      });
    } catch (error) {
      return { ok: false, reason: "exif", error, buffer: null, pattern, frameCount, duration, fps };
    }
    if (!isValidWebp(finalBuffer)) {
      return { ok: false, reason: "exif", buffer: null, pattern, frameCount, duration, fps };
    }

    return {
      ok: true,
      reason: null,
      buffer: finalBuffer,
      pattern,
      frameCount,
      duration,
      fps,
      layout,
    };
  } finally {
    try {
      fs.rmSync(frameDir, { recursive: true, force: true });
    } catch {}
  }
}

export {
  resolveFontFamily,
  createMeasure,
  drawBratFrame,
  renderBratStatic,
  renderBratAnimated,
};
