import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "take",
  alias: [],
  category: "sticker",
  description: "Mengubah metadata pembuat stiker",
  usage: 'Kirim atau balas stiker dengan ".take", opsional ".take nama pack | nama author"',
  example: ".take NAZE | Nendi",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.takeSticker(m);
}
