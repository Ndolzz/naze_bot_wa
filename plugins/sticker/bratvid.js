import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "bratvid",
  alias: [],
  category: "sticker",
  description: "Membuat stiker teks BRAT animasi dengan pola acak",
  usage: 'Kirim ".bratvid" diikuti teksnya, atau balas pesan teks dengan ".bratvid"',
  example: ".bratvid teks di sini",
  cooldown: 10,
};

export async function handler(m) {
  await stickerManager.createBratVid(m);
}
