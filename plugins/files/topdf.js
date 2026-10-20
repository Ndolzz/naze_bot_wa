import * as fileManager from "../../src/lib/naze-file-manager.js";

export const config = {
  name: "topdf",
  alias: [],
  category: "files",
  description: "Menggabungkan foto dan file TXT menjadi satu dokumen PDF",
  usage: "Kirim .topdf, lalu kirim berkas satu per satu, akhiri dengan nama output",
  example: ".topdf",
  cooldown: 5,
};

export async function handler(m, { sock }) {
  await fileManager.startSession(m, "pdf", sock);
}
