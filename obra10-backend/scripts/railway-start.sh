#!/bin/sh
# Start Railway: aplica migrations; se o banco já tem schema sem histórico (P3005), faz baseline.
set -e

echo "[railway-start] prisma migrate deploy..."
if npx prisma migrate deploy; then
  echo "[railway-start] migrations ok"
else
  echo "[railway-start] migrate falhou — tentando baseline (P3005)..."
  for dir in prisma/migrations/*/ ; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    echo "[railway-start] resolve --applied $name"
    npx prisma migrate resolve --applied "$name" || true
  done
  echo "[railway-start] migrate deploy (após baseline)..."
  npx prisma migrate deploy
fi

echo "[railway-start] starting API..."
exec node dist/src/main
