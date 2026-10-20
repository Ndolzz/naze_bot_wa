// Filter console yang dipasang SEBELUM dependensi eksternal dimuat.
// Pustaka "naze" (npm:wileys) mencetak banner promosi hosting (yupra.me)
// pada saat diimpor; filter ini meniadakan banner tersebut dan mencetak
// sambutan milik bot sebagai gantinya. Harus menjadi import PERTAMA di index.js.

const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PRZcf-ntqry=><~]))/g;

const PROMO_PATTERNS = [
  /wileys/i,
  /yupra\.me/i,
  /dapatkan hosting panel/i,
];

function stripAnsi(value) {
  return String(value).replace(ANSI_PATTERN, "");
}

function isPromo(args) {
  const text = stripAnsi(
    args.map((a) => (typeof a === "string" ? a : "")).join(" "),
  );
  return PROMO_PATTERNS.some((pattern) => pattern.test(text));
}

const rawLog = console.log;
let welcomeShown = false;

console.log = (...args) => {
  if (isPromo(args)) {
    if (!welcomeShown) {
      welcomeShown = true;
      rawLog.call(console, "wellcome to naze bot");
    }
    return;
  }
  rawLog.apply(console, args);
};

export {};
