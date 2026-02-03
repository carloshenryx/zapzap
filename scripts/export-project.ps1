param(
  [string]$OutDir = "exports",
  [ValidateSet("safe", "deploy", "full", "everything")]
  [string]$Preset = "safe",
  [switch]$IncludeDist = $false,
  [switch]$IncludeNodeModules = $false,
  [switch]$IncludeEnvLocal = $false,
  [switch]$IncludeVercelLink = $true,
  [switch]$IncludeTrae = $false
)

$ErrorActionPreference = "Stop"

$rootInfo = Resolve-Path (Join-Path $PSScriptRoot "..")
$root = $rootInfo.Path

$effectiveIncludeDist = $IncludeDist
$effectiveIncludeNodeModules = $IncludeNodeModules
$effectiveIncludeEnvLocal = $IncludeEnvLocal
$effectiveIncludeVercelLink = $IncludeVercelLink
$effectiveIncludeTrae = $IncludeTrae

if ($Preset -eq "deploy") {
  $effectiveIncludeDist = $true
}

if ($Preset -eq "full") {
  $effectiveIncludeDist = $true
  $effectiveIncludeNodeModules = $true
}

if ($Preset -eq "everything") {
  $effectiveIncludeDist = $true
  $effectiveIncludeNodeModules = $true
  $effectiveIncludeEnvLocal = $true
  $effectiveIncludeVercelLink = $true
  $effectiveIncludeTrae = $true
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$exportsDir = Join-Path $root $OutDir
$zipPath = Join-Path $exportsDir ("avaliazapsystem-" + $Preset + "-" + $timestamp + ".zip")

New-Item -ItemType Directory -Force -Path $exportsDir | Out-Null
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $files = Get-ChildItem -Path $root -Recurse -File -Force
  foreach ($file in $files) {
    $full = $file.FullName
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { continue }

    $rel = $full.Substring($root.Length).TrimStart("\", "/")
    if ($rel.Length -eq 0) { continue }

    if ($rel -match '^(exports[\\/])') { continue }
    if ($rel -match '^(\.git[\\/])') { continue }
    if (-not $effectiveIncludeTrae -and ($rel -match '^(\.trae[\\/])')) { continue }
    if (-not $effectiveIncludeVercelLink -and ($rel -match '^(\.vercel[\\/])')) { continue }
    if (-not $effectiveIncludeNodeModules -and ($rel -match '^(node_modules[\\/])')) { continue }
    if (-not $effectiveIncludeDist -and ($rel -match '^(dist[\\/])')) { continue }
    if (-not $effectiveIncludeEnvLocal -and ($rel -ieq '.env.local')) { continue }

    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $full,
      $rel,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $zip.Dispose()
}

Write-Host $zipPath
