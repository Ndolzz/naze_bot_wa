import fs from "fs";
import path from "path";
import { getAllPlugins } from "../../src/lib/naze-plugins.js";
import te from "../../src/lib/naze-error.js";
const pluginConfig = {
  name: "searchplugin",
  alias: ["splugin", "findplugin", "infoplugin"],
  category: "owner",
  description: "Cari dan tampilkan info plugin",
  usage: ".splugin <nama>",
  example: ".splugin sticker",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function findPluginInfo(name) {
  const allPlugins = getAllPlugins();

  for (const plugin of allPlugins) {
    if (!plugin.config) continue;

    const rawName = plugin.config.name;
    const pName = (
      Array.isArray(rawName) ? rawName[0] : rawName
    )?.toLowerCase();
    const aliases = Array.isArray(plugin.config.alias)
      ? plugin.config.alias
      : plugin.config.alias
        ? [plugin.config.alias]
        : [];

    if (
      pName === name.toLowerCase() ||
      aliases.map((a) => a?.toLowerCase()).includes(name.toLowerCase())
    ) {
      return {
        ...plugin.config,
        filePath: plugin.filePath,
      };
    }
  }

  return null;
}

async function findPluginFromFile(pluginsDir, name) {
  const folders = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of folders) {
    const folderPath = path.join(pluginsDir, folder);
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"));

    for (const file of files) {
      const baseName = file.replace(".js", "");
      if (baseName.toLowerCase() === name.toLowerCase()) {
        const filePath = path.join(folderPath, file);
        try {
          const mod = await import(`file://${filePath.replace(/\\/g, "/")}`);
          return {
            ...mod.config,
            folder,
            file,
            filePath,
          };
        } catch (e) {
          return { folder, file, filePath, error: e.message };
        }
      }
    }
  }

  return null;
}

async function handler(m, { sock }) {
  const name = m.text?.trim();

  if (!name) {
    return m.reply(
      ` *Search Plugin*\n\n` +
        `> Cari dan tampilkan info plugin\n\n` +
        `*Contoh:*\n` +
        `> \`${m.prefix}splugin sticker\`\n` +
        `> \`${m.prefix}splugin menu\``,
    );
  }

  m.react("");

  try {
    let info = findPluginInfo(name);

    if (!info) {
      const pluginsDir = path.join(process.cwd(), "plugins");
      info = await findPluginFromFile(pluginsDir, name);
    }

    if (!info) {
      await m.react("");
      return m.reply(
        ` *Tidak Ditemukan*\n\n> Plugin \`${name}\` tidak ditemukan`,
      );
    }

    if (info.error) {
      await m.react("");
      return m.reply(
        ` *Plugin Error*\n\n` +
          `> File: \`${info.file}\`\n` +
          `> Folder: \`${info.folder}\`\n` +
          `> Error: \`${info.error}\``,
      );
    }

    const aliases = Array.isArray(info.alias)
      ? info.alias.join(", ")
      : info.alias || "-";
    const isEnabled = info.isEnabled !== false ? " Ya" : " Tidak";
    const isOwner = info.isOwner ? " Ya" : " Tidak";
    const isPremium = info.isPremium ? " Ya" : " Tidak";
    const isGroup = info.isGroup ? " Ya" : " Tidak";
    const isAdmin = info.isAdmin ? " Ya" : " Tidak";

    await m.react("");
    return m.reply(
      ` *Info Plugin*\n\n` +
        `╭┈┈「 *Detail* 」\n` +
        `┃ Nama: \`${info.name || "-"}\`\n` +
        `┃ Alias: \`${aliases}\`\n` +
        `┃ Category: \`${info.category || "-"}\`\n` +
        `┃ Desc: ${info.description || "-"}\n` +
        `┃ Usage: \`${info.usage || "-"}\`\n` +
        `┃ Example: \`${info.example || "-"}\`\n` +
        `╰┈┈\n\n` +
        `╭┈┈「 *Settings* 」\n` +
        `┃ Enabled: ${isEnabled}\n` +
        `┃ Owner Only: ${isOwner}\n` +
        `┃ Premium: ${isPremium}\n` +
        `┃ Group Only: ${isGroup}\n` +
        `┃ Admin Only: ${isAdmin}\n` +
        `┃ Cooldown: \`${info.cooldown || 0}s\`\n` +
        `┃ Limit: \`${info.limit || 0}\`\n` +
        `╰┈┈`,
    );
  } catch (error) {
    console.log(error);
    await m.react("");
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
