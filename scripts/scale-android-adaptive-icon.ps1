# Scales the launcher foreground to 75% of a square canvas (1024) so Android adaptive icons show more padding.
# Uses daemon-icon.png as source (full-bleed square). Writes daemon-adaptive-icon.png with transparency around the scaled art.
param(
  [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string] $SourceRelative = "brand\daemon-icon.png",
  # Default keeps legacy path; use assets\android-adaptive-foreground.png if brand\ is not writable (e.g. OneDrive locks).
  [string] $OutputRelative = "assets\android-adaptive-foreground.png",
  [int] $CanvasSize = 1024,
  [double] $ContentScale = 0.75
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $ProjectRoot $SourceRelative
$outPath = Join-Path $ProjectRoot $OutputRelative

if (-not (Test-Path $srcPath)) {
  throw "Source icon not found: $srcPath"
}

$inner = [int][Math]::Round($CanvasSize * $ContentScale)
$src = [System.Drawing.Image]::FromFile($srcPath)
$bmp = $null

try {
  $ratio = [Math]::Min($inner / $src.Width, $inner / $src.Height)
  $newW = [int][Math]::Round($src.Width * $ratio)
  $newH = [int][Math]::Round($src.Height * $ratio)
  $ox = [int](($CanvasSize - $newW) / 2)
  $oy = [int](($CanvasSize - $newH) / 2)

  $bmp = New-Object System.Drawing.Bitmap($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($src, $ox, $oy, $newW, $newH)
  }
  finally {
    $g.Dispose()
  }

  $bak = "$outPath.bak.png"
  if (Test-Path $outPath) {
    try {
      Copy-Item -Force $outPath $bak -ErrorAction Stop
      Write-Host "Backed up previous adaptive icon to $bak"
    }
    catch {
      Write-Host "Skip backup (could not write ${bak}): $($_.Exception.Message)"
    }
  }

  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("daemon-adaptive-" + [Guid]::NewGuid().ToString("n") + ".png")
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  Copy-Item -Force $tmp $outPath
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
  Write-Host "Wrote $outPath (${CanvasSize}px canvas, artwork max ${inner}px, scale vs source ~$([math]::Round($ratio * 100))%)"
}
finally {
  $src.Dispose()
  if ($null -ne $bmp) {
    $bmp.Dispose()
  }
}
