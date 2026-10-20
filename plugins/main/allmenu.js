import config from "../../config.js";
import { setPlainMenu } from "../../src/lib/naze-menu-typography.js";
import { buildStructure, buildAllChunks } from "../../src/lib/naze-menu-util.js";

setPlainMenu(config.features?.plainMenu === true);

const pluginConfig = {
  name: "allmenu",
  alias: ["fullmenu", "allcommand", "semua"],
  category: "main",
  description: "Seluruh perintah bot per menu",
  usage: ".allmenu",
  example: ".allmenu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const prefix = config.command?.prefix || ".";
  const structure = buildStructure({ isOwner: m.isOwner });
  for (const chunk of buildAllChunks(structure, prefix)) {
    await m.reply(chunk);
  }
}

export { pluginConfig as config, handler };
