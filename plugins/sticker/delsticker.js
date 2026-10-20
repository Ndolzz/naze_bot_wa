import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "delsticker",
  alias: [],
  category: "sticker",
  description: "Menghapus stiker tersimpan berdasarkan nama",
  usage: 'Kirim ".delsticker" diikuti nama stiker',
  example: ".delsticker kucing",
  cooldown: 3,
};

export async function handler(m) {
  await stickerManager.deleteStoredSticker(m);
}
