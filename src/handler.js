import config from "../config.js";
import { serialize } from "./lib/naze-serialize.js";
import { getDatabase } from "./lib/naze-database.js";
import { logger, logMessage } from "./lib/naze-logger.js";
import { getPlugin } from "./lib/naze-plugins.js";
import * as fileManager from "./lib/naze-file-manager.js";
import { dispatchPlugin, replySafe } from "./lib/naze-plugin-dispatch.js";
import { handleIntent } from "./lib/naze-intent-router.js";

function logIncomingMessage(m) {
  const db = getDatabase();
  if (!db?.ready) return;

  let groupName = "PRIVATE";
  if (m.isGroup) {
    const groupData = db.getGroup(m.chat);
    groupName = groupData?.name || "Unknown Group";
  }

  logMessage({
    chatType: m.isNewsletter
      ? "newsletter"
      : m.isGroup
        ? "group"
        : "private",
    groupName: m.isNewsletter ? "Channel" : groupName,
    pushName: m.pushName,
    sender: m.sender,
    message: m.body,
    messageType: m.type,
    isForwarded: m.message?.[m.type]?.contextInfo?.isForwarded || false,
    isNewsletter:
      m.isNewsletter ||
      !!m.message?.[m.type]?.contextInfo?.forwardedNewsletterMessageInfo,
  });
}

async function runDispatcher(m, sock) {
  if (m.isNewsletter) return;
  // Pesan dari akun bot sendiri dilewati, kecuali saat mode self aktif
  // karena pengguna mengoperasikan bot dari akun yang sama.
  if (m.isBot && config.mode !== "self") return;

  if (m.isCommand && m.isBanned) {
    await replySafe(m, config.messages?.banned || "Akses diblokir.");
    return;
  }

  // Sesi pengumpulan berkas aktif: media masuk dicatat sebagai berkas sesi.
  if (!m.isCommand && m.isMedia) {
    const session = fileManager.getActiveSession(m.sender, m.chat);
    if (session) {
      await fileManager.ingestMedia(session, m, sock);
      return;
    }
  }

  if (!m.isCommand) {
    fileManager.rememberTextMessage(m);
    // Naze Intent Router hanya aktif saat fitur smartTrigger dinyalakan dan
    // tidak ada sesi pengumpulan berkas aktif, agar pesan yang sedang
    // menjadi bagian sesi tidak salah dikenali sebagai permintaan baru.
    if (
      config.features?.smartTriggers &&
      !fileManager.getActiveSession(m.sender, m.chat)
    ) {
      try {
        await handleIntent(m, sock);
      } catch (error) {
        logger.error("INTENT", error.message);
      }
    }
    return;
  }

  const plugin = getPlugin(m.command);
  if (!plugin) {
    // Bukan perintah terdaftar. Saat sesi aktif, teks berawalan titik
    // ditafsirkan sebagai nama output sesi tersebut.
    const session = fileManager.getActiveSession(m.sender, m.chat);
    if (session) {
      const rawName =
        m.prefix && m.body.startsWith(m.prefix)
          ? m.body.slice(m.prefix.length).trim()
          : m.body.trim();
      await fileManager.finishWithName(session, rawName, m, sock);
    }
    return;
  }

  await dispatchPlugin(m, sock, plugin);
}

async function messageHandler(msg, sock, options = {}) {
  try {
    let m;
    try {
      m = await serialize(sock, msg);
    } catch {
      return;
    }

    if (!m) return;
    if (!m.message) return;
    if (!m.sender) m.sender = m.chat || "";

    if (config.features?.logMessage) {
      logIncomingMessage(m);
    }

    await runDispatcher(m, sock);
  } catch (error) {
    logger.error("HANDLER", error.message);
  }
}

async function groupHandler(update, sock) {}

async function messageUpdateHandler(updates, sock) {}

async function groupSettingsHandler(update, sock) {}

async function handleAntiRemoveFromUpsert(msg, sock, db) {}

export {
  messageHandler,
  groupHandler,
  messageUpdateHandler,
  groupSettingsHandler,
  handleAntiRemoveFromUpsert,
};
