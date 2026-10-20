// Orkestrator sistem pengelolaan file NAZE: sesi pengumpulan berkas,
// penerimaan media, pembuatan TXT/PDF/ZIP, dan pembersihan berkas sementara.

import fs from "fs";
import path from "path";
import config from "../../config.js";
import { logger } from "./naze-logger.js";
import { buildPdf, parseJpegSize } from "./naze-pdf-builder.js";
import {
  SESSION_LABELS,
  REJECT_REASONS,
  TOTXT_LAST_TEXT_TTL_MS,
  createSessionCore,
  resolveLimits,
  sanitizeFileName,
  uniqueFileName,
  validateOutputName,
  pickTotxtSource,
  extFromMime,
  sessionStartMessage,
  resumedSessionMessage,
  sessionConflictMessage,
  fileAcceptedMessage,
  fileRejectedMessage,
  statusMessage,
  noSessionMessage,
  cancelMessage,
  cancelNoSessionMessage,
  invalidNameMessage,
  noFilesToFinishMessage,
  finishedPdfMessage,
  finishedZipMessage,
  processFailedMessage,
  totxtGuideMessage,
  totxtDoneMessage,
  qrGuideMessage,
  qrMediaUnsupportedMessage,
  qrTooLongMessage,
  qrDoneMessage,
  busyMessage,
} from "./naze-file-utils.js";

const TEMP_ROOT = path.join(process.cwd(), "storage", "temp", "naze-files");

const core = createSessionCore({ limits: resolveLimits(config.files) });
const lastTexts = new Map();
let sweeperTimer = null;
let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  try {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
    fs.mkdirSync(TEMP_ROOT, { recursive: true });
  } catch (error) {
    logger.warn("files", "folder sementara tidak dapat disiapkan: " + error.message);
  }
  sweeperTimer = setInterval(() => {
    try {
      for (const session of core.sweepExpired()) {
        cleanupSessionFiles(session);
      }
    } catch (error) {
      logger.warn("files", "pembersih sesi gagal: " + error.message);
    }
  }, 60 * 1000);
  if (sweeperTimer.unref) sweeperTimer.unref();
}

