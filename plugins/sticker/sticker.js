import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "sticker",
  alias: ["s", "stiker"],
  category: "sticker",
  description: "Membuat stiker dari gambar atau video",
  usage: 'Kirim atau balas gambar/video dengan ".sticker"',
  example: ".sticker",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.createSticker(m);
}
