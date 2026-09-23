/**
 * Single source of truth for the screenshot coordinate-grid geometry.
 *
 * The grid is DRAWN on the (possibly downscaled) bitmap in IMAGE space, but
 * DESCRIBED to the model in PHYSICAL screen pixels (because guessBounds
 * flows straight through to physical-pixel click resolution). This function
 * computes both views from one set of inputs so the draw and the prompt can
 * never diverge (the original bug was a /25 image-space draw vs a /20
 * physical-space prompt).
 *
 * Grid density is resolution-adaptive by design: cells are a FIXED size in
 * image pixels, so the cell COUNT grows with the image (20 cols on a 720p
 * native screen, 30 on 1080p, more at higher caps) while label legibility
 * stays constant. Screens up to GRID_MAX_DIM on their longest side run
 * native — one cell is then exactly GRID_CELL_IMG physical pixels, the same
 * ruler on every screen below the cap.
 *
 * Round-trip invariant (verified in grid-geometry.test.ts):
 *   grid line `col` is drawn at image x = col * cellWImg
 *   its true physical x              = col * cellWImg * physW / imgW
 *   the prompt's rule gives          = col * cellWPhys
 *   => cellWPhys must equal cellWImg * physW / imgW
 */
export const GRID_MAX_DIM = 1920;
/** Fixed grid cell size in image pixels — the draw script and the prompt
 *  builders share this one definition, so density scales with resolution
 *  without a per-resolution tier table. */
export const GRID_CELL_IMG = 64;

export interface GridGeometry {
  physW: number;
  physH: number;
  imgW: number;
  imgH: number;
  scale: number;
  cellWImg: number;
  cellHImg: number;
  cellWPhys: number;
  cellHPhys: number;
}

/**
 * Compute grid geometry for a capture region of physW x physH physical pixels.
 * Mirrors the PowerShell downscale exactly: scale = maxDim/maxSide when the
 * longest side exceeds maxDim, then truncate toward zero (PowerShell `[int]`).
 */
export function computeGridGeometry(
  physW: number,
  physH: number,
  maxDim: number = GRID_MAX_DIM,
): GridGeometry {
  const maxSide = Math.max(physW, physH);
  const scale = maxSide > maxDim ? maxDim / maxSide : 1;
  const imgW = Math.trunc(physW * scale);
  const imgH = Math.trunc(physH * scale);
  const cellWImg = GRID_CELL_IMG;
  const cellHImg = GRID_CELL_IMG;
  // Physical cell size: maps a drawn grid line back to the physical pixel it
  // represents. Rounded to an int because this is the number printed in the
  // prompt; the round-trip test tolerates the resulting sub-pixel rounding.
  const cellWPhys = imgW > 0 ? Math.round((cellWImg * physW) / imgW) : cellWImg;
  const cellHPhys = imgH > 0 ? Math.round((cellHImg * physH) / imgH) : cellHImg;
  return { physW, physH, imgW, imgH, scale, cellWImg, cellHImg, cellWPhys, cellHPhys };
}
