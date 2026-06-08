#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT"

if ! docker ps -aq -f name='^/pm-app$' | grep -q .; then
  printf '%s\n' 'pm-app is not running.'
  exit 0
fi

docker rm -f pm-app >/dev/null
printf '%s\n' 'pm-app has been stopped and removed.'
