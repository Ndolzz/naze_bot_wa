import config from "../config.js";
import { serialize } from "./lib/naze-serialize.js";
import { getDatabase } from "./lib/naze-database.js";
import { logger, logMessage } from "./lib/naze-logger.js";
import { getPlugin, getAllPlugins } from "./lib/naze-plugins.js";
import * as fileManager from "./lib/naze-file-manager.js";

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

const commandCooldowns = new Map();

function getCooldownRemaining(sender, commandName, cooldownSeconds) {
  if (!cooldownSeconds || cooldownSeconds <= 0) return 0;
  const key = sender + ":" + commandName;
  const now = Date.now();
  const last = commandCooldowns.get(key) || 0;
  const remaining = Math.ceil((last + cooldownSeconds * 1000 - now) / 1000);
  if (remaining > 0) return remaining;
  commandCooldowns.set(key, now);
  if (commandCooldowns.size > 2000) {
    for (const [k, time] of commandCooldowns) {
      if (now - time > 300000) commandCooldowns.delete(k);
    }
  }
  return 0;
}

function replySafe(m, text) {
  return m.reply(text).catch(() => null);
}

async function runDispatcher(m, sock) {
  if (m.isBot || m.isNewsletter) return;

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

  if (config.mode === "self" && !m.isOwner) return;

  const pluginConfig = plugin.config || {};
  if (pluginConfig.isEnabled === false) return;
  if (pluginConfig.isOwner && !m.isOwner) {
    await replySafe(m, config.messages?.ownerOnly || "Fitur ini khusus owner.");
    return;
  }
  if (pluginConfig.isPremium && !m.isPremium) {
    await replySafe(m, config.messages?.premiumOnly || "Fitur ini khusus pengguna premium.");
    return;
  }
  if (pluginConfig.isGroup && !m.isGroup) {
    await replySafe(m, config.messages?.groupOnly || "Fitur ini hanya untuk grup.");
    return;
  }
  if (pluginConfig.isPrivate && !m.isPrivate) {
    await replySafe(m, config.messages?.privateOnly || "Fitur ini hanya untuk chat pribadi.");
    return;
  }
  if (pluginConfig.isAdmin && !m.isAdmin) {
    await replySafe(m, config.messages?.adminOnly || "Fitur ini khusus admin grup.");
    return;
  }
  if (pluginConfig.isBotAdmin && !m.isBotAdmin) {
    await replySafe(m, config.messages?.botAdminOnly || "Bot harus menjadi admin grup.");
    return;
  }

  const primaryName = Array.isArray(pluginConfig.name)
    ? pluginConfig.name[0]
    : pluginConfig.name;
  const remaining = getCooldownRemaining(
    m.sender,
    String(primaryName || m.command),
    Number(pluginConfig.cooldown ?? 3)
  );
  if (remaining > 0) {
    const template =
      config.messages?.cooldown ||
      "Mohon tunggu %time% detik sebelum memakai perintah ini lagi.";
    await replySafe(m, template.replace("%time%", String(remaining)));
    return;
  }

  try {
    await plugin.handler(m, {
      sock,
      store: sock?.store,
      config,
      plugins: getAllPlugins(),
    });
  } catch (error) {
    logger.error("PLUGIN", m.command + ": " + error.message);
    await replySafe(m, config.messages?.error || "Terjadi kesalahan. Silakan coba lagi nanti.");
  }
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
