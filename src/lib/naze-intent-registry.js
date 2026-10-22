// Registri kemampuan Naze Intent Router.
//
// Setiap deklarasi hanya merujuk plugin yang benar-benar tersedia di sistem
// plugin (divalidasi saat runtime melalui getPlugin()). Skor kemampuan
// dihitung dari bobot pola teks yang cocok, ditambah bonus aksi dan media,
// dikurangi penalti pola negatif. Router tidak menjalankan logika plugin
// sendiri; ia hanya menyusun pesan invokasi lalu menyerahkan eksekusi ke
// dispatcher plugin yang sudah ada.

import { getPlugin } from "./naze-plugins.js";

// Pola verba permintaan (aksi) dan verba pengunduhan.
const ACTION_PATTERN =
  /(jadikan|jadi(in)?|ubah(in)?|ganti|bikin(in)?|buat|proses|tolong|konversi|convert)/i;
const ACTION_WEIGHT = 2;
const DOWNLOAD_VERB_PATTERN = /(download|unduh|ambil|convert|ekstrak|simpan|save)/i;
const DOWNLOAD_VERB_WEIGHT = 2;
const REQUIRES_BONUS = 2;

// Rujukan pada pesan yang dibalas dan akhiran nama koleksi stiker.
const QUOTED_REF_PATTERN =
  /(teks ini|link ini|dari teks|pesan ini|catatan ini|tulisan ini|balas pesan)/i;
const COLLECTION_TAIL_PATTERN =
  /\s+(yang tadi.*|dari\s(koleksi|simpanan|simpenan)|di\s(koleksi|simpanan))\s*$/i;

