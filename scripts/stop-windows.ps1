$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$existingContainer = docker ps -aq -f "name=^pm-app$"
if (-not $existingContainer) {
  Write-Output "pm-app is not running."
  exit 0
}

docker rm -f pm-app | Out-Null
Write-Output "pm-app has been stopped and removed."
