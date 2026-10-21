import { getAllPlugins } from "../../src/lib/naze-plugins.js";
import config from "../../config.js";

export const config = {
  name: "menu",
  alias: [],
  category: "files",
  description: "Menu utama: daftar seluruh fitur NAZE",
  usage: ".menu",
  example: ".menu",
  cooldown: 5,
};

const CATEGORY_ORDER = [
  "files",
  "sticker",
  "game",
  "search",
  "download",
  "tools",
];

const CATEGORY_LABEL = {
  files: "Pengelolaan File",
  sticker: "Sticker Studio",
  game: "Game",
  search: "Pencarian",
  download: "Downloader",
  tools: "Alat",
};

function buildMenu() {
  const prefix = config?.command?.prefix || ".";
  const seen = new Set();
  const byCategory = new Map();
  let total = 0;

  for (const plugin of getAllPlugins()) {
    const cfg = plugin?.config;
    if (!cfg || cfg.isEnabled === false) continue;
    const names = Array.isArray(cfg.name) ? cfg.name : [cfg.name];
    const primary = names[0];
    if (!primary || seen.has(primary)) continue;
    seen.add(primary);

    const category = String(cfg.category || "uncategorized").toLowerCase();
    if (!byCategory.has(category)) byCategory.set(category, []);
    const aliases = Array.isArray(cfg.alias)
      ? cfg.alias
      : cfg.alias
        ? [cfg.alias]
        : [];
    byCategory.get(category).push({
      primary,
      aliases,
      description: cfg.description || "",
    });
    total += 1;
  }

  const categoryRank = (cat) => {
    const index = CATEGORY_ORDER.indexOf(cat);
    return index >= 0 ? index : CATEGORY_ORDER.length;
  };
  const categories = [...byCategory.keys()].sort(
    (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b),
  );

  const lines = ["NAZE BOT - DAFTAR FITUR", "Prefix: " + prefix + " | Total fitur: " + total];
  for (const category of categories) {
    lines.push("");
    lines.push("[" + (CATEGORY_LABEL[category] || category.toUpperCase()) + "]");
    const items = byCategory
      .get(category)
      .sort((a, b) => a.primary.localeCompare(b.primary));
    for (const item of items) {
      const commands = [prefix + item.primary].concat(
        item.aliases.map((a) => prefix + a),
      );
      lines.push(commands.join(" / ") + " - " + item.description);
    }
  }
  return lines.join("\n");
}

export async function handler(m) {
  await m.reply(buildMenu());
}
