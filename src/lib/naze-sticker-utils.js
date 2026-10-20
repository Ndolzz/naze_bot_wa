// Utilitas murni Sticker Studio NAZE: tata letak teks BRAT, easing,
// pola keyframe animasi, validasi, templat pesan, dan teks menu.
// Modul ini sengaja hanya mengimpor modul murni lain agar logika intinya
// dapat diuji secara terisolasi (lihat tests/sticker-studio.test.js).

import { BOT_TITLE, messageHeader } from "./naze-file-utils.js";

// ---------------------------------------------------------------------------
// Konstanta desain BRAT
// ---------------------------------------------------------------------------

const BRAT_CANVAS_SIZE = 512; // kanvas persegi WhatsApp
const BRAT_MARGIN = 24; // margin minimal tanpa memotong karakter
const BRAT_LINE_HEIGHT_RATIO = 1.15;
const BRAT_MIN_FONT = 16;
const BRAT_MAX_FONT = 260;
const BRAT_DEFAULT_MAX_TEXT = 500;

// Batas bawaan untuk konversi dan penyimpanan
const DEFAULT_STUDIO_LIMITS = {
  maxTextLength: BRAT_DEFAULT_MAX_TEXT,
  maxMediaBytes: 30 * 1024 * 1024, // 30 MB media sumber
  maxVideoSeconds: 10, // batas durasi video untuk stiker
  bratvidDurationSeconds: 3, // durasi satu putaran animasi
  bratvidFps: 10, // frame rate animasi
  bratvidMaxBytes: 1024 * 1024, // 1 MB batas WebP animasi
  gifMaxBytes: 15 * 1024 * 1024, // 15 MB batas GIF hasil konversi
  store: {
    maxStickers: 100,
    maxStickerBytes: 1024 * 1024,
  },
};

