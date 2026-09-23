import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { getIsDebug } from "./debug-timing";
import { computeGridGeometry } from "../shared/grid-geometry";

const log = (msg: string) => console.log(`[VISION] ${msg}`);

// v7: grid cell size + downscale target are now supplied by the caller
// (computeGridGeometry) so the draw and the model-facing prompt share one
// source of truth. Previously the script computed its own /25 cells in image
// space while the prompt described /20 cells in physical space — they
// disagreed and a literal model landed at wrong pixels.
// v8: grid lines switched from light gray to brand orange (#E89423, the
// capture-shimmer color) — gray was invisible on white/light backgrounds.
const CAPTURE_SCRIPT_NAME = "hoverbuddy-capture-v8.ps1";
// v4: quality-only compression — never rescale a gridded capture. The prompt
// states the image dims from computeGridGeometry verbatim; any post-draw
// rescale would make that a lie and corrupt every grid-derived coordinate.
const RESIZE_SCRIPT_NAME = "hoverbuddy-resize-v4.ps1";
const MAX_IMAGE_BYTES = 200 * 1024;
const HARD_IMAGE_CAP_BYTES = 1024 * 1024;
const JPEG_QUALITY = 85;

function getCaptureScriptContent(): string {
  const lines: string[] = [];
  lines.push("param([int]$X1, [int]$Y1, [int]$X2, [int]$Y2, [int]$NewW, [int]$NewH, [int]$CellW, [int]$CellH, [string]$OutFile, [switch]$NoGrid)");
  lines.push("Add-Type @\"");
  lines.push("using System;");
  lines.push("using System.Runtime.InteropServices;");
  lines.push("public class DpiHelper {");
  lines.push("    [DllImport(\"user32.dll\")]");
  lines.push("    public static extern bool SetProcessDPIAware();");
  lines.push("}");
  lines.push("\"@");
  lines.push("[DpiHelper]::SetProcessDPIAware() | Out-Null");
  lines.push("Add-Type -AssemblyName System.Drawing");
  lines.push("");
  lines.push("$w = $X2 - $X1");
  lines.push("$h = $Y2 - $Y1");
  lines.push("if ($w -le 0 -or $h -le 0) {");
  lines.push("    Write-Error 'Invalid area'");
  lines.push("    exit 1");
  lines.push("}");
  lines.push("");
  lines.push("try {");
  lines.push("    $fullBmp = New-Object System.Drawing.Bitmap($w, $h)");
  lines.push("    $g = [System.Drawing.Graphics]::FromImage($fullBmp)");
  lines.push("    $g.CopyFromScreen($X1, $Y1, 0, 0, [System.Drawing.Size]::new($w, $h))");
  lines.push("    $g.Dispose()");
  lines.push("");
  lines.push("    # Downscale to caller-supplied target dims ($NewW/$NewH equal $w/$h when no downscale).");
  lines.push("    # The caller (computeGridGeometry) owns this math so the grid it describes matches the grid we draw.");
  lines.push("    if ($NewW -ne $w -or $NewH -ne $h) {");
  lines.push("        $bmp = New-Object System.Drawing.Bitmap($NewW, $NewH)");
  lines.push("        $g2 = [System.Drawing.Graphics]::FromImage($bmp)");
  lines.push("        $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic");
  lines.push("        $g2.DrawImage($fullBmp, 0, 0, $NewW, $NewH)");
  lines.push("        $g2.Dispose()");
  lines.push("        $fullBmp.Dispose()");
  lines.push("    } else {");
  lines.push("        $bmp = $fullBmp");
  lines.push("    }");
  lines.push("");
  lines.push("    # --- Coordinate ruler overlay on final bitmap (cell size from caller) ---");
    lines.push("    if (-not $NoGrid) {");
    lines.push("        $g3 = [System.Drawing.Graphics]::FromImage($bmp)");
    // Brand orange #E89423 (same as the capture shimmer) — visible on both
    // light and dark content. Gray (200,200,200) vanished on white areas.
    lines.push("        $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 232, 148, 35), 1)");
  lines.push("        for ($x = $CellW; $x -lt $NewW; $x += $CellW) { $g3.DrawLine($gridPen, $x, 0, $x, $NewH) }");
  lines.push("        for ($y = $CellH; $y -lt $NewH; $y += $CellH) { $g3.DrawLine($gridPen, 0, $y, $NewW, $y) }");
  lines.push("        $gridPen.Dispose()");
  lines.push("");
  lines.push("        $font = New-Object System.Drawing.Font('Consolas', 10, [System.Drawing.FontStyle]::Bold)");
  lines.push("        $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 0, 0, 0))");
  lines.push("        $fg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 255, 255, 255))");
  lines.push("");
  lines.push("        $col = 0");
  lines.push("        for ($x = 0; $x -lt $NewW; $x += $CellW) {");
  lines.push("            $label = \"$col\"");
  lines.push("            $sz = $g3.MeasureString($label, $font)");
  lines.push("            $cx = $x + ($CellW - $sz.Width) / 2");
  lines.push("            $cy = 2");
  lines.push("            $g3.FillRectangle($bg, $cx - 2, $cy, $sz.Width + 4, $sz.Height + 2)");
  lines.push("            $g3.DrawString($label, $font, $fg, $cx, $cy)");
  lines.push("            $col++");
  lines.push("        }");
  lines.push("");
  lines.push("        $row = 0");
  lines.push("        for ($y = 0; $y -lt $NewH; $y += $CellH) {");
  lines.push("            $label = \"$row\"");
  lines.push("            $sz = $g3.MeasureString($label, $font)");
  lines.push("            $cx = 2");
  lines.push("            $cy = $y + ($CellH - $sz.Height) / 2");
  lines.push("            $g3.FillRectangle($bg, $cx, $cy - 2, $sz.Width + 4, $sz.Height + 4)");
  lines.push("            $g3.DrawString($label, $font, $fg, $cx, $cy)");
  lines.push("            $row++");
  lines.push("        }");
  lines.push("        $font.Dispose(); $bg.Dispose(); $fg.Dispose(); $g3.Dispose()");
  lines.push("    }");
  lines.push("");
  lines.push("    $jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1");
  lines.push("    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)");
  lines.push("    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]" + JPEG_QUALITY + ")");
  lines.push("    $bmp.Save($OutFile, $jpgCodec, $encParams)");
  lines.push("    $bmp.Dispose()");
  lines.push("    Write-Output 'OK'");
  lines.push("} catch {");
  lines.push("    Write-Error $_.Exception.Message");
  lines.push("    exit 1");
  lines.push("}");
  return lines.join("\n");
}

