import { menuText } from "../../src/lib/naze-file-utils.js";

export const config = {
  name: "menu",
  alias: [],
  category: "files",
  description: "Menampilkan menu utama NAZE",
  usage: "Kirim .menu",
  example: ".menu",
  cooldown: 5,
};

export async function handler(m) {
  await m.reply(menuText());
}
