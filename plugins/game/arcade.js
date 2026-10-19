import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendInlineHtml } from "../../src/lib/naze-inline-html.js";

// Perintah langsung -> id game (nama file di assets/arcade tanpa .html)
const DIRECT = {
  dino: "dino",
  sonik: "sonik",
  speedy: "sonik",
  tetris: "tetris",
  chess: "chess",
  fishgame: "fishing",
  ularrimba: "snake",
  ttsilang: "tts",
};

const pluginConfig = {
  name: ["arcade", ...Object.keys(DIRECT)],
  alias: ["arcadegame"],
  category: "game",
  description: "Naze Games Arcade: game yang dimainkan langsung di dalam chat WhatsApp",
  usage: ".arcade [nama/nomor] [file]",
  example: ".arcade dino",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

// Semua file .html di assets/arcade otomatis jadi game.
// Judul diambil dari <title>, info tambahan dari meta:
//   <meta name="game:desc" content="Deskripsi singkat">
//   <meta name="game:controls" content="Cara main">
const GAME_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../assets/arcade",
);

function readMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  return html.match(re)?.[1]?.replace(/&quot;/g, '"').trim() || "";
}

function loadGames() {
  if (!fs.existsSync(GAME_DIR)) return [];
  return fs
    .readdirSync(GAME_DIR)
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const id = path.basename(file, ".html").toLowerCase();
      let html = "";
      try {
        html = fs.readFileSync(path.join(GAME_DIR, file), "utf8");
      } catch {
        return null;
      }
      return {
        id,
        file,
        html,
        title: readMeta(html, "game:title") || html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || id,
        desc: readMeta(html, "game:desc") || "Game arcade",
        controls: readMeta(html, "game:controls"),
      };
    })
    .filter(Boolean);
}

function findGame(games, query) {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const exact = games.find((g) => g.id === q);
  if (exact) return exact;
  if (/^\d+$/.test(q)) return games[parseInt(q, 10) - 1] || null;
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cq = clean(q);
  return (
    games.find((g) => clean(g.id) === cq || clean(g.title) === cq) ||
    games.find((g) => clean(g.title).includes(cq) || clean(g.id).includes(cq)) ||
    null
  );
}

async function handler(m, { sock }) {
  const prefix = m.prefix || ".";
  const cmd = (m.command || "").toLowerCase();
  const games = loadGames();

  if (games.length === 0) {
    return m.reply(
      `*Arcade*\n\n> Belum ada game. Taruh file .html di folder assets/arcade/.`,
    );
  }

  const args = (m.args || []).map((a) => a.toLowerCase());
  const asFile = args.includes("file");
  const query = DIRECT[cmd] || args.filter((a) => a !== "file").join(" ").trim();

  if (!query) {
    let txt = `*NAZE GAMES - Arcade*\n\nGame dimainkan langsung di chat, tanpa install dan tanpa buka browser.\n\n`;
    games.forEach((g, i) => {
      txt += `${i + 1}. *${g.title}*\n   ${g.desc}\n`;
    });
    txt += `\nCara main: ${prefix}arcade <nama atau nomor>\n`;
    txt += `Contoh: ${prefix}arcade dino\n`;
    txt += `Kalau game tidak tampil di WhatsApp kamu, tambahkan kata "file" untuk menerima file HTML dan buka di browser, contoh: ${prefix}arcade dino file`;
    return m.reply(txt);
  }

  const game = findGame(games, query);
  if (!game) {
    return m.reply(
      `*Game tidak ditemukan*\n\n> "${query}" tidak ada.\n> Ketik ${prefix}arcade untuk melihat daftar.`,
    );
  }

  const sendFile = () =>
    sock.sendMessage(
      m.chat,
      {
        document: Buffer.from(game.html, "utf8"),
        mimetype: "text/html",
        fileName: `${game.title}.html`,
        caption:
          `*${game.title}*\n\n${game.desc}` +
          (game.controls ? `\n\nKontrol: ${game.controls}` : "") +
          `\n\n> Buka file ini dengan browser (Chrome/Firefox/Safari).`,
      },
      { quoted: m },
    );

  try {
    if (asFile) return await sendFile();
    await sendInlineHtml(sock, m.chat, game.html, game.title);
  } catch (error) {
    console.error("Arcade Plugin Error:", error);
    try {
      await sendFile();
    } catch {
      await m.reply(`*Gagal*\n\n> ${error.message}`);
    }
  }
}

export { pluginConfig as config, handler };