function getResizeScriptContent(): string {
  const lines: string[] = [];
  lines.push("param([string]$InFile, [string]$OutFile, [int]$MaxBytes)");
  lines.push("Add-Type -AssemblyName System.Drawing");
  lines.push("");
  lines.push("try {");
  lines.push("    $img = [System.Drawing.Image]::FromFile($InFile)");
  lines.push("    $quality = 80");
  lines.push("    $tmpFile = $InFile + '.tmp.jpg'");
  lines.push("    $jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1");
  lines.push("");
  lines.push("    for ($i = 0; $i -lt 7; $i++) {");
  lines.push("        $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)");
  lines.push("        $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$quality)");
  lines.push("        $img.Save($tmpFile, $jpgCodec, $encParams)");
  lines.push("        $size = (Get-Item $tmpFile).Length");
  lines.push("        if ($size -le $MaxBytes) {");
  lines.push("            Copy-Item $tmpFile $OutFile -Force");
  lines.push("            Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue");
  lines.push("            $img.Dispose()");
  lines.push("            Write-Output \"OK q=$quality size=$size\"");
  lines.push("            exit 0");
  lines.push("        }");
  lines.push("        $quality = [Math]::Max(15, $quality - 10)");
  lines.push("        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue");
  lines.push("    }");
  lines.push("");
  lines.push("    # Quality floor reached without fitting MaxBytes: save the q15 image at");
  lines.push("    # its ORIGINAL pixel size. NEVER rescale — grid geometry (and the");
  lines.push("    # prompt's stated image dimensions) assume this exact size.");
  lines.push("    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)");
  lines.push("    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]15)");
  lines.push("    $img.Save($OutFile, $jpgCodec, $encParams)");
  lines.push("    $img.Dispose()");
  lines.push("    Write-Output \"BEST q=15 size=$((Get-Item $OutFile).Length)\"");
  lines.push("    exit 0");
  lines.push("} catch {");
  lines.push("    Write-Error $_.Exception.Message");
  lines.push("    exit 1");
  lines.push("}");
  return lines.join("\n");
}

let captureScriptPath: string | null = null;
let resizeScriptPath: string | null = null;

function ensureCaptureScript(): string {
  if (captureScriptPath && fs.existsSync(captureScriptPath)) {
    return captureScriptPath;
  }
  const tmpDir = path.join(os.tmpdir(), "hoverbuddy");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  captureScriptPath = path.join(tmpDir, CAPTURE_SCRIPT_NAME);
  fs.writeFileSync(captureScriptPath, getCaptureScriptContent(), "utf-8");
  return captureScriptPath;
}

function ensureResizeScript(): string {
  if (resizeScriptPath && fs.existsSync(resizeScriptPath)) {
    return resizeScriptPath;
  }
  const tmpDir = path.join(os.tmpdir(), "hoverbuddy");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  resizeScriptPath = path.join(tmpDir, RESIZE_SCRIPT_NAME);
  fs.writeFileSync(resizeScriptPath, getResizeScriptContent(), "utf-8");
  return resizeScriptPath;
}

