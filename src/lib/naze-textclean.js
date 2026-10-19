// Pembersih teks keluar: ubah font unicode aneh jadi teks biasa, hapus emoji dan hiasan kotak.
// Dipasang di sock.sendMessage / sock.relayMessage (lihat naze-socket.js).

// Ditulis dengan kode \u agar tidak ikut berubah saat source dikonversi massal.
const SMALL_CAPS = {
  "\u1D00": "a", "\u0299": "b", "\u1D04": "c", "\u1D05": "d", "\u1D07": "e", "\uA730": "f",
  "\u0262": "g", "\u029C": "h", "\u026A": "i", "\u1D0A": "j", "\u1D0B": "k", "\u029F": "l",
  "\u1D0D": "m", "\u0274": "n", "\u1D0F": "o", "\u1D18": "p", "\u01EB": "q", "\u0280": "r",
  "\u1D1B": "t", "\u1D1C": "u", "\u1D20": "v", "\u1D21": "w", "\u028F": "y", "\u1D22": "z",
};
const SC_CHARS = Object.keys(SMALL_CAPS).join("");
// token = rangkaian huruf yang memuat minimal satu huruf small-caps (huruf s/x asli ikut karena mirip ASCII)
const SC_TOKEN = new RegExp(`[A-Za-z${SC_CHARS}]*[${SC_CHARS}][A-Za-z${SC_CHARS}]*`, "g");

const MATH_ALNUM = /[\u{1D400}-\u{1D7FF}]/gu;
const EMOJI = /(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}])(?:\uFE0F|\u200D|\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;
const KEEP_SYMBOLS = new Set(["\u00A9", "\u00AE", "\u2122"]); // (c) (r) (tm)
const BOX_CHARS = "\u256D\u256E\u2570\u256F\u2500\u2501\u2508\u2504\u2505\u2550\u2551\u2502\u2503\u250F\u2513\u2517\u251B\u2523\u252B\u2533\u253B\u254B\u2B23\u2B21\u25E6";
const ONLY_DECOR = new RegExp(`^[\\s${BOX_CHARS}\\-_=~*]*[${BOX_CHARS}][\\s${BOX_CHARS}\\-_=~*]*$`);
const TITLE_IN_BRACKET = /[\u3014\u300C\u3010\[]\s*([^\u3015\u300D\u3011\]]+?)\s*[\u3015\u300D\u3011\]]/;

function titleCaseToken(tok) {
  const lower = tok
    .split("")
    .map((c) => SMALL_CAPS[c] ?? c)
    .join("")
    .toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function stripEmoji(s) {
  return s
    .replace(new RegExp(EMOJI.source + " ?", "gu"), (m) => (KEEP_SYMBOLS.has(m.trim()) ? m : ""))
    .replace(/\uFE0F|\u20E3/g, "");
}

function cleanSegment(seg) {
  // 1. font aneh -> teks biasa
  seg = seg.replace(MATH_ALNUM, (c) => c.normalize("NFKC"));
  seg = seg.replace(SC_TOKEN, titleCaseToken);
  // 2. emoji
  seg = stripEmoji(seg);
  // 3. hiasan kotak per baris
  const lines = seg.split("\n").map((line) => {
    line = line.replace(new RegExp(`^(\\s*)\\*([${BOX_CHARS}]+)\\*`), "$1$2");
    if (ONLY_DECOR.test(line)) return null;
    const hasBox = new RegExp(`[${BOX_CHARS}]`).test(line);
    if (!hasBox) return line;
    // baris judul: ╭─〔 JUDUL 〕 atau ╭┈┈「 JUDUL 」
    if (/^[\s╭┏]/.test(line) && /[╭┏]/.test(line.trimStart().charAt(0)) ) {
      const t = line.match(TITLE_IN_BRACKET);
      const raw = (t ? t[1] : line.replace(new RegExp(`[${BOX_CHARS}]`, "g"), "")).replace(/[`*]/g, "").trim();
      return raw ? `*${raw}*` : null;
    }
    // baris isi: │ ◦ teks  ->  - teks
    const body = line.replace(new RegExp(`^\\s*[${BOX_CHARS}]+\\s*`), "").replace(/^\s*[`]?◦[`]?\s*/, "");
    const cleaned = body.replace(new RegExp(`[${BOX_CHARS}]+\\s*$`), "").trimEnd();
    return cleaned ? `- ${cleaned}` : null;
  });
  seg = lines.filter((l) => l !== null).join("\n");
  // 4. sisa spasi akibat emoji dihapus
  seg = seg.replace(/^ (?=[^\s>])/gm, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  return seg;
}

export function cleanText(text) {
  if (typeof text !== "string" || !text) return text;
  // jangan sentuh isi blok kode ```...```
  const parts = text.split("```");
  for (let i = 0; i < parts.length; i += 2) parts[i] = cleanSegment(parts[i]);
  return parts.join("```");
}

// key yang isinya bukan teks tampilan
const SKIP_KEYS = new Set([
  "react", "vcard", "url", "mimetype", "fileName", "jpegThumbnail", "thumbnail",
  "buffer", "stream", "image", "video", "audio", "document", "sticker", "key",
  "id", "jid", "data", "payload", "mentions", "mentionedJid", "participant", "remoteJid",
]);

function isBinary(v) {
  return v instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) || typeof v?.pipe === "function";
}

function cleanJsonString(str) {
  try {
    return JSON.stringify(walk(JSON.parse(str), new WeakSet(), 0));
  } catch {
    return cleanText(str);
  }
}

const isJsonKey = (k) => /paramsjson$/i.test(k);

function walk(node, seen, depth) {
  if (typeof node === "string") return cleanText(node);
  if (!node || typeof node !== "object" || depth > 14 || isBinary(node) || seen.has(node)) return node;
  seen.add(node);
  const fni = node.forwardedNewsletterMessageInfo;
  if (fni && typeof fni === "object" && !fni.newsletterJid) {
    delete node.forwardedNewsletterMessageInfo;
  }
  for (const k of Object.keys(node)) {
    if (SKIP_KEYS.has(k)) continue;
    const v = node[k];
    if (typeof v === "string") {
      const c = isJsonKey(k) ? cleanJsonString(v) : cleanText(v);
      if (c !== v) node[k] = c;
    } else if (v && typeof v === "object") {
      walk(v, seen, depth + 1);
    }
  }
  return node;
}

export function cleanContent(content) {
  try {
    if (typeof content === "string") return cleanText(content);
    return walk(content, new WeakSet(), 0);
  } catch {
    return content;
  }
}
