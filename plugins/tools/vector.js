import * as vectorManager from "../../src/lib/naze-vector-manager.js";

export const config = {
  name: "vector",
  alias: ["vektor"],
  category: "tools",
  description: "Mengubah gambar menjadi vektor XML Alight Motion",
  usage: 'Balas gambar/stiker dengan ".vector"; opsional: terang|gelap, angka ambang 1-99, rendah|sedang|tinggi, warna #RRGGBB, isi|garis',
  example: ".vector terang 70 sedang #2563EB",
  cooldown: 10,
};

export async function handler(m) {
  await vectorManager.createVector(m);
}
