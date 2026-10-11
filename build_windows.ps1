$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $project

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Windows Python launcher 'py' tidak ditemukan. Install Python resmi hanya di mesin build, bukan di komputer client."
}

if (-not $env:PRESSLY_IMAGEMAGICK_DIR) {
    throw "Set PRESSLY_IMAGEMAGICK_DIR ke folder portable ImageMagick Windows sebelum build."
}

py -3 -m pip install -r requirements.txt
py -3 -m pip install --upgrade pyinstaller
py -3 -m PyInstaller --clean --noconfirm Pressly.spec
$artifactDir = Join-Path $project "artifacts\windows"
New-Item -ItemType Directory -Force $artifactDir | Out-Null
if (Test-Path (Join-Path $project "dist")) { Move-Item -Force (Join-Path $project "dist") $artifactDir }
if (Test-Path (Join-Path $project "build")) { Move-Item -Force (Join-Path $project "build") $artifactDir }
Write-Host "Build selesai: $artifactDir\dist\Fazima Print.exe"
