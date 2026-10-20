import * as fileManager from "../../src/lib/naze-file-manager.js";

export const config = {
  name: "totxt",
  alias: [],
  category: "files",
  description: "Mengubah teks menjadi file TXT",
  usage: 'Balas pesan teks dengan ".totxt", atau kirim ".totxt" diikuti teksnya',
  example: ".totxt Nama saya Nendi",
  cooldown: 5,
};

export async function handler(m, { sock }) {
  await fileManager.createTxt(m, sock);
}
