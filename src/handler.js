import config from "../config.js";
import { serialize } from "./lib/naze-serialize.js";
import { getDatabase } from "./lib/naze-database.js";
import { logger, logMessage } from "./lib/naze-logger.js";

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

    if (!config.features?.logMessage) return;

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
