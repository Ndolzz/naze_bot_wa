import fs from "fs";
import config from "../../config.js";
import { formatUptime, getTimeGreeting } from "../../src/lib/naze-formatter.js";
import {
  buildStructure,
  findSection,
  findSub,
  buildOverview,
  buildSection,
  buildSub,
} from "../../src/lib/naze-menu-util.js";

const pluginConfig = {
  name: "menu",
  alias: ["help", "bantuan", "commands", "m", "menucat", "category", "cat"],
  category: "main",
  description: "Menu utama bot",
  usage: ".menu [menu] [submenu]",
  example: ".menu tools downloader",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function readLogo() {
  try {
    return fs.readFileSync(config.assets["naze-logo"]);
  } catch {
    return null;
  }
}

async function handler(m, { sock, config: botConfig, uptime }) {
  const prefix = botConfig.command?.prefix || ".";
  const structure = buildStructure({ isOwner: m.isOwner });
  const [q1, q2] = m.args || [];

  if (q1) {
    const section = findSection(structure, q1);
    if (!section) {
      return m.reply(
        `Menu "${q1}" tidak ditemukan.\nKetik ${prefix}menu untuk melihat daftar menu.`,
      );
    }
    if (q2) {
      const sub = findSub(section, q2);
      if (!sub) {
        return m.reply(
          `Submenu "${q2}" tidak ditemukan di ${section.label}.\nKetik ${prefix}menu ${section.key} untuk melihat daftar submenu.`,
        );
      }
      return m.reply(buildSub(section, sub, prefix));
    }
    return m.reply(buildSection(section, prefix));
  }

  const text = buildOverview({
    prefix,
    botName: botConfig.bot?.name || "NAZE",
    version: botConfig.bot?.version || "-",
    mode: String(botConfig.mode || "public").toUpperCase(),
    uptime: formatUptime(uptime),
    developer: botConfig.bot?.developer || "-",
    pushName: m.pushName,
    role: m.isOwner ? "Owner" : m.isPremium ? "Premium" : "Pengguna",
    greeting: getTimeGreeting().trim(),
    structure,
  });

  const logo = readLogo();
  if (!logo) return m.reply(text);
  return sock.sendMessage(m.chat, { image: logo, caption: text }, { quoted: m });
}

export { pluginConfig as config, handler };
