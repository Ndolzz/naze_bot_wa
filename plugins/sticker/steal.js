import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "steal",
  alias: [],
  category: "sticker",
  description: "Mengambil stiker dengan metadata baru, opsional menyimpan ke koleksi",
  usage: 'Kirim atau balas stiker dengan ".steal", opsional ".steal nama" untuk menyimpan',
  example: ".steal kucing",
  cooldown: 5,
};

export async function handler(m) {
  await stickerManager.stealSticker(m);
}
