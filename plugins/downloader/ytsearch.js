import * as ytsearchManager from "../../src/lib/naze-ytsearch-manager.js";

export const config = {
  name: "ytsearch",
  alias: ["yts"],
  category: "downloader",
  description: "Mencari video YouTube lalu mengunduhnya",
  usage: 'Kirim ".ytsearch" diikuti kata kunci; kirim ".ytsearch <nomor>" untuk memilih hasil',
  example: ".ytsearch lagu Indonesia",
  cooldown: 5,
};

export async function handler(m) {
  await ytsearchManager.searchYouTube(m);
}
