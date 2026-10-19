// src/lib/naze-preset-session.js
// Manajer sesi Preset Instan: penyimpanan per pengguna (terisolasi berdasarkan
// JID pengirim + chat), TTL dan pembersihan berkas, pengumpulan media
// berurutan, perakitan keluaran (XML remix + ZIP media + instruksi), serta
// hook pesan handlePresetMessage yang dipasang di src/handler.js mengikuti
// pola global.giveawaySessions yang sudah ada di repositori.
// Kejujuran: hasil keluaran TIDAK dirender menjadi MP4; validasi struktur
// bukan jaminan keberhasilan impor di Alight Motion asli.

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import {
  createPresetSessionState,
  currentPrompt,
  validateMediaForPrompt,
  recordSlotMedia,
  skipCurrentPrompt,
  cancelPresetSessionState,
  finishPresetSessionState,
  isSessionExpired,
  buildFinalReplacements,
  buildPromptText,
  buildSummaryText,
  buildInstructionsText,
  sanitizeName,
} from "./naze-preset-session-core.js";
import { remixPreset, buildRemixDownloadName } from "./naze-am-preset/workflow.js";

const presetSessions =
  global.presetSessions || (global.presetSessions = new Map());

function sessionRootDir() {
  const root = path.join(process.cwd(), "storage", "preset");
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function sessionDir(id) {
  return path.join(sessionRootDir(), sanitizeName(id));
}

function cleanupSessionFiles(id) {
  try {
    const dir = sessionDir(id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

export function getPresetSession(ownerJid) {
  return presetSessions.get(ownerJid) || null;
}

export function sweepExpiredPresetSessions(now = Date.now()) {
  for (const [ownerJid, wrapper] of presetSessions.entries()) {
    if (!wrapper?.state || isSessionExpired(wrapper.state, now)) {
      cleanupSessionFiles(wrapper?.state?.id || wrapper?.dirName || ownerJid);
      presetSessions.delete(ownerJid);
    }
  }
}

export function startPresetSession({ ownerJid, chatJid, fileName, xmlText, limits }) {
  const existing = presetSessions.get(ownerJid);
  if (existing?.state) {
    cleanupSessionFiles(existing.state.id);
    presetSessions.delete(ownerJid);
  }
  const id = sanitizeName(String(ownerJid).split("@")[0]) + "-" + Date.now();
  const created = createPresetSessionState({
    id,
    ownerJid,
    chatJid,
    fileName,
    xmlText,
    limits,
    now: Date.now(),
  });
  if (!created.ok) {
    return { ok: false, error: created.error };
  }
  const dir = sessionDir(id);
  fs.mkdirSync(path.join(dir, "media"), { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, "original.xml"), xmlText, "utf8");
  } catch {}
  presetSessions.set(ownerJid, { state: created.state, dir });
  return { ok: true, error: "", state: created.state };
}

export function cancelPresetSession(ownerJid) {
  const wrapper = presetSessions.get(ownerJid);
  if (!wrapper?.state) return { ok: false, error: "Tidak ada sesi aktif." };
  cancelPresetSessionState(wrapper.state, Date.now());
  cleanupSessionFiles(wrapper.state.id);
  presetSessions.delete(ownerJid);
  return { ok: true, error: "" };
}

function mediaEntryName(replacement) {
  return (
    "FOTO-" + replacement.slotNumber + "-" + sanitizeName(replacement.fileName)
  );
}

// Ukuran gambar bersifat best-effort: bila sharp gagal membaca metadata,
// penggantian tetap berjalan tanpa width/height (atribut tidak ditulis).
// NAZE_PRESET_SKIP_SHARP memungkinkan lingkungan uji tanpa sharp mematikan
// jalur ini tanpa mengubah perilaku runtime bot.
async function readImageSize(buffer) {
  if (globalThis.NAZE_PRESET_SKIP_SHARP) return {};
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    if (Number.isFinite(meta.width) && Number.isFinite(meta.height)) {
      return { width: meta.width, height: meta.height };
    }
  } catch {}
  return {};
}

async function saveSessionMedia(wrapper, buffer, mediaInfo) {
  const dir = path.join(wrapper.dir, "media");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName =
    "foto-" + mediaInfo.slotNumber + "-" + Date.now() + "." + mediaInfo.ext;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Perakitan keluaran akhir: XML remix (atau XML asli bila tidak ada media
// terkumpul) + ZIP berisi XML, media pengganti, dan instruksi manual.
// Tidak menghapus sesi — pemanggil membersihkan setelah pengiriman berhasil.
export async function buildSessionOutput(ownerJid) {
  const wrapper = presetSessions.get(ownerJid);
  if (!wrapper?.state) {
    return { ok: false, error: "Tidak ada sesi aktif." };
  }
  const state = wrapper.state;
  const base = buildRemixDownloadName(state.fileName);
  const xmlName = base + ".xml";
  const replacements = buildFinalReplacements(state);
  let xmlOut = state.xmlText;
  let warnings = [];
  if (replacements.length > 0) {
    const result = remixPreset(state.xmlText, replacements);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    xmlOut = result.xml;
    warnings = result.warnings || [];
  }
  const mediaReplacements = state.replacements.filter((r) => r.savedFile);
  const entries = mediaReplacements.map((r) => mediaEntryName(r));
  const instructions = buildInstructionsText(state, xmlName, entries);
  let zipBuffer = null;
  if (mediaReplacements.length > 0) {
    const zip = new AdmZip();
    zip.addFile(xmlName, Buffer.from(xmlOut, "utf8"));
    zip.addFile("BACA-DULU.txt", Buffer.from(instructions, "utf8"));
    for (const rep of mediaReplacements) {
      try {
        zip.addLocalFile(rep.savedFile, "", mediaEntryName(rep));
      } catch {}
    }
    zipBuffer = zip.toBuffer();
  }
  return {
    ok: true,
    error: "",
    xml: Buffer.from(xmlOut, "utf8"),
    xmlName,
    zip: zipBuffer,
    zipName: base + "-media.zip",
    instructions,
    warnings,
    replacedCount: replacements.length,
    mediaCount: mediaReplacements.length,
    slotTotal: state.slots.length,
  };
}

export function finishAndCleanup(ownerJid) {
  const wrapper = presetSessions.get(ownerJid);
  if (wrapper?.state) {
    finishPresetSessionState(wrapper.state, Date.now());
    cleanupSessionFiles(wrapper.state.id);
  }
  presetSessions.delete(ownerJid);
}

function extractDocumentName(source) {
  try {
    if (typeof source?.fileName === "string" && source.fileName.trim().length > 0) {
      return source.fileName;
    }
    const name = source?.message?.documentMessage?.fileName;
    if (typeof name === "string" && name.trim().length > 0) return name;
  } catch {}
  return null;
}

function pickMediaSource(m) {
  if (m.isMedia) return m;
  if (m.quoted && (m.quoted.isMedia || m.quoted.isImage || m.quoted.isVideo)) {
    return m.quoted;
  }
  return null;
}

// Hook pesan sesi preset. Mengembalikan true bila pesan dikonsumsi sesi,
// false agar pesan diproses handler normal. Pesan perintah (berprefix)
// selalu diteruskan ke handler agar plugin .preset tetap berjalan.
export async function handlePresetMessage(m, sock) {
  sweepExpiredPresetSessions();
  const wrapper = presetSessions.get(m.sender);
  if (!wrapper?.state) return false;
  const state = wrapper.state;
  if (m.chat !== state.chatJid) return false;
  if (m.isCommand) return false;

  const body = (m.body || "").trim().toLowerCase();

  if (body === "batal" || body === "cancel") {
    cancelPresetSession(m.sender);
    await m.reply(" *Sesi preset dibatalkan.* Seluruh berkas sementara dihapus.");
    return true;
  }

  if (body === "skip" || body === "lewati") {
    if (state.status !== "collecting") {
      await m.reply(
        "Tidak ada slot aktif untuk dilewati.\n\nKetik *selesai* untuk memproses atau *batal* untuk membatalkan."
      );
      return true;
    }
    const prompt = currentPrompt(state);
    const skipped = skipCurrentPrompt(state, Date.now());
    if (!skipped.ok) {
      await m.reply(skipped.error);
      return true;
    }
    await m.reply(
      "Foto " + prompt.slotNumber + " dilewati (slot dipertahankan apa adanya).\n\n" +
        buildPromptText(state)
    );
    return true;
  }

  if (body === "selesai" || body === "done" || body === "finish") {
    const output = await buildSessionOutput(m.sender);
    if (!output.ok) {
      cancelPresetSession(m.sender);
      await m.reply(
        " *Pembuatan keluaran gagal.*\n\n> " +
          output.error +
          "\n\nSesi diakhiri dan berkas sementara dihapus. Silakan kirim ulang berkas preset untuk memulai ulang."
      );
      return true;
    }
    try {
      if (output.zip) {
        await m.replyDocument(output.zip, output.zipName, "application/zip", {
          caption:
            " *Paket Hasil Preset*\n\n" +
            "Berisi XML remix, foto pengganti, dan BACA-DULU.txt (cara impor dan Ganti Media).\n" +
            "Slot diganti: " + output.replacedCount + " dari " + output.slotTotal + ".",
        });
        await m.replyDocument(output.xml, output.xmlName, "application/xml", {
          caption: " *XML Remix* — hasil lolos validasi struktur.",
        });
      } else {
        await m.replyDocument(output.xml, output.xmlName, "application/xml", {
          caption:
            " *XML Preset*\n\nTidak ada media pengganti terkumpul, XML dikirim tanpa perubahan.\n" +
            "Slot diganti: 0 dari " + output.slotTotal + ".",
        });
      }
      await m.reply(output.instructions);
    } catch (sendError) {
      await m.reply(
        "Pengiriman hasil gagal: " +
          (sendError?.message || "kesalahan tidak diketahui") +
          ". Sesi tetap aktif; ketik *selesai* untuk mencoba mengirim ulang."
      );
      return true;
    }
    finishAndCleanup(m.sender);
    return true;
  }

  // Pesan media: kandidat media untuk slot aktif.
  const source = pickMediaSource(m);
  if (!source) return false;
  if (state.status !== "collecting") {
    await m.reply(
      "Semua slot foto sudah diproses.\n\nKetik *selesai* untuk memproses atau *batal* untuk membatalkan."
    );
    return true;
  }
  let buffer;
  try {
    buffer = await source.download();
  } catch (downloadError) {
    await m.reply("Gagal mengunduh media. Kirim ulang fotonya.");
    return true;
  }
  if (!buffer || buffer.length === 0) {
    await m.reply("Media kosong atau gagal diunduh. Kirim ulang fotonya.");
    return true;
  }
  const fileName = extractDocumentName(source);
  const check = validateMediaForPrompt(state, buffer, fileName, Date.now());
  if (!check.ok) {
    await m.reply(" *Media Ditolak*\n\n> " + check.error);
    return true;
  }
  const dims = await readImageSize(buffer);
  const savedFile = await saveSessionMedia(wrapper, buffer, check);
  const recorded = recordSlotMedia(
    state,
    {
      ...check,
      width: dims.width,
      height: dims.height,
    },
    savedFile,
    Date.now()
  );
  if (!recorded.ok) {
    await m.reply(recorded.error);
    return true;
  }
  await m.reply(
    "Foto " + check.slotNumber + " tersimpan" +
      (dims.width ? " (" + dims.width + "x" + dims.height + ")" : "") +
      ".\n\n" + buildPromptText(state)
  );
  return true;
}

export { buildSummaryText, buildPromptText };
