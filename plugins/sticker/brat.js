import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "brat",
  alias: [],
  category: "sticker",
  description: "Membuat stiker teks BRAT statis",
  usage: 'Kirim ".brat" diikuti teksnya, atau balas pesan teks dengan ".brat"',
  example: ".brat teks di sini",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.createBrat(m);
}