function resolveStudioLimits(overrides = {}) {
  const merged = { ...DEFAULT_STUDIO_LIMITS, store: { ...DEFAULT_STUDIO_LIMITS.store } };
  const storeOverrides = overrides.store || {};
  for (const key of Object.keys(DEFAULT_STUDIO_LIMITS)) {
    if (key === "store") continue;
    const value = Number(overrides[key]);
    if (Number.isFinite(value) && value > 0) merged[key] = value;
  }
  for (const key of Object.keys(DEFAULT_STUDIO_LIMITS.store)) {
    const value = Number(storeOverrides[key]);
    if (Number.isFinite(value) && value > 0) merged.store[key] = value;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Validasi teks BRAT
// ---------------------------------------------------------------------------

function validateBratText(text, maxLength = BRAT_DEFAULT_MAX_TEXT) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return { ok: false, reason: "empty", text: "" };
  if ([...normalized].length > maxLength) {
    return { ok: false, reason: "too-long", text: normalized };
  }
  return { ok: true, reason: null, text: normalized };
}

// ---------------------------------------------------------------------------
// Tata letak teks BRAT (ukuran font dan pemenggalan baris otomatis)
// ---------------------------------------------------------------------------

/**
 * Memenggal teks menjadi baris dengan lebar terbatas.
 * Kata yang lebih panjang dari lebar maksimal dipenggal per karakter
 * agar tidak ada teks yang keluar dari frame.
 * @param {string} text - Teks sumber (sudah dinormalisasi)
 * @param {number} fontSize - Ukuran font yang diuji
 * @param {Function} measure - Fungsi (text, fontSize) => lebar dalam piksel
 * @param {number} maxWidth - Lebar maksimal satu baris
 * @returns {string[]} Daftar baris
 */
function wrapBratText(text, fontSize, measure, maxWidth) {
  const words = String(text).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (measure(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (measure(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const char of word) {
      const chunkCandidate = chunk + char;
      if (measure(chunkCandidate, fontSize) <= maxWidth) {
        chunk = chunkCandidate;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Menghitung tata letak BRAT: mencari ukuran font terbesar yang menampung
 * seluruh teks di dalam kanvas dengan margin minimal.
 * @param {string} text - Teks sumber
 * @param {Function} measure - Fungsi (text, fontSize) => lebar dalam piksel
 * @param {Object} [options]
 * @returns {Object|null} Tata letak, atau null bila teks tidak tertampung
 */
function computeBratLayout(text, measure, options = {}) {
  const canvasSize = options.canvasSize ?? BRAT_CANVAS_SIZE;
  const margin = options.margin ?? BRAT_MARGIN;
  const lineHeightRatio = options.lineHeightRatio ?? BRAT_LINE_HEIGHT_RATIO;
  const minFont = options.minFont ?? BRAT_MIN_FONT;
  const maxFont = options.maxFont ?? BRAT_MAX_FONT;

  const normalized = String(text ?? "").trim();
  if (!normalized) return null;

  const availWidth = canvasSize - margin * 2;
  const availHeight = canvasSize - margin * 2;

  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 2) {
    const lines = wrapBratText(normalized, fontSize, measure, availWidth);
    if (lines.length === 0) continue;
    const lineHeight = fontSize * lineHeightRatio;
    const totalHeight = lines.length * lineHeight;
    const widthsFit = lines.every((line) => measure(line, fontSize) <= availWidth);
    if (totalHeight <= availHeight && widthsFit) {
      return {
        canvasSize,
        margin,
        fontSize,
        lineHeight,
        totalHeight,
        lineCount: lines.length,
        lines,
        blockTop: (canvasSize - totalHeight) / 2,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fungsi easing untuk sistem keyframe
// ---------------------------------------------------------------------------

function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeInCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * t;
}

function easeInOutCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutSine(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ---------------------------------------------------------------------------
// Lima pola keyframe BRATVID
//
// Setiap pola menerima waktu normal t (0 <= t < 1, satu putaran penuh) dan
// mengembalikan transformasi per frame. Semua pola bersifat siklik:
// nilai pada t = 0 sama dengan nilai pada t = 1 sehingga animasi berulang
// dengan mulus tanpa frame rusak.
//
// Bentuk hasil:
// {
//   block: { dx, dy, scale, rotate },        // transformasi seluruh blok teks
//   lines: [{ dx, dy, scale, rotate }],      // transformasi per baris (opsional)
//   halves: [{ dx, dy, rotate }, { ... }],   // belahan kiri/kanan (split saja)
// }
// ---------------------------------------------------------------------------

const PATTERN_IDS = [
  "elastic-snap",
  "wave-cascade",
  "orbit-shift",
  "beat-pulse",
  "split-reassemble",
];

const PATTERN_LABELS = {
  "elastic-snap": "Elastic Snap",
  "wave-cascade": "Wave Cascade",
  "orbit-shift": "Orbit Shift",
  "beat-pulse": "Beat Pulse",
  "split-reassemble": "Split Reassemble",
};

const IDENTITY_TRANSFORM = { dx: 0, dy: 0, scale: 1, rotate: 0 };

function patternFrameTransforms(patternId, t, context = {}) {
  const time = ((Number(t) % 1) + 1) % 1;
  const lineCount = Math.max(1, Number(context.lineCount) || 1);

  if (patternId === "elastic-snap") {
    // Teks menuju posisi akhir dengan easing elastis (melewati target
    // sedikit lalu kembali), diam sebentar, lalu keluar agar loop mulus.
    let scale;
    if (time < 0.5) {
      scale = 0.62 + 0.38 * easeOutElastic(time / 0.5);
    } else if (time < 0.85) {
      scale = 1;
    } else {
      scale = 1 - 0.38 * easeInCubic((time - 0.85) / 0.15);
    }
    return {
      block: { ...IDENTITY_TRANSFORM, scale, dy: (1 - scale) * 90 },
      lines: [],
    };
  }

  if (patternId === "wave-cascade") {
    // Baris bergerak bergantian dengan jeda waktu membentuk gelombang.
    const amplitude = 34;
    const stagger = Math.min(0.12, 1 / Math.max(lineCount * 2, 2));
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
      const dy = amplitude * Math.sin(2 * Math.PI * (time - i * stagger));
      lines.push({ ...IDENTITY_TRANSFORM, dy: Math.round(dy * 100) / 100 });
    }
    return { block: { ...IDENTITY_TRANSFORM }, lines };
  }

  if (patternId === "orbit-shift") {
    // Blok teks menempuh lintasan melingkar dengan rotasi ringan,
    // lalu kembali ke susunan semula.
    const radius = 44;
    const maxRotate = 8 * (Math.PI / 180);
    const angle = 2 * Math.PI * time;
    return {
      block: {
        ...IDENTITY_TRANSFORM,
        dx: Math.round(radius * Math.cos(angle) * 100) / 100,
        dy: Math.round(radius * Math.sin(angle) * 100) / 100,
        rotate: Math.round(maxRotate * Math.sin(angle) * 10000) / 10000,
      },
      lines: [],
    };
  }

  if (patternId === "beat-pulse") {
    // Ukuran teks membesar dan mengecil secara ritmis dua ketukan per putaran.
    const amplitude = 0.13;
    const pulse = Math.pow(Math.abs(Math.sin(Math.PI * 2 * time)), 2);
    return {
      block: { ...IDENTITY_TRANSFORM, scale: 1 + amplitude * pulse },
      lines: [],
    };
  }

  if (patternId === "split-reassemble") {
    // Teks terbelah dua; tiap belahan menempuh jalur berbeda lalu menyatu.
    const distance = 96;
    const spread = 26;
    const out = Math.sin(Math.PI * time);
    const sway = Math.sin(2 * Math.PI * time);
    return {
      block: { ...IDENTITY_TRANSFORM },
      lines: [],
      halves: [
        {
          dx: Math.round(-distance * out * 100) / 100,
          dy: Math.round(spread * sway * 100) / 100,
          rotate: 0,
        },
        {
          dx: Math.round(distance * out * 100) / 100,
          dy: Math.round(-spread * sway * 100) / 100,
          rotate: 0,
        },
      ],
    };
  }

  return { block: { ...IDENTITY_TRANSFORM }, lines: [] };
}

/**
 * Memilih pola animasi secara acak.
 * Bila pola sebelumnya diketahui, pola tersebut dikeluarkan dari giliran
 * sekali agar tidak ada pola yang muncul dua kali berturut-turut.
 * Konsekuensi: pemilihan tidak lagi independen antar perintah (pola yang
 * sama tidak pernah berulang berurutan), tetapi setiap pola tetap memiliki
 * peluang jangka panjang yang sama.
 * @param {string|null} previousId - Id pola sebelumnya (atau null)
 * @param {Function} [rand] - Generator acak untuk pengujian
 * @returns {string} Id pola terpilih
 */
function pickPattern(previousId = null, rand = Math.random) {
  const pool =
    previousId && PATTERN_IDS.length > 1
      ? PATTERN_IDS.filter((id) => id !== previousId)
      : PATTERN_IDS;
  const index = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return pool[index];
}

// ---------------------------------------------------------------------------
// Validasi nama stiker tersimpan
// ---------------------------------------------------------------------------

const STICKER_NAME_MAX = 32;

function validateStickerName(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "empty", name: "" };
  if (!/^[a-z0-9_-]{1,32}$/.test(normalized)) {
    return { ok: false, reason: "invalid", name: normalized };
  }
  return { ok: true, reason: null, name: normalized };
}

// ---------------------------------------------------------------------------
// Teks menu Sticker Studio
// ---------------------------------------------------------------------------

function stickerStudioMenuText() {
  return [
    "*STICKER STUDIO*",
    "",
    "*STICKER MAKER*",
    "",
    '1. ".sticker"',
    "   Fungsi: membuat stiker dari gambar atau video",
    '2. ".s"',
    "   Fungsi: alias dari \".sticker\"",
    '3. ".stiker"',
    "   Fungsi: alias dari \".sticker\"",
    '4. ".brat"',
    "   Fungsi: membuat stiker teks BRAT statis",
    '5. ".bratvid"',
    "   Fungsi: membuat stiker teks BRAT animasi",
    "",
    "*MEDIA CONVERTER*",
    "",
    '6. ".toimg"',
    "   Fungsi: mengubah stiker menjadi gambar",
    '7. ".togif"',
    "   Fungsi: mengubah stiker animasi menjadi GIF",
    '8. ".tovideo"',
    "   Fungsi: mengubah stiker animasi menjadi video",
    "",
    "*STICKER MANAGEMENT*",
    "",
    '9. ".take"',
    "   Fungsi: mengubah metadata pembuat stiker",
    '10. ".steal"',
    "   Fungsi: mengambil stiker dengan metadata baru, opsional menyimpan",
    '11. ".getsticker"',
    "   Fungsi: mengambil stiker tersimpan berdasarkan nama",
    '12. ".liststicker"',
    "   Fungsi: menampilkan daftar stiker tersimpan",
    '13. ".delsticker"',
    "   Fungsi: menghapus stiker tersimpan berdasarkan nama",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Templat pesan
// ---------------------------------------------------------------------------

function studioTextEmptyMessage(command) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Teks tidak ditemukan.",
    "",
    `Kirim "${command}" diikuti teksnya, atau balas pesan teks dengan "${command}".`,
  ].join("\n");
}

function studioTextTooLongMessage(maxLength) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Teks terlalu panjang. Maksimal ${maxLength} karakter.`,
    "",
    "Persingkat teks lalu coba lagi.",
  ].join("\n");
}

function studioTextDoesNotFitMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Teks tidak dapat ditampung di dalam kanvas stiker.",
    "",
    "Persingkat teks lalu coba lagi.",
  ].join("\n");
}

function studioRenderFailedMessage(reason) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Stiker tidak dapat dibuat: ${reason}.`,
    "",
    "Silakan coba lagi. Jika masalah berlanjut, pastikan ffmpeg tersedia di server.",
  ].join("\n");
}

function stickerGuideMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Media tidak ditemukan.",
    "",
    'Kirim atau balas gambar/video dengan ".sticker".',
    "",
    "Gambar dikonversi menjadi stiker statis; video menjadi stiker animasi.",
  ].join("\n");
}

function stickerMediaUnsupportedMessage(mediaType) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Media bertipe "${mediaType}" tidak dapat diubah menjadi stiker.`,
    "",
    "Gunakan gambar atau video, lalu coba lagi.",
  ].join("\n");
}

function stickerVideoTooLongMessage(maxSeconds) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Durasi video melebihi batas maksimal ${maxSeconds} detik.`,
    "",
    "Gunakan video yang lebih pendek.",
  ].join("\n");
}

function stickerMediaTooLargeMessage(maxBytes) {
  const mb = Math.round(maxBytes / (1024 * 1024));
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Ukuran media melebihi batas maksimal ${mb} MB.`,
    "",
    "Gunakan media yang lebih kecil.",
  ].join("\n");
}

function converterGuideMessage(command) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Stiker tidak ditemukan.",
    "",
    `Kirim atau balas stiker dengan "${command}".`,
  ].join("\n");
}

function converterNotAnimatedMessage(command) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Stiker ini bukan stiker animasi.",
    "",
    `"${command}" hanya berlaku untuk stiker animasi.`,
  ].join("\n");
}

function converterInvalidStickerMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Berkas stiker tidak valid atau tidak dapat dibaca.",
    "",
    "Kirim ulang stiker lalu coba lagi.",
  ].join("\n");
}

function converterTooLargeMessage(kind, maxBytes) {
  const mb = Math.round(maxBytes / (1024 * 1024));
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Hasil konversi ${kind} melebihi batas ${mb} MB.`,
    "",
    "Gunakan stiker animasi yang lebih pendek.",
  ].join("\n");
}

function converterFailedMessage(reason) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Konversi gagal: ${reason}.`,
    "",
    "Silakan coba lagi. Jika masalah berlanjut, pastikan ffmpeg tersedia di server.",
  ].join("\n");
}

function takeGuideMessage(command) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Stiker tidak ditemukan.",
    "",
    `Kirim atau balas stiker dengan "${command}".`,
    "",
    `Format opsional: "${command} nama pack | nama author"`,
  ].join("\n");
}

function metadataDoneMessage(packname, author) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Metadata stiker berhasil diubah.",
    "",
    `Pack: ${packname}`,
    `Author: ${author}`,
  ].join("\n");
}

function stealGuideMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Stiker tidak ditemukan.",
    "",
    'Kirim atau balas stiker dengan ".steal".',
    "",
    'Format opsional: ".steal nama" untuk menyimpan stiker ke koleksi.',
  ].join("\n");
}

function storeInvalidNameMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Nama stiker tidak valid.",
    "",
    "Nama hanya boleh memuat huruf kecil, angka, garis bawah, dan tanda hubung,",
    `dengan panjang maksimal ${STICKER_NAME_MAX} karakter.`,
  ].join("\n");
}

function storeNameExistsMessage(name) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Nama "${name}" sudah dipakai stiker lain.`,
    "",
    "Gunakan nama berbeda, atau hapus dengan \".delsticker\" terlebih dahulu.",
  ].join("\n");
}

