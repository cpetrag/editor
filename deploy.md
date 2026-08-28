# Deploy — Editor de Inserts

Documento canônico de build e publicação. Visão do produto: `README.md`.

**Modelo:** edição e runtime no **mesmo volume** (`HD 1Tb`). Não há cópia no SSD interno, nem CI/CD, Vercel ou Actions. `git push` (se existir) **não** sobe produção.

## 1. Mapa

| Camada | Onde | Papel |
|---|---|---|
| Edição | `N:\Vibecoding\Editor Video` (= `/Volumes/HD 1Tb/Vibecoding/Editor Video`) | Cursor no Windows edita aqui |
| Runtime PM2 | **o mesmo path no Mac** | `next start -p 4013` — cwd no HD, processo `editor-video` |
| Render Final | **o mesmo path**, PM2 `editor-render` | `npm run render:server` — `127.0.0.1:4014` |
| Público | https://editor.macmini-capture.cc | Cloudflare Tunnel → `:4013` |
| Logs | `logs/pm2-out.log`, `pm2-error.log`, `pm2-render-out.log`, `pm2-render-error.log` no HD | PM2 `--output` / `--error` |
| Store pnpm | `.pnpm-store/` no HD | `pnpm install --store-dir` local |

**Não criar** `~/vibecoding/editor-video` no SSD interno do Mini. O script recusa se essa pasta existir.

| Item | Valor |
|---|---|
| Host SSH | `mac` (`192.168.0.38`, user `cpetrag`) |
| Processos PM2 | `editor-video` (4013) e `editor-render` (4014) |
| Porta do editor | **4013** |
| Porta do render Final | **4014** (`127.0.0.1` — não entra no túnel) |
| Node | `v24.13.0` via nvm (`$HOME/.nvm/versions/node/v24.13.0/bin`) |
| Pacotes | pnpm 11 (`/opt/homebrew/bin/pnpm`) |
| Tunnel | `mac-capture` (`f5521be0-55c4-4d8c-a048-37f68cd1aa89`) |
| Ingress | `editor.macmini-capture.cc` → `http://localhost:4013` |

**Regra de ouro:** depois de mudar código do editor → **`pnpm build` + `pm2 restart editor-video`**. Sem rebuild o navegador recebe o bundle antigo (`next start` é build congelado). Hard refresh (`Ctrl+Shift+R`) ou janela anônima.

Mudou `render-server/` ou `remotion/` usado no MP4 Final → **`pm2 restart editor-render`** (bundle no boot). Ver [`docs/remotion-export.md`](docs/remotion-export.md) §3. `pm2 restart editor-video` **não** recarrega o Remotion.

## 2. Fluxo padrão (Windows → Mac)

O HD já está montado no Mini. Do Windows:

```powershell
ssh mac 'bash /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/scripts/deploy-on-hd.sh'
```

Se o app **já estiver no ar**, a porta 4013 está ocupada e o script aborta. Liberar e rodar de novo:

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; pm2 delete editor-video'
ssh mac 'bash /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/scripts/deploy-on-hd.sh'
```

### Publicar a partir do Windows (caminho estável)

O script completo (`pnpm install` + `pnpm build`) costuma falhar via SSH (TTY, `msw`, links do `node_modules` feitos no Windows). Com o `node_modules` **já nativo no Mac**:

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; pm2 delete editor-video'

ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; export NEXT_TELEMETRY_DISABLED=1; cd /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video && ./node_modules/.bin/next build'

ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; mkdir -p /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/logs; PORT=4013 pm2 start npm --name editor-video --cwd /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video --output /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/logs/pm2-out.log --error /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/logs/pm2-error.log -- start; pm2 save'
```

Smoke: `curl` em `http://127.0.0.1:4013/` e em `https://editor.macmini-capture.cc/` → `200`. Hard refresh no navegador.

Se `node_modules/.bin/next` não existir no Mac, apagar `node_modules` **no Mini** (não no Windows) e reinstalar com o store do HD; depois repetir o `next build`.

O script, nesta ordem:

1. Confirma que o cwd está em `/Volumes/HD 1Tb` (não no SSD)
2. Recusa se existir `~/vibecoding/editor-video`
3. Aponta cache/store para o HD (`.pnpm-store`, `.npm-cache`, `.cache`, `logs`)
4. Confere se **4013** está livre
5. `pnpm install --store-dir …/.pnpm-store --no-frozen-lockfile`
6. `pnpm build` (`next build`, Turbopack)
7. Confirma que `node_modules`, `.next` e `.pnpm-store` estão no HD
8. `pm2 delete editor-video` (se houver) + `pm2 start npm --name editor-video -- start`. Se `editor-render` não existir, sobe também (`127.0.0.1:4014`). **Não** reinicia o render se já estiver no PM2.
9. `pm2 save`
10. Smoke `http://127.0.0.1:4013/` até HTTP 200

Sucesso: linha `OK deploy no HD`.

## 3. Quando fazer o quê

