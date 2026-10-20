import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "togif",
  alias: [],
  category: "sticker",
  description: "Mengubah stiker animasi menjadi GIF",
  usage: 'Kirim atau balas stiker animasi dengan ".togif"',
  example: ".togif",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.stickerToGif(m);
}
