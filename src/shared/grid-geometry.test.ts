import { describe, expect, it } from "vitest";
import { computeGridGeometry, GRID_CELL_IMG } from "./grid-geometry";

/**
 * Regression guard for the screenshot coordinate-grid bug.
 *
 * The grid is drawn in IMAGE space (on the downscaled bitmap) but the prompt
 * describes PHYSICAL pixels. A grid line at column `col` is drawn at image
 * x = col * cellWImg, which represents physical x = col * cellWImg * physW / imgW.
 * The prompt tells the model "x = column * cellWPhys", so cellWPhys MUST equal
 * that draw-derived per-cell physical size, or a literal model that follows
 * the arithmetic lands at the wrong pixel.
 */

// Tolerance: comfortably above int-label rounding (<= ~11px at the far edge
// of a 1920-wide image with 64px cells) and comfortably below the smallest
// systematic error the original /20-vs-/25+downscale bug produced.
const TOL = 15;

function maxCol(geo: ReturnType<typeof computeGridGeometry>): number {
  return Math.floor(geo.imgW / geo.cellWImg);
}
function maxRow(geo: ReturnType<typeof computeGridGeometry>): number {
  return Math.floor(geo.imgH / geo.cellHImg);
}

/** Ground-truth physical X of a drawn vertical grid line (independent of the prompt label). */
function drawLinePhysX(geo: ReturnType<typeof computeGridGeometry>, col: number): number {
  return (col * geo.cellWImg * geo.physW) / geo.imgW;
}
function drawLinePhysY(geo: ReturnType<typeof computeGridGeometry>, row: number): number {
  return (row * geo.cellHImg * geo.physH) / geo.imgH;
}

describe("computeGridGeometry — round-trip", () => {
  const cases = [
    { name: "1920x1080 (native — at the cap)", w: 1920, h: 1080 },
    { name: "2560x1440 (downscaled to 1920)", w: 2560, h: 1440 },
    { name: "1280x800 (native, below cap)", w: 1280, h: 800 },
    { name: "1366x768 (native, non-power-of-2)", w: 1366, h: 768 },
  ];

  for (const c of cases) {
    it(`${c.name}: prompt rule (col*cellWPhys) lands on the drawn grid line`, () => {
      const geo = computeGridGeometry(c.w, c.h);
      const cols = [0, 1, Math.floor(maxCol(geo) / 2), maxCol(geo)];
      const rows = [0, 1, Math.floor(maxRow(geo) / 2), maxRow(geo)];
      for (const col of cols) {
        expect(Math.abs(col * geo.cellWPhys - drawLinePhysX(geo, col))).toBeLessThan(TOL);
      }
      for (const row of rows) {
        expect(Math.abs(row * geo.cellHPhys - drawLinePhysY(geo, row))).toBeLessThan(TOL);
      }
    });
  }

  it("covers the bottom edge of a 1080p screen (the reported unreachable region)", () => {
    const geo = computeGridGeometry(1920, 1080);
    // Bottom ~17% of a 1080 screen: physical y around 900 => row 14 (64px cells).
    const row = 14;
    expect(Math.abs(row * geo.cellHPhys - drawLinePhysY(geo, row))).toBeLessThan(TOL);
    expect(row * geo.cellHPhys).toBeGreaterThan(850); // actually addresses the bottom
  });

  it("grid density scales with resolution: fixed 64px image cells", () => {
    expect(GRID_CELL_IMG).toBe(64);
    const hd = computeGridGeometry(1280, 720);
    const fhd = computeGridGeometry(1920, 1080);
    expect(hd.imgW / hd.cellWImg).toBe(20); // 20 columns on 720p native
    expect(fhd.imgW / fhd.cellWImg).toBe(30); // 30 columns on 1080p native
    // Below the cap every cell is exactly 64 PHYSICAL px — same ruler everywhere.
    expect(fhd.cellWPhys).toBe(64);
    expect(fhd.cellHPhys).toBe(64);
  });

  it("downscaled image respects the 1920 cap on its longest side", () => {
    expect(computeGridGeometry(2560, 1440).imgW).toBe(1920);
    expect(computeGridGeometry(3840, 2160).imgW).toBe(1920);
    expect(computeGridGeometry(1080, 3840).imgH).toBe(1920);
  });

  it("native (below-cap) image keeps its dimensions", () => {
    const geo = computeGridGeometry(1366, 768);
    expect(geo.imgW).toBe(1366);
    expect(geo.imgH).toBe(768);
    expect(geo.scale).toBe(1);
  });
});

describe("computeGridGeometry — regression: the old /20 physical formula fails", () => {
  // The pre-fix prompt computed cell size as max(60, round(physW / 20)) in
  // PHYSICAL space while the grid was drawn in IMAGE space. Re-derive the old
  // label here and prove it does NOT round-trip — i.e. this test would have
  // caught the original bug.
  const oldPhysCell = (physW: number, physH: number) => ({
    cellW: Math.max(60, Math.round(physW / 20)),
    cellH: Math.max(60, Math.round(physH / 20)),
  });

  it("old /20 label diverges from the drawn grid on 1920x1080", () => {
    const geo = computeGridGeometry(1920, 1080);
    const old = oldPhysCell(1920, 1080);
    const col = maxCol(geo);
    const row = maxRow(geo);
    // Far-edge grid line, horizontal then vertical.
    expect(Math.abs(col * old.cellW - drawLinePhysX(geo, col))).toBeGreaterThan(TOL);
    expect(Math.abs(row * old.cellH - drawLinePhysY(geo, row))).toBeGreaterThan(TOL);
  });
});
