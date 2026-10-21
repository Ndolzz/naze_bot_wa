import { getAllPlugins } from "../../src/lib/naze-plugins.js";
import config from "../../config.js";
import { getBannerImage } from "../../src/lib/naze-banner.js";
import {
  buildFullMenuText,
  parseMenuTarget,
  buildInvalidMenuText,
  buildMainMenuView,
  buildCategoryView,
  buildFeatureView,
} from "../../src/lib/naze-menu.js";
import { sendInteractiveView } from "../../src/lib/naze-menu-send.js";

export const config = {
  name: "menu",
  alias: [],
  category: "files",
  description: "Menu utama: daftar seluruh fitur NAZE",
  usage: ".menu [kategori|fitur|all]",
  example: ".menu",
  cooldown: 5,
};

function menuOptions() {
  return { prefix: config?.command?.prefix || "." };
}

// Tahap 2: .menu default interaktif (WhatsApp List Message) dengan fallback
// otomatis ke menu teks; .menu all tetap menghasilkan teks lengkap. Row ID
// list adalah perintah ".menu <target>" sehingga pilihan pengguna diproses
// ulang oleh dispatcher sebagai perintah biasa. Perintah, alias, pemeriksaan
// akses, dan cooldown plugin tidak berubah (ditangani dispatcher).
export async function handler(m, ctx = {}) {
  const plugins = Array.isArray(ctx.plugins) ? ctx.plugins : getAllPlugins();
  const options = menuOptions();
  const target = parseMenuTarget(m.text, plugins, options);

  if (target && target.kind === "all") {
    await m.reply(buildFullMenuText(plugins, options));
    return;
  }
  if (target && target.kind === "invalid") {
    await m.reply(buildInvalidMenuText(target.arg, options));
    return;
  }

  let view = null;
  if (!target) {
    view = buildMainMenuView(plugins, options);
  } else if (target.kind === "category") {
    view = buildCategoryView(plugins, target.category, options);
  } else if (target.kind === "feature") {
    view = buildFeatureView(plugins, target.plugin, options);
  }

  if (!view) {
    await m.reply(buildFullMenuText(plugins, options));
    return;
  }

  const banner = await getBannerImage(view.mode).catch(() => null);
  const result = await sendInteractiveView(ctx.sock, m.chat, view, banner, {
    quoted: m.raw,
  });
  if (!result.sent) {
    console.error("[Menu] Pengiriman interaktif gagal:", result.error);
    await m.reply(view.fallbackText);
  }
}
