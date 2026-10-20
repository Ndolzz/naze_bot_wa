import * as sosmedManager from "../../src/lib/naze-sosdown-manager.js";

export const config = {
  name: "tiktok",
  alias: [],
  category: "downloader",
  description: "Mengunduh video atau foto TikTok",
  usage: "Kirim .tiktok diikuti tautan TikTok, atau balas pesan berisi tautan",
  example: ".tiktok https://www.tiktok.com/@user/video/123456",
  cooldown: 10,
};

export async function handler(m) {
  await sosmedManager.downloadTikTok(m);
}
