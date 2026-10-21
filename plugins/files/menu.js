import { menuText, BOT_TITLE } from "../../src/lib/naze-file-utils.js";
import { stickerStudioMenuText } from "../../src/lib/naze-sticker-utils.js";
import { sosmedDownloaderMenuText } from "../../src/lib/naze-sosdown-utils.js";
import { ytsearchMenuText } from "../../src/lib/naze-ytsearch-utils.js";
import { vectorMenuText } from "../../src/lib/naze-vector-utils.js";

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
    sosmedDownloaderMenuText(),
    "",
    ytsearchMenuText(),
    "",
    vectorMenuText(),
    "",
    menuText(false),
  ].join("\n");
  await m.reply(menu);
}
