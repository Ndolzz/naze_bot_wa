// Modul menu NAZE (murni).
// Menyediakan pemetaan kategori, teks menu lengkap, detail fitur, penafsiran
// argumen menu, dan tampilan menu interaktif (WhatsApp List Message) dari
// daftar plugin yang diberikan. Tidak membaca config, filesystem, maupun
// socket sehingga seluruh fungsi dapat diuji tanpa koneksi WhatsApp
// (tests/menu.test.js, tests/menu-interactive.test.js).
//
// Tahap 2: .menu default interaktif (lihat plugins/files/menu.js dan
// src/lib/naze-menu-send.js); .menu all tetap menghasilkan teks menu
// lengkap. Row ID list berupa perintah ".menu <target>" (ASCII) sehingga
// pilihan pengguna diproses ulang oleh dispatcher sebagai perintah biasa.

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
 * Membangun teks menu lengkap (perilaku ".menu all" sejak Tahap 2).
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
 * Menafsirkan argumen menu menjadi target navigasi.
 * @param {string} raw - Argumen setelah .menu (m.text).
 * @param {Object[]} plugins - Daftar plugin.
 * @param {Object} options - { prefix, categoryOrder, categoryLabel }.
 * @returns {{kind: "all"|"category"|"feature"|"invalid", category?: string, plugin?: Object, arg?: string}|null}
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

// ---------------------------------------------------------------------------
// Tahap 2: tampilan menu interaktif (WhatsApp List Message)
// ---------------------------------------------------------------------------
//
// Struktur tampilan (view):
//   kind         - "main" | "category" | "feature".
//   mode         - mode banner: null untuk banner utama, key kategori untuk
//                  banner per mode (lihat src/lib/naze-banner.js).
//   caption      - teks pendamping banner (caption gambar).
//   listText     - teks pada pesan list.
//   buttonText   - label tombol pembuka list.
//   sections     - seksi WhatsApp List Message; rowId tiap baris adalah
//                  perintah navigasi ".menu <target>" (ASCII).
//   fallbackText - teks yang dikirim bila pengiriman interaktif gagal.

const LIST_MAX_ROWS_PER_SECTION = 10;
const LIST_ROW_TITLE_MAX = 24;
const LIST_ROW_DESC_MAX = 72;

function truncateText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function buildListRow(rowId, title, description) {
  return {
    rowId,
    title: truncateText(title, LIST_ROW_TITLE_MAX),
    description: truncateText(description, LIST_ROW_DESC_MAX),
  };
}

function menuCommand(prefix, target = "") {
  return target ? prefix + "menu " + target : prefix + "menu";
}

function chunkRows(rows, size = LIST_MAX_ROWS_PER_SECTION) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

function buildListSections(sectionTitle, rows) {
  return chunkRows(rows).map((chunk, index) => ({
    title: index === 0 ? sectionTitle : sectionTitle + " (" + (index + 1) + ")",
    rows: chunk,
  }));
}

/**
 * Tampilan menu utama interaktif: satu baris per kategori terisi plus
 * baris menu teks lengkap. Kategori kosong tidak ditampilkan.
 * @param {Object[]} plugins - Daftar plugin.
 * @param {Object} options - { prefix, categoryOrder, categoryLabel }.
 * @returns {Object} Tampilan (view) menu utama.
 */
export function buildMainMenuView(plugins, options = {}) {
  const { prefix } = resolveOptions(options);
  const groups = groupPluginsByCategory(plugins, options);
  const total = groups.reduce((count, group) => count + group.plugins.length, 0);

  const categoryRows = groups.map((group) =>
    buildListRow(menuCommand(prefix, group.key), group.label, group.plugins.length + " fitur")
  );

  return {
    kind: "main",
    mode: null,
    caption:
      "NAZE BOT - MENU UTAMA\n" +
      "Prefix: " + prefix + " | Total fitur: " + total + "\n" +
      "Pilih kategori untuk melihat daftar fitur.",
    listText: "Pilih salah satu menu di bawah.",
    buttonText: "Pilih Menu",
    sections: buildListSections("Kategori", categoryRows).concat([
      {
        title: "Lainnya",
        rows: [
          buildListRow(menuCommand(prefix, "all"), "Semua Fitur", "Daftar lengkap dalam bentuk teks"),
        ],
      },
    ]),
    fallbackText: buildFullMenuText(plugins, options),
  };
}

/**
 * Teks kategori sebagai fallback: daftar fitur satu kategori.
 * @param {Object} group - Entri dari groupPluginsByCategory.
 * @param {Object} options - { prefix }.
 * @returns {string|null} Teks kategori, atau null bila grup tidak sah.
 */
