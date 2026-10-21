// Rendering piksel banner NAZE (murni, tanpa dependensi).
// Dipisahkan dari naze-banner.js agar tata letak piksel dapat diuji
// tanpa sharp. naze-banner.js memakai modul ini lalu mengodekan hasilnya
// menjadi JPEG.
//
// Font piksel 7 baris A-Z; lebar tiap glyph mengikuti barisnya.
// Karakter di luar font dilewati, sehingga label tetap aman untuk
// string apa pun.

export const BANNER_WIDTH = 900;
export const BANNER_HEIGHT = 270;

export const COLORS = {
  bg: [15, 23, 42], // #0F172A
  border: [37, 99, 235], // #2563EB
  accent: [96, 165, 250], // #60A5FA
  panel: [37, 99, 235], // #2563EB
  white: [248, 250, 252], // #F8FAFC
  sub: [148, 163, 184], // #94A3B8
};

export const FONT = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ####", "#    ", "#    ", "#    ", "#    ", "#    ", "#### "],
  D: ["####  ", "#   # ", "#    #", "#    #", "#    #", "#   # ", "####  "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ####", "#    ", "#    ", "#  ##", "#   #", "#   #", "#### "],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: ["###", " # ", " # ", " # ", " # ", " # ", "###"],
  J: ["  ###", "    #", "    #", "    #", "    #", "#   #", " ### "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "# # #", " # # "],
  X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  " ": ["  ", "  ", "  ", "  ", "  ", "  ", "  "],
  "-": ["   ", "   ", "   ", "###", "   ", "   ", "   "],
  ".": [" ", " ", " ", " ", " ", " ", "#"],
  "0": [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  "3": ["#### ", "    #", "    #", " ### ", "    #", "    #", "#### "],
  "4": ["#   #", "#   #", "#   #", "#####", "    #", "    #", "    #"],
  "5": ["#####", "#    ", "#    ", "#### ", "    #", "    #", "#### "],
  "6": [" ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "    #", " ### "],
};

export function fillRect(pixels, x, y, w, h, color) {
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

export function drawGlyph(pixels, glyph, x0, y0, scale, color) {
  for (let gy = 0; gy < glyph.length; gy++) {
    const row = glyph[gy];
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] !== "#") continue;
      fillRect(pixels, x0 + gx * scale, y0 + gy * scale, scale, scale, color);
    }
  }
}

export function measureTextWidth(text, scale, gap = 1) {
  let width = 0;
  let glyphs = 0;
  for (const ch of String(text).toUpperCase()) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    width += glyph[0].length * scale;
    glyphs += 1;
  }
  return glyphs === 0 ? 0 : width + (glyphs - 1) * gap * scale;
}

export function drawText(pixels, text, x0, y0, scale, color, gap = 1) {
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    drawGlyph(pixels, glyph, x, y0, scale, color);
    x += (glyph[0].length + gap) * scale;
  }
}

// Label subjudul default banner utama; harus tetap "WHATSAPP ASSISTANT"
// agar keluaran banner utama identik dengan versi sebelumnya.
export const DEFAULT_BANNER_SUBTITLE = "WHATSAPP ASSISTANT";

const SUBTITLE_X = 280;
const SUBTITLE_Y = 182;
const SUBTITLE_MAX_WIDTH = 580;

/**
 * Merender piksel banner NAZE.
 * @param {string|null} subtitle - Label subjudul; null memakai default.
 * @returns {Uint8Array} Piksel RGB lebar 900 x tinggi 270.
 */
export function renderBannerPixels(subtitle = DEFAULT_BANNER_SUBTITLE) {
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

  const label = subtitle || DEFAULT_BANNER_SUBTITLE;
  let scale = 5;
  while (scale > 1 && measureTextWidth(label, scale) > SUBTITLE_MAX_WIDTH) {
    scale -= 1;
  }
  drawText(pixels, label, SUBTITLE_X, SUBTITLE_Y, scale, COLORS.sub);

  return pixels;
}
