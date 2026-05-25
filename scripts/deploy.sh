#!/usr/bin/env sh
set -eu

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  echo "Docker Compose is not installed."
  echo "Legacy install: sudo apt update && sudo apt install -y docker-compose"
  echo "Modern install: sudo apt update && sudo apt install -y docker-compose-plugin"
  exit 1
fi

echo "Using: $COMPOSE"
$COMPOSE up -d --build
$COMPOSE logs -f
