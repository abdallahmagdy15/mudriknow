import { app, globalShortcut } from "electron";
import robot from "robotjs";

const log = (msg: string) => console.log(`[HOTKEY] ${msg}`);

export interface HotkeyCallbacks {
  onPointerActivate: (cursorPos: { x: number; y: number }) => void;
  onAreaActivate: () => void;
  onQuickActivate: (cursorPos: { x: number; y: number }) => void;
}

export interface HotkeyBindings {
  pointer: string;
  area: string;
  quick: string;
}

let lastPointerTime = 0;
let lastAreaTime = 0;
let lastQuickTime = 0;
const DEBOUNCE_MS = 800;

let activeCallbacks: HotkeyCallbacks | null = null;
let activeBindings: HotkeyBindings = { pointer: "Alt+Space", area: "CommandOrControl+Space", quick: "Alt+X" };

export function startHotkeyListener(callbacks: HotkeyCallbacks, initial?: HotkeyBindings): void {
  log("Starting hotkey listener...");
  activeCallbacks = callbacks;
  if (initial) activeBindings = { ...initial };
  app.whenReady().then(() => applyBindings(activeBindings));
}

export function stopHotkeyListener(): void {
  globalShortcut.unregisterAll();
  activeCallbacks = null;
  log("Hotkey listener stopped");
}

/**
 * Re-bind the global hotkeys to new accelerator strings. If registration of
 * any new binding fails (key already in use, invalid accelerator), the
 * previous working bindings are restored and `{ ok: false, failed }` is
 * returned so the caller can surface a notification and roll back config.
 */
export function applyHotkeys(next: HotkeyBindings): { ok: boolean; failed?: Array<"pointer" | "area" | "quick"> } {
  if (!activeCallbacks) {
    log("applyHotkeys called before startHotkeyListener — nothing to do");
    return { ok: false };
  }
  const prev = { ...activeBindings };
  globalShortcut.unregisterAll();
  const failed: Array<"pointer" | "area" | "quick"> = [];
  const pointerOk = registerPointer(next.pointer);
  const areaOk = registerArea(next.area);
  const quickOk = registerQuick(next.quick);
  if (!pointerOk) failed.push("pointer");
  if (!areaOk) failed.push("area");
  if (!quickOk) failed.push("quick");
  if (failed.length > 0) {
    log(`applyHotkeys FAILED for: ${failed.join(", ")} — rolling back to ${prev.pointer} / ${prev.area} / ${prev.quick}`);
    globalShortcut.unregisterAll();
    registerPointer(prev.pointer);
    registerArea(prev.area);
    registerQuick(prev.quick);
    return { ok: false, failed };
  }
  activeBindings = { ...next };
  log(`Hotkeys applied: pointer=${next.pointer} area=${next.area} quick=${next.quick}`);
  return { ok: true };
}

function applyBindings(b: HotkeyBindings): void {
  registerPointer(b.pointer);
  registerArea(b.area);
  registerQuick(b.quick);
}

function registerPointer(accelerator: string): boolean {
  log(`Registering pointer shortcut: ${accelerator}`);
  try {
    const ok = globalShortcut.register(accelerator, () => {
      const now = Date.now();
      if (now - lastPointerTime < DEBOUNCE_MS) return;
      lastPointerTime = now;
      const pos = robot.getMousePos();
      log(`Pointer hotkey at: x=${pos.x}, y=${pos.y}`);
      activeCallbacks?.onPointerActivate({ x: pos.x, y: pos.y });
    });
    if (!ok) log(`ERROR: Failed to register ${accelerator} — may already be in use`);
    return ok;
  } catch (e: any) {
    log(`ERROR: Failed to register ${accelerator}: ${e.message}`);
    return false;
  }
}

function registerArea(accelerator: string): boolean {
  log(`Registering area shortcut: ${accelerator}`);
  try {
    const ok = globalShortcut.register(accelerator, () => {
      const now = Date.now();
      if (now - lastAreaTime < DEBOUNCE_MS) return;
      lastAreaTime = now;
      log(`Area hotkey triggered!`);
      activeCallbacks?.onAreaActivate();
    });
    if (!ok) log(`ERROR: Failed to register ${accelerator} — may already be in use`);
    return ok;
  } catch (e: any) {
    log(`ERROR: Failed to register ${accelerator}: ${e.message}`);
    return false;
  }
}

function registerQuick(accelerator: string): boolean {
  log(`Registering quick shortcut: ${accelerator}`);
  try {
    const ok = globalShortcut.register(accelerator, () => {
      const now = Date.now();
      if (now - lastQuickTime < DEBOUNCE_MS) return;
      lastQuickTime = now;
      const pos = robot.getMousePos();
      log(`Quick hotkey at: x=${pos.x}, y=${pos.y}`);
      activeCallbacks?.onQuickActivate({ x: pos.x, y: pos.y });
    });
    if (!ok) log(`ERROR: Failed to register ${accelerator} — may already be in use`);
    return ok;
  } catch (e: any) {
    log(`ERROR: Failed to register ${accelerator}: ${e.message}`);
    return false;
  }
}
