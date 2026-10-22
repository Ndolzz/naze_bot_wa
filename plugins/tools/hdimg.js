import * as imageTools from "../../src/lib/naze-image-tools.js";

export const config = {
  name: "hdimg",
  alias: ["hd", "upscale"],
  category: "tools",
  description: "Meningkatkan resolusi dan ketajaman gambar",
  usage: 'Kirim atau balas gambar dengan ".hdimg [2|3|4]"',
  example: ".hdimg 3",
  cooldown: 15,
};

export async function handler(m) {
  await imageTools.enhanceImage(m);
}