function safeDirName(session) {
  return session.key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function sessionDir(session) {
  return path.join(TEMP_ROOT, safeDirName(session));
}

function cleanupSessionFiles(session) {
  try {
    fs.rmSync(sessionDir(session), { recursive: true, force: true });
  } catch (error) {
    logger.warn("files", "gagal membersihkan berkas sementara: " + error.message);
  }
}

function getActiveSession(sender, chat) {
  ensureInitialized();
  return core.get(sender, chat);
}

async function startSession(m, type, sock) {
  ensureInitialized();
  const result = core.start(m.sender, m.chat, type);
  if (!result.ok) {
    if (result.error === "conflict") {
      await m.reply(sessionConflictMessage(result.session.label));
      return;
    }
    await m.reply(processFailedMessage("tipe sesi tidak dikenal"));
    return;
  }
  if (result.resumed) {
    await m.reply(resumedSessionMessage(result.session.label));
    return;
  }
  try {
    fs.rmSync(sessionDir(result.session), { recursive: true, force: true });
    fs.mkdirSync(sessionDir(result.session), { recursive: true });
  } catch (error) {
    core.remove(m.sender, m.chat);
    logger.error("files", "folder sesi gagal dibuat: " + error.message);
    await m.reply(processFailedMessage("folder sementara tidak dapat dibuat"));
    return;
  }
  await m.reply(sessionStartMessage(type));
}

function describeIncomingName(m) {
  if (m.isDocument && m.fileName) return m.fileName;
  if (m.isImage) return "foto";
  if (m.isVideo) return "video";
  if (m.isAudio) return m.ptt ? "pesan suara" : "audio";
  return "berkas";
}

function classifyMedia(m, sessionType) {
  const mimetype = String(m.mimetype || "").split(";")[0].trim().toLowerCase();
  const fileName = String(m.fileName || "");
  if (sessionType === "pdf") {
    if (m.isImage) return { kind: "image" };
    if (m.isDocument) {
      if (mimetype === "text/plain" || /\.txt$/i.test(fileName)) {
        return { kind: "text" };
      }
      if (mimetype.startsWith("image/")) return { kind: "image" };
    }
    return { kind: null, reason: "unsupported" };
  }
  if (m.isImage) return { kind: "image" };
  if (m.isVideo) return { kind: "video" };
  if (m.isAudio) return { kind: m.ptt ? "voice" : "audio" };
  if (m.isDocument) return { kind: "document" };
  return { kind: null, reason: "unsupported" };
}

function buildEntryName(session, m, kind) {
  const existingNames = session.files.map((file) => file.entryName);
  let desired;
  if (kind === "text") {
    desired = sanitizeFileName(
      m.fileName,
      "catatan " + (session.files.length + 1) + ".txt"
    );
  } else if (kind === "document") {
    desired = sanitizeFileName(m.fileName, "berkas " + (session.files.length + 1));
  } else {
    const labels = { image: "foto", video: "video", audio: "audio", voice: "pesan suara" };
    desired =
      (labels[kind] || "berkas") +
      " " + (session.files.length + 1) + "." +
      extFromMime(m.mimetype);
  }
  return uniqueFileName(existingNames, desired);
}

async function rejectIncoming(session, m, reason) {
  session.failedCount += 1;
  await m.reply(
    fileRejectedMessage(describeIncomingName(m), reason)
  );
}

async function ingestMedia(session, m, sock) {
  if (session.busy) {
    await m.reply(busyMessage());
    return;
  }

  const classified = classifyMedia(m, session.type);
  if (!classified.kind) {
    await rejectIncoming(session, m, REJECT_REASONS.unsupported(session.type));
    return;
  }

  const declaredSize = Number(m.fileLength) || 0;
  const check = core.checkNewFile(session, declaredSize);
  if (!check.ok) {
    await rejectIncoming(session, m, REJECT_REASONS[check.error] || REJECT_REASONS.download);
    return;
  }

  let buffer;
  try {
    buffer = await m.download();
  } catch (error) {
    logger.warn("files", "gagal mengunduh media: " + error.message);
    await rejectIncoming(session, m, REJECT_REASONS.download());
    return;
  }

  if (!buffer || buffer.length === 0) {
    await rejectIncoming(session, m, REJECT_REASONS.empty());
    return;
  }
  if (buffer.length > core.limits.maxSizePerFile) {
    await rejectIncoming(session, m, REJECT_REASONS.maxsize());
    return;
  }

  const entryName = buildEntryName(session, m, classified.kind);
  const filePath = path.join(sessionDir(session), entryName);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (error) {
    logger.warn("files", "gagal menyimpan berkas sesi: " + error.message);
    await rejectIncoming(session, m, REJECT_REASONS.store());
    return;
  }

  core.addFile(session, {
    entryName,
    originalName: describeIncomingName(m),
    kind: classified.kind,
    size: buffer.length,
    path: filePath,
  });

  await m.reply(fileAcceptedMessage(entryName, session.files.length));
}

async function producePdf(session, outputBase, m) {
  const pages = [];
  const failed = [];
  for (const file of session.files) {
    try {
      if (file.kind === "text") {
        pages.push({ kind: "text", text: fs.readFileSync(file.path, "utf8") });
      } else {
        let buffer = fs.readFileSync(file.path);
        let info = parseJpegSize(buffer);
        if (!info || info.progressive) {
          const sharp = (await import("sharp")).default;
          buffer = await sharp(buffer)
            .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .jpeg({ quality: 85 })
            .toBuffer();
          info = parseJpegSize(buffer);
        }
        if (!info) throw new Error("gambar tidak valid");
        pages.push({ kind: "jpeg", data: buffer });
      }
    } catch (error) {
      failed.push(file.entryName + " (" + (error.message || "gagal diproses") + ")");
    }
  }
  const pdfBytes = pages.length > 0 ? buildPdf(pages) : null;
  if (!pdfBytes) {
    throw new Error("tidak ada berkas yang dapat dikonversi");
  }
  await m.reply(finishedPdfMessage(outputBase + ".pdf", pages.length, failed, session.failedCount));
  await m.replyDocument(Buffer.from(pdfBytes), outputBase + ".pdf", "application/pdf");
}

async function produceZip(session, outputBase, m) {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip();
  let included = 0;
  const failed = [];
  for (const file of session.files) {
    try {
      zip.addFile(file.entryName, fs.readFileSync(file.path));
      included += 1;
    } catch (error) {
      failed.push(file.entryName + " (gagal dibaca)");
    }
  }
  if (included === 0) {
    throw new Error("tidak ada berkas yang dapat dimasukkan");
  }
  const zipBuffer = zip.toBuffer();
  await m.reply(finishedZipMessage(outputBase + ".zip", included, failed, session.failedCount));
  await m.replyDocument(zipBuffer, outputBase + ".zip", "application/zip");
}

async function finishWithName(session, rawName, m, sock) {
  if (session.busy) {
    await m.reply(busyMessage());
    return;
  }
  const validation = validateOutputName(rawName);
  if (!validation.valid) {
    await m.reply(invalidNameMessage(rawName));
    return;
  }
  if (session.files.length === 0) {
    await m.reply(noFilesToFinishMessage(session.label));
    return;
  }

  session.busy = true;
  const outputBase = validation.name;
  try {
    if (session.type === "pdf") {
      await producePdf(session, outputBase, m);
    } else {
      await produceZip(session, outputBase, m);
    }
  } catch (error) {
    logger.error("files", "gagal memproses sesi: " + error.message);
    await m.reply(processFailedMessage(error.message));
  } finally {
    core.remove(session.sender, session.chat);
    cleanupSessionFiles(session);
  }
}

async function createTxt(m, sock) {
  ensureInitialized();
  const key = core.sessionKey(m.sender, m.chat);
  const source = pickTotxtSource(m, lastTexts.get(key), Date.now());
  if (!source) {
    await m.reply(totxtGuideMessage());
    return;
  }
  const buffer = Buffer.from(source, "utf8");
  await m.reply(totxtDoneMessage());
  await m.replyDocument(buffer, "hasil.txt", "text/plain");
}

function describeQuotedMedia(quoted) {
  if (quoted.isImage) return "foto";
  if (quoted.isVideo) return "video";
  if (quoted.isSticker) return "stiker";
  if (quoted.isAudio) return "audio";
  if (quoted.isDocument) return "dokumen";
  return "berkas media";
}

async function createQr(m, sock) {
  ensureInitialized();
  const key = core.sessionKey(m.sender, m.chat);
  const source = pickTotxtSource(m, lastTexts.get(key), Date.now());
  if (!source) {
    if (m.quoted?.isMedia) {
      await m.reply(
        qrMediaUnsupportedMessage(describeQuotedMedia(m.quoted), core.limits.qrMaxTextBytes)
      );
      return;
    }
    if (m.isMedia) {
      await m.reply(
        qrMediaUnsupportedMessage(describeIncomingName(m), core.limits.qrMaxTextBytes)
      );
      return;
    }
    await m.reply(qrGuideMessage(core.limits.qrMaxTextBytes));
    return;
  }

  const byteLength = Buffer.byteLength(source, "utf8");
  const maxBytes = core.limits.qrMaxTextBytes;
  if (byteLength > maxBytes) {
    await m.reply(qrTooLongMessage(byteLength, maxBytes));
    return;
  }

  try {
    const QRCode = (await import("qrcode")).default;
    const imageBuffer = await QRCode.toBuffer(source, {
      type: "png",
      width: 720,
      margin: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    await m.reply(qrDoneMessage(source.length));
    await m.replyImage(imageBuffer, "");
  } catch (error) {
    logger.error("files", "gagal membuat kode QR: " + error.message);
    await m.reply(processFailedMessage("kode QR tidak dapat dibuat"));
  }
}

function rememberTextMessage(m) {
  if (m.isCommand) return;
  if (m.type !== "conversation" && m.type !== "extendedTextMessage") return;
  const body = m.body;
  if (!body || body.trim() === "") return;
  const key = core.sessionKey(m.sender, m.chat);
  lastTexts.set(key, { text: body, at: Date.now() });
  if (lastTexts.size > 500) {
    const now = Date.now();
    for (const [k, entry] of lastTexts) {
      if (now - entry.at > TOTXT_LAST_TEXT_TTL_MS) lastTexts.delete(k);
    }
  }
}

async function sendStatus(m) {
  ensureInitialized();
  const session = core.get(m.sender, m.chat);
  if (!session) {
    await m.reply(noSessionMessage());
    return;
  }
  await m.reply(statusMessage(core.summary(session)));
}

async function cancelSession(m) {
  ensureInitialized();
  const session = core.get(m.sender, m.chat);
  if (!session) {
    await m.reply(cancelNoSessionMessage());
    return;
  }
  core.remove(m.sender, m.chat);
  cleanupSessionFiles(session);
  await m.reply(cancelMessage(session.label));
}

export {
  startSession,
  getActiveSession,
  ingestMedia,
  finishWithName,
  createTxt,
  createQr,
  rememberTextMessage,
  sendStatus,
  cancelSession,
};
