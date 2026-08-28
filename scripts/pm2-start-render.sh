#!/usr/bin/env bash
# Sobe o render Remotion (:4014) no PM2 e grava o dump.
set -euo pipefail

export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"
APP="/Volumes/HD 1Tb/Vibecoding/Editor Video"
mkdir -p "$APP/logs"

echo "==> quem escuta 4014 agora"
lsof -nP -iTCP:4014 -sTCP:LISTEN || true

echo "==> encerrar processo avulso na 4014"
PIDS="$(lsof -nP -iTCP:4014 -sTCP:LISTEN -t || true)"
if [ -n "$PIDS" ]; then
  # shellcheck disable=SC2086
  kill $PIDS || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! lsof -nP -iTCP:4014 -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  PIDS2="$(lsof -nP -iTCP:4014 -sTCP:LISTEN -t || true)"
  if [ -n "$PIDS2" ]; then
    # shellcheck disable=SC2086
    kill -9 $PIDS2 || true
    sleep 1
  fi
fi

pm2 delete editor-render >/dev/null 2>&1 || true

if lsof -nP -iTCP:4014 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERRO: porta 4014 ainda ocupada" >&2
  lsof -nP -iTCP:4014 -sTCP:LISTEN || true
  exit 1
fi

echo "==> pm2 start editor-render"
RENDER_HOST=127.0.0.1 RENDER_PORT=4014 pm2 start npm --name editor-render --cwd "$APP" \
  --output "$APP/logs/pm2-render-out.log" \
  --error "$APP/logs/pm2-render-error.log" \
  --kill-timeout 30000 \
  -- run render:server

echo "==> pm2 save"
pm2 save

echo "==> aguardar /health (bundle no boot)"
ok=""
for _ in $(seq 1 40); do
  body="$(curl -sS -m 5 http://127.0.0.1:4014/health || true)"
  if printf "%s" "$body" | grep -q '"ok":true'; then
    echo "health -> $body"
    ok=1
    break
  fi
  sleep 3
done

if [ -z "$ok" ]; then
  echo "ERRO: /health nao respondeu ok" >&2
  pm2 describe editor-render || true
  pm2 logs editor-render --lines 50 --nostream || true
  exit 1
fi

echo "==> pm2 list"
pm2 list
echo "==> describe editor-render"
pm2 describe editor-render
echo "==> dump"
ls -l "$HOME/.pm2/dump.pm2"
python3 - <<'PY'
import json, os
path = os.path.expanduser("~/.pm2/dump.pm2")
with open(path, encoding="utf-8") as fh:
    data = json.load(fh)
names = [item.get("name") for item in data]
print("processos no dump:", len(names))
print("editor-render no dump:", "editor-render" in names)
print("editor-video no dump:", "editor-video" in names)
PY
echo "==> listen 4014"
lsof -nP -iTCP:4014 -sTCP:LISTEN
echo "OK editor-render no PM2"
