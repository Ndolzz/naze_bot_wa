import * as imageTools from "../../src/lib/naze-image-tools.js";

export const config = {
  name: "reformat",
  alias: ["toformat"],
  category: "tools",
  description: "Mengubah format gambar ke JPG, PNG, atau WebP",
  usage: 'Kirim atau balas gambar dengan ".reformat jpg|png|webp [kualitas 30-100]"',
  example: ".reformat png",
  cooldown: 5,
};

export async function handler(m) {
  await imageTools.reformatImage(m);
}