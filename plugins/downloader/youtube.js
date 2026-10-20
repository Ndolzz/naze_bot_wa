import * as sosmedManager from "../../src/lib/naze-sosdown-manager.js";

export const config = {
  name: "youtube",
  alias: ["yt"],
  category: "downloader",
  description: "Mengunduh video YouTube",
  usage: "Kirim .youtube diikuti tautan YouTube, atau balas pesan berisi tautan",
  example: ".youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  cooldown: 10,
};

export async function handler(m) {
  await sosmedManager.downloadYouTube(m);
}