function storeFullMessage(maxStickers) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Penyimpanan stiker penuh (maksimal ${maxStickers} stiker).`,
    "",
    "Hapus stiker yang tidak terpakai dengan \".delsticker\".",
  ].join("\n");
}

function storeTooLargeMessage(maxBytes) {
  const kb = Math.round(maxBytes / 1024);
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Ukuran stiker melebihi batas penyimpanan ${kb} KB.`,
  ].join("\n");
}

function storeSavedMessage(name) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Stiker tersimpan dengan nama "${name}".`,
    "",
    `Kirim ".getsticker ${name}" untuk mengambilnya kembali.`,
  ].join("\n");
}

function storeNotFoundMessage(name) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Stiker dengan nama "${name}" tidak ditemukan.`,
    "",
    'Kirim ".liststicker" untuk melihat daftar stiker tersimpan.',
  ].join("\n");
}

function storeListEmptyMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Belum ada stiker yang tersimpan.",
    "",
    'Simpan stiker dengan ".steal nama" saat mengirim atau membalas stiker.',
  ].join("\n");
}

function storeListMessage(entries, maxStickers) {
  const lines = [
    messageHeader("STICKER STUDIO"),
    "",
    `*STICKER MANAGEMENT* (${entries.length}/${maxStickers})`,
    "",
  ];
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. "${entry.name}"`);
    lines.push(
      `   Disimpan oleh ${entry.senderNumber} pada ${entry.createdLabel} (${entry.sizeLabel})`,
    );
  });
  lines.push("");
  lines.push('Kirim ".getsticker nama" untuk mengambil stiker.');
  return lines.join("\n");
}

function storeDeletedMessage(name) {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    `Stiker "${name}" berhasil dihapus.`,
  ].join("\n");
}

function storeDeleteDeniedMessage() {
  return [
    messageHeader("STICKER STUDIO"),
    "",
    "Stiker ini hanya dapat dihapus oleh penyimpannya atau owner bot.",
  ].join("\n");
}

export {
  BOT_TITLE,
  BRAT_CANVAS_SIZE,
  BRAT_MARGIN,
  BRAT_LINE_HEIGHT_RATIO,
  BRAT_MIN_FONT,
  BRAT_MAX_FONT,
  BRAT_DEFAULT_MAX_TEXT,
  DEFAULT_STUDIO_LIMITS,
  STICKER_NAME_MAX,
  PATTERN_IDS,
  PATTERN_LABELS,
  IDENTITY_TRANSFORM,
  resolveStudioLimits,
  validateBratText,
  wrapBratText,
  computeBratLayout,
  easeOutElastic,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  patternFrameTransforms,
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
};
