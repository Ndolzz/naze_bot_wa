/*
  Cache cookie sumber media.

  CDN TikTok/Instagram menolak (403) pengambilan berkas dari IP server bila
  request tidak membawa cookie sesi yang diterima saat halaman sumber diambil
  pada tahap resolve. Modul ini menyimpan cookie per URL media agar tahap
  unduh bisa meneruskannya ke CDN.

  Dipindahkan dari repositori naze-sosdown (lib/media-cookies.ts) tanpa
  perubahan logika, hanya tanpa anotasi TypeScript.
*/

const cookieByUrl = new Map();

export function rememberCookies(mediaUrls, cookie) {
  if (!cookie) return;
  for (const url of mediaUrls) {
    cookieByUrl.set(url, cookie);
  }
}

export function getCookieFor(mediaUrl) {
  return cookieByUrl.get(mediaUrl) ?? null;
}

export function extractResponseCookie(response) {
  if (typeof response.headers.getSetCookie === "function") {
    const setCookieList = response.headers.getSetCookie();
    if (setCookieList && setCookieList.length > 0) {
      return setCookieList.map((c) => c.split(";")[0]).join("; ");
    }
  }

  const raw = response.headers.get("set-cookie");
  if (!raw) return null;

  return raw
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}
