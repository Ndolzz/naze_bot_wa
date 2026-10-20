import * as fileManager from "../../src/lib/naze-file-manager.js";

export const config = {
  name: "toqr",
  alias: [],
  category: "files",
  description: "Mengubah teks menjadi gambar kode QR",
  usage: 'Balas pesan teks dengan ".toqr", atau kirim ".toqr" diikuti teksnya',
  example: ".toqr https://contoh.com",
  cooldown: 5,
};

export async function handler(m, { sock }) {
  await fileManager.createQr(m, sock);
}
