#!/bin/bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"
export NEXT_TELEMETRY_DISABLED=1
APP="/Volumes/HD 1Tb/Vibecoding/Editor Video"
cd "$APP"
echo "==> version $(node -p "require('./package.json').version")"
echo "==> stop editor-video"
pm2 delete editor-video >/dev/null 2>&1 || true
echo "==> next build"
./node_modules/.bin/next build
echo "==> pm2 start editor-video"
mkdir -p "$APP/logs"
PORT=4013 pm2 start npm --name editor-video --cwd "$APP" \
  --output "$APP/logs/pm2-out.log" \
  --error "$APP/logs/pm2-error.log" \
  -- start
pm2 save
echo "==> smoke"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4013/ || true)
  echo "try $i -> $code"
  if [ "$code" = "200" ]; then
    echo "OK deploy no HD"
    exit 0
  fi
  sleep 1
done
echo "ERRO: editor nao respondeu 200" >&2
exit 1
