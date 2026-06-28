// src/main/guide/guide-overlay.ts
//
// Always-on-top transparent BrowserWindow that renders the owl-wing
// pointer animating to a target + a translucent rounded circle around
// the target. Created lazily on first showOverlay() call; reused for
// subsequent steps; destroyed when the guide ends or the app quits.

import { BrowserWindow, screen, app, ipcMain } from "electron";
import * as path from "node:path";
import { log } from "../logger";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

let overlayWin: BrowserWindow | null = null;
let preloadPath: string | null = null;

function getPreloadPath(): string {
  // Webpack copies guide-overlay-preload.js next to main.js in dist/.
  // Resolve relative to __dirname (which is dist/ at runtime).
  if (preloadPath) return preloadPath;
  preloadPath = path.join(__dirname, "guide-overlay-preload.js");
  return preloadPath;
}

// --- Click-through poller (owns setIgnoreMouseEvents) ---
// The overlay is click-through by default so the user can interact with their
// app during a guide. The bubble (option buttons) and the owl (drag handle)
// must be hittable, but we do NOT rely on Electron's forwarded mouse-move to
// detect hover — that forwarding is unreliable when another window sits
// beneath the overlay at the bubble/owl spot, which left the bubble visually
// on top yet clicks fell through to the window beneath. Instead the renderer
// reports the owl + bubble rects (window-relative DIP) and the drag flag; the
// main process polls the cursor and toggles click-through authoritatively.
interface InteractiveRect { x: number; y: number; w: number; h: number; }
let interactiveOwl: InteractiveRect | null = null;
let interactiveBubble: InteractiveRect | null = null;
let userDragging = false;
let pollTimer: NodeJS.Timeout | null = null;
let currentlyHittable = false;

function rectContains(r: InteractiveRect | null, px: number, py: number): boolean {
  if (!r || r.w <= 0 || r.h <= 0) return false;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function evalClickThrough(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  // screen.getCursorScreenPoint() and getBounds() are both in DIP relative to
  // the virtual screen, so rx/ry are window-relative DIP — the same frame the
  // renderer reports rects in (getBoundingClientRect on a zoom-1 transparent
  // window == DIP relative to the window origin).
  const cursor = screen.getCursorScreenPoint();
  const b = overlayWin.getBounds();
  const rx = cursor.x - b.x;
  const ry = cursor.y - b.y;
  const wantHittable =
    userDragging || rectContains(interactiveOwl, rx, ry) || rectContains(interactiveBubble, rx, ry);
  if (wantHittable !== currentlyHittable) {
    currentlyHittable = wantHittable;
    overlayWin.setIgnoreMouseEvents(!wantHittable, { forward: true });
  }
}

function startClickThroughPoller(): void {
  if (pollTimer) return;
  pollTimer = setInterval(evalClickThrough, 30);
}

function stopClickThroughPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  // Reset to click-through so a hidden/idle overlay never traps clicks.
  currentlyHittable = false;
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
  }
}

async function createOverlayWindow(): Promise<BrowserWindow> {
  // Cover the entire virtual desktop so the overlay works on any monitor
  // in a multi-display setup. Uses the union of all display bounds.
  const displays = screen.getAllDisplays();
  const minX = Math.min(...displays.map((d) => d.bounds.x));
  const minY = Math.min(...displays.map((d) => d.bounds.y));
  const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
  const w = new BrowserWindow({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
    },
  });
  await w.loadFile(path.join(__dirname, "guide-overlay.html"));
  // Click-through: ignore mouse events. forward:true keeps hover events
  // for any future hover-driven affordances; the user clicks pass to the
  // app underneath.
  w.setIgnoreMouseEvents(true, { forward: true });
  // CRITICAL: use screen-saver level on Windows so the overlay stays above
  // Chrome context menus, app popups, and other always-on-top windows.
  // The standard alwaysOnTop:true isn't enough for system-level popups.
  if (process.platform === "win32") {
    w.setAlwaysOnTop(true, "screen-saver");
  }
  log(`guide-overlay window created covering virtual desktop ${minX},${minY} ${maxX - minX}x${maxY - minY} (${displays.length} display${displays.length > 1 ? "s" : ""})`);
  return w;
}

/** Find the display that contains a physical-screen point. Falls back to
 *  getDisplayNearestPoint with an approximate logical conversion. */