const DECLARATIONS = [
  {
    id: "sticker",
    plugin: "sticker",
    description: "Membuat stiker dari gambar atau video",
    patterns: [[/(^|\W)(stiker|sticker)(in)?($|\W)/i, 4]],
    useAction: true,
    requires: ["image", "video"],
    passText: "empty",
  },
  {
    id: "toimg",
    plugin: "toimg",
    description: "Mengubah stiker menjadi gambar",
    patterns: [[/(jadi.*?(gambar|png)|ubah.*?(gambar|png)|ke\s(gambar|png))/i, 4]],
    useAction: true,
    requires: ["sticker"],
    passText: "empty",
  },
  {
    id: "tovideo",
    plugin: "tovideo",
    description: "Mengubah stiker animasi menjadi video",
    patterns: [[/(jadi.*?video|ubah.*?video|ke\svideo)/i, 4]],
    useAction: true,
    requires: ["sticker"],
    passText: "empty",
  },
  {
    id: "togif",
    plugin: "togif",
    description: "Mengubah stiker animasi menjadi GIF",
    patterns: [[/gif/i, 4]],
    useAction: true,
    requires: ["sticker"],
    passText: "empty",
  },
  {
    id: "brat",
    plugin: "brat",
    description: "Membuat stiker teks bergaya brat",
    patterns: [[/brat/i, 6]],
    useAction: true,
    passText: "payload",
    requiresArg: true,
    argPatterns: [/brat[:\s-]+(.+)$/i],
    quotedPayload: "raw",
    quotedRefPattern: QUOTED_REF_PATTERN,
    argHint: 'Sebutkan teks untuk stikernya. Contoh: "brat semangat pagi".',
  },
  {
    id: "bratvid",
    plugin: "bratvid",
    description: "Membuat stiker teks brat animasi",
    patterns: [
      [/(brat\s?vid|bratvid)/i, 6],
      [/brat.*animasi|animasi.*brat/i, 6],
      [/brat/i, 2],
    ],
    useAction: true,
    passText: "payload",
    requiresArg: true,
    argPatterns: [
      /brat\s?animasi[:\s-]+(.+)$/i,
      /brat\s?vid[:\s-]+(.+)$/i,
      /bratvid[:\s-]+(.+)$/i,
    ],
    quotedPayload: "raw",
    quotedRefPattern: QUOTED_REF_PATTERN,
    argHint: 'Sebutkan teks untuk stiker animasinya. Contoh: "brat vid semangat pagi".',
  },
  {
    id: "take",
    plugin: "take",
    description: "Mengganti nama pembuat stiker",
    patterns: [
      [/(take|ganti.*?(pembuat|author|pack)|ubah.*?(metadata|nama\spack))/i, 6],
    ],
    useAction: true,
    requires: ["sticker"],
    passText: "empty",
  },
  {
    id: "steal",
    plugin: "steal",
    description: "Mengambil stiker dengan metadata milik sendiri",
    patterns: [
      [/steal/i, 6],
      [/curi/i, 3],
      [/(simpan|panen)\s(stiker|sticker)/i, 3],
    ],
    requires: ["sticker"],
    passText: "empty",
  },
  {
    id: "getsticker",
    plugin: "getsticker",
    description: "Mengambil stiker dari koleksi tersimpan",
    patterns: [
      [/(ambil|keluarkan|tampilkan|buka).*?stiker/i, 5],
      [/(koleksi|simpanan|tersimpan|yang\stadi)/i, 2],
    ],
    useAction: true,
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(?:stiker|sticker)\s+(.+)$/i],
    cleanup: [COLLECTION_TAIL_PATTERN],
    argHint: 'Sebutkan nama stiker yang ingin diambil. Contoh: "ambil stiker kucing".',
  },
  {
    id: "liststicker",
    plugin: "liststicker",
    description: "Melihat daftar stiker tersimpan",
    patterns: [
      [/(daftar|list).*?(stiker|sticker)|stiker.*?(tersimpan|koleksi)/i, 6],
      [/(lihat|tampilkan|buka)/i, 1],
    ],
    neg: [[/(ambil|keluarkan|buka|hapus|delete|buang)/i, -3]],
    passText: "empty",
  },
  {
    id: "delsticker",
    plugin: "delsticker",
    description: "Menghapus stiker dari koleksi",
    patterns: [
      [/(hapus.*?stiker|delete.*?sticker)/i, 6],
      [/dari\s(koleksi|simpanan)/i, 1],
    ],
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(?:stiker|sticker)\s+(.+)$/i],
    cleanup: [COLLECTION_TAIL_PATTERN],
    argHint: 'Sebutkan nama stiker yang ingin dihapus. Contoh: "hapus stiker kucing".',
  },
  {
    id: "topdf",
    plugin: "topdf",
    description: "Menggabungkan berkas menjadi PDF",
    patterns: [
      [/pdf/i, 5],
      [/(gabung(kan)?|jadi\s?satu|satukan|kumpul(kan)?|merge)/i, 2],
    ],
    useAction: true,
    passText: "empty",
  },
  {
    id: "tozip",
    plugin: "tozip",
    description: "Menggabungkan berkas menjadi arsip ZIP",
    patterns: [
      [/zip/i, 5],
      [/arsip(kan)?/i, 3],
      [/(gabung(kan)?|jadi\s?satu|satukan|kumpul(kan)?|merge)/i, 2],
    ],
    useAction: true,
    passText: "empty",
  },
  {
    id: "totxt",
    plugin: "totxt",
    description: "Mengubah teks menjadi file TXT",
    patterns: [
      [/(txt|file\s(teks|txt))/i, 5],
      [/(teks|catatan|tulisan|notes?)/i, 2],
    ],
    useAction: true,
    passText: "payload",
    requiresArg: true,
    quotedPayload: "raw",
    quotedRefPattern: QUOTED_REF_PATTERN,
    argHint:
      "Kirim teksnya dalam pesan yang sama, atau balas pesan yang ingin dijadikan file TXT.",
  },
  {
    id: "toqr",
    plugin: "toqr",
    description: "Membuat kode QR dari teks atau tautan",
    patterns: [
      [/(kode\s)?qr/i, 6],
      [/(link|teks|url|isi)/i, 1],
    ],
    useAction: true,
    passText: "payload",
    requiresArg: true,
    quotedPayload: "raw",
    quotedRefPattern: QUOTED_REF_PATTERN,
    argHint: "Kirim teks atau tautannya, atau balas pesan yang ingin dijadikan kode QR.",
  },
  {
    id: "statusfile",
    plugin: "statusfile",
    description: "Melihat status pengumpulan berkas",
    patterns: [
      [/status/i, 3],
      [/sesi/i, 2],
      [/(file|berkas|pengumpulan)/i, 2],
    ],
    useAction: true,
    passText: "empty",
  },
  {
    id: "batal",
    plugin: "batal",
    description: "Membatalkan sesi pengumpulan berkas",
    patterns: [
      [/(batal(kan)?|stop|udahan|sudahi)/i, 5],
      [/(sesi|pdf|file|berkas)/i, 2],
    ],
    useAction: true,
    passText: "empty",
  },
  {
    id: "kompres",
    plugin: "kompres",
    description: "Mengompres gambar agar di bawah 1 MB",
    patterns: [
      [/(kompres|perkecil|kecilin|kecilkan)/i, 6],
      [/(kecil|hemat|di bawah\s?1\s?mb|kurangi\s(ukuran|size))/i, 2],
      [/(gambar|foto|image|ukuran|size|file|berkas)/i, 1],
    ],
    useAction: true,
    requires: ["image"],
    neg: [[/(video|mp4|audio|suara|voice|pdf|zip)/i, -4]],
    passText: "empty",
  },
  {
    id: "hdimg",
    plugin: "hdimg",
    description: "Meningkatkan resolusi dan ketajaman gambar",
    patterns: [
      [
        /(\bhd\b|resolusi|tajam|jernih(kan)?|upscale|tingkatkan\s(kualitas|resolusi)|perbesar)/i,
        4,
      ],
      [/(gambar|foto|image)/i, 1],
    ],
    useAction: true,
    requires: ["image"],
    neg: [[/(kecil|perkecil|kompres|di bawah)/i, -2]],
    passText: "payload",
    argPatterns: [/([1-4])\s*(x)?$/i],
  },
  {
    id: "reformat",
    plugin: "reformat",
    description: "Mengubah format gambar ke JPG, PNG, atau WebP",
    patterns: [
      [
        /(format|konversi|convert|ubah.*?(jpg|jpeg|png|webp)|ke\s(jpg|jpeg|png|webp)|jadi(n|in)?\s?(jpg|jpeg|png|webp))/i,
        4,
      ],
      [/(jpg|jpeg|png|webp)/i, 2],
    ],
    useAction: true,
    requires: ["image"],
    neg: [[/(youtube|youtu\.be)/i, -3]],
    passText: "payload",
    requiresArg: true,
    argPatterns: [
      /(?:ke|jadi(?:n|in)?|menjadi|format)\s+((?:jpg|jpeg|png|webp)(?:\s+\d{1,3})?)$/i,
      /(?:^|\s)((?:jpg|jpeg|png|webp)(?:\s+\d{1,3})?)\s*$/i,
    ],
    argHint: 'Sebutkan format tujuannya. Contoh: "ubah gambar ini ke png".',
  },
  {
    id: "amvector",
    plugin: "amvector",
    description: "Mengubah gambar menjadi vektor Alight Motion",
    patterns: [
      [/(vektor|vector|alight\smotion|amvector|siluet)/i, 5],
      [/(garis|kontur|isi|xml)/i, 1],
    ],
    useAction: true,
    requires: ["image"],
    passText: "original",
  },
  {
    id: "lagu",
    plugin: "lagu",
    description: "Mencari lagu lalu mengirimkan MP3-nya",
    patterns: [
      [/(lagu|musik|mp3|putar(kan)?)/i, 5],
      [/(cari(kan)?|download|unduh|kirim|putar|kasih)/i, 2],
    ],
    neg: [[/(youtube|youtu\.be)/i, -4]],
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(?:lagu|musik|mp3)\s+(.+)$/i],
    argHint: 'Sebutkan judul lagunya. Contoh: "cari lagu lathi".',
  },
  {
    id: "ytmp3",
    plugin: "ytmp3",
    description: "Mengunduh audio YouTube",
    patterns: [
      [/(youtube|youtu\.be)/i, 3],
      [/(mp3|audio)/i, 3],
    ],
    useDownloadVerb: true,
    bonusIf: [[["url-yt"], 2]],
    neg: [
      [/mp4/i, -5],
      [/video/i, -3],
      [/(cari(kan)?|pencarian|search)/i, -3],
    ],
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(https?:\/\/\S+)/i],
    quotedPayload: "pattern",
    argHint: "Kirim tautan video YouTube-nya, atau balas pesan yang berisi tautannya.",
  },
  {
    id: "ytmp4",
    plugin: "ytmp4",
    description: "Mengunduh video YouTube",
    patterns: [
      [/(youtube|youtu\.be)/i, 3],
      [/(mp4|video)/i, 3],
    ],
    useDownloadVerb: true,
    bonusIf: [[["url-yt"], 2]],
    neg: [
      [/(mp3|audio)/i, -5],
      [/(cari(kan)?|pencarian|search)/i, -3],
    ],
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(https?:\/\/\S+)/i],
    quotedPayload: "pattern",
    argHint: "Kirim tautan video YouTube-nya, atau balas pesan yang berisi tautannya.",
  },
  {
    id: "tiktok",
    plugin: "tiktok",
    description: "Mengunduh video atau foto TikTok",
    patterns: [[/tiktok/i, 7]],
    useDownloadVerb: true,
    bonusIf: [[["url-tt"], 2]],
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(https?:\/\/\S+)/i],
    quotedPayload: "pattern",
    argHint: "Kirim tautan TikTok-nya, atau balas pesan yang berisi tautannya.",
  },
  {
    id: "instagram",
    plugin: "ig",
    description: "Mengunduh video atau foto Instagram",
    patterns: [[/(instagram|reels?|\big\b)/i, 7]],
    useDownloadVerb: true,
    bonusIf: [[["url-ig"], 2]],
    passText: "payload",
    requiresArg: true,
    argPatterns: [/(https?:\/\/\S+)/i],
    quotedPayload: "pattern",
    argHint: "Kirim tautan Instagram-nya, atau balas pesan yang berisi tautannya.",
  },
  {
    id: "ytsearch",
    plugin: "ytsearch",
    description: "Mencari video di YouTube",
    patterns: [
      [/(cari(kan)?|pencarian|search)/i, 3],
      [/(youtube|youtu\.be)/i, 3],
      [/(video|hasil)/i, 1],
    ],
    passText: "payload",
    requiresArg: true,
    argPatterns: [
      /youtube\s+(?:tentang\s+)?(.+)$/i,
      /cari(?:kan)?\s+(?:video\s+)?(.+)$/i,
    ],
    cleanup: [/\s+(?:di\s)?(?:youtube|yt)\s*$/i],
    argHint:
      'Sebutkan kata kunci pencariannya. Contoh: "cari video musik lofi di youtube".',
  },
  {
    id: "menu",
    plugin: "menu",
    description: "Menampilkan daftar fitur bot",
    patterns: [
      [/(menu|daftar\s(fitur|perintah)|semua\sfitur|fitur\sapa)/i, 6],
      [/(lihat|buka|tampilkan|kasih|kirim)/i, 1],
    ],
    passText: "empty",
  },
  {
    id: "filehelp",
    plugin: "filehelp",
    description: "Panduan fitur pengelolaan berkas",
    patterns: [
      [/(cara\s(pakai|make|guna).*?file|panduan.*?file|filehelp)/i, 6],
    ],
    passText: "empty",
  },
  {
    id: "pixelfishing",
    plugin: "pixelfishing",
    description: "Permainan memancing Pixel Fishing",
    patterns: [
      [/(memancing|mancing|fishing|pixelfish)/i, 7],
      [/(main(kan)?|mulai|gas)/i, 1],
    ],
    passText: "empty",
  },
];

