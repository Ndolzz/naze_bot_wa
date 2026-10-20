import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "tovideo",
  alias: [],
  category: "sticker",
  description: "Mengubah stiker animasi menjadi video",
  usage: 'Kirim atau balas stiker animasi dengan ".tovideo"',
  example: ".tovideo",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.stickerToVideo(m);
}
