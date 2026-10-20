import config from "../../config.js";
import { setPlainMenu } from "../../src/lib/naze-menu-typography.js";
import { buildStructure, findSection, findSub, buildSection, buildSub } from "../../src/lib/naze-menu-util.js";

setPlainMenu(config.features?.plainMenu === true);

const pluginConfig = {
  name: "ownermenu",
  alias: ["menuowner", "ownerpanel", "panelowner"],
  category: "owner",
  description: "Panel pengelolaan bot (khusus owner)",
  usage: ".ownermenu [submenu]",
  example: ".ownermenu",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const prefix = config.command?.prefix || ".";
  const section = findSection(buildStructure({ isOwner: true }), "owner");
  if (!section) return m.reply("Panel owner tidak tersedia.");
  const q = m.args?.[0];
  if (q) {
    const sub = findSub(section, q);
    if (!sub) return m.reply(`Submenu "${q}" tidak ditemukan.\nKetik ${prefix}ownermenu untuk melihat daftar.`);
    return m.reply(buildSub(section, sub, prefix, { title: "NAZE OWNER PANEL" }));
  }
  return m.reply(
    buildSection(section, prefix, {
      title: "NAZE OWNER PANEL",
      detail: `Ketik ${prefix}ownermenu <submenu> untuk membuka submenu.`,
    }),
  );
}

export { pluginConfig as config, handler };