// Permintaan yang dikenali tetapi belum didukung bot. Semua pola pada satu
// entri harus cocok agar permintaan dianggap tidak didukung.
const UNSUPPORTED_MATCHERS = [
  {
    id: "compress-video",
    patterns: [/(kompres|perkecil|kecil(in|kan)?)/i, /(video|mp4)/i],
    message:
      'Kompres video belum tersedia di bot ini. Alternatif yang tersedia: ".kompres" untuk mengompres gambar agar di bawah 1 MB.',
  },
  {
    id: "transcribe-audio",
    patterns: [
      /(transkrip|teks dari (pesan )?(suara|voice|audio)|(suara|voice|audio)[^.]*?ke\s?teks|ubah[^.]*?(suara|voice)[^.]*?(teks|tulisan))/i,
    ],
    message:
      "Transkripsi pesan suara menjadi teks belum tersedia di bot ini.",
  },
  {
    id: "removebg-dev",
    patterns: [/(hapus\s(latar|background|bg)|removebg|hapus\sbackground)/i],
    message:
      "Penghapusan latar belakang gambar masih dalam tahap pengembangan dan belum dapat digunakan.",
  },
];

const MEDIA_LABELS = {
  image: "gambar (foto)",
  video: "video",
  audio: "pesan suara",
  sticker: "stiker",
  document: "dokumen (berkas)",
  text: "pesan teks",
};

