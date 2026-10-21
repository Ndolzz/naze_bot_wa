import { downloadYoutubeVideo } from "../../src/lib/naze-youtube.js";

export const config = {
  name: "ytmp4",
  alias: [],
  category: "download",
  description: "Mengunduh video YouTube sebagai MP4 (maks 64 MB)",
  usage: ".ytmp4 <tautan/kata kunci> [144|360|480|720|1080]",
  example: ".ytmp4 https://youtu.be/xxxx 360",
  cooldown: 15,
};

const VALID_QUALITY = ["144", "360", "480", "720", "1080"];

export async function handler(m) {
  const input = (m.text || "").trim();
  if (!input) {
    return m.reply(
      "Gunakan format: .ytmp4 <tautan/kata kunci> [144|360|480|720|1080]\nContoh: .ytmp4 https://youtu.be/xxxx 360",
    );
  }

  const parts = input.split(/\s+/);
  const last = parts[parts.length - 1];
  let quality = "360";
  if (VALID_QUALITY.includes(last)) {
    quality = last;
    parts.pop();
  }
  const query = parts.join(" ").trim();
  if (!query) {
    return m.reply(
      "Gunakan format: .ytmp4 <tautan/kata kunci> [144|360|480|720|1080]\nContoh: .ytmp4 https://youtu.be/xxxx 360",
    );
  }

  await m.reply("Permintaan diterima. Video akan dikirim setelah selesai diproses.");
  try {
    const { buffer, title, quality: resultQuality } =
      await downloadYoutubeVideo(query, quality);
    return m.replyVideo(
      buffer,
      "Judul: " + (title || query) + "\nKualitas: " + (resultQuality || quality) + "p",
    );
  } catch (err) {
    return m.reply("Unduhan gagal: " + (err?.message || "kesalahan tidak diketahui"));
  }
}