export function buildCategoryText(group, options = {}) {
  if (!group || !Array.isArray(group.plugins)) return null;
  const { prefix } = resolveOptions(options);
  const lines = [
    "NAZE BOT - " + String(group.label || "").toUpperCase(),
    "Prefix: " + prefix + " | Total fitur: " + group.plugins.length,
    "",
  ];
  for (const item of group.plugins) {
    const commands = [prefix + item.primary].concat(
      item.aliases.map((a) => prefix + a),
    );
    lines.push(commands.join(" / ") + " - " + item.description);
  }
  lines.push("");
  lines.push("Ketik " + menuCommand(prefix) + " untuk kembali ke menu utama.");
  return lines.join("\n");
}

/**
 * Memilih target rowId fitur yang dipetakan balik ke fitur itu sendiri.
 * Nama utama yang bertabrakan dengan kategori (misalnya fitur "sticker"
 * pada kategori "sticker") digantikan alias pertama yang valid agar baris
 * fitur tidak menavigasi balik ke kategori yang sama.
 */
function resolveFeatureRowTarget(item, plugins, options) {
  const candidates = [item.primary].concat(item.aliases);
  for (const candidate of candidates) {
    const target = parseMenuTarget(candidate, plugins, options);
    if (target && target.kind === "feature" && target.plugin === item.plugin) {
      return candidate;
    }
  }
  return item.primary;
}

/**
 * Tampilan kategori interaktif: daftar fitur dalam kategori plus navigasi.
 * @param {Object[]} plugins - Daftar plugin.
 * @param {string} category - Key kategori.
 * @param {Object} options - { prefix, categoryOrder, categoryLabel }.
 * @returns {Object|null} null bila kategori tidak dikenal atau kosong.
 */
export function buildCategoryView(plugins, category, options = {}) {
  const { prefix } = resolveOptions(options);
  const key = normalizeKey(category);
  const groups = groupPluginsByCategory(plugins, options);
  const group = groups.find((item) => item.key === key);
  if (!group || group.plugins.length === 0) return null;

  const featureRows = group.plugins.map((item) =>
    buildListRow(
      menuCommand(prefix, resolveFeatureRowTarget(item, plugins, options)),
      prefix + item.primary,
      item.description
    )
  );
  const navigationRows = [
    buildListRow(menuCommand(prefix), "Menu Utama", "Kembali ke daftar kategori"),
    buildListRow(menuCommand(prefix, "all"), "Semua Fitur", "Daftar lengkap dalam bentuk teks"),
  ];

  return {
    kind: "category",
    mode: group.key,
    caption:
      "NAZE BOT - " + group.label.toUpperCase() + "\n" +
      "Prefix: " + prefix + " | Total fitur: " + group.plugins.length,
    listText: "Pilih fitur untuk melihat detail.",
    buttonText: "Pilih Fitur",
    sections: buildListSections(group.label, featureRows).concat(
      buildListSections("Navigasi", navigationRows)
    ),
    fallbackText: buildCategoryText(group, options),
  };
}

/**
 * Tampilan detail fitur interaktif: detail fitur plus navigasi kembali.
 * @param {Object[]} plugins - Daftar plugin (untuk navigasi kategori).
 * @param {Object} plugin - Plugin yang ditampilkan.
 * @param {Object} options - { prefix, categoryLabel }.
 * @returns {Object|null} null bila plugin tidak sah.
 */
export function buildFeatureView(plugins, plugin, options = {}) {
  const cfg = plugin?.config;
  const primary = pluginNameList(cfg)[0];
  if (!primary) return null;

  const { prefix } = resolveOptions(options);
  const category = normalizeKey(cfg.category || "uncategorized");
  const groups = groupPluginsByCategory(plugins, options);
  const group = groups.find((item) => item.key === category);

  const navigationRows = [];
  if (group) {
    navigationRows.push(
      buildListRow(
        menuCommand(prefix, group.key),
        group.label,
        "Kembali ke daftar fitur " + group.label
      )
    );
  }
  navigationRows.push(
    buildListRow(menuCommand(prefix), "Menu Utama", "Kembali ke daftar kategori")
  );
  navigationRows.push(
    buildListRow(menuCommand(prefix, "all"), "Semua Fitur", "Daftar lengkap dalam bentuk teks")
  );

  const detailText = buildFeatureDetail(plugin, options);
  return {
    kind: "feature",
    mode: category,
    caption: detailText,
    listText: "Pilih navigasi di bawah.",
    buttonText: "Navigasi",
    sections: buildListSections("Navigasi", navigationRows),
    fallbackText: detailText,
  };
}

/**
 * Teks balasan untuk target menu yang tidak dikenal.
 * @param {string} arg - Argumen yang tidak dikenal.
 * @param {Object} options - { prefix }.
 * @returns {string} Teks panduan.
 */
export function buildInvalidMenuText(arg, options = {}) {
  const { prefix } = resolveOptions(options);
  return [
    "Target menu tidak dikenali: " + String(arg || ""),
    "",
    "Ketik " + menuCommand(prefix) + " untuk menu interaktif atau " +
      menuCommand(prefix, "all") + " untuk daftar lengkap.",
  ].join("\n");
}
