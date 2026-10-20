// Sistem tipografi menu Naze.
// Menghasilkan judul dan header menu dengan gaya Unicode yang terkontrol,
// disertai fallback teks polos (mode plain) untuk lingkungan yang tidak
// mendukung karakter dekoratif. Nama perintah tidak pernah diubah di sini;
// perintah selalu dirender sebagai ASCII biasa oleh pembuat menu.

let plainMode = false;

// Offset code point untuk tiap gaya (basis huruf besar, kecil, dan angka).
// Rentang diverifikasi tanpa celah untuk huruf A-Z; gaya italic tanpa digit.
const STYLES = {
  fullwidth: { upper: 0xff21, lower: 0xff41, digit: 0xff10 },
  serifBold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  serifItalic: { upper: 0x1d434, lower: 0x1d44e, digit: null },
  serifBoldItalic: { upper: 0x1d468, lower: 0x1d482, digit: null },
  sans: { upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 },
  sansBold: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  sansBoldItalic: { upper: 0x1d63c, lower: 0x1d656, digit: null },
  mono: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
};

// Gaya tetap per section menu.
const SECTION_STYLES = {
  main: "sansBold",
  tools: "sansBoldItalic",
  games: "sans",
  groups: "serifBold",
  system: "mono",
  owner: "serifBoldItalic",
};

// Gaya tetap per submenu; label yang tidak terdaftar memakai sansBold.
const SUB_STYLES = {
  Help: "serifBold",
  About: "sans",
  Profile: "serifItalic",
  Downloader: "sansBoldItalic",
  Documents: "mono",
  Media: "sansBold",
  Stickers: "sans",
  "Text Effects": "serifItalic",
  Converter: "sansBoldItalic",
  Search: "sansBoldItalic",
  "Account Lookup": "mono",
  Utilities: "sansBold",
  Fun: "sansBold",
  Games: "sansBoldItalic",
  Clan: "sans",
  Rank: "serifItalic",
  Moderation: "sansBoldItalic",
  Management: "serifBoldItalic",
  Protection: "sans",
  Automation: "sansBold",
  Information: "mono",
  Status: "mono",
  "Bot Management": "serifBold",
  "User Management": "serifBoldItalic",
  "Group Management": "serifItalic",
  "Plugin Management": "mono",
  "System Management": "sansBold",
};

export function setPlainMenu(enabled) {
  plainMode = enabled === true;
}

export function isPlainMenu() {
  return plainMode;
}

export function stylize(text, styleKey) {
  const t = String(text == null ? "" : text);
  if (plainMode) return t.toUpperCase();
  const s = STYLES[styleKey];
  if (!s) return t;
  let out = "";
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if (c >= 0x41 && c <= 0x5a) {
      out += String.fromCodePoint(s.upper + (c - 0x41));
    } else if (c >= 0x61 && c <= 0x7a) {
      // Blok Mathematical Italic tidak memuat huruf h kecil (U+1D455 dipesan);
      // pakai ℎ (U+210E) sebagai gantinya.
      if (styleKey === "serifItalic" && c === 0x68) out += "\u210e";
      else out += String.fromCodePoint(s.lower + (c - 0x61));
    } else if (c >= 0x30 && c <= 0x39) {
      out += s.digit == null ? ch : String.fromCodePoint(s.digit + (c - 0x30));
    } else {
      out += ch;
    }
  }
  return out;
}

export function stylizeHeader(text, styleKey) {
  return stylize(String(text).toUpperCase(), styleKey);
}

export function menuTitle(botName) {
  return stylize(`${String(botName || "NAZE").toUpperCase()} MENU`, "fullwidth");
}

export function menuBrand() {
  return plainMode ? "#" : "❖";
}

export function separator(width = 28) {
  return plainMode ? "-".repeat(width) : "─".repeat(width);
}

export function menuDot() {
  return plainMode ? "|" : "•";
}

export { STYLES, SECTION_STYLES, SUB_STYLES };
