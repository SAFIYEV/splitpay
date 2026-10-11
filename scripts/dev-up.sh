#!/usr/bin/env bash
# SplitPay — поднять локальное dev-окружение (Git Bash)
# Использование: bash scripts/dev-up.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.docker-data"

echo "== PostgreSQL =="
if "$DATA/tools/pgsql/bin/pg_ctl.exe" -D "$DATA/pgdata" status >/dev/null 2>&1; then
  echo "уже запущен"
else
  rm -f "$DATA/pgdata/postmaster.pid"
  "$DATA/tools/pgsql/bin/pg_ctl.exe" -D "$DATA/pgdata" -l "$DATA/pg.log" -w -t 25 start || true
  sleep 2
  "$DATA/tools/pgsql/bin/pg_ctl.exe" -D "$DATA/pgdata" status >/dev/null 2>&1 \
    && echo "запущен" \
    || { echo "НЕ СТАРТУЕТ — если ноутбук недавно спал, перезагрузи ПК (ошибка 0xC0000142 лечится только так)"; exit 1; }
fi

echo "== Redis =="
if "$DATA/tools/redis/redis-cli.exe" -p 6379 ping 2>/dev/null | grep -q PONG; then
  echo "уже запущен"
else
  (cd "$DATA/tools/redis" && ./redis-server.exe --port 6379 &)
  sleep 2
  echo "запущен"
fi

echo "== Backend (:3000) =="
if curl -s --max-time 2 http://localhost:3000/api/v1/health >/dev/null 2>&1; then
  echo "уже запущен"
else
  (cd "$ROOT/backend" && node dist/main.js &)
  sleep 5
  curl -s http://localhost:3000/api/v1/health && echo
fi

echo "== Frontend (:5173) =="
if curl -s --max-time 2 -o /dev/null http://localhost:5173/; then
  echo "уже запущен"
else
  (cd "$ROOT/frontend" && npx vite --port 5173 &)
  sleep 4
  echo "запущен"
fi

echo ""
echo "Готово: http://localhost:5173 (UI) · http://localhost:3000/api/v1/health (API)"
