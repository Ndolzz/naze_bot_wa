import * as sosmedManager from "../../src/lib/naze-sosdown-manager.js";

export const config = {
  name: "instagram",
  alias: ["ig"],
  category: "downloader",
  description: "Mengunduh video, foto, atau carousel Instagram",
  usage: "Kirim .instagram diikuti tautan Instagram, atau balas pesan berisi tautan",
  example: ".instagram https://www.instagram.com/reel/Cxxxxxxxx",
  cooldown: 10,
};

export async function handler(m) {
  await sosmedManager.downloadInstagram(m);
}
