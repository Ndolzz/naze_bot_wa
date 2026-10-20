import "./src/console-guard.js";
import "./src/lib/naze-ffmpeg-path.js";
import path from "path";
import config from "./config.js";
import { startConnection } from "./src/connection.js";
import {
  messageHandler,
  groupHandler,
  messageUpdateHandler,
  groupSettingsHandler,
  handleAntiRemoveFromUpsert,
} from "./src/handler.js";
import { loadPlugins } from "./src/lib/naze-plugins.js";
import { initDatabase, getDatabase } from "./src/lib/naze-database.js";
import { startMemoryMonitor } from "./src/lib/naze-memory-monitor.js";
import { startTempCleaner } from "./src/lib/naze-temp-cleaner.js";
import { startDailyPruner } from "./src/lib/naze-data-pruner.js";
import {
  logger,
  c,
  playBootSequence,
  spinText,
  logConnection,
  logStartup,
  logErrorBox,
  divider,
} from "./src/lib/naze-logger.js";

const LOG_NOISE = new Set([
  "Closing",
  "Opening",
  "prekey",
  "_chains",
  "registrationId",
  "chainKey",
  "ephemeralKeyPair",
  "rootKey",
  "indexInfo",
  "pendingPreKey",
  "currentRatchet",
  "baseKey",
  "privKey",
  "Session already",
  "SessionEntry",
]);

function _isNoise(args) {
  const first = typeof args[0] === "string" ? args[0] : "";
  for (const noise of LOG_NOISE) {
    if (first.includes(noise)) return true;
  }
  return false;
}

const _log = console.log;
const _info = console.info;
const _warn = console.warn;

console.log = (...args) => {
  if (_isNoise(args)) return;
  _log.apply(console, args);
};

console.info = (...args) => {
  if (_isNoise(args)) return;
  _info.apply(console, args);
};

console.warn = (...args) => {
  if (_isNoise(args)) return;
  _warn.apply(console, args);
};

const startTime = Date.now();

function setupAntiCrash() {
  process.on("uncaughtException", (error, origin) => {
    const ignoredErrors = [
      "write EOF",
      "ECONNRESET",
      "EPIPE",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNREFUSED",
      "read ECONNRESET",
    ];
    const isIgnored = ignoredErrors.some(
      (msg) => error.message?.includes(msg) || error.code === msg,
    );
    if (isIgnored) return;

    logErrorBox("uncaught exception", error.message);
    console.error(c.gray(error.stack));
    logger.system("system", "Engine is still running");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logErrorBox("unhandled rejection", String(reason));
    console.error(c.gray("Promise:"), promise);
    logger.system("system", "Engine is still running");
  });

  process.on("warning", (warning) => {
    logger.warn("system", warning.name + ": " + warning.message);
  });

  process.on("SIGINT", async () => {
    console.log("");
    logger.system("system", "Received STOP signal (SIGINT)");
    logger.info("database", "Saving data to local storage...");
    try {
      const db = getDatabase();
      db.save();
      logger.success("database", "All data successfully saved");
    } catch (error) {
      logger.warn("database", "save failed: " + error.message);
    }
    logger.info("system", "Engine stopped safely");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("");
    logger.system("system", "Received TERMINATE signal (SIGTERM)");
    process.exit(0);
  });

  logger.success("system", "Anti-Crash Protection is Active");
}

async function main() {
  await playBootSequence({
    name: config.bot?.name || "Naze",
    version: config.bot?.version || "1.0.0",
    developer: config.bot?.developer || "Developer",
    mode: config.mode || "public",
  });
  setupAntiCrash();

  const dbPath = path.join(
    process.cwd(),
    config.database?.path || "./database/main",
  );
  await initDatabase(dbPath);
  const db = getDatabase();

  const savedMode = db.setting("botMode");
  if (savedMode && (savedMode === "self" || savedMode === "public"))
    config.mode = savedMode;
  const savedPremium = db.setting("premiumUsers");
  if (Array.isArray(savedPremium)) config.premiumUsers = savedPremium;
  const savedBanned = db.setting("bannedUsers");
  if (Array.isArray(savedBanned)) config.bannedUsers = savedBanned;

  const pCount = Array.isArray(savedPremium) ? savedPremium.length : 0;
  const bCount = Array.isArray(savedBanned) ? savedBanned.length : 0;
  logger.success(
    "database",
    "Database initialized | Mode: " +
      config.mode +
      " | Premium: " +
      pCount +
      " | Banned: " +
      bCount,
  );

  const pluginsPath = path.join(process.cwd(), "plugins");
  const pluginCount = await loadPlugins(pluginsPath);
  logger.success("plugin", pluginCount + " modules loaded successfully");

  const bootTime = Date.now() - startTime;
  logger.success("boot", "System initialized in " + bootTime + "ms");
  divider();
  await spinText("network", "Opening WhatsApp connection tunnel...", {
    duration: 900,
    tone: "accent",
  });
  logConnection("connecting", "Establishing session and handshake protocol");
  console.log("");

  await startConnection({
    onMessage: async (msg, sock) => {
      try {
        const handlerPromise = messageHandler(msg, sock);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Handler timeout")), 60000),
        );
        await Promise.race([handlerPromise, timeoutPromise]);
      } catch (error) {
        if (error.message !== "Handler timeout") {
          logger.error("HANDLER", error.message);
          if (config.dev?.debugLog) console.error(c.gray(error.stack));
        }
      }
    },

    onGroupUpdate: async (update, sock) => {
      try {
        await groupHandler(update, sock);
      } catch (error) {
        logger.error("GROUP", error.message);
      }
    },

    onMessageUpdate: async (updates, sock) => {
      try {
        await messageUpdateHandler(updates, sock);
      } catch (error) {
        logger.error("MSG", error.message);
      }
    },

    onGroupSettingsUpdate: async (update, sock) => {
      try {
        await groupSettingsHandler(update, sock);
      } catch (error) {
        logger.error("GROUP", error.message);
      }
    },

    onStubMessage: async (msg, sock) => {
      try {
        const db = getDatabase();
        await handleAntiRemoveFromUpsert(msg, sock, db);
      } catch (error) {
        logger.error("ANTIDELETE", error.message);
      }
    },

    onConnectionUpdate: async (update, sock) => {
      if (update.connection === "open") {
        logConnection("connected", sock.user?.name || "Bot");
        if (!global.__nazeStartupShown) {
          global.__nazeStartupShown = true;
          logStartup({
            name: config.bot?.name,
            plugins: (await import("./src/lib/naze-plugins.js")).getAllPlugins().length,
          });
        }

        startMemoryMonitor();
        startTempCleaner();
        startDailyPruner();
        const devLabel = config.dev?.enabled ? " " + c.yellow("• dev") : "";
        logger.success("ready", "All subsystems are fully operational" + devLabel);
        divider();
      }
    },
  });
}

main().catch((error) => {
  logErrorBox("Fatal Error", error.message);
  console.error(c.gray(error.stack));
  process.exit(1);
});