| Mudança | Ação |
|---|---|
| Front (`app/`, `components/`, `lib/`, `app/globals.css`) | Script completo (install se deps mudaram + **build** + start) |
| `remotion/` ou `render-server/` | Rebuild do Next **se** o editor importa o arquivo **e** `pm2 restart editor-render` |
| Só `package.json` / lockfile | Script completo (reinstala + build) |
| Já buildou no Mac e só caiu o processo | Só restart (abaixo) |
| Tunnel / hostname | Ver §5 — **não** precisa rebuild do Next |
| Texto deste `deploy.md` | Nada em produção |

### Só reiniciar (sem rebuild)

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; pm2 restart editor-video'
```

Serve quando o processo morreu ou o Mini reiniciou e o `pm2 save` já tinha o app. **Não** atualiza UI: o `next start` continua servindo o último `.next`.

Render Final (`:4014`), sem rebuild do Next:

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; pm2 restart editor-render'
```

Recriar o processo do zero: `scripts/pm2-start-render.sh` (mata a 4014 avulsa, `pm2 start` + `pm2 save`).

## 4. Checklist pós-deploy

1. Script terminou com `OK deploy no HD`
2. `pm2 describe editor-video` e `pm2 describe editor-render` → `status: online` e `exec cwd` = `/Volumes/HD 1Tb/Vibecoding/Editor Video`
3. Local no Mini: `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4013/` → `200`
4. Público: `curl.exe -sS -o NUL -w "%{http_code}\n" https://editor.macmini-capture.cc/` → `200`
5. Site: hard refresh. Título: **Editor de Inserts — Automação de Marketing**
6. SSD: **não** deve existir `~/vibecoding/editor-video`. `du` de `~/Library/pnpm`, `~/.npm` e `~/vibecoding` não deve ter crescido por causa deste projeto

### Comandos de conferência (no Mac)

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"

pm2 describe editor-video | grep -E 'status|exec cwd|script path'
pm2 describe editor-render | grep -E 'status|exec cwd|script path'
lsof -nP -iTCP:4013 -sTCP:LISTEN
lsof -nP -iTCP:4014 -sTCP:LISTEN
df "/Volumes/HD 1Tb/Vibecoding/Editor Video/.next"
ls -ld "$HOME/vibecoding/editor-video"   # esperado: No such file
```

## 5. Cloudflare Tunnel (já publicado)

O tunnel **não** depende da pasta do projeto. Só hostname → `localhost:4013`.

Trecho em `~/.cloudflared/config.yml` no Mini:

```yaml
  - hostname: editor.macmini-capture.cc
    service: http://localhost:4013
```

Índice dos hostnames: https://indice.macmini-capture.cc (Basic Auth; lista o `config.yml`).

### Primeira vez (já feito em 2026-08-18)

Não repetir no dia a dia. Só se o hostname sumir do `config.yml` ou do DNS.

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"

# 1) Inserir a regra de ingress (idempotente)
python3 "/Volumes/HD 1Tb/Vibecoding/Editor Video/scripts/publish-tunnel.py"

# 2) CNAME no Cloudflare (túnel mac-capture)
cloudflared tunnel route dns f5521be0-55c4-4d8c-a048-37f68cd1aa89 editor.macmini-capture.cc

# 3) Recarregar o cloudflared (cai o público de TODOS os hostnames por 1–2 s)
pm2 restart tunnel
```

`publish-tunnel.py` só edita `~/.cloudflared/config.yml` (infra do Mini). Não copia o app para o SSD.

## 6. Primeiro deploy do zero

1. HD `HD 1Tb` montado no Mini; projeto visível em `/Volumes/HD 1Tb/Vibecoding/Editor Video`
2. SSH do Windows: `ssh mac` (chave em `~/.ssh/config`, host `mac`)
3. Porta 4013 livre: `lsof -nP -iTCP:4013 -sTCP:LISTEN` não deve listar nada
4. Rodar `scripts/deploy-on-hd.sh` (§2)
5. Publicar o hostname (§5) se ainda não existir
6. Checklist (§4)

## 7. Scripts

| Arquivo | Uso |
|---|---|
| `scripts/deploy-on-hd.sh` | Install + build + PM2 no HD. Caminho canônico de publicação |
| `scripts/publish-tunnel.py` | Garante a linha `editor.macmini-capture.cc` no `config.yml` |

Os dois vivem **no HD**. Rodar via `ssh mac` com path escapado (`Editor\ Video`).

Scripts gravados no Windows podem ter CRLF. Se o bash reclamar de `$'\r'`:

```bash
python3 -c "from pathlib import Path; p=Path('/Volumes/HD 1Tb/Vibecoding/Editor Video/scripts/deploy-on-hd.sh'); p.write_bytes(p.read_bytes().replace(b'\r\n', b'\n'))"
```

## 8. O que o deploy **não** faz

