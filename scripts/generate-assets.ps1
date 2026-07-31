# Regenerate MudrikNow owl assets from the hero/icon pack.
# Default pack: D:\SandBoX\Mudrik-Plan\assets\new-hero-icon-pack
#
# Outputs (FIXED names -- code references them, do NOT rename):
#   mascot.png (512)  icon.png (256)  tray.png (32)  tray@2x.png (64)  <- owl-straight.png
#   owl-point-left.png (256)  owl-point-right.png (256)                <- pack (guide pointers)
#   owl-thinking.png (256)                                             <- owl-thinking.png (guide thinking state)
#   hero-mascot.png (512)                                              <- owl-thinking.png (README + website)
#   icon.ico (16/24/32/48/64/128/256)                                  <- owl-straight.png
#
# Usage:
#   ./scripts/generate-assets.ps1
#   ./scripts/generate-assets.ps1 -Pack D:\path\to\pack -Dst .\assets

param(
  [string]$Pack = "D:\SandBoX\Mudrik-Plan\assets\new-hero-icon-pack",
  [string]$Dst  = (Join-Path $PSScriptRoot "..\assets")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $Pack)) { throw "Pack not found: $Pack" }
if (-not (Test-Path -LiteralPath $Dst))  { New-Item -ItemType Directory -Path $Dst | Out-Null }

$mainSrc  = Join-Path $Pack "owl-straight.png"
$thinkSrc = Join-Path $Pack "owl-thinking.png"
$leftSrc  = Join-Path $Pack "owl-point-left.png"
$rightSrc = Join-Path $Pack "owl-point-right.png"
foreach ($p in @($mainSrc, $thinkSrc, $leftSrc, $rightSrc)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "Missing pack file: $p" }
}

function Save-Png([string]$src, [string]$dest, [int]$size) {
  $bmp = [System.Drawing.Image]::FromFile($src)
  try {
    $out = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($bmp, 0, 0, $size, $size)
    $g.Dispose()
    $out.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
  } finally { $bmp.Dispose() }
}

Write-Output "Pack: $Pack"
Write-Output "Out:  $Dst"

# Main owl (owl-straight) -> mascot / icon / tray family
Save-Png $mainSrc (Join-Path $Dst "mascot.png")   512
Save-Png $mainSrc (Join-Path $Dst "icon.png")     256
Save-Png $mainSrc (Join-Path $Dst "tray.png")      32
Save-Png $mainSrc (Join-Path $Dst "tray@2x.png")   64

# Guide pointers (directional) -> 256
Save-Png $leftSrc  (Join-Path $Dst "owl-point-left.png")  256
Save-Png $rightSrc (Join-Path $Dst "owl-point-right.png") 256

# Guide thinking-state owl -> 256 (same scale as the pointers; shown in the
# guide overlay during waiting/recapturing/awaiting-ai phases)
Save-Png $thinkSrc (Join-Path $Dst "owl-thinking.png") 256

# README / website hero mascot (owl-thinking) -> 512
Save-Png $thinkSrc (Join-Path $Dst "hero-mascot.png") 512

# --- Build icon.ico (multi-size) from owl-straight ---
# GOTCHA: [System.IO.BinaryWriter].Write($byteArray) resolves to the wrong
# overload and silently emits a ~125-byte header-only .ico. Must use
# Write($bytes, 0, $bytes.Length).
$sizes = @(16,24,32,48,64,128,256)
$pngBytesList = @()
foreach ($s in $sizes) {
  $tmp = [System.IO.Path]::GetTempFileName() + ".png"
  Save-Png $mainSrc $tmp $s
  $pngBytesList += ,([System.IO.File]::ReadAllBytes($tmp))
  Remove-Item -LiteralPath $tmp -Force
}

$ico = Join-Path $Dst "icon.ico"
$fs  = [System.IO.File]::Create($ico)
$bw  = New-Object System.IO.BinaryWriter $fs
try {
  $bw.Write([UInt16]0)                    # reserved
  $bw.Write([UInt16]1)                    # type = icon
  $bw.Write([UInt16]$sizes.Count)         # image count
  $offset = 6 + ($sizes.Count * 16)
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bytes = $pngBytesList[$i]
    $wh = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
    $bw.Write([Byte]$wh)                  # width (0 = 256)
    $bw.Write([Byte]$wh)                  # height
    $bw.Write([Byte]0)                    # color count
    $bw.Write([Byte]0)                    # reserved
    $bw.Write([UInt16]1)                  # planes
    $bw.Write([UInt16]32)                 # bpp
    $bw.Write([UInt32]$bytes.Length)      # size
    $bw.Write([UInt32]$offset)            # offset
    $offset += $bytes.Length
  }
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bytes = $pngBytesList[$i]
    $bw.Write($bytes, 0, $bytes.Length)
  }
} finally { $bw.Close(); $fs.Close() }

Write-Output "Done. icon.ico must be ~80-120 KB (NOT ~125 bytes -- that signals the Write overload bug)."
Write-Output ""
Get-ChildItem $Dst | Where-Object { $_.Name -match 'mascot|icon|^tray|owl-point|owl-thinking|hero' } | Select-Object Name, Length | Format-Table -AutoSize
