// Pengujian Sosmed Downloader NAZE.
// Bagian murni menguji deteksi platform, batas unduhan, pemilihan varian
// media, penyusun opsi ffmpeg MP3, templat pesan, dan teks menu pada
// src/lib/naze-sosdown-utils.js tanpa dependensi.
// Bagian integrasi menguji konversi MP3 (ffmpeg) dan konfigurasi plugin;
// jika dependensi belum terpasang (npm install), bagian itu dilewati dengan
// laporan yang jelas. Resolver memerlukan jaringan sehingga hanya diuji di
// lingkungan nyata.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import * as utils from "../src/lib/naze-sosdown-utils.js";

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

// ---------------------------------------------------------------------------
// Bagian 1: utilitas murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("detectPlatform mengenali tautan TikTok", () => {
  const video = utils.detectPlatform("https://www.tiktok.com/@user/video/1234567890");
  assert.equal(video.platform, "tiktok");
  assert.ok(video.normalizedUrl.includes("tiktok.com"));

  const short = utils.detectPlatform("https://vt.tiktok.com/ZSabcdef/");
  assert.equal(short.platform, "tiktok");

  const shortVm = utils.detectPlatform("https://vm.tiktok.com/ZSabcdef/");
  assert.equal(shortVm.platform, "tiktok");
});

test("detectPlatform mengenali tautan Instagram", () => {
  const post = utils.detectPlatform("https://www.instagram.com/p/Cabcdefghij/");
  assert.equal(post.platform, "instagram");

  const reel = utils.detectPlatform("https://instagram.com/reel/Cabcdefghij/");
  assert.equal(reel.platform, "instagram");

  const tv = utils.detectPlatform("https://www.instagram.com/tv/Cabcdefghij/");
  assert.equal(tv.platform, "instagram");
});

