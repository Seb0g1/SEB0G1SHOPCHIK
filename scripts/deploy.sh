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
echo "Stopping old project containers..."
$COMPOSE down --remove-orphans || true

echo "Removing legacy app containers that can break docker-compose 1.29.x recreation..."
for name in seb0g1shopchik seb0g1shopchik-worker; do
  for id in $(docker ps -a --filter "name=$name" --format "{{.ID}}"); do
    echo "Removing container $id ($name)"
    docker rm -f "$id" >/dev/null 2>&1 || true
  done
done

$COMPOSE build --pull
$COMPOSE up -d --force-recreate --remove-orphans
$COMPOSE logs -f
