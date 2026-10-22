import * as imageTools from "../../src/lib/naze-image-tools.js";

export const config = {
  name: "removebg",
  alias: ["nobg"],
  category: "tools",
  description: "Penghapus latar belakang gambar (dalam pengembangan)",
  usage: 'Kirim atau balas gambar dengan ".removebg"',
  example: ".removebg",
  cooldown: 5,
};

export async function handler(m) {
  await imageTools.removeBackground(m);
}