function scoreDeclaration(declaration, text, mediaKind) {
  let score = 0;
  for (const [pattern, weight] of declaration.patterns) {
    if (pattern.test(text)) score += weight;
  }
  for (const [pattern, weight] of declaration.neg || []) {
    if (pattern.test(text)) score += weight;
  }
  if (declaration.useAction && ACTION_PATTERN.test(text)) {
    score += ACTION_WEIGHT;
  }
  if (declaration.useDownloadVerb && DOWNLOAD_VERB_PATTERN.test(text)) {
    score += DOWNLOAD_VERB_WEIGHT;
  }
  if (declaration.requires && declaration.requires.length) {
    if (declaration.requires.includes(mediaKind)) score += REQUIRES_BONUS;
  }
  for (const [kinds, weight] of declaration.bonusIf || []) {
    if (kinds.includes(mediaKind)) score += weight;
  }
  return score;
}

function getActiveCapabilities() {
  return DECLARATIONS.filter((declaration) => Boolean(getPlugin(declaration.plugin)));
}

function getAllDeclarations() {
  return DECLARATIONS.map((declaration) => declaration);
}

function getUnsupportedMatchers() {
  return UNSUPPORTED_MATCHERS.map((matcher) => ({
    id: matcher.id,
    patterns: [...matcher.patterns],
    message: matcher.message,
  }));
}

function mediaLabel(kind) {
  return MEDIA_LABELS[kind] || String(kind || "media");
}

export {
  ACTION_PATTERN,
  DOWNLOAD_VERB_PATTERN,
  QUOTED_REF_PATTERN,
  COLLECTION_TAIL_PATTERN,
  scoreDeclaration,
  getActiveCapabilities,
  getAllDeclarations,
  getUnsupportedMatchers,
  mediaLabel,
};
