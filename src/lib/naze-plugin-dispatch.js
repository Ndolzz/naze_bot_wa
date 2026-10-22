// Dispatcher plugin terpisah dari handler pesan.
//
// Blok gerbang (mode self, izin, cooldown) dan eksekusi handler dipindahkan
// dari src/handler.js tanpa perubahan perilaku, agar dapat dipakai bersama
// oleh jalur perintah eksplisit dan Naze Intent Router. Router memanggil
// dispatchPlugin dengan pesan invokasi; seluruh gerbang yang sama tetap
// berlaku sehingga tidak ada jalur eksekusi yang melewati pemeriksaan.

import config from "../../config.js";
import { logger } from "./naze-logger.js";
import { getAllPlugins } from "./naze-plugins.js";

const commandCooldowns = new Map();

function getCooldownRemaining(sender, commandName, cooldownSeconds) {
  if (!cooldownSeconds || cooldownSeconds <= 0) return 0;
  const key = sender + ":" + commandName;
  const now = Date.now();
  const last = commandCooldowns.get(key) || 0;
  const remaining = Math.ceil((last + cooldownSeconds * 1000 - now) / 1000);
  if (remaining > 0) return remaining;
  commandCooldowns.set(key, now);
  if (commandCooldowns.size > 2000) {
    for (const [k, time] of commandCooldowns) {
      if (now - time > 300000) commandCooldowns.delete(k);
    }
  }
  return 0;
}

function replySafe(m, text) {
  return m.reply(text).catch(() => null);
}

async function dispatchPlugin(m, sock, plugin) {
  if (config.mode === "self" && !m.isOwner) return false;

  const pluginConfig = plugin.config || {};
  if (pluginConfig.isEnabled === false) return false;
  if (pluginConfig.isOwner && !m.isOwner) {
    await replySafe(m, config.messages?.ownerOnly || "Fitur ini khusus owner.");
    return false;
  }
  if (pluginConfig.isPremium && !m.isPremium) {
    await replySafe(
      m,
      config.messages?.premiumOnly || "Fitur ini khusus pengguna premium.",
    );
    return false;
  }
  if (pluginConfig.isGroup && !m.isGroup) {
    await replySafe(m, config.messages?.groupOnly || "Fitur ini hanya untuk grup.");
    return false;
  }
  if (pluginConfig.isPrivate && !m.isPrivate) {
    await replySafe(
      m,
      config.messages?.privateOnly || "Fitur ini hanya untuk chat pribadi.",
    );
    return false;
  }
  if (pluginConfig.isAdmin && !m.isAdmin) {
    await replySafe(
      m,
      config.messages?.adminOnly || "Fitur ini khusus admin grup.",
    );
    return false;
  }
  if (pluginConfig.isBotAdmin && !m.isBotAdmin) {
    await replySafe(
      m,
      config.messages?.botAdminOnly || "Bot harus menjadi admin grup.",
    );
    return false;
  }

  const primaryName = Array.isArray(pluginConfig.name)
    ? pluginConfig.name[0]
    : pluginConfig.name;
  const remaining = getCooldownRemaining(
    m.sender,
    String(primaryName || m.command),
    Number(pluginConfig.cooldown ?? 3),
  );
  if (remaining > 0) {
    const template =
      config.messages?.cooldown ||
      "Mohon tunggu %time% detik sebelum memakai perintah ini lagi.";
    await replySafe(m, template.replace("%time%", String(remaining)));
    return false;
  }

  try {
    await plugin.handler(m, {
      sock,
      store: sock?.store,
      config,
      plugins: getAllPlugins(),
    });
    return true;
  } catch (error) {
    // Untuk perintah eksplisit label tetap nama perintah yang diketik;
    // untuk invokasi router (m.command kosong) dipakai nama utama plugin.
    logger.error("PLUGIN", String(m.command || primaryName || "") + ": " + error.message);
    await replySafe(
      m,
      config.messages?.error || "Terjadi kesalahan. Silakan coba lagi nanti.",
    );
    return false;
  }
}

export { dispatchPlugin, getCooldownRemaining, replySafe };
