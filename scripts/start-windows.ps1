$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$existingContainer = docker ps -aq -f "name=^pm-app$"
if ($existingContainer) {
  docker rm -f pm-app | Out-Null
}

docker build -t pm-app .
docker run --detach --name pm-app --env-file .env -p 8000:8000 pm-app | Out-Null

Write-Output "pm-app is running at http://localhost:8000"
