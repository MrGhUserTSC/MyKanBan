#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT"

if docker ps -aq -f name='^/pm-app$' | grep -q .; then
  docker rm -f pm-app >/dev/null
fi

docker build -t pm-app .
docker run --detach --name pm-app --env-file .env -p 8000:8000 pm-app >/dev/null

printf '%s\n' 'pm-app is running at http://localhost:8000'
