// Utilitas murni untuk fitur gambar NAZE.
// Tidak mengimpor modul lain agar seluruh logika keputusan (pembacaan
// argumen, tangga format, pencarian kualitas kompresi) dapat diuji
// tanpa sharp maupun lingkungan WhatsApp.

const FORMAT_ALIASES = { jpg: "jpeg", jpe: "jpeg" };
const SUPPORTED_FORMATS = ["jpeg", "png", "webp"];

// 1 MB sebagai batas keras kompresi; hasil harus berada di bawah nilai ini.
export const COMPRESS_TARGET_BYTES = 1024 * 1024;
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export const FORMAT_INFO = {
  jpeg: { ext: "jpg", mime: "image/jpeg", label: "JPG" },
  png: { ext: "png", mime: "image/png", label: "PNG" },
  webp: { ext: "webp", mime: "image/webp", label: "WebP" },
};

export function normalizeFormatName(raw) {
  const key = String(raw || "").trim().toLowerCase();
  const canonical = FORMAT_ALIASES[key] || key;
  return SUPPORTED_FORMATS.indexOf(canonical) >= 0 ? canonical : null;
}

// Membaca argumen ".reformat <format> [kualitas]".
// Contoh sah: "png", "jpg 80", "webp 95".
export function parseReformatArgs(text) {
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: "empty" };

  const format = normalizeFormatName(parts[0]);
  if (!format) return { ok: false, reason: "bad-format" };

  if (parts.length > 1) {
    const quality = Number(parts[1]);
    if (!Number.isInteger(quality) || quality < 30 || quality > 100) {
      return { ok: false, reason: "bad-quality" };
    }
    return { ok: true, format, quality };
  }

  return { ok: true, format, quality: null };
}

// Membaca argumen ".hdimg [1-4]". Faktor bawaan 2x.
// Menerima "2", "2x", dan "x2".
export function parseEnhanceArgs(text) {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw) return { ok: true, scale: 2 };

  const match = raw.match(/^x?([1-4])x?$/);
  if (!match) return { ok: false, reason: "bad-scale" };

  return { ok: true, scale: Number(match[1]) };
}

// Tangga format kompresi: format asal dipertahankan; PNG berpindah ke
// WebP hanya bila PNG tidak dapat mencapai batas ukuran ("bila terpaksa").
// Format asing (tiff, avif, dan sejenisnya) dibawa ke WebP.
export function pickCompressFormatLadder(inputFormat) {
  const primary = normalizeFormatName(inputFormat) || "webp";
  if (primary === "png") return ["png", "webp"];
  return [primary];
}

export const COMPRESS_DEFAULTS = {
  targetBytes: COMPRESS_TARGET_BYTES,
  qualityCeil: 90,
  qualityFloor: 30,
  scales: [1, 0.6, 0.45, 0.3, 0.2],
};

// Mencari kualitas tertinggi yang tetap berada di bawah batas untuk satu
// kombinasi format dan skala. Mengembalikan null bila batas tidak mungkin
// dicapai pada kombinasi tersebut.
async function searchBestQuality(image, format, scale, opts) {
  const targetWidth = Math.max(64, Math.round(image.width * scale));
  const encodeAt = (quality) =>
    opts.encode({ buffer: image.buffer, format, quality, targetWidth });

  const fits = (out) => out.buffer.length < opts.targetBytes;

  const ceilOut = await encodeAt(opts.qualityCeil);
  if (fits(ceilOut)) {
    return {
      buffer: ceilOut.buffer,
      width: ceilOut.width,
      height: ceilOut.height,
      format,
      quality: opts.qualityCeil,
      scale,
      sizeBytes: ceilOut.buffer.length,
    };
  }

  const floorOut = await encodeAt(opts.qualityFloor);
  if (!fits(floorOut)) return null;

  let best = floorOut;
  let bestQuality = opts.qualityFloor;
  let lo = opts.qualityFloor + 1;
  let hi = opts.qualityCeil - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const out = await encodeAt(mid);
    if (fits(out)) {
      best = out;
      bestQuality = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    buffer: best.buffer,
    width: best.width,
    height: best.height,
    format,
    quality: bestQuality,
    scale,
    sizeBytes: best.buffer.length,
  };
}

