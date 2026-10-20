import * as stickerManager from "../../src/lib/naze-sticker-manager.js";

export const config = {
  name: "liststicker",
  alias: [],
  category: "sticker",
  description: "Menampilkan daftar stiker tersimpan",
  usage: "Kirim .liststicker",
  example: ".liststicker",
  cooldown: 3,
};

export async function handler(m) {
  await stickerManager.listStoredStickers(m);
}
