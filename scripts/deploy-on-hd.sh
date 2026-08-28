#!/usr/bin/env bash
# Deploy e runtime ficam neste volume (HD 1Tb). Nao copia para o SSD inteno.
set -euo pipefail

export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"

APP="/Volumes/HD 1Tb/Vibecoding/Editor Video"
FORBIDDEN_SSD_COPY="$HOME/vibecoding/editor-video"

if [[ ! -d "$APP" ]]; then
  echo "ERRO: projeto ausente no HD 1Tb: $APP" >&2
  exit 1
fi

if [[ -e "$FORBIDDEN_SSD_COPY" ]]; then
  echo "ERRO: existe copia no SSD inteno ($FORBIDDEN_SSD_COPY). Nao criar/usar." >&2
  exit 1
fi

vol="$(df "$APP" | awk 'NR==2 {print $NF}')"
df_line="$(df "$APP" | awk 'NR==2 {print}')"
if [[ "$df_line" != *"/Volumes/HD 1Tb"* ]]; then
  echo "ERRO: cwd nao esta no HD 1Tb (df=$df_line)" >&2
  exit 1
fi

export NEXT_TELEMETRY_DISABLED=1
export npm_config_cache="$APP/.npm-cache"
export XDG_CACHE_HOME="$APP/.cache"
export PNPM_STORE_DIR="$APP/.pnpm-store"

cd "$APP"
mkdir -p "$APP/.pnpm-store" "$APP/.npm-cache" "$APP/.cache" "$APP/logs"

echo "==> cwd=$(pwd)"
echo "==> volume=$vol"
echo "==> SSD snapshot before"
du -sh "$HOME/Library/pnpm" "$HOME/.npm" "$HOME/vibecoding" 2>/dev/null || true

if lsof -nP -iTCP:4013 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERRO: porta 4013 ocupada" >&2
  lsof -nP -iTCP:4013 -sTCP:LISTEN || true
  exit 1
fi

echo "==> pnpm install (store no HD)"
pnpm install --store-dir "$APP/.pnpm-store" --no-frozen-lockfile

echo "==> next build"
pnpm build

echo "==> confirmar artefatos no HD"
for p in node_modules .next .pnpm-store; do
  p_df="$(df "$APP/$p" | awk 'NR==2 {print}')"
  echo "    $p -> $p_df"
  if [[ "$p_df" != *"/Volumes/HD 1Tb"* ]]; then
    echo "ERRO: $p nao esta no HD 1Tb" >&2
    exit 1
  fi
done

if [[ -e "$FORBIDDEN_SSD_COPY" ]]; then
  echo "ERRO: algo criou $FORBIDDEN_SSD_COPY no SSD" >&2
  exit 1
fi

echo "==> pm2 start editor-video (cwd no HD, logs no HD)"
pm2 delete editor-video >/dev/null 2>&1 || true
PORT=4013 pm2 start npm --name editor-video --cwd "$APP" \
  --output "$APP/logs/pm2-out.log" \
  --error "$APP/logs/pm2-error.log" \
  -- start

if pm2 describe editor-render >/dev/null 2>&1; then
  echo "==> editor-render ja no PM2 (nao reinicia neste deploy do Next)"
else
  echo "==> pm2 start editor-render (ausente)"
  RENDER_HOST=127.0.0.1 RENDER_PORT=4014 pm2 start npm --name editor-render --cwd "$APP" \
    --output "$APP/logs/pm2-render-out.log" \
    --error "$APP/logs/pm2-render-error.log" \
    --kill-timeout 30000 \
    -- run render:server
fi

pm2 save

echo "==> SSD snapshot after"
du -sh "$HOME/Library/pnpm" "$HOME/.npm" "$HOME/vibecoding" 2>/dev/null || true

echo "==> smoke localhost:4013"
for i in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" -m 5 http://127.0.0.1:4013/ || true)"
  if [[ "$code" == "200" ]]; then
    echo "localhost:4013 -> $code"
    echo "OK deploy no HD"
    exit 0
  fi
  sleep 2
done

echo "ERRO: app nao respondeu 200 em :4013 (ultimo=$code)" >&2
pm2 logs editor-video --lines 40 --nostream || true
exit 1
