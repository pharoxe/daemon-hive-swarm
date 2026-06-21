# Close Cursor and any terminals using this repo, then run:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rename-to-daemon-hive-swarm.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$parent = Split-Path $repoRoot -Parent
$src = $repoRoot
$dst = Join-Path $parent "daemon-hive-swarm"

if (-not (Test-Path $src)) {
  if (Test-Path $dst) {
    Write-Host "Already renamed. Open: $dst"
    exit 0
  }
  throw "Source folder not found: $src"
}

if (Test-Path $dst) {
  throw "Destination already exists: $dst"
}

Write-Host "Renaming:"
Write-Host "  $src"
Write-Host "  -> $dst"
Move-Item -LiteralPath $src -Destination $dst
Write-Host "Done. In GitHub Desktop: Remove old entry, Add local repository -> $dst"
