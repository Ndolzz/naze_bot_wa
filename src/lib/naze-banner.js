import sharp from "sharp";
import { getAssetBuffer } from "./naze-asset-manager.js";
import {
  BANNER_WIDTH,
  BANNER_HEIGHT,
  renderBannerPixels,
} from "./naze-banner-pixels.js";

// Banner NAZE: dikirim bersama setiap balasan teks bot (m.reply).
// Prioritas aset "naze-logo" dari config.js (assets/image/naze-logo.jpg).
// Jika file tersebut tidak ada, banner dibuat otomatis dari piksel
// (font piksel internal) lalu dikodekan menjadi JPEG dengan sharp,
// sehingga bot tetap tampil konsisten tanpa berkas gambar di repo.
//
// Sejak menu interaktif, tiap mode dapat memakai banner sendiri:
// - getBannerImage()      : banner utama (kompatibel dengan semua pemanggilan lama).
// - getBannerImage(mode)  : banner mode; memakai aset "naze-menu-<mode>"
//                           bila tersedia, jika tidak banner otomatis dengan
//                           subjudul label mode. Cache per mode terpisah.

const BANNER_MIN_ASSET_BYTES = 1024;

// Label subjudul banner untuk tiap mode menu (ASCII, sesuai font piksel).
const MODE_BANNER_LABEL = {
  files: "FILE MANAGEMENT",
  sticker: "STICKER STUDIO",
  game: "GAME MODE",
  search: "SEARCH MODE",
  download: "DOWNLOADER MODE",
  tools: "CREATIVE TOOLS",
  owner: "OWNER MODE",
  group: "GROUP MODE",
  ai: "AI MODE",
  other: "OTHER MODES",
};

async function renderBannerJpeg(subtitle = null) {
  const pixels = renderBannerPixels(subtitle);
  return sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), {
    raw: { width: BANNER_WIDTH, height: BANNER_HEIGHT, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// Cache per mode: "main" untuk banner utama, key mode untuk lainnya.
const bannerCacheByMode = new Map();

function bannerCacheKey(mode) {
  return mode == null ? "main" : String(mode).trim().toLowerCase();
}

/**
 * Mengembalikan buffer gambar banner NAZE.
 * Tanpa argumen: banner utama, memakai aset "naze-logo" bila tersedia,
 * jika tidak banner dibuat otomatis. Perilaku identik dengan versi sebelumnya.
 * Dengan nama mode: banner mode tersebut, memakai aset "naze-menu-<mode>"
 * bila tersedia, jika tidak banner otomatis dengan subjudul label mode.
 * Hasil per key di-cache terpisah di memori.
 * @param {string|null} mode - Nama mode (kategori menu), atau null/undefined.
 * @returns {Promise<Buffer|null>} Buffer JPEG, atau null bila gagal.
 */
export async function getBannerImage(mode = null) {
  const key = bannerCacheKey(mode);
  if (bannerCacheByMode.has(key)) return bannerCacheByMode.get(key);

  const assetKey = mode == null ? "naze-logo" : "naze-menu-" + key;
  let buffer = null;
  try {
    const asset = getAssetBuffer(assetKey);
    if (asset && asset.length >= BANNER_MIN_ASSET_BYTES) {
      buffer = asset;
    }
  } catch {
    // Aset tidak tersedia; lanjut ke banner otomatis.
  }

  if (!buffer) {
    try {
      const subtitle =
        mode == null ? null : MODE_BANNER_LABEL[key] || String(mode).toUpperCase();
      buffer = await renderBannerJpeg(subtitle);
    } catch (e) {
      console.error("[Banner] Gagal membuat banner otomatis:", e.message);
      buffer = null;
    }
  }

  if (buffer) bannerCacheByMode.set(key, buffer);
  return buffer;
}

/**
 * Menghapus cache banner. Tanpa argumen menghapus seluruh cache (perilaku
 * lama setelah aset naze-logo diganti); dengan nama mode menghapus hanya
 * cache mode tersebut.
 * @param {string|null} mode - Nama mode, atau null untuk semua.
 */
export function resetBannerCache(mode = null) {
  if (mode == null) {
    bannerCacheByMode.clear();
    return;
  }
  bannerCacheByMode.delete(bannerCacheKey(mode));
}
