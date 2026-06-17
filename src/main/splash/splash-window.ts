import { BrowserWindow } from "electron";
import * as path from "path";
import { log } from "../logger";

let splashWindow: BrowserWindow | null = null;
let closeTimer: NodeJS.Timeout | null = null;

export function showSplashScreen(options?: {
  debug?: boolean;
  pointer?: string;
  area?: string;
  quick?: string;
  lang?: string;
  onReady?: () => void;
}): BrowserWindow {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.show();
    splashWindow.focus();
    return splashWindow;
  }

  const width = 460;
  const height = 320;

  splashWindow = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const query = new URLSearchParams();
  if (options?.pointer) query.set("pointer", options.pointer);
  if (options?.area) query.set("area", options.area);
  if (options?.quick) query.set("quick", options.quick);
  if (options?.lang) query.set("lang", options.lang);
  splashWindow.loadFile(path.join(__dirname, "splash.html"), { query: Object.fromEntries(query) });

  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
    splashWindow?.focus();
    options?.onReady?.();
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  });

  log("Splash window created");
  return splashWindow;
}

export function closeSplashScreen(delayMs = 0): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  if (delayMs <= 0) {
    splashWindow.close();
    return;
  }
  closeTimer = setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  }, delayMs);
}

export function isSplashVisible(): boolean {
  return !!splashWindow && !splashWindow.isDestroyed() && splashWindow.isVisible();
}

export function getSplashWindow(): BrowserWindow | null {
  return splashWindow && !splashWindow.isDestroyed() ? splashWindow : null;
}
