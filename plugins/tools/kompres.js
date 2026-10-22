import * as imageTools from "../../src/lib/naze-image-tools.js";

export const config = {
  name: "kompres",
  alias: ["compress"],
  category: "tools",
  description: "Mengompres gambar agar di bawah 1 MB dengan kualitas sejernih mungkin",
  usage: 'Kirim atau balas gambar dengan ".kompres"',
  example: ".kompres",
  cooldown: 15,
};

export async function handler(m) {
  await imageTools.compressImage(m);
}