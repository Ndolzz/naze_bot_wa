// Modul menu NAZE (murni).
// Menyediakan pemetaan kategori, teks menu lengkap, detail fitur, dan
// penafsiran argumen menu dari daftar plugin yang diberikan. Tidak membaca
// config, filesystem, maupun socket sehingga seluruh fungsi dapat diuji
// tanpa koneksi WhatsApp (tests/menu.test.js).
//
// Tahap 1 hanya menyediakan modul ini beserta pengujian; perilaku
// plugins/files/menu.js belum berubah.

export const DEFAULT_CATEGORY_ORDER = [
  "files",
  "sticker",
  "game",
  "search",
  "download",
  "tools",
  "owner",
  "group",
  "ai",
  "other",
];

export const DEFAULT_CATEGORY_LABEL = {
  files: "Pengelolaan File",
  sticker: "Sticker Studio",
  game: "Game",
  search: "Pencarian",
  download: "Downloader",
  tools: "Alat",
  owner: "Owner",
  group: "Group",
  ai: "AI",
  other: "Lainnya",
};

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function pluginNameList(config) {
  const names = Array.isArray(config?.name) ? config.name : [config?.name];
  return names.map(normalizeKey).filter(Boolean);
}

function pluginAliasList(config) {
  const alias = config?.alias;
  const values = Array.isArray(alias) ? alias : alias ? [alias] : [];
  return values.map(normalizeKey).filter(Boolean);
}

function resolveOptions(options = {}) {
  return {
    prefix: typeof options.prefix === "string" && options.prefix ? options.prefix : ".",
    categoryOrder: Array.isArray(options.categoryOrder) ? options.categoryOrder : DEFAULT_CATEGORY_ORDER,
    categoryLabel:
      options.categoryLabel && typeof options.categoryLabel === "object"
        ? { ...DEFAULT_CATEGORY_LABEL, ...options.categoryLabel }
        : { ...DEFAULT_CATEGORY_LABEL },
  };
}

function categoryLabel(category, categoryLabel) {
  return categoryLabel[category] || category.toUpperCase();
}

/**
 * Mengelompokkan daftar plugin per kategori menu.
 * Plugin nonaktif (isEnabled === false) dan duplikasi nama primer
 * disembunyikan, mengikuti perilaku menu saat ini.
 * @param {Object[]} plugins - Daftar plugin (bentuk getAllPlugins()).
 * @param {Object} options - { categoryOrder, categoryLabel }.
 * @returns {{key: string, label: string, plugins: Object[]}[]}
 */