- Não copia para `~/vibecoding/` (SSD interno)
- Não usa o store global `~/Library/pnpm` (store fica em `.pnpm-store` no HD)
- Não sobe para Vercel / Hostinger / GitHub Actions
- `.env.local` (ou `.env`) no cwd do app: `OPENAI_API_KEY` (IA real, ver
  [`docs/ia-real.md`](docs/ia-real.md)). Sem a chave, Gerar com IA responde 503.
  Copie `.env.example`. **Não** use `OPENAI_ADMIN_KEY`. Import por URL usa `yt-dlp` /
  `ffmpeg` no PATH do PM2 (`/opt/homebrew/bin` no script de deploy). Opcional:
  `YTDLP_PATH`, `IMPORT_PROXY`, `IMPORT_DOWNLOAD_DIR` — ver
  [`docs/import-social-url.md`](docs/import-social-url.md) §6.
  Render Final: `RENDER_URL` (padrão `http://127.0.0.1:4014`) — ver
  [`docs/remotion-export.md`](docs/remotion-export.md).
- Não reinicia o processo PM2 `editor-render` na **4014**. Código do Remotion: `pm2 restart editor-render` (ver [`docs/remotion-export.md`](docs/remotion-export.md) §3). Se o processo sumir: `scripts/pm2-start-render.sh`.
- Não reinicia o processo PM2 `tunnel` no fluxo padrão (só no §5)

O `pm2 save` grava `~/.pm2/dump.pm2` no SSD. Isso é lista de processos do Mini, não cópia do projeto.

## 9. Gotchas

- Editar só no `N:` **não** muda o site até rebuild no Mac. O `next start` serve `.next` congelado.
- **Não** rodar `next dev` / `pnpm dev` pelo Windows no `N:` (SMB). Turbopack/gravação de `.next` quebra com `EBADF`. Dev e produção deste app: **no Mac**, path nativo `/Volumes/HD 1Tb/...`.
- O Studio Shopee continua no SSD por outro motivo (app grande + walk de `package.json` que já travou sob PM2). Este editor é pequeno e o teste de 2026-08-18 subiu no HD sem cópia.
- Porta 4013 ocupada por outro processo → o script aborta. `lsof -nP -iTCP:4013 -sTCP:LISTEN` e `pm2 delete editor-video` se for este app.
- `pnpm` 11 no Mini ignora o campo `"pnpm"` do `package.json`. Overrides e `allowBuilds.msw: false` ficam em `pnpm-workspace.yaml`. Sem isso o install aborta com `ERR_PNPM_IGNORED_BUILDS`.
- `pnpm build` via SSH sem TTY pode abortar (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Caminho estável: `./node_modules/.bin/next build` (ver §2).
- `node_modules` criado no Windows (SMB) **não** tem `node_modules/.bin/next` no Mac. Recriar **no Mini**: `rm -rf node_modules` e `pnpm install --store-dir` no HD.
- PowerShell não preserva `APP="/Volumes/HD 1Tb/..."`. Usar `/Volumes/HD\ 1Tb/Vibecoding/Editor\ Video`, sem aspas aninhadas no `ssh`.
- No PowerShell, **não** coloque `|` dentro de aspas duplas no comando remoto (`cwd` vira comando). `pm2 describe editor-video` sem grep, ou aspas **simples** no `ssh mac '...'`.
- UI “não mudou” → faltou `next build` no Mac ou cache do browser (hard refresh).
- Restart do `tunnel` interrompe **todos** os `*.macmini-capture.cc` por alguns segundos. Evitar no deploy cotidiano.
- Volume desmontado (`/Volumes/HD 1Tb` sumiu) → PM2 fica `errored` / porta morta. Remontar o disco e `pm2 restart editor-video editor-render` (ou o script se o `.next` tiver sumido).
- **Por URL** falha com `yt-dlp` / `spawn ENOENT` → o PATH do PM2 perdeu o Homebrew. Conferir `which yt-dlp` no mesmo PATH do deploy e, se preciso, `YTDLP_PATH=/opt/homebrew/bin/yt-dlp`. Merge de streams precisa de `ffmpeg` no PATH.
- Pasta `data/import-downloads/` cresce sem TTL (um MP4 por job). Apagar à mão no HD se o disco apertar.
- Final trava em 8% / `replies:0` com MP4 já no CapCut → build antigo ou cache. Hard refresh; conferir `GET /api/version` (≥ **v1.1.10**). Ops: [`docs/remotion-export.md`](docs/remotion-export.md) §2 e §10.
- Final “offline” / 503 → conferir `curl http://127.0.0.1:4014/health`. Se recusar conexão: `pm2 restart editor-render` (ou `scripts/pm2-start-render.sh` se o processo não existir). **Não** cai mais automaticamente para rascunho.
- `tmp/render/` no HD: jobs órfãos somem no boot do render-server; disco &lt; 5 GB → 507.

## 10. Parar / remover o serviço

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"
pm2 delete editor-video
pm2 delete editor-render
pm2 save
```

O hostname no tunnel continua apontando para `:4013` (vai 502 enquanto o app estiver down). Para tirar o público: remover o bloco `editor.macmini-capture.cc` do `config.yml` e `pm2 restart tunnel`.
