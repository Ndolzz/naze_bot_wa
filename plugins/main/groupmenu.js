import config from "../../config.js";
import { buildStructure, findSection, buildSection } from "../../src/lib/naze-menu-util.js";

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
  return m.reply(buildSection(section, prefix).replace(/\*GROUPS\*/, "*NAZE GROUP*"));
}

export { pluginConfig as config, handler };