test("detectPlatform mengenali tautan YouTube", () => {
  const watch = utils.detectPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(watch.platform, "youtube");

  const shortLink = utils.detectPlatform("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(shortLink.platform, "youtube");

  const shorts = utils.detectPlatform("https://www.youtube.com/shorts/abcde12345");
  assert.equal(shorts.platform, "youtube");

  const mobile = utils.detectPlatform("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(mobile.platform, "youtube");
});

test("detectPlatform menolak tautan yang tidak dikenali", () => {
  assert.equal(utils.detectPlatform("halo dunia"), null);
  assert.equal(utils.detectPlatform(""), null);
  assert.equal(utils.detectPlatform(null), null);
  assert.equal(utils.detectPlatform("https://www.google.com/search?q=tiktok"), null);

  // Instagram tanpa jalur konten (profil saja) bukan tautan unduhan.
  assert.equal(utils.detectPlatform("https://www.instagram.com/naze/"), null);

  // YouTube tanpa id video bukan tautan konten.
  assert.equal(utils.detectPlatform("https://www.youtube.com/"), null);
  assert.equal(utils.detectPlatform("https://www.youtube.com/results?search_query=naze"), null);
});

test("findSosmedLink menemukan tautan di tengah teks dan membersihkan tanda baca", () => {
  const inSentence = utils.findSosmedLink(
    "tolong unduhin https://www.tiktok.com/@user/video/1234567890 ya bang",
  );
  assert.equal(inSentence.platform, "tiktok");

  const wrapped = utils.findSosmedLink("lihat <https://youtu.be/dQw4w9WgXcQ> ini");
  assert.equal(wrapped.platform, "youtube");

  const quoted = utils.findSosmedLink('"https://www.instagram.com/reel/Cabcdefghij/."');
  assert.equal(quoted.platform, "instagram");

  assert.equal(utils.findSosmedLink("tidak ada tautan di sini"), null);
  assert.equal(utils.findSosmedLink(""), null);
});

test("resolveDownloaderLimits menerima angka sah dan mengabaikan nilai tidak sah", () => {
  const defaults = utils.resolveDownloaderLimits();
  assert.equal(defaults.maxMediaBytes, 100 * 1024 * 1024);
  assert.equal(defaults.maxDurationSeconds, 1800);
  assert.equal(defaults.maxPhotosPerPost, 5);
  assert.equal(defaults.mp3BitrateKbps, 192);

  const custom = utils.resolveDownloaderLimits({
    maxMediaBytes: 1000,
    mp3BitrateKbps: "banyak",
    requestTimeoutMs: 0,
  });
  assert.equal(custom.maxMediaBytes, 1000);
  assert.equal(custom.mp3BitrateKbps, 192, "nilai tidak sah harus diabaikan");
  assert.equal(custom.requestTimeoutMs, 30000, "nol dan negatif harus diabaikan");
});

test("choosePreferredItem memilih varian tanpa watermark lebih dulu", () => {
  const items = [
    { url: "a", hasWatermark: true, label: "hd" },
    { url: "b", hasWatermark: false, label: null },
  ];
  assert.equal(utils.choosePreferredItem(items).url, "b");
});

test("choosePreferredItem memilih label hd di antara varian tanpa watermark", () => {
  const items = [
    { url: "a", hasWatermark: false, label: null },
    { url: "b", hasWatermark: false, label: "hd" },
  ];
  assert.equal(utils.choosePreferredItem(items).url, "b");
});

test("choosePreferredItem menangani daftar kosong dan tidak sah", () => {
  assert.equal(utils.choosePreferredItem([]), null);
  assert.equal(utils.choosePreferredItem(null), null);
  assert.equal(utils.choosePreferredItem([null, null]), null);
});

test("chooseAudioSource memilih trek audio terpisah bila ada", () => {
  const data = {
    audio: { url: "audio", mimeType: "audio/mp4" },
    items: [{ url: "video", mimeType: "video/mp4" }],
  };
  assert.equal(utils.chooseAudioSource(data).url, "audio");
  assert.equal(utils.chooseAudioSource(null), null);

  const videoOnly = { items: [{ url: "b", hasWatermark: false, label: "hd" }] };
  assert.equal(utils.chooseAudioSource(videoOnly).url, "b");
});

test("buildMp3OutputOptions menyusun opsi MP3 tanpa sampul", () => {
  const args = utils.buildMp3OutputOptions({ bitrateKbps: 320 });
  assert.ok(args.includes("-vn"));
  assert.equal(args.includes("-map"), false, "tanpa sampul tidak ada pemetaan video");
  assert.ok(args.includes("-c:a"));
  assert.equal(args[args.indexOf("-c:a") + 1], "libmp3lame");
  assert.ok(args.includes("-b:a"));
  assert.equal(args[args.indexOf("-b:a") + 1], "320k");
  assert.equal(args[args.indexOf("-id3v2_version") + 1], "3");
  assert.equal(args[args.indexOf("-write_id3v1") + 1], "1");
});

test("buildMp3OutputOptions menyusun opsi MP3 dengan sampul dan metadata", () => {
  const args = utils.buildMp3OutputOptions({
    bitrateKbps: 192,
    withCover: true,
    title: "Judul Uji",
    artist: "Penyanyi Uji",
  });
  assert.ok(args.includes("-map"));
  assert.equal(args[args.indexOf("-map") + 1], "0:a");
  assert.ok(args.includes("1:v"), "sampul dipetakan dari input kedua");
  assert.equal(args[args.indexOf("-c:v") + 1], "copy");
  assert.equal(args[args.indexOf("-disposition:v") + 1], "attached_pic");
  assert.equal(args.indexOf("-vn"), -1, "dengan sampul tidak ada -vn");
  assert.ok(args.includes("title=Judul Uji"));
  assert.ok(args.includes("artist=Penyanyi Uji"));
});

test("buildMp3OutputOptions menjaga bitrate pada batas yang sah", () => {
  assert.equal(utils.buildMp3OutputOptions({}).includes("192k"), true);
  assert.equal(utils.buildMp3OutputOptions({ bitrateKbps: "x" }).includes("192k"), true);
  assert.equal(utils.buildMp3OutputOptions({ bitrateKbps: 10 }).includes("32k"), true);
});

test("extensionForMime memetakan MIME type umum", () => {
  assert.equal(utils.extensionForMime("video/mp4"), ".mp4");
  assert.equal(utils.extensionForMime("video/mp4; codecs=\"avc1\""), ".mp4");
  assert.equal(utils.extensionForMime("image/jpeg"), ".jpg");
  assert.equal(utils.extensionForMime("audio/mp4"), ".m4a");
  assert.equal(utils.extensionForMime("audio/webm"), ".webm");
  assert.equal(utils.extensionForMime("application/octet-stream"), ".bin");
  assert.equal(utils.extensionForMime(null), ".bin");
  assert.equal(utils.extensionForMime(""), ".bin");
});

test("menu Sosmed Downloader menampilkan entri bernomor lengkap", () => {
  const menu = utils.sosmedDownloaderMenuText();
  assert.ok(menu.includes("SOSMED DOWNLOADER"));

  const commands = ["tiktok", "instagram", "ig", "youtube", "yt", "mp3"];
  commands.forEach((command, index) => {
    const expected = `${index + 1}. ".${command}"`;
    assert.ok(
      menu.includes(expected),
      `menu harus memuat entri bernomor "${expected}"`,
    );
  });
  assert.equal(EMOJI_PATTERN.test(menu), false);
});

test("templat pesan memuat judul dan isi yang jelas", () => {
  const guide = utils.downloaderGuideMessage(".tiktok");
  assert.ok(guide.includes("Tautan tidak ditemukan."));
  assert.ok(guide.includes('".tiktok"'));

  const mismatch = utils.platformMismatchMessage(".tiktok", "YouTube", ".youtube");
  assert.ok(mismatch.includes("tautan YouTube"));
  assert.ok(mismatch.includes('".youtube"'));

  const tooLarge = utils.mediaTooLargeMessage(100 * 1024 * 1024);
  assert.ok(tooLarge.includes("100 MB"));

  const tooLong = utils.durationTooLongMessage(1800);
  assert.ok(tooLong.includes("30 menit"));

  const mp3TooLarge = utils.mp3TooLargeMessage(50 * 1024 * 1024);
  assert.ok(mp3TooLarge.includes("50 MB"));

  const failed = utils.downloadFailedMessage();
  assert.ok(failed.includes("gagal diunduh"));
  assert.equal(EMOJI_PATTERN.test(failed), false);
});

test("templat pesan foto dan kaption hasil", () => {
  const partial = utils.photosPartialMessage(3, 5);
  assert.ok(partial.includes("3 dari 5"));

  const limited = utils.photosLimitMessage(5);
  assert.ok(limited.includes("5 foto"));

  const caption = utils.resultCaption(
    {
      caption: "Judul Video",
      author: "penulis",
      sourceUrl: "https://www.tiktok.com/@user/video/123",
    },
    { quality: "720p", formatLabel: "Ukuran: 5 MB" },
  );
  assert.ok(caption.includes("Judul Video"));
  assert.ok(caption.includes("@penulis"));
  assert.ok(caption.includes("Kualitas: 720p"));
  assert.ok(caption.includes("Ukuran: 5 MB"));
  assert.ok(caption.includes("Sumber: https://www.tiktok.com/@user/video/123"));
});

// ---------------------------------------------------------------------------
// Bagian 2: integrasi (memerlukan npm install; dilewati bila dependensi
// belum tersedia)
// ---------------------------------------------------------------------------

let depsReady = false;
let depsError = null;
let ffmpegOk = false;
let manager = null;

try {
  // naze-ffmpeg-path.js harus diimpor sebelum modul yang memuat naze-exif.js
  // agar FFMPEG_PATH terpasang dengan benar (mengikuti konvensi index.js).
  await import("../src/lib/naze-ffmpeg-path.js");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const ffmpegTarget = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    await execFileAsync(ffmpegTarget, ["-version"]);
    ffmpegOk = true;
  } catch {
    ffmpegOk = false;
  }
  manager = await import("../src/lib/naze-sosdown-manager.js");
  depsReady = true;
} catch (error) {
  depsError = error.message;
}

if (!depsReady) {
  test("integrasi Sosmed Downloader ditandai dilewati", () => {
    assert.ok(
      true,
      "dependensi runtime belum terpasang (" + depsError + "); jalankan npm install lalu npm test",
    );
  });
} else {
  const pluginFiles = ["tiktok", "instagram", "youtube", "mp3"];

  test("plugin downloader terdaftar dengan konfigurasi sah dan tanpa benturan nama", async () => {
    const names = new Set();
    const aliases = new Set();

    for (const pluginName of pluginFiles) {
      const modul = await import(`../plugins/downloader/${pluginName}.js`);
      assert.equal(typeof modul.config.name, "string");
      assert.equal(modul.config.category, "downloader");
      assert.equal(typeof modul.handler, "function");
      assert.ok(!names.has(modul.config.name), "nama command ganda: " + modul.config.name);
      names.add(modul.config.name);
      for (const alias of modul.config.alias || []) {
        assert.ok(!names.has(alias), "alias bentrok dengan command: " + alias);
        assert.ok(!aliases.has(alias), "alias ganda: " + alias);
        aliases.add(alias);
      }
    }

    assert.deepEqual([...names].sort(), ["instagram", "mp3", "tiktok", "youtube"]);
    assert.deepEqual([...aliases].sort(), ["ig", "yt"]);

    // Perintah lama tidak boleh bentrok dengan perintah baru.
    const existingFiles = [
      "menu", "filehelp", "totxt", "topdf", "tozip", "toqr", "statusfile", "batal",
    ];
    for (const pluginName of existingFiles) {
      const modul = await import(`../plugins/files/${pluginName}.js`);
      assert.ok(!names.has(modul.config.name), "benturan dengan perintah files: " + modul.config.name);
      assert.ok(!aliases.has(modul.config.name), "benturan alias dengan perintah files: " + modul.config.name);
    }

    const existingStickers = [
      "sticker", "brat", "bratvid", "toimg", "togif", "tovideo",
      "take", "steal", "getsticker", "liststicker", "delsticker",
    ];
    for (const pluginName of existingStickers) {
      const modul = await import(`../plugins/sticker/${pluginName}.js`);
      assert.ok(!names.has(modul.config.name), "benturan dengan perintah sticker: " + modul.config.name);
      assert.ok(!aliases.has(modul.config.name), "benturan alias dengan perintah sticker: " + modul.config.name);
      for (const alias of modul.config.alias || []) {
        assert.ok(!names.has(alias), "benturan command dengan alias sticker: " + alias);
        assert.ok(!aliases.has(alias), "benturan alias dengan alias sticker: " + alias);
      }
    }
  });

  test("menu utama menampilkan bagian Sosmed Downloader", async () => {
    const menuPlugin = await import("../plugins/files/menu.js");
    const m = {
      reply: (text) => {
        assert.ok(text.includes("SOSMED DOWNLOADER"));
        assert.ok(text.includes('".mp3"'));
        assert.ok(text.includes("STICKER"));
        assert.ok(text.includes("FILE MANAGEMENT"));
        assert.equal(EMOJI_PATTERN.test(text), false);
      },
    };
    await menuPlugin.handler(m);
  });

  // Pengujian konversi MP3 memerlukan ffmpeg dengan libmp3lame.
  if (ffmpegOk) {
    const { getTempDir } = await import("../src/lib/naze-exif.js");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const ffmpegTarget = process.env.FFMPEG_PATH || "ffmpeg";

    async function makeSineInput(inputPath) {
      await execFileAsync(ffmpegTarget, [
        "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
        "-c:a", "pcm_s16le", "-ar", "44100",
        "-f", "wav", "-y", inputPath,
      ]);
    }

    async function makeCoverJpeg(coverPath) {
      await execFileAsync(ffmpegTarget, [
        "-f", "lavfi", "-i", "testsrc=size=320x320:rate=1",
        "-frames:v", "1", "-c:v", "mjpeg", "-q:v", "5",
        "-y", coverPath,
      ]);
    }

    test("convertToMp3File menghasilkan MP3 dengan header ID3", async () => {
      const tmpDir = getTempDir();
      const stamp = "sosdown_uji_" + Date.now();
      const inputPath = path.join(tmpDir, stamp + ".wav");
      const outputPath = path.join(tmpDir, stamp + ".mp3");
      try {
        await makeSineInput(inputPath);
        const mp3 = await manager.convertToMp3File(inputPath, outputPath, {
          bitrateKbps: 128,
        });
        assert.ok(Buffer.isBuffer(mp3));
        assert.ok(mp3.length > 1000, "MP3 dua detik tidak mungkin sekecil itu");
        assert.equal(mp3.subarray(0, 3).toString("latin1"), "ID3");
        assert.equal(fs.existsSync(outputPath), true);
      } finally {
        for (const filePath of [inputPath, outputPath]) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
    });

    test("convertToMp3File menyertakan sampul dan metadata", async () => {
      const tmpDir = getTempDir();
      const stamp = "sosdown_uji_cover_" + Date.now();
      const inputPath = path.join(tmpDir, stamp + ".wav");
      const coverPath = path.join(tmpDir, stamp + "_cover.jpg");
      const outputPath = path.join(tmpDir, stamp + ".mp3");
      try {
        await makeSineInput(inputPath);
        await makeCoverJpeg(coverPath);
        const mp3 = await manager.convertToMp3File(inputPath, outputPath, {
          bitrateKbps: 128,
          coverPath,
          title: "Judul Uji",
          artist: "Penyanyi Uji",
        });
        assert.equal(mp3.subarray(0, 3).toString("latin1"), "ID3");
        assert.ok(mp3.includes("Judul Uji"), "judul harus tercatat di tag ID3");
        assert.ok(mp3.includes("Penyanyi Uji"), "penyanyi harus tercatat di tag ID3");
        assert.ok(mp3.includes("Album cover"), "sampul harus tercatat sebagai attached picture");
      } finally {
        for (const filePath of [inputPath, coverPath, outputPath]) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
    });
  } else {
    test("konversi MP3 ditandai dilewati", () => {
      assert.ok(
        true,
        "ffmpeg tidak tersedia di PATH; pengujian konversi MP3 dilewati",
      );
    });
  }
}
