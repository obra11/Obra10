#!/bin/sh
set -e
echo "[railway-start] prisma migrate deploy..."
npx prisma migrate deploy
echo "[railway-start] migrations ok"
echo "[railway-start] starting API..."
exec node dist/src/main