function captureRegion(x1: number, y1: number, x2: number, y2: number, opts?: { noGrid?: boolean }): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), "hoverbuddy");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outFile = path.join(tmpDir, `capture-${Date.now()}.jpg`);

  // Grid geometry is computed here (the single source of truth) and passed to
  // the draw script. The prompt builders call computeGridGeometry with the
  // same physical dimensions, so the cells we draw and the cells we describe
  // are always derived from one function.
  const geo = computeGridGeometry(x2 - x1, y2 - y1);

  return new Promise((resolve, reject) => {
    const script = ensureCaptureScript();
    const noGridFlag = opts?.noGrid ? " -NoGrid" : "";
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" ${x1} ${y1} ${x2} ${y2} ${geo.imgW} ${geo.imgH} ${geo.cellWImg} ${geo.cellHImg} "${outFile}"${noGridFlag}`;
    log(`Capturing region (${x1},${y1})-(${x2},${y2}) -> image ${geo.imgW}x${geo.imgH}, cells ${geo.cellWImg}x${geo.cellHImg} (phys ${geo.cellWPhys}x${geo.cellHPhys})${opts?.noGrid ? " [no-grid]" : ""}`);

    exec(cmd, { timeout: 10000 }, (err: any, _stdout: string, stderr: string) => {
      if (err) {
        log(`Capture failed: ${err.message}`);
        reject(new Error(stderr || err.message));
        return;
      }
      if (!fs.existsSync(outFile)) {
        reject(new Error("Screenshot file not created"));
        return;
      }
      log(`Screenshot saved: ${outFile} (${fs.statSync(outFile).size} bytes)`);
      resolve(outFile);
    });
  });
}

async function optimizeImage(imagePath: string): Promise<string> {
  const size = fs.statSync(imagePath).size;
  if (size <= MAX_IMAGE_BYTES) {
    log(`Image already under limit: ${(size / 1024).toFixed(0)}kb`);
    return imagePath;
  }

  log(`Image too large (${(size / 1024).toFixed(0)}kb), optimizing to ~200kb...`);
  const tmpDir = path.join(os.tmpdir(), "hoverbuddy");
  const outFile = path.join(tmpDir, `optimized-${Date.now()}.jpg`);
  const script = ensureResizeScript();

  return new Promise((resolve) => {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" "${imagePath}" "${outFile}" ${MAX_IMAGE_BYTES}`;
    exec(cmd, { timeout: 15000 }, (err: any, stdout: string, stderr: string) => {
      if (err) {
        log(`Resize failed: ${err.message}`);
        const fsize = fs.existsSync(imagePath) ? fs.statSync(imagePath).size : 0;
        if (fsize > HARD_IMAGE_CAP_BYTES) {
          log(`Image too large after resize failure (${(fsize / 1024).toFixed(0)}kb), discarding`);
          try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
          resolve("");
        } else {
          resolve(imagePath);
        }
        return;
      }
      if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
        const newSize = fs.statSync(outFile).size;
        log(`Optimized: ${(size / 1024).toFixed(0)}kb -> ${(newSize / 1024).toFixed(0)}kb (${stdout.trim()})`);
        try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
        resolve(outFile);
      } else {
        log(`Resize output missing`);
        const fsize = fs.existsSync(imagePath) ? fs.statSync(imagePath).size : 0;
        if (fsize > HARD_IMAGE_CAP_BYTES) {
          log(`Image too large after resize output missing (${(fsize / 1024).toFixed(0)}kb), discarding`);
          try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
          resolve("");
        } else {
          resolve(imagePath);
        }
      }
    });
  });
}

export async function captureAndOptimize(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts?: { noGrid?: boolean },
): Promise<string | null> {
  log(`captureAndOptimize: (${x1},${y1}) to (${x2},${y2})${opts?.noGrid ? " [no-grid]" : ""}`);
  try {
    let imagePath: string;
    try {
      imagePath = await captureRegion(x1, y1, x2, y2, opts);
    } catch (err: any) {
      log(`Screenshot capture failed: ${err.message}`);
      return null;
    }

    try {
      const result = await optimizeImage(imagePath);
      if (!result) {
        log(`Image too large, discarded`);
        return null;
      }
      persistDebugScreenshot(result, opts);
      return result;
    } catch (err: any) {
      log(`Image optimization failed: ${err.message}`);
      const fsize = fs.statSync(imagePath).size;
      if (fsize > HARD_IMAGE_CAP_BYTES) {
        log(`Image too large after optimization failure (${(fsize / 1024).toFixed(0)}kb), discarding`);
        try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
        return null;
      }
      persistDebugScreenshot(imagePath, opts);
      return imagePath;
    }
  } catch (err: any) {
    log(`captureAndOptimize FAILED: ${err.message}`);
    return null;
  }
}

export function cleanupImage(imagePath: string): void {
  try {
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  } catch { /* ignore */ }
}

function persistDebugScreenshot(imagePath: string, opts?: { noGrid?: boolean }): void {
  if (!getIsDebug()) return;
  try {
    if (!fs.existsSync(imagePath)) return;
    const debugDir = path.join(os.tmpdir(), "hoverbuddy", "debug-screenshots");
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const tag = opts?.noGrid ? "nogrid" : "grid";
    const ext = path.extname(imagePath) || ".jpg";
    const dest = path.join(debugDir, `shot-${ts}-${tag}${ext}`);
    fs.copyFileSync(imagePath, dest);
    log(`DEBUG screenshot persisted: ${dest}`);
  } catch (err: any) {
    log(`DEBUG screenshot persist failed: ${err.message}`);
  }
}