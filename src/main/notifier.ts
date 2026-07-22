import { Notification, BrowserWindow } from "electron";
import { IPC } from "../shared/types";
import { log } from "./logger";

// Windows toast notification for finished AI responses. Fires ONLY when the
// panel is hidden (tray) or minimized to the taskbar — never while visible
// (the caller gates on visibility). Respects the user's Settings toggle
// (notificationsEnabled, read live by the caller) and Windows Focus Assist
// (quiet hours) automatically — the OS suppresses modern toasts during DND.

const APP_ID = "com.mudriknow.app";
const SNIPPET_MAX = 120;

/** Strip action/copy markers + injected skill/system blocks so the toast
 *  body is clean prose. Mirrors the renderer's message-content stripping. */
function buildSnippet(fullText: string): string {
  const cleaned = fullText
    .replace(/<!--ACTION:[\s\S]*?-->/g, "")
    .replace(/<!--COPY_BEGIN-->[\s\S]*?<!--COPY_END-->/g, "")
    .replace(/<!--COPY:[\s\S]*?-->/g, "")
    .replace(/<skill_content[\s\S]*?<\/skill_content>/gi, "")
    .replace(/<skill[\s\S]*?<\/skill>/gi, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/\[skill\][\s\S]*?\[\/skill\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > SNIPPET_MAX ? cleaned.slice(0, SNIPPET_MAX) + "…" : cleaned;
}

interface RestoreFns {
  // Show the panel from tray-hidden state (with last context).
  showPanel: () => void;
  // Send the renderer the signal to scroll to the fresh response.
  scrollToLatest: () => void;
}

/** Show a toast for a finished response. `win` is the panel window. */
export function notifyResponseReady(win: BrowserWindow, fullText: string, restore: RestoreFns): void {
  const body = buildSnippet(fullText) || "AI response is ready";
  const onClick = () => {
    try {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) restore.showPanel();
      win.focus();
      restore.scrollToLatest();
    } catch (e: any) {
      log(`notification click restore failed: ${e.message}`);
    }
  };

  // Modern Windows toast. Needs the AppUserModelID (set at boot in index.ts)
  // + a Start Menu shortcut for reliable display; packaged installs have
  // both via electron-builder. Fall back to the legacy tray balloon only
  // if the platform genuinely doesn't support modern notifications.
  try {
    if (Notification.isSupported()) {
      const n = new Notification({
        title: "MudrikNow",
        body,
        // silent: false — let Windows play the default toast sound.
      });
      n.on("click", onClick);
      n.show();
      log(`Toast shown: "${body.slice(0, 60)}..."`);
      return;
    }
  } catch (e: any) {
    log(`Modern toast failed (${e.message}) — falling back to balloon`);
  }
  // Legacy fallback for builds where Notification isn't available.
  try {
    const { showNotification } = require("./tray") as typeof import("./tray");
    showNotification("MudrikNow", body);
  } catch (e: any) {
    log(`Balloon fallback failed: ${e.message}`);
  }
}

/** Set once at boot so modern toasts carry the right app identity/icon. */
export function setToastAppId(): void {
  try {
    // setAppUserModelId must be called before any Notification is created.
    (require("electron").app as { setAppUserModelId: (id: string) => void }).setAppUserModelId(APP_ID);
  } catch (e: any) {
    log(`setAppUserModelId failed: ${e.message}`);
  }
}

// Re-exported so the caller can reference the IPC name for the scroll signal.
export { IPC as SCROLL_IPC };
