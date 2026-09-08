#!/bin/sh
set -e

mkdir -p /data

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" = "0" ]; then
  chown -R "${PUID}:${PGID}" /data
  exec su-exec "${PUID}:${PGID}" "$@"
fi

exec "$@"
