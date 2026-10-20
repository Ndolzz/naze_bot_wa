import { fileHelpText } from "../../src/lib/naze-file-utils.js";

export const config = {
  name: "filehelp",
  alias: [],
  category: "files",
  description: "Menampilkan panduan penggunaan fitur pengelolaan file",
  usage: "Kirim .filehelp",
  example: ".filehelp",
  cooldown: 5,
};

export async function handler(m) {
  await m.reply(fileHelpText());
}
