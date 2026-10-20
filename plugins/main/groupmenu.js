import config from "../../config.js";
import { setPlainMenu } from "../../src/lib/naze-menu-typography.js";
import { buildStructure, findSection, buildSection } from "../../src/lib/naze-menu-util.js";

setPlainMenu(config.features?.plainMenu === true);

const pluginConfig = {
  name: "groupmenu",
  alias: ["menugrup", "menugroup", "gmenu"],
  category: "main",
  description: "Menu administrasi grup",
  usage: ".groupmenu",
  example: ".groupmenu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const prefix = config.command?.prefix || ".";
  const section = findSection(buildStructure({ isOwner: m.isOwner }), "groups");
  if (!section) return m.reply("Menu grup tidak tersedia.");
  return m.reply(buildSection(section, prefix, { title: "NAZE GROUP" }));
}

export { pluginConfig as config, handler };
