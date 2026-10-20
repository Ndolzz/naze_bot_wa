import * as fileManager from "../../src/lib/naze-file-manager.js";

export const config = {
  name: "tozip",
  alias: [],
  category: "files",
  description: "Mengemas beberapa berkas menjadi satu arsip ZIP",
  usage: "Kirim .tozip, lalu kirim berkas satu per satu, akhiri dengan nama output",
  example: ".tozip",
  cooldown: 5,
};

export async function handler(m, { sock }) {
  await fileManager.startSession(m, "zip", sock);
}
