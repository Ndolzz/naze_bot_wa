import config from "../../config.js";
import { formatUptime } from "../../src/lib/naze-formatter.js";
import { buildStructure, countOf } from "../../src/lib/naze-menu-util.js";

const pluginConfig = {
  name: "about",
  alias: ["tentang", "info-bot", "credits", "kredit"],
  category: "main",
  description: "Informasi tentang bot",
  usage: ".about",
  example: ".about",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { uptime }) {
  const total = buildStructure({ isOwner: false }).reduce(
    (n, s) => n + countOf(s),
    0,
  );

  const text = [
    `*${config.bot?.name || "NAZE"} BOT*`,
    "",
    `Versi: ${config.bot?.version || "-"}`,
    `Developer: ${config.bot?.developer || "-"}`,
    "Platform: WhatsApp",
    `Mode: ${String(config.mode || "public").toUpperCase()}`,
    `Aktif: ${formatUptime(uptime)}`,
    `Perintah tersedia: ${total}`,
    "",
    `Ketik ${m.prefix || "."}menu untuk melihat daftar perintah.`,
    "Pustaka pihak ketiga dan atribusi: lihat NOTICE.md.",
  ].join("\n");

  return m.reply(text);
}

export { pluginConfig as config, handler };
