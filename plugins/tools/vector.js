import * as vectorManager from "../../src/lib/naze-vector-manager.js";

export const config = {
  name: "vector",
  alias: ["vektor"],
  category: "tools",
  description: "Mengubah gambar menjadi siluet vektor SVG",
  usage: 'Balas gambar/stiker dengan ".vector"; opsional: terang|gelap, angka ambang 1-99, rendah|sedang|tinggi, warna #RRGGBB',
  example: ".vector terang 70 sedang #2563EB",
  cooldown: 10,
};

export async function handler(m) {
  await vectorManager.createVector(m);
}
