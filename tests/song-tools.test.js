// Pengujian fitur cari lagu NAZE: pembacaan argumen, pemilihan hasil
// pencarian, dan pesan pengguna.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as songUtils from "../src/lib/naze-song-utils.js";

test("parseSongArgs menuntut kata kunci dan menerima kualitas opsional", () => {
  assert.deepEqual(songUtils.parseSongArgs(""), { ok: false, reason: "empty" });
  assert.deepEqual(songUtils.parseSongArgs("   "), { ok: false, reason: "empty" });
  assert.deepEqual(songUtils.parseSongArgs("lathi"), { ok: true, query: "lathi", quality: "128" });
  assert.deepEqual(songUtils.parseSongArgs("lathi 320"), { ok: true, query: "lathi", quality: "320" });
  assert.deepEqual(songUtils.parseSongArgs("320"), { ok: false, reason: "empty" });
  assert.deepEqual(songUtils.parseSongArgs("lathi 100"), { ok: true, query: "lathi 100", quality: "128" });
});

test("pickSongFromResults memilih video pertama berdurasi 1-10 menit", () => {
  const videos = [
    { url: "https://youtu.be/a", title: "cuplikan", duration: { seconds: 30 } },
    { url: "https://youtu.be/b", title: "mix 1 jam", duration: { seconds: 3600 } },
    { url: "https://youtu.be/c", title: "lagu asli", duration: { seconds: 240 } },
  ];
  assert.equal(songUtils.pickSongFromResults(videos).url, "https://youtu.be/c");
});

test("pickSongFromResults memakai kandidat pertama bila tidak ada di jendela durasi", () => {
  const videos = [
    { url: "https://youtu.be/a", title: "mix 1 jam", duration: { seconds: 3600 } },
    { url: "https://youtu.be/b", title: "siaran langsung", duration: { seconds: 0 } },
  ];
  assert.equal(songUtils.pickSongFromResults(videos).url, "https://youtu.be/a");
});

test("pickSongFromResults mengabaikan entri tanpa tautan", () => {
  const videos = [
    { title: "tanpa url", duration: { seconds: 200 } },
    { url: "https://youtu.be/c", title: "kandidat", duration: { seconds: 200 } },
  ];
  assert.equal(songUtils.pickSongFromResults(videos).url, "https://youtu.be/c");
});

test("pickSongFromResults mengembalikan null untuk hasil kosong", () => {
  assert.equal(songUtils.pickSongFromResults([]), null);
  assert.equal(songUtils.pickSongFromResults(null), null);
  assert.equal(songUtils.pickSongFromResults([{ title: "tanpa url" }]), null);
});

test("pesan pengguna berisi petunjuk perintah yang tepat", () => {
  assert.ok(songUtils.songGuideMessage().includes(".lagu"));
  assert.ok(songUtils.songReceivedMessage("lathi").includes("lathi"));
  assert.ok(songUtils.songSearchFailedMessage().length > 0);
  assert.ok(songUtils.songNotFoundMessage("abc").includes("abc"));
  assert.ok(songUtils.songSentMessage("Judul", "128").includes("128 kbps"));
  assert.ok(songUtils.songDownloadFailedMessage("server sibuk").includes("server sibuk"));
});
