// Penyusun PDF mandiri tanpa dependensi tambahan.
// Mendukung halaman teks (Helvetica, WinAnsiEncoding) dan halaman gambar JPEG
// (DCTDecode). Modul ini murni JavaScript: tidak melakukan operasi berkas dan
// tidak bergantung pada Buffer, sehingga mudah diuji secara terisolasi.

const PAGE_WIDTH = 595.28; // A4 dalam point
const PAGE_HEIGHT = 841.89;
const MARGIN = 56.7; // sekitar 2 cm
const FONT_SIZE = 11;
const LINE_HEIGHT = 15;
const DEFAULT_CHAR_WIDTH = 556;

// Lebar huruf Helvetica dalam satu per seribu em (tabel AFM standar, ASCII 32-126).
const HELVETICA_WIDTHS = {
  " ": 278, "!": 278, "\"": 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
  "@": 1015, "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778,
  "H": 722, "I": 278, "J": 500, "K": 667, "L": 556, "M": 833, "N": 722, "O": 778,
  "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944,
  "X": 667, "Y": 667, "Z": 611, "[": 278, "\\": 278, "]": 278, "^": 469, "_": 556,
  "\`": 333, "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556,
  "h": 556, "i": 222, "j": 222, "k": 500, "l": 222, "m": 833, "n": 556, "o": 556,
  "p": 556, "q": 556, "r": 333, "s": 500, "t": 278, "u": 556, "v": 500, "w": 722,
  "x": 500, "y": 500, "z": 500, "{": 334, "|": 260, "}": 334, "~": 584,
};

// Pengganti karakter yang tidak tersedia pada pengodean WinAnsi.
const UNICODE_SUBSTITUTIONS = [
  [/[\u2018\u2019\u201B]/g, "'"],
  [/[\u201C\u201D\u201F]/g, "\""],
  [/[\u2013\u2014]/g, "-"],
  [/\u2026/g, "..."],
  [/\u2022/g, "*"],
  [/\u00A0/g, " "],
  [/\u2192/g, "->"],
  [/\u2190/g, "<-"],
  [/\t/g, "    "],
];

function normalizeText(text) {
  let out = String(text ?? "").replace(/\r\n?/g, "\n");
  for (const [pattern, replacement] of UNICODE_SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function charWidth(ch) {
  const width = HELVETICA_WIDTHS[ch];
  return width !== undefined ? width : DEFAULT_CHAR_WIDTH;
}

function textWidth(str, fontSize) {
  let units = 0;
  for (const ch of str) units += charWidth(ch);
  return (units / 1000) * fontSize;
}

function wrapText(text, maxWidth, fontSize = FONT_SIZE) {
  const lines = [];
  for (const paragraph of normalizeText(text).split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current === "" ? word : current + " " + word;
      if (textWidth(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current !== "") {
        lines.push(current);
        current = "";
      }
      if (textWidth(word, fontSize) <= maxWidth) {
        current = word;
        continue;
      }
      let piece = "";
      for (const ch of word) {
        if (textWidth(piece + ch, fontSize) <= maxWidth) {
          piece += ch;
        } else {
          lines.push(piece);
          piece = ch;
        }
      }
      current = piece;
    }
    if (current !== "") lines.push(current);
  }
  return lines;
}

function maxLinesPerPage() {
  return Math.max(1, Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT));
}

function paginateLines(lines) {
  const perPage = maxLinesPerPage();
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }
  if (pages.length === 0) pages.push([]);
  return pages;
}

// Membaca ukuran gambar JPEG dari penanda SOF tanpa mendekode isinya.
function parseJpegSize(bytes) {
  if (!bytes || !bytes.length) return null;
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const SOF_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) return null;
    i += 2;
    if (i + 1 >= b.length) return null;
    const length = (b[i] << 8) | b[i + 1];
    if (length < 2) return null;
    if (SOF_MARKERS.has(marker)) {
      if (i + 7 >= b.length) return null;
      const height = (b[i + 3] << 8) | b[i + 4];
      const width = (b[i + 5] << 8) | b[i + 6];
      const components = b[i + 7];
      if (width <= 0 || height <= 0) return null;
      return {
        width,
        height,
        components,
        progressive: marker === 0xc2 || marker === 0xc3 || marker === 0xc9 || marker === 0xca,
      };
    }
    i += length;
  }
  return null;
}

function latin1Bytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[i] = code <= 0xff ? code : 0x3f; // '?' untuk karakter di luar WinAnsi
  }
  return bytes;
}