export function groupPluginsByCategory(plugins, options = {}) {
  const { categoryOrder, categoryLabel: labels } = resolveOptions(options);
  const seen = new Set();
  const byCategory = new Map();

  for (const plugin of plugins || []) {
    const cfg = plugin?.config;
    if (!cfg || cfg.isEnabled === false) continue;
    const primary = pluginNameList(cfg)[0];
    if (!primary || seen.has(primary)) continue;
    seen.add(primary);

    const category = normalizeKey(cfg.category || "uncategorized");
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push({
      primary,
      aliases: pluginAliasList(cfg),
      description: String(cfg.description || ""),
      config: cfg,
      plugin,
    });
  }

  const rank = (cat) => {
    const index = categoryOrder.indexOf(cat);
    return index >= 0 ? index : categoryOrder.length;
  };

  return [...byCategory.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((key) => ({
      key,
      label: categoryLabel(key, labels),
      plugins: byCategory.get(key).sort((a, b) => a.primary.localeCompare(b.primary)),
    }));
}

/**
 * Membangun teks menu lengkap (perilaku .menu saat ini, termasuk ".menu all"
 * pada Tahap 2).
 * @param {Object[]} plugins - Daftar plugin.
 * @param {Object} options - { prefix, categoryOrder, categoryLabel }.
 * @returns {string} Teks menu.
 */
export function buildFullMenuText(plugins, options = {}) {
  const { prefix } = resolveOptions(options);
  const groups = groupPluginsByCategory(plugins, options);

  const lines = [];
  let total = 0;
  for (const group of groups) total += group.plugins.length;

  lines.push("NAZE BOT - DAFTAR FITUR");
  lines.push("Prefix: " + prefix + " | Total fitur: " + total);
  for (const group of groups) {
    lines.push("");
    lines.push("[" + group.label + "]");
    for (const item of group.plugins) {
      const commands = [prefix + item.primary].concat(
        item.aliases.map((a) => prefix + a),
      );
      lines.push(commands.join(" / ") + " - " + item.description);
    }
  }
  return lines.join("\n");
}

/**
 * Membangun teks detail satu fitur.
 * @param {Object} plugin - Plugin (bentuk getAllPlugins()).
 * @param {Object} options - { prefix, categoryLabel }.
 * @returns {string|null} Teks detail, atau null bila plugin tidak sah.
 */
export function buildFeatureDetail(plugin, options = {}) {
  const cfg = plugin?.config;
  if (!cfg) return null;
  const { prefix, categoryLabel: labels } = resolveOptions(options);
  const primary = pluginNameList(cfg)[0];
  if (!primary) return null;

  const category = normalizeKey(cfg.category || "uncategorized");
  const lines = ["NAZE BOT - DETAIL FITUR", ""];
  const commands = [prefix + primary].concat(
    pluginAliasList(cfg).map((a) => prefix + a),
  );
  lines.push("Perintah: " + commands.join(" / "));
  lines.push("Kategori: " + categoryLabel(category, labels));
  if (cfg.description) lines.push("Deskripsi: " + cfg.description);
  if (cfg.usage) lines.push("Cara pakai: " + cfg.usage);
  if (cfg.example) lines.push("Contoh: " + cfg.example);
  if (Number.isFinite(Number(cfg.cooldown)) && Number(cfg.cooldown) > 0) {
    lines.push("Cooldown: " + Number(cfg.cooldown) + " detik");
  }
  lines.push("");
  lines.push("Ketik .menu untuk kembali ke menu utama.");
  return lines.join("\n");
}

/**
 * Mencari plugin berdasarkan nama atau alias perintah.
 * @param {Object[]} plugins - Daftar plugin.
 * @param {string} command - Nama atau alias perintah (tanpa prefix).
 * @returns {Object|null} Plugin yang cocok, atau null.
 */
export function findPluginByCommand(plugins, command) {
  const target = normalizeKey(command);
  if (!target) return null;
  for (const plugin of plugins || []) {
    const cfg = plugin?.config;
    if (!cfg || cfg.isEnabled === false) continue;
    if (pluginNameList(cfg).includes(target)) return plugin;
    if (pluginAliasList(cfg).includes(target)) return plugin;
  }
  return null;
}

/**
 * Menafsirkan argumen menu menjadi target navigasi (dipakai pada Tahap 2).
 * @param {string} raw - Argumen setelah .menu (m.text).
 * @param {Object[]} plugins - Daftar plugin.
 * @param {Object} options - { prefix, categoryOrder, categoryLabel }.
 * @returns {{kind: "main"|"all"|"category"|"feature", category?: string, plugin?: Object}|null}
 *          null bila argumen kosong (menu utama).
 */
export function parseMenuTarget(raw, plugins, options = {}) {
  const { prefix } = resolveOptions(options);
  const arg = String(raw || "").trim();
  if (!arg) return null;

  const lowered = arg.toLowerCase();
  if (lowered === "all" || lowered === "semua") {
    return { kind: "all" };
  }

  const groups = groupPluginsByCategory(plugins, options);
  for (const group of groups) {
    if (lowered === group.key || lowered === group.label.toLowerCase()) {
      return { kind: "category", category: group.key };
    }
  }

  const stripped = lowered.startsWith(prefix) ? lowered.slice(prefix.length) : lowered;
  const plugin = findPluginByCommand(plugins, stripped);
  if (plugin) {
    return { kind: "feature", plugin };
  }

  return { kind: "invalid", arg };
}
