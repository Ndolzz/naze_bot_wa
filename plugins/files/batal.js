import * as fileManager from "../../src/lib/naze-file-manager.js";

export const config = {
  name: "batal",
  alias: [],
  category: "files",
  description: "Membatalkan sesi pengumpulan berkas",
  usage: "Kirim .batal saat sesi pengumpulan berjalan",
  example: ".batal",
  cooldown: 3,
};

export async function handler(m) {
  await fileManager.cancelSession(m);
}
