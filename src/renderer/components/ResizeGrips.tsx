import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

// Explicit resize grips for the frameless panel. The BrowserWindow has
// `resizable: false` so the native ~6px edge gutter (which intercepted
// scroll/clicks near the edges) is gone. These grips are the ONLY way to
// resize: grab the bottom edge or the bottom-right corner and drag.
//
// The panel is anchored top-left (cursor-first), so resize keeps x/y fixed
// and grows the window down/right. setPointerCapture keeps the move/up
// events flowing to the grip element even if the cursor leaves the window
// mid-drag — no global mouse listener needed.

type Axis = "x" | "y" | "both";

interface Grip {
  axis: Axis;
  className: string;
  // Which cursor hints to show while hovering the grip.
  cursor: string;
}

const GRIPS: Grip[] = [
  { axis: "y", className: "rg-bottom", cursor: "ns-resize" },
  { axis: "both", className: "rg-corner", cursor: "nwse-resize" },
];

function Grip({ grip }: { grip: Grip }) {
  const start = useRef<{ w: number; h: number; x: number; y: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Only the primary button starts a resize, and don't fight text
    // selection / other handlers.
    if (e.button !== 0) return;
    e.preventDefault();
    start.current = {
      w: window.innerWidth,
      h: window.innerHeight,
      x: e.clientX,
      y: e.clientY,
    };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = grip.axis !== "y" ? e.clientX - s.x : 0;
    const dy = grip.axis !== "x" ? e.clientY - s.y : 0;
    window.hoverbuddy.resizePanel(s.w + dx, s.h + dy);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch { /* pointer already released */ }
  };

  return (
    <div
      className={`resize-grip ${grip.className}`}
      style={{ cursor: grip.cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}

export function ResizeGrips() {
  return (
    <div className="resize-grips" aria-hidden="true">
      {GRIPS.map((g) => (
        <Grip key={g.className} grip={g} />
      ))}
    </div>
  );
}
