import { autoUpdater } from "electron-updater";
import { app } from "electron";
import type { WebContents } from "electron";
import { createLogger } from "./logger";

const log = createLogger("main/updater");

let webContents: WebContents | null = null;

function send(channel: string, payload?: unknown): void {
  webContents?.send(channel, payload);
}

export function initAutoUpdater(wc: WebContents): void {
  webContents = wc;

  const isMac = process.platform === "darwin";
  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = !isMac;
  autoUpdater.logger = null; // use our own logging

  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available", { version: info.version });
    const releaseUrl = isMac
      ? "https://github.com/blackwaterbread/Konomi/releases/latest"
      : undefined;
    send("app:updateAvailable", { version: info.version, releaseUrl });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No update available");
  });

  autoUpdater.on("download-progress", (progress) => {
    send("app:updateProgress", {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded", { version: info.version });
    send("app:updateDownloaded", { version: info.version });
  });

  autoUpdater.on("error", (err) => {
    log.errorWithStack("Auto-updater error", err);
  });

  // Check 10 seconds after launch (only in packaged builds)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        log.errorWithStack("checkForUpdates failed", err);
      });
    }, 10_000);
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    log.errorWithStack("checkForUpdates failed", err);
  });
}
