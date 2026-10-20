import * as sosmedManager from "../../src/lib/naze-sosdown-manager.js";

export const config = {
  name: "mp3",
  alias: [],
  category: "downloader",
  description: "Mengunduh audio TikTok, Instagram, atau YouTube sebagai MP3",
  usage: "Kirim .mp3 diikuti tautan, atau balas pesan berisi tautan",
  example: ".mp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  cooldown: 10,
};

export async function handler(m) {
  await sosmedManager.downloadMp3(m);
}
