import * as fileManager from "../../src/lib/naze-file-manager.js";

export const config = {
  name: "statusfile",
  alias: [],
  category: "files",
  description: "Menampilkan status sesi pengumpulan berkas",
  usage: "Kirim .statusfile saat sesi pengumpulan berjalan",
  example: ".statusfile",
  cooldown: 3,
};

export async function handler(m) {
  await fileManager.sendStatus(m);
}
