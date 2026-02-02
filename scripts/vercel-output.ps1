param(
  [switch]$PullEnv = $true
)

$ErrorActionPreference = "Stop"

Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

if ($PullEnv) {
  npx vercel@latest pull --yes
}

npx vercel@latest build

Write-Host ""
Write-Host "Output gerado em: .vercel\\output"
