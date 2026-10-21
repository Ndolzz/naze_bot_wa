import { downloadYoutubeAudio } from "../../src/lib/naze-youtube.js";

export const config = {
  name: "ytmp3",
  alias: [],
  category: "download",
  description: "Mengunduh audio YouTube sebagai MP3 (maks 64 MB)",
  usage: ".ytmp3 <tautan/kata kunci> [92|128|256|320]",
  example: ".ytmp3 https://youtu.be/xxxx 128",
  cooldown: 15,
};

const VALID_QUALITY = ["92", "128", "256", "320"];

export async function handler(m) {
  const input = (m.text || "").trim();
  if (!input) {
    return m.reply(
      "Gunakan format: .ytmp3 <tautan/kata kunci> [92|128|256|320]\nContoh: .ytmp3 https://youtu.be/xxxx 128",
    );
  }

  const parts = input.split(/\s+/);
  const last = parts[parts.length - 1];
  let quality = "128";
  if (VALID_QUALITY.includes(last)) {
    quality = last;
    parts.pop();
  }
  const query = parts.join(" ").trim();
  if (!query) {
    return m.reply(
      "Gunakan format: .ytmp3 <tautan/kata kunci> [92|128|256|320]\nContoh: .ytmp3 https://youtu.be/xxxx 128",
    );
  }

  await m.reply("Permintaan diterima. Audio akan dikirim setelah selesai diproses.");
  try {
    const { buffer, title, quality: resultQuality } =
      await downloadYoutubeAudio(query, quality);
    await m.replyAudio(buffer);
    return m.reply(
      "Audio terkirim. Judul: " +
        (title || query) +
        "\nKualitas: " +
        (resultQuality || quality) +
        " kbps",
    );
  } catch (err) {
    return m.reply("Unduhan gagal: " + (err?.message || "kesalahan tidak diketahui"));
  }
}
