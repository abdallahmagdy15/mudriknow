import { describe, expect, it } from "vitest";
import { computeGridGeometry } from "./grid-geometry";

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

// Tolerance: comfortably above int-label rounding (<= ~10.5px at the far edge
// of a 1280-wide image with 60px cells) and comfortably below the smallest
// systematic error the original /20-vs-/25+downscale bug produced (~60px).
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
    { name: "1920x1080 (downscaled, longest > 1280)", w: 1920, h: 1080 },
    { name: "2560x1440 (downscaled)", w: 2560, h: 1440 },
    { name: "1280x800 (not downscaled)", w: 1280, h: 800 },
    { name: "1366x768 (downscaled, non-power-of-2)", w: 1366, h: 768 },
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
    // Bottom ~17% of a 1080 screen: physical y around 900.
    // Image y = 900 * 720 / 1080 = 600 => row 10 (cellHImg=60).
    const row = 10;
    expect(Math.abs(row * geo.cellHPhys - drawLinePhysY(geo, row))).toBeLessThan(TOL);
    expect(row * geo.cellHPhys).toBeGreaterThan(850); // actually addresses the bottom
  });

  it("downscaled image respects the 1280 cap on its longest side", () => {
    expect(computeGridGeometry(1920, 1080).imgW).toBe(1280);
    expect(computeGridGeometry(2560, 1440).imgW).toBe(1280);
    expect(computeGridGeometry(1080, 1920).imgH).toBe(1280);
  });

  it("non-downscaled image keeps native dimensions", () => {
    const geo = computeGridGeometry(1280, 800);
    expect(geo.imgW).toBe(1280);
    expect(geo.imgH).toBe(800);
    expect(geo.scale).toBe(1);
  });
});

describe("computeGridGeometry — regression: the old /20 physical formula fails", () => {
  // The pre-fix prompt computed cell size as max(60, round(physW / 20)) in
  // PHYSICAL space while the grid was drawn at max(60, round(imgW / 25)) in
  // IMAGE space. Re-derive the old label here and prove it does NOT round-trip
  // — i.e. this test would have caught the original bug.
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