function getDisplayForPhysicalPoint(px: number, py: number): Electron.Display {
  const displays = screen.getAllDisplays();
  for (const d of displays) {
    const left = Math.round(d.bounds.x * d.scaleFactor);
    const top = Math.round(d.bounds.y * d.scaleFactor);
    const right = Math.round((d.bounds.x + d.bounds.width) * d.scaleFactor);
    const bottom = Math.round((d.bounds.y + d.bounds.height) * d.scaleFactor);
    if (px >= left && px < right && py >= top && py < bottom) {
      return d;
    }
  }
  // Fallback: convert to approximate logical using primary scale factor
  const primarySf = screen.getPrimaryDisplay().scaleFactor || 1;
  return screen.getDisplayNearestPoint({ x: Math.round(px / primarySf), y: Math.round(py / primarySf) });
}

export async function showOverlay(target: Bounds, fromCursor: { x: number; y: number }): Promise<void> {
  if (!overlayWin || overlayWin.isDestroyed()) {
    overlayWin = await createOverlayWindow();
  }
  const winBounds = overlayWin.getBounds();

  // Convert physical screen coords → logical, then window-relative.
  // Callers (UIA / robotjs) give physical pixels; the overlay window
  // is sized in logical (DIP) pixels and positioned at the virtual-desktop
  // origin (may be negative on multi-monitor setups).
  const targetDisplay = getDisplayForPhysicalPoint(target.x, target.y);
  const targetSf = targetDisplay?.scaleFactor || screen.getPrimaryDisplay().scaleFactor || 1;
  const relTarget = {
    x: Math.round(target.x / targetSf) - winBounds.x,
    y: Math.round(target.y / targetSf) - winBounds.y,
    width: Math.round(target.width / targetSf),
    height: Math.round(target.height / targetSf),
  };
  log(`showOverlay: target physical=(${target.x},${target.y}) display="${targetDisplay.label}" sf=${targetSf} logical=(${Math.round(target.x / targetSf)},${Math.round(target.y / targetSf)}) rel=(${relTarget.x},${relTarget.y}) winBounds=(${winBounds.x},${winBounds.y})`);

  const cursorDisplay = getDisplayForPhysicalPoint(fromCursor.x, fromCursor.y);
  const cursorSf = cursorDisplay?.scaleFactor || screen.getPrimaryDisplay().scaleFactor || 1;
  const relCursor = {
    x: Math.round(fromCursor.x / cursorSf) - winBounds.x,
    y: Math.round(fromCursor.y / cursorSf) - winBounds.y,
  };

  overlayWin.webContents.send("guide-overlay-show", { target: relTarget, fromCursor: relCursor });
  overlayWin.showInactive();
  overlayWin.moveTop();
  // Click-through is owned by the poller. Start click-through; the poller
  // makes the overlay hittable only while the cursor is over the owl/bubble
  // (or during a drag).
  currentlyHittable = false;
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  startClickThroughPoller();
}

export function hideOverlay(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.webContents.send("guide-overlay-hide");
  stopClickThroughPoller();
  interactiveOwl = null;
  interactiveBubble = null;
  userDragging = false;
  // Give the fade-out animation 300ms to play before hiding the window
  setTimeout(() => {
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.hide();
  }, 320);
}

export function showBubble(caption: string, options: string[], theme: string = "light"): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.webContents.send("guide-overlay-bubble-show", { caption, options, theme });
}

export function hideBubble(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.webContents.send("guide-overlay-bubble-hide");
}

export function fadeBubble(opacity: number): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.webContents.send("guide-overlay-bubble-fade", { opacity });
}

export function setOwlMode(mode: "pointing" | "thinking"): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.webContents.send("guide-overlay-owl-mode", { mode });
}

export function showCaptureScreen(): void {
  (async () => {
    if (!overlayWin || overlayWin.isDestroyed()) {
      overlayWin = await createOverlayWindow();
    }
    overlayWin.webContents.send("guide-overlay-capture-show");
    overlayWin.showInactive();
    overlayWin.moveTop();
  })();
}

export function hideCaptureScreen(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.webContents.send("guide-overlay-capture-hide");
  overlayWin.hide();
}

export function destroyOverlay(): void {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  stopClickThroughPoller();
  overlayWin.destroy();
  overlayWin = null;
}

// Renderer reports current owl + bubble geometry (window-relative DIP) and
// drag state so the click-through poller can toggle hit-testing reliably.
ipcMain.on("guide-overlay-report-rects", (_event, rects: { owl: InteractiveRect | null; bubble: InteractiveRect | null }) => {
  interactiveOwl = rects.owl;
  interactiveBubble = rects.bubble;
});

ipcMain.on("guide-overlay-report-dragging", (_event, dragging: boolean) => {
  userDragging = dragging;
});

// Ensure overlay window is destroyed on app quit so it doesn't linger
app.on("before-quit", destroyOverlay);