function concatBytes(parts) {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function escapePdfString(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildTextPageContent(lines) {
  let out = "BT\n/F1 " + FONT_SIZE + " Tf\n";
  const firstBaseline = PAGE_HEIGHT - MARGIN - FONT_SIZE;
  lines.forEach((line, index) => {
    const y = firstBaseline - index * LINE_HEIGHT;
    out += "1 0 0 1 " + MARGIN.toFixed(2) + " " + y.toFixed(2) + " Tm\n";
    if (line !== "") out += "(" + escapePdfString(line) + ") Tj\n";
  });
  out += "ET\n";
  return latin1Bytes(out);
}

function buildImagePageContent(imageName, width, height) {
  const fitWidth = PAGE_WIDTH - MARGIN * 2;
  const fitHeight = PAGE_HEIGHT - MARGIN * 2;
  let scale = Math.min(fitWidth / width, fitHeight / height);
  if (scale > 1) scale = 1;
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = (PAGE_WIDTH - drawWidth) / 2;
  const y = (PAGE_HEIGHT - drawHeight) / 2;
  const content =
    "q\n" +
    drawWidth.toFixed(2) + " 0 0 " + drawHeight.toFixed(2) + " " +
    x.toFixed(2) + " " + y.toFixed(2) + " cm\n" +
    "/" + imageName + " Do\n" +
    "Q\n";
  return latin1Bytes(content);
}

function colorSpaceName(components) {
  if (components === 1) return "/DeviceGray";
  if (components === 4) return "/DeviceCMYK";
  return "/DeviceRGB";
}

// Membangun berkas PDF dari daftar halaman:
// [{ kind: "text", text }, { kind: "jpeg", data: Uint8Array }]
// Mengembalikan Uint8Array atau null jika tidak ada halaman yang dapat dibangun.
function buildPdf(pagesSpec) {
  const pages = [];
  for (const spec of pagesSpec || []) {
    if (!spec) continue;
    if (spec.kind === "text") {
      const wrapped = wrapText(spec.text, PAGE_WIDTH - MARGIN * 2);
      for (const lines of paginateLines(wrapped)) {
        pages.push({ type: "text", lines });
      }
    } else if (spec.kind === "jpeg") {
      const info = parseJpegSize(spec.data);
      if (!info) return null;
      pages.push({ type: "jpeg", data: spec.data, info });
    }
  }
  if (pages.length === 0) return null;

  const objects = [];
  function reserveObject() {
    objects.push(null);
    return objects.length;
  }
  function setObject(id, bytes) {
    objects[id - 1] = bytes;
  }

  const catalogId = reserveObject();
  const pagesRootId = reserveObject();
  const fontId = reserveObject();

  const kidIds = [];
  for (const page of pages) {
    const pageId = reserveObject();
    const contentId = reserveObject();
    let imageId = 0;

    if (page.type === "jpeg") {
      imageId = reserveObject();
      const info = page.info;
      const header = latin1Bytes(
        "<< /Type /XObject /Subtype /Image /Width " + info.width +
        " /Height " + info.height +
        " /ColorSpace " + colorSpaceName(info.components) +
        " /BitsPerComponent 8 /Filter /DCTDecode /Length " + page.data.length + " >>\nstream\n"
      );
      setObject(imageId, concatBytes([header, page.data, latin1Bytes("\nendstream")]));
    }

    const content = page.type === "text"
      ? buildTextPageContent(page.lines)
      : buildImagePageContent("Im0", page.info.width, page.info.height);
    setObject(contentId, content);

    const resources = imageId
      ? "<< /Font << /F1 " + fontId + " 0 R >> /XObject << /Im0 " + imageId + " 0 R >> >>"
      : "<< /Font << /F1 " + fontId + " 0 R >> >>";
    setObject(pageId, latin1Bytes(
      "<< /Type /Page /Parent " + pagesRootId + " 0 R /MediaBox [0 0 " +
      PAGE_WIDTH.toFixed(2) + " " + PAGE_HEIGHT.toFixed(2) +
      "] /Resources " + resources + " /Contents " + contentId + " 0 R >>"
    ));
    kidIds.push(pageId);
  }

  setObject(catalogId, latin1Bytes("<< /Type /Catalog /Pages " + pagesRootId + " 0 R >>"));
  setObject(
    pagesRootId,
    latin1Bytes(
      "<< /Type /Pages /Kids [" +
      kidIds.map((id) => id + " 0 R").join(" ") +
      "] /Count " + kidIds.length + " >>"
    )
  );
  setObject(
    fontId,
    latin1Bytes(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    )
  );

  const parts = [latin1Bytes("%PDF-1.4\n")];
  let offset = parts[0].length;
  const xrefOffsets = [];
  for (let id = 1; id <= objects.length; id += 1) {
    xrefOffsets[id] = offset;
    const head = latin1Bytes(id + " 0 obj\n");
    const tail = latin1Bytes("endobj\n");
    parts.push(head, objects[id - 1], tail);
    offset += head.length + objects[id - 1].length + tail.length;
  }

  const xrefOffset = offset;
  let xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let id = 1; id <= objects.length; id += 1) {
    xref += String(xrefOffsets[id]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer =
    "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalogId + " 0 R >>\n" +
    "startxref\n" + xrefOffset + "\n%%EOF\n";

  parts.push(latin1Bytes(xref), latin1Bytes(trailer));
  return concatBytes(parts);
}

export {
  buildPdf,
  parseJpegSize,
  wrapText,
  normalizeText,
  maxLinesPerPage,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  FONT_SIZE,
  LINE_HEIGHT,
};
