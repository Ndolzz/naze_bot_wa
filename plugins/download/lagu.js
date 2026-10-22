import yts from "yt-search";
import { downloadYoutubeAudio } from "../../src/lib/naze-youtube.js";
import {
  parseSongArgs,
  pickSongFromResults,
  songGuideMessage,
  songReceivedMessage,
  songSearchFailedMessage,
  songNotFoundMessage,
  songSentMessage,
  songDownloadFailedMessage,
} from "../../src/lib/naze-song-utils.js";

export const config = {
  name: "lagu",
  alias: ["song"],
  category: "download",
  description: "Mencari lagu lalu mengirim MP3-nya (maks 64 MB)",
  usage: ".lagu <judul lagu> [92|128|256|320]",
  example: ".lagu potong bebek pangkas",
  cooldown: 15,
};

export async function handler(m) {
  const parsed = parseSongArgs(m.text);
  if (!parsed.ok) {
    return m.reply(songGuideMessage());
  }

  await m.reply(songReceivedMessage(parsed.query));

  let result;
  try {
    result = await yts(parsed.query);
  } catch {
    return m.reply(songSearchFailedMessage());
  }

  const song = pickSongFromResults(result?.videos || []);
  if (!song) {
    return m.reply(songNotFoundMessage(parsed.query));
  }

  try {
    const { buffer, title, quality } = await downloadYoutubeAudio(
      song.url,
      parsed.quality,
    );
    await m.replyAudio(buffer);
    return m.reply(
      songSentMessage(title || song.title || parsed.query, quality || parsed.quality),
    );
  } catch (err) {
    return m.reply(songDownloadFailedMessage(err?.message));
  }
}
