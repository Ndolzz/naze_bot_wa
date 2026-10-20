import { menuText, BOT_TITLE } from "../../src/lib/naze-file-utils.js";
import { stickerStudioMenuText } from "../../src/lib/naze-sticker-utils.js";

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
  const menu = [
    BOT_TITLE,
    "",
    stickerStudioMenuText(),
    "",
    menuText(false),
  ].join("\n");
  await m.reply(menu);
}
