// Penyimpanan stiker NAZE: kumpulan stiker tersimpan per nama.
// Berkas stiker disimpan di storage/stickers dengan indeks index.json.
// Modul ini sengaja tidak bergantung pada library WhatsApp agar mudah diuji.

import fs from "fs";
import path from "path";
import Crypto from "crypto";

const STORE_ROOT = path.join(process.cwd(), "storage", "stickers");
const INDEX_FILE = path.join(STORE_ROOT, "index.json");

let indexCache = null;

function ensureStoreDir() {
  if (!fs.existsSync(STORE_ROOT)) {
    fs.mkdirSync(STORE_ROOT, { recursive: true });
  }
}

function loadIndex() {
  if (indexCache) return indexCache;
  ensureStoreDir();
  try {
    const raw = fs.readFileSync(INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw);
    indexCache = {
      version: 1,
      stickers: Array.isArray(parsed.stickers) ? parsed.stickers : [],
    };
  } catch {
    indexCache = { version: 1, stickers: [] };
  }
  return indexCache;
}

function saveIndex() {
  ensureStoreDir();
  const tmpFile = INDEX_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(loadIndex(), null, 2), "utf8");
  fs.renameSync(tmpFile, INDEX_FILE);
}

function stickerFilePath(fileName) {
  return path.join(STORE_ROOT, fileName);
}

/**
 * Menyimpan stiker baru ke koleksi.
 * @param {Object} entry
 * @param {string} entry.name - Nama stiker (sudah tervalidasi)
 * @param {Buffer} entry.buffer - Isi berkas WebP stiker
 * @param {string} entry.sender - JID pengirim
 * @param {string} entry.senderNumber - Nomor pengirim
 * @param {number} entry.maxStickers - Kapasitas maksimal koleksi
 * @param {number} entry.maxStickerBytes - Ukuran maksimal per stiker
 * @param {Function} entry.createdLabel - Label waktu pembuatan
 * @returns {Object} Hasil operasi { ok, reason, entry }
 */
function saveSticker({
  name,
  buffer,
  sender,
  senderNumber,
  maxStickers,
  maxStickerBytes,
  createdLabel,
}) {
  const index = loadIndex();
  if (index.stickers.some((item) => item.name === name)) {
    return { ok: false, reason: "exists" };
  }
  if (index.stickers.length >= maxStickers) {
    return { ok: false, reason: "full" };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (buffer.length > maxStickerBytes) {
    return { ok: false, reason: "too-large" };
  }

  const id = Crypto.randomBytes(6).toString("hex");
  const fileName = `sticker_${id}.webp`;
  ensureStoreDir();
  fs.writeFileSync(stickerFilePath(fileName), buffer);

  const entry = {
    id,
    name,
    fileName,
    sender,
    senderNumber,
    createdAt: Date.now(),
    createdLabel: createdLabel || "",
    sizeBytes: buffer.length,
  };
  index.stickers.push(entry);
  saveIndex();
  return { ok: true, reason: null, entry };
}

function findEntry(name) {
  const index = loadIndex();
  return index.stickers.find((item) => item.name === name) || null;
}

/**
 * Mengambil stiker tersimpan berdasarkan nama.
 * @param {string} name - Nama stiker
 * @returns {Object|null} { entry, buffer } atau null bila tidak ditemukan
 */
function getSticker(name) {
  const entry = findEntry(name);
  if (!entry) return null;
  try {
    const buffer = fs.readFileSync(stickerFilePath(entry.fileName));
    return { entry, buffer };
  } catch {
    return null;
  }
}

/**
 * Daftar seluruh stiker tersimpan, terurut dari yang terlama.
 * @returns {Object[]} Daftar entri stiker
 */
function listStickers() {
  const index = loadIndex();
  return [...index.stickers].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Menghapus stiker dari koleksi setelah pemeriksaan izin.
 * @param {string} name - Nama stiker
 * @param {string} requester - JID pengirim perintah
 * @param {boolean} isOwner - Apakah pengirim adalah owner bot
 * @returns {Object} Hasil operasi { ok, reason, entry }
 */
function deleteSticker(name, requester, isOwner) {
  const entry = findEntry(name);
  if (!entry) return { ok: false, reason: "not-found", entry: null };
  if (!isOwner && entry.sender !== requester) {
    return { ok: false, reason: "denied", entry };
  }
  const index = loadIndex();
  const position = index.stickers.findIndex((item) => item.id === entry.id);
  if (position !== -1) {
    index.stickers.splice(position, 1);
  }
  saveIndex();
  try {
    if (fs.existsSync(stickerFilePath(entry.fileName))) {
      fs.unlinkSync(stickerFilePath(entry.fileName));
    }
  } catch {}
  return { ok: true, reason: null, entry };
}

export { STORE_ROOT, INDEX_FILE, saveSticker, getSticker, listStickers, deleteSticker };
