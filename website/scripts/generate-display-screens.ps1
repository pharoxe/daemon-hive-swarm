# Pre-scale phone screenshots to exact CSS display sizes (no runtime resampling).
Add-Type -AssemblyName System.Drawing

$sourceDir = Join-Path $PSScriptRoot "..\public\screens"
$outDir = Join-Path $sourceDir "display"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$sizes = @(
    @{ Name = "1x"; Width = 270; Height = 603 },
    @{ Name = "2x"; Width = 540; Height = 1206 }
)

$sources = @(
    "hero-home.jpg",
    "chat-local.jpg",
    "onboarding-model.jpg",
    "hive-datasets.jpg",
    "hive-rewards.jpg"
)

function Resize-Screen {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )

    $source = [System.Drawing.Image]::FromFile($InputPath)
    try {
        $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.DrawImage($source, 0, 0, $Width, $Height)
        }
        finally {
            $graphics.Dispose()
        }
        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bitmap.Dispose()
    }
    finally {
        $source.Dispose()
    }
}

foreach ($file in $sources) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $inputPath = Join-Path $sourceDir $file
    if (-not (Test-Path $inputPath)) {
        Write-Warning "Missing source: $inputPath"
        continue
    }

    foreach ($size in $sizes) {
        $suffix = if ($size.Name -eq "2x") { "@2x" } else { "" }
        $outputPath = Join-Path $outDir "$base$suffix.png"
        Resize-Screen -InputPath $inputPath -OutputPath $outputPath -Width $size.Width -Height $size.Height
        Write-Host "Wrote $outputPath"
    }
}

# Nav / favicon icon at exact CSS sizes (28px and 56px).
$iconOutDir = Join-Path $PSScriptRoot "..\public\visuals\display"
New-Item -ItemType Directory -Force -Path $iconOutDir | Out-Null
$iconSource = Join-Path $PSScriptRoot "..\..\brand\daemon-icon.png"
$iconSizes = @(
    @{ Name = "1x"; Width = 28; Height = 28 },
    @{ Name = "2x"; Width = 56; Height = 56 }
)

if (Test-Path $iconSource) {
    foreach ($size in $iconSizes) {
        $suffix = if ($size.Name -eq "2x") { "@2x" } else { "" }
        $outputPath = Join-Path $iconOutDir "daemon-icon$suffix.png"
        Resize-Screen -InputPath $iconSource -OutputPath $outputPath -Width $size.Width -Height $size.Height
        Write-Host "Wrote $outputPath"
    }
} else {
    Write-Warning "Missing icon source: $iconSource"
}

Write-Host "Done."
