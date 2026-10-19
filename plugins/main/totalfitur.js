import { buildStructure, countOf } from "../../src/lib/naze-menu-util.js";

const pluginConfig = {
  name: "totalfitur",
  alias: ["totalfeature", "totalcmd", "countplugin", "distribusi"],
  category: "main",
  description: "Jumlah perintah bot per menu",
  usage: ".totalfitur",
  example: ".totalfitur",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const structure = buildStructure({ isOwner: m.isOwner });
  const total = structure.reduce((n, s) => n + countOf(s), 0);

  const lines = ["*Jumlah Perintah*", "--------------------------------"];
  for (const s of structure) {
    lines.push(`*${s.label}*: ${countOf(s)}`);
    for (const sub of s.subs) lines.push(`- ${sub.label}: ${sub.items.length}`);
    lines.push("");
  }
  lines.push(`Total: ${total} perintah`);
  return m.reply(lines.join("\n"));
}

export { pluginConfig as config, handler };
