import { performance } from "perf_hooks";
import { getDatabase } from "../src/lib/naze-database.js";
import {
  getAllPlugins,
  getCommandsByCategory,
  getCategories,
  pluginStore,
} from "../src/lib/naze-plugins.js";
import config from "../config.js";

function toSmallCaps(text) {
  return String(text).toUpperCase();
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const CATEGORY_EMOJIS = {
  owner: "",
  main: "",
  utility: "",
  fun: "",
  group: "",
  download: "",
  search: "",
  tools: "",
  sticker: "",
  game: "",
  media: "",
  info: "",
  user: "",
  canvas: "",
  premium: "",
  convert: "",
  economy: "",
};

async function handleCommand(m, sock) {
  try {
    if (!m.isCommand) return { handled: false };

    const command = m.command?.toLowerCase();
    if (!command) return { handled: false };

    const db = getDatabase();

    switch (command) {
      // Category: info
      case "cping":
      case "cspeed":
      case "clatency": {
        try {
          if (config.features?.autoTyping) {
            await sock.sendPresenceUpdate("composing", m.chat);
          }

          const start = performance.now();
          await m.react("");

          const msgTimestamp = m.messageTimestamp
            ? m.messageTimestamp * 1000
            : Date.now();
          const latency = Math.max(1, Date.now() - msgTimestamp);

          const processTime = (performance.now() - start).toFixed(2);

          let pingStatus = " Excellent";
          if (latency > 100 && latency <= 300) pingStatus = " Good";
          else if (latency > 300) pingStatus = " Poor";

          const text =
            ` *CASE SYSTEM PING*\n\n` +
            `╭┈┈「 *Status* 」\n` +
            `┃ ◦ Latency: *${latency}ms*\n` +
            `┃ ◦ Process: *${processTime}ms*\n` +
            `┃ ◦ Status: ${pingStatus}\n` +
            `╰┈┈`;

          await m.reply(text);
          await m.react("");

          if (config.features?.autoTyping) {
            await sock.sendPresenceUpdate("paused", m.chat);
          }
        } catch (error) {
          console.error("[CPing] Error:", error);
          await m.react("");
          await m.reply(` *Gagal*\n\n> ${error.message}`);
        }
        return { handled: true };
      }

      case "lcase":
      case "caselist":
      case "allcase":
      case "listallcase": {
        try {
          if (config.features?.autoTyping) {
            await sock.sendPresenceUpdate("composing", m.chat);
          }

          await m.react("");

          const casesByCategory = {
            info: ["cping", "listallcase", "listallplugin"],
          };

          const caseAliases = {
            cping: ["cspeed", "clatency"],
            listallcase: ["lcase", "caselist", "allcase"],
            listallplugin: ["lplugin", "pluginlist", "allplugin"],
          };

          let totalCases = 0;
          for (const cat in casesByCategory) {
            totalCases += casesByCategory[cat].length;
          }

          let text = `╔══════════════════╗\n`;
          text += ` *${toSmallCaps("CASE LIST")}*\n`;
          text += `╚══════════════════╝\n\n`;
          text += `╭┈┈「 *Info* 」\n`;
          text += `┃ ◦ Total: *${totalCases}* cases\n`;
          text += `┃ ◦ Kategori: *${Object.keys(casesByCategory).length}*\n`;
          text += `╰┈┈\n\n`;

          for (const category in casesByCategory) {
            const commands = casesByCategory[category];
            const emoji = CATEGORY_EMOJIS[category] || "";
            const categoryName = toSmallCaps(category);

            text += `╭┈┈「 ${emoji} *${categoryName}* 」\n`;
            commands.forEach((cmd, i) => {
              const prefix = m.prefix || ".";
              const aliases = caseAliases[cmd]
                ? ` (${caseAliases[cmd].slice(0, 2).join(", ")})`
                : "";
              text += `┃ ${i + 1}. ${prefix}${cmd}${aliases}\n`;
            });
            text += `╰┈┈\n\n`;
          }

          text += `*━━━━━━━━━━━━━━━*\n`;
          text += ` *Tip:* Gunakan \`.listallplugin\` untuk melihat plugin`;

          await sock.sendMessage(
            m.chat,
            {
              text,
              contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: "120363405683815121@newsletter",
                  newsletterName: "Naze Case System",
                  serverMessageId: 127,
                },
              },
            },
            { quoted: m },
          );

          await m.react("");

          if (config.features?.autoTyping) {
            await sock.sendPresenceUpdate("paused", m.chat);
          }
        } catch (error) {
          console.error("[ListAllCase] Error:", error);
          await m.react("");
          await m.reply(` *Gagal*\n\n> ${error.message}`);
        }
        return { handled: true };
      }

      case "lplugin":
      case "pluginlist":
      case "allplugin":
      case "listallplugin": {
        try {
          if (config.features?.autoTyping) {
            await sock.sendPresenceUpdate("composing", m.chat);
          }

          await m.react("");

          const categories = getCategories();
          const commandsByCategory = getCommandsByCategory();

          let totalPlugins = 0;
          for (const category of categories) {
            totalPlugins += (commandsByCategory[category] || []).length;
          }

          if (totalPlugins === 0) {
            await m.reply(" *Belum ada plugin yang dimuat*");
            return { handled: true };
          }

          let text = `╔══════════════════╗\n`;
          text += ` *${toSmallCaps("PLUGIN LIST")}*\n`;
          text += `╚══════════════════╝\n\n`;
          text += `╭┈┈「 *Info* 」\n`;
          text += `┃ ◦ Total: *${totalPlugins}* plugins\n`;
          text += `┃ ◦ Kategori: *${categories.length}*\n`;
          text += `╰┈┈\n\n`;

          for (const category of categories.sort()) {
            const commands = commandsByCategory[category] || [];
            if (commands.length === 0) continue;

            const emoji = CATEGORY_EMOJIS[category] || "";
            const categoryName = toSmallCaps(category);

            text += `╭┈┈「 ${emoji} *${categoryName}* 」\n`;

            commands.sort().forEach((cmd, i) => {
              const plugin = pluginStore.commands.get(cmd);
              if (plugin && plugin.config) {
                const prefix = m.prefix || ".";
                const aliases = plugin.config.alias
                  ? ` (${plugin.config.alias.slice(0, 2).join(", ")})`
                  : "";
                text += `┃ ${i + 1}. ${prefix}${cmd}${aliases}\n`;
              }
            });

            text += `╰┈┈\n\n`;
          }

          text += `*━━━━━━━━━━━━━━━*\n`;
          text += ` *Tip:* Gunakan \`.listallcase\` untuk melihat case`;

          await sock.sendMessage(
            m.chat,
            {
              text,
              contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: "120363405683815121@newsletter",
                  newsletterName: "Naze Plugin System",
                  serverMessageId: 127,
                },
              },
            },
            { quoted: m },
          );

          await m.react("");

          if (config.features?.autoTyping) {
            await sock.sendPresenceUpdate("paused", m.chat);
          }
        } catch (error) {
          console.error("[ListAllPlugin] Error:", error);
          await m.react("");
          await m.reply(` *Gagal*\n\n> ${error.message}`);
        }
        return { handled: true };
      }
      // End Category: info

      default:
        return { handled: false };
    }
  } catch (error) {
    console.error("[CaseHandler] Error:", error);
    try {
      await m.reply(` *Error*\n\n> ${error.message}`);
    } catch {}
    return { handled: true, error: error.message };
  }
}

function getCaseCommands() {
  return {
    info: ["cping", "listallcase", "listallplugin"],
  };
}

function getCaseCount() {
  const cases = getCaseCommands();
  let total = 0;
  for (const category in cases) {
    total += cases[category].length;
  }
  return total;
}

function getCaseCategories() {
  return Object.keys(getCaseCommands());
}

function getCasesByCategory() {
  return getCaseCommands();
}

export {
  handleCommand,
  getCaseCommands,
  getCaseCount,
  getCaseCategories,
  getCasesByCategory,
};
