import sharp from "sharp";
import { getAssetBuffer } from "./naze-asset-manager.js";

// Banner NAZE: dikirim bersama setiap balasan teks bot (m.reply).
// Prioritas: aset "naze-logo" dari config.js (assets/image/naze-logo.jpg).
// Jika file tersebut tidak ada, banner dibuat otomatis dari piksel
// (font piksel internal) lalu dikodekan menjadi JPEG dengan sharp,
// sehingga bot tetap tampil konsisten tanpa berkas gambar di repo.

const BANNER_WIDTH = 900;
const BANNER_HEIGHT = 270;
const BANNER_MIN_ASSET_BYTES = 1024;

const COLORS = {
  bg: [15, 23, 42], // #0F172A
  border: [37, 99, 235], // #2563EB
  accent: [96, 165, 250], // #60A5FA
  panel: [37, 99, 235], // #2563EB
  white: [248, 250, 252], // #F8FAFC
  sub: [148, 163, 184], // #94A3B8
};

// Font piksel 7 baris; lebar per glyph mengikuti barisnya.
const FONT = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: ["###", " # ", " # ", " # ", " # ", " # ", "###"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "# # #", " # # "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  " ": ["  ", "  ", "  ", "  ", "  ", "  ", "  "],
};

function fillRect(pixels, x, y, w, h, color) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(BANNER_WIDTH, x + w);
  const y1 = Math.min(BANNER_HEIGHT, y + h);
  for (let py = y0; py < y1; py++) {
    let idx = (py * BANNER_WIDTH + x0) * 3;
    for (let px = x0; px < x1; px++) {
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      idx += 3;
    }
  }
}

function drawGlyph(pixels, glyph, x0, y0, scale, color) {
  for (let gy = 0; gy < glyph.length; gy++) {
    const row = glyph[gy];
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] !== "#") continue;
      fillRect(pixels, x0 + gx * scale, y0 + gy * scale, scale, scale, color);
    }
  }
}

function drawText(pixels, text, x0, y0, scale, color, gap = 1) {
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    drawGlyph(pixels, glyph, x, y0, scale, color);
    x += (glyph[0].length + gap) * scale;
  }
}

function renderBannerPixels() {
  const pixels = new Uint8Array(BANNER_WIDTH * BANNER_HEIGHT * 3);
  fillRect(pixels, 0, 0, BANNER_WIDTH, BANNER_HEIGHT, COLORS.bg);

  // Bingkai luar
  fillRect(pixels, 10, 10, BANNER_WIDTH - 20, 4, COLORS.border);
  fillRect(pixels, 10, BANNER_HEIGHT - 14, BANNER_WIDTH - 20, 4, COLORS.border);
  fillRect(pixels, 10, 10, 4, BANNER_HEIGHT - 20, COLORS.border);
  fillRect(pixels, BANNER_WIDTH - 14, 10, 4, BANNER_HEIGHT - 20, COLORS.border);

  // Logo: kotak biru dengan huruf N putih
  fillRect(pixels, 52, 57, 156, 156, COLORS.accent);
  fillRect(pixels, 55, 60, 150, 150, COLORS.panel);
  drawGlyph(pixels, FONT.N, 90, 79, 16, COLORS.white);

  // Judul dan subjudul
  drawText(pixels, "NAZE", 280, 55, 13, COLORS.white);
  fillRect(pixels, 280, 162, 300, 3, COLORS.accent);
  drawText(pixels, "WHATSAPP ASSISTANT", 280, 182, 5, COLORS.sub);

  return pixels;
}

async function renderBannerJpeg() {
  const pixels = renderBannerPixels();
  return sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), {
    raw: { width: BANNER_WIDTH, height: BANNER_HEIGHT, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
}

let bannerCache = null;

/**
 * Mengembalikan buffer gambar banner NAZE.
 * Memakai aset "naze-logo" bila tersedia; jika tidak, banner dibuat otomatis.
 * Hasil di-cache di memori selama proses bot berjalan.
 * @returns {Promise<Buffer|null>} Buffer JPEG, atau null bila gagal.
 */
export async function getBannerImage() {
  if (bannerCache) return bannerCache;
  try {
    const asset = getAssetBuffer("naze-logo");
    if (asset && asset.length >= BANNER_MIN_ASSET_BYTES) {
      bannerCache = asset;
      return bannerCache;
    }
  } catch {
    // Aset tidak tersedia; lanjut ke banner otomatis.
  }
  try {
    bannerCache = await renderBannerJpeg();
  } catch (e) {
    console.error("[Banner] Gagal membuat banner otomatis:", e.message);
    bannerCache = null;
  }
  return bannerCache;
}

/**
 * Menghapus cache banner (dipakai setelah aset naze-logo diganti).
 */
export function resetBannerCache() {
  bannerCache = null;
}