// Mengompresi gambar hingga di bawah batas ukuran dengan tangga berurutan:
// kualitas diturunkan lebih dulu pada resolusi penuh, lalu resolusi
// diturunkan bertahap, dan format cadangan dicoba pada setiap tingkat.
// deps.encode({ buffer, format, quality, targetWidth }) harus mengembalikan
// { buffer, width, height } agar logika ini dapat diuji tanpa sharp.
export async function compressUnderLimit(image, deps) {
  if (!image || !image.width || !image.height || !image.buffer) {
    throw new Error("data gambar tidak lengkap");
  }
  if (!deps || typeof deps.encode !== "function") {
    throw new Error("deps.encode wajib berupa fungsi");
  }

  const opts = { ...COMPRESS_DEFAULTS, ...deps };
  const ladder = pickCompressFormatLadder(image.format);

  for (const scale of opts.scales) {
    for (const format of ladder) {
      const found = await searchBestQuality(image, format, scale, opts);
      if (found) return { ok: true, ...found };
    }
  }

  return { ok: false };
}

// ---------------------------------------------------------------------------
// Pesan pengguna
// ---------------------------------------------------------------------------

export function imageSourceUnsupportedMessage(mediaType) {
  return (
    "Media " + (mediaType || "tersebut") +
    " belum didukung. Fitur ini hanya menerima gambar."
  );
}

export function imageDownloadFailedMessage() {
  return "Gambar gagal diunduh. Silakan kirim ulang gambarnya.";
}

export function imageInvalidMessage() {
  return "Gambar tidak dapat dibaca. Pastikan berkas tidak rusak.";
}

export function imageTooLargeMessage(maxLabel) {
  return "Ukuran gambar melebihi batas " + maxLabel + ".";
}

export function processFailedMessage() {
  return "Pemrosesan gambar gagal. Silakan coba lagi dengan gambar lain.";
}

export function enhanceGuideMessage() {
  return (
    'Kirim atau balas gambar dengan ".hdimg [2|3|4]" untuk meningkatkan ' +
    "resolusi dan ketajamannya. Faktor bawaan 2x."
  );
}

export function enhanceScaleInvalidMessage() {
  return 'Faktor pembesaran harus angka 1 sampai 4. Contoh: ".hdimg 3"';
}

export function enhanceDoneMessage(beforeDims, afterDims, sizeBefore, sizeAfter) {
  return (
    "Peningkatan selesai: " + beforeDims + " menjadi " + afterDims +
    " (" + sizeBefore + " menjadi " + sizeAfter + ")." +
    " Berkas dikirim sebagai dokumen agar WhatsApp tidak mengompresnya ulang."
  );
}

export function reformatGuideMessage() {
  return (
    'Kirim atau balas gambar dengan ".reformat jpg|png|webp [kualitas 30-100]".' +
    ' Contoh: ".reformat png" atau ".reformat jpg 85".'
  );
}

export function reformatArgsInvalidMessage(reason) {
  if (reason === "bad-format") {
    return "Format harus jpg, png, atau webp.";
  }
  if (reason === "bad-quality") {
    return "Kualitas harus angka bulat 30 sampai 100.";
  }
  return reformatGuideMessage();
}

export function reformatDoneMessage(fromLabel, toLabel, sizeBefore, sizeAfter) {
  return (
    "Format berhasil diubah dari " + fromLabel + " ke " + toLabel +
    " (" + sizeBefore + " menjadi " + sizeAfter + ")." +
    " Berkas dikirim sebagai dokumen agar formatnya tetap utuh."
  );
}

export function compressGuideMessage() {
  return (
    'Kirim atau balas gambar dengan ".kompres" untuk mengecilkan ukurannya ' +
    "di bawah 1 MB dengan kualitas sejernih mungkin."
  );
}

export function compressAlreadySmallMessage(sizeLabel) {
  return (
    "Gambar sudah di bawah 1 MB (" + sizeLabel + "), tidak perlu dikompres."
  );
}

export function compressDoneMessage(sizeBefore, sizeAfter, quality, changedFormat) {
  return (
    "Kompresi selesai: " + sizeBefore + " menjadi " + sizeAfter +
    " (kualitas " + quality + ")." +
    " Berkas dikirim sebagai dokumen agar ukurannya tetap di bawah 1 MB." +
    (changedFormat
      ? " Format diubah ke WebP karena format asal tidak dapat mencapai batas tersebut."
      : "")
  );
}

export function compressFailedMessage() {
  return (
    "Gambar tidak dapat dikompres ke bawah 1 MB tanpa merusak kualitas " +
    "secara serius. Silakan coba gambar dengan resolusi lebih kecil."
  );
}

export function removebgDevMessage() {
  return (
    "Fitur penghapus latar belakang masih dalam pengembangan dan akan " +
    "diaktifkan pada pembaruan berikutnya. Sementara ini, gunakan .kompres " +
    "untuk mengecilkan ukuran gambar atau .reformat untuk mengubah formatnya."
  );
}