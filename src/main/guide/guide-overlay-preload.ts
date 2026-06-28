// Preload for the guide overlay BrowserWindow. Bridges IPC events from
// the main process into the renderer (which has nodeIntegration:false).

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("guideOverlay", {
  onShow: (handler: (payload: { target: any; fromCursor: any }) => void) => {
    ipcRenderer.on("guide-overlay-show", (_event, payload) => handler(payload));
  },
  onHide: (handler: () => void) => {
    ipcRenderer.on("guide-overlay-hide", () => handler());
  },
  onCaptureShow: (handler: () => void) => {
    ipcRenderer.on("guide-overlay-capture-show", () => handler());
  },
  onCaptureHide: (handler: () => void) => {
    ipcRenderer.on("guide-overlay-capture-hide", () => handler());
  },
  onBubbleShow: (handler: (payload: { caption: string; options: string[]; theme: string }) => void) => {
    ipcRenderer.on("guide-overlay-bubble-show", (_event, payload) => handler(payload));
  },
  onBubbleHide: (handler: () => void) => {
    ipcRenderer.on("guide-overlay-bubble-hide", () => handler());
  },
  onBubbleFade: (handler: (payload: { opacity: number }) => void) => {
    ipcRenderer.on("guide-overlay-bubble-fade", (_event, payload) => handler(payload));
  },
  onSetOwlMode: (handler: (payload: { mode: "pointing" | "thinking" }) => void) => {
    ipcRenderer.on("guide-overlay-owl-mode", (_event, payload) => handler(payload));
  },
  sendChoice: (choice: string) => {
    ipcRenderer.send("guide-overlay-choice", choice);
  },
  // Click-through is owned by a main-process cursor poller (see
  // guide-overlay.ts). The renderer reports the owl + bubble rects (window-
  // relative) and the drag flag so the poller can decide hit-testing without
  // relying on Electron's forwarded mouse-move, which is unreliable when
  // another window sits beneath the overlay at the bubble/owl spot.
  reportInteractive: (rects: {
    owl: { x: number; y: number; w: number; h: number } | null;
    bubble: { x: number; y: number; w: number; h: number } | null;
  }) => {
    ipcRenderer.send("guide-overlay-report-rects", rects);
  },
  reportDragging: (dragging: boolean) => {
    ipcRenderer.send("guide-overlay-report-dragging", dragging);
  },
});
