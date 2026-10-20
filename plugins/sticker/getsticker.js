import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "getsticker",
  alias: [],
  category: "sticker",
  description: "Mengambil stiker tersimpan berdasarkan nama",
  usage: 'Kirim ".getsticker" diikuti nama stiker',
  example: ".getsticker kucing",
  cooldown: 3,
};

export async function handler(m) {
  await stickerManager.getStoredSticker(m);
}
