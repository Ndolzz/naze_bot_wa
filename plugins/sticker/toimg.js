import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "toimg",
  alias: [],
  category: "sticker",
  description: "Mengubah stiker menjadi gambar",
  usage: 'Kirim atau balas stiker dengan ".toimg"',
  example: ".toimg",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.stickerToImage(m);
}
