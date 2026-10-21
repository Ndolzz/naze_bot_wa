import { vectorizeImageToXml } from "../../src/lib/naze-vector.js";

export const config = {
  name: "amvector",
  alias: [],
  category: "tools",
  description: "Mengubah gambar menjadi siluet vektor XML Alight Motion",
  usage: ".amvector [isi|garis|kontur] [asli] [gelap|terang] [ambang 1-99] [#rrggbb]",
  example: ".amvector garis",
  cooldown: 15,
};

function parseOptions(args) {
  const options = {};
  for (const raw of args || []) {
    const arg = String(raw).toLowerCase();
    if (arg === "isi" || arg === "garis" || arg === "kontur") {
      options.representation = arg;
    } else if (arg === "asli") {
      options.originalColors = true;
    } else if (arg === "gelap" || arg === "terang") {
      options.mode = arg;
    } else if (/^#[0-9a-f]{6}$/.test(arg)) {
      options.color = arg;
    } else if (/^\d{1,2}$/.test(arg)) {
      const value = parseInt(arg, 10);
      if (value >= 1 && value <= 99) options.threshold = value;
    }
  }
  return options;
}

function getSource(m) {
  if (m.isImage) return m;
  if (m.isQuoted && m.quoted?.isImage) return m.quoted;
  return null;
}

export async function handler(m) {
  const source = getSource(m);
  if (!source) {
    return m.reply(
      "Kirim atau balas gambar dengan .amvector\nContoh: .amvector garis (untuk line art) atau .amvector isi",
    );
  }

  const options = parseOptions(m.args);
  const usageHint =
    "Pilihan: isi (bentuk terisi), garis (line art), kontur (per garis tepi), asli (warna asli), gelap/terang, ambang 1-99, warna #rrggbb.";

  await m.reply("Gambar sedang diproses. Hasil dikirim sebagai berkas XML Alight Motion.");

  try {
    const buffer = await source.download();
    if (!buffer || !buffer.length) {
      return m.reply("Gambar tidak dapat diunduh. Coba kirim ulang gambar tersebut.");
    }

    const result = await vectorizeImageToXml(buffer, options);
    if (!result.ok) {
      return m.reply(result.message + "\n\n" + usageHint);
    }

    const stats = result.stats;
    const caption = [
      "Vektorisasi selesai.",
      "Mode: " + stats.representation + " | Siluet: " + stats.mode + " | Ambang: " + stats.threshold,
      "Komponen: " + stats.componentCount + " | Path: " + stats.pathCount + " | Titik: " + stats.vertexCount,
      "Dimensi kerja: " + stats.width + " x " + stats.height,
      "Impor berkas XML ini ke Alight Motion sebagai proyek.",
    ].join("\n");

    const fileName = "naze-vector-" + stats.representation + ".xml";
    return m.replyDocument(
      Buffer.from(result.xml, "utf8"),
      fileName,
      "application/xml",
      { caption },
    );
  } catch (err) {
    return m.reply(
      "Pemrosesan gagal: " + (err?.message || "kesalahan tidak diketahui"),
    );
  }
}
