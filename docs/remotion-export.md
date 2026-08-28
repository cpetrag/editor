# Export Final (Remotion) e rascunho

**Atualizado:** 2026-08-28 (v1.1.11)  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`, porta **4013**)  
**Status:** Final estável atrás do túnel Cloudflare. Fase 4 (lote no servidor) **não** começou.  
**Spec original:** [`superpowers/specs/2026-08-20-remotion-render-design.md`](superpowers/specs/2026-08-20-remotion-render-design.md).  
**Changelog desta rodada:** [`changelog-2026-08-28.md`](changelog-2026-08-28.md).

Dois modos no rodapé do editor. **Final** é o padrão. O schema `Composition` não muda.

| Modo | Motor | Arquivo | Áudio | Quando usar |
| --- | --- | --- | --- | --- |
| **Final** | Remotion no Mac (porta **4014**) | MP4 1080×1920, 30 fps, CRF 18 | O do vídeo de fundo | Entrega → pasta CapCut |
| **Rascunho** | MediaRecorder / WebCodecs no navegador | MP4 ou WebM, qualidade escolhida | Só no Chrome 126+ | Conferir timing, ou se o Mac estiver offline |

O preview continua no canvas do editor. O Final **não** grava o screenshot do preview: o Mac pinta frame a frame a composição `Short`. Enquadramento: [`enquadramento.md`](enquadramento.md). Fontes: [`fontes.md`](fontes.md). Marca d’água: [`marca-dagua.md`](marca-dagua.md). Mudou `remotion/` → rebuild Next **e** `pm2 restart editor-render`.

---

## 1. O que o operador vê (Final)

1. Toggle **Rascunho / Final** (travado durante o export).
2. Campo **Nome do arquivo** no painel (pré-preenchido com o stem do vídeo de origem).
3. Clica **Renderizar e Exportar Vídeo** → abre o **modal** “Nome do arquivo no CapCut” com o nome pré-preenchido.
4. Edita o nome correto → **Iniciar render** (ou Cancelar / Esc — não inicia nada).
5. Barra + passo + porcentagem + cronômetro + contagem de `replies` (consultas de status).
6. Quando o Mac termina e grava CapCut → mensagem `Vídeo salvo na pasta CapCut: <nome>.mp4`.
7. **Sem** diálogo “Salvar como” do Chrome no Final quando CapCut já gravou.
8. Se falhar: **Tentar de novo**. Se houver `jobId` recente: **Recuperar último export**.

Rascunho: continua com encode no navegador + “Salvar como” / Downloads; CapCut opcional via checkbox (só rascunho MP4).

### Passos da barra (Final)

| Faixa | Texto | O que está acontecendo |
| --- | --- | --- |
| ~2–8% | Enviando o vídeo para o Mac… | Upload do MP4 + `props.json` + `saveToCapcut` + `fileName` |
| 8–85% | O Mac está gerando o vídeo… | Remotion; poll de status a cada ~1,2 s |
| (pulado se CapCut ok) | Baixando o MP4… | Só se CapCut **não** gravou (recuperação / fallback) |
| ~98% | Confirmando o arquivo na pasta CapCut… | Mac já copiou; UI só confirma |
| 100% | Vídeo salvo na pasta CapCut: … | Pronto |

### Pasta CapCut

Destino padrão: `/Volumes/HD 1Tb/Vibecoding/Shopee Reviews/CapCut`  
Override: `CAPCUT_HD_SOURCE` no `.env.local` (Next e `editor-render`).

O Final **sempre** manda `saveToCapcut=1` no POST. O nome vem do modal (sanitizado → `*.mp4`).

---

## 2. Fluxo técnico (Final)

```
Operador → modal de nome → finalExportTask.start({ fileName, saveToCapcut: true })
  → POST /api/render (vídeo + props.json + fileName)
  → jobId no sessionStorage (editor.export.lastJob.v1)
  → watchJobUntilDone (setInterval ~1,2s)
       GET /api/render/status/:jobId   (XHR + timeout 5s; JSON bufferizado no proxy)
       se status falhar → GET /api/render (health)
       se Mac livre + status done / download probe → conclui
  → se capcutSaved: saveHandler sem download e sem showSaveFilePicker
  → senão: download + saveExportBlob (fallback)
```

### Arquivos-chave

| Arquivo | Papel |
| --- | --- |
| `lib/export/final-task.ts` | Singleton fora do React: `start` / `cancel` / `retry` / `recoverLast` / `nudgeMacIdle` |
| `lib/export/final-client.ts` | POST, `watchJobUntilDone` (XHR), download com stall, health |
| `lib/export/render-proxy.ts` | Next → 4014; **JSON bufferizado** + `Connection: close` (túnel) |
| `lib/export/last-job.ts` | `sessionStorage` do último `jobId` |
| `lib/export/export-status.ts` | Textos da barra / CapCut-only |
| `lib/export/save.ts` | `showSaveFilePicker` (rascunho / fallback Final) |
| `hooks/use-final-export-task.ts` | `useSyncExternalStore` no snapshot |
| `components/video-editor.tsx` | Modal de nome + `setSaveHandler` CapCut-only |
| `render-server/app.ts` | Job, CapCut copy, `/status`, `/download` |

### Por que o poll é assim (túnel)

O Cloudflare Tunnel **mata streams HTTP** com frequência: headers chegam, o corpo fica pendurado, e um `await fetch().json()` antigo prendia a UI para sempre (`replies:0`, barra em 8%, Mac já `done`).

Mitigações no ar (v1.1.9 → v1.1.11):

1. **Proxy bufferiza JSON** de `/status` e `/health` (corpo completo + `Connection: close`).
2. **Poll por `setInterval`** — cada tick dispara consulta independente; timeout nativo via **XHR** (5 s).
3. **Fallback health** — Mac `busy:false` → reconsulta status / probe download.
4. **`nudgeMacIdle`** — o poll de saúde da UI (a cada 4 s) força conclusão quando o Mac fica livre.
5. **Um loop só** — sem watchdog paralelo competindo com `AbortSignal` compartilhado (falsos “Export cancelado”).
6. **CapCut done → não baixa** o MP4 pelo túnel (evita stall no download e o modal “Salvar como”).

### Cancelamento

Só o botão **Cancelar** (ou novo export) marca `userCancelled`. Timeout / abort técnico **não** vira “Export cancelado”.

---

## 3. Arquitetura de rede

O processo **4014 não passa pelo Cloudflare**. O browser fala com o Next (`:4013`); o Next, no Mac, fala com o render em `127.0.0.1:4014`.

```
Windows (Chrome)
  → https://editor.macmini-capture.cc  (túnel → :4013)
       POST /api/render
       GET  /api/render/status/:jobId
       GET  /api/render              (health)
       GET  /api/render/download/:jobId   (só se CapCut não salvou)
            │
            ▼
       Next.js (PM2 editor-video, :4013)
            proxy → http://127.0.0.1:4014
            │
            ▼
       render-server (Node, bind 127.0.0.1:4014)
            bundle() no boot · 1 job por vez
            copia CapCut se saveToCapcut
            GET /status → { progress, stage, capcutSaved, capcutFileName }
```

`blob:` / `file://` **não** servem no Remotion. O servidor grava o upload e expõe `http://127.0.0.1:4014/media/<jobId>`.

---

## 4. Processos e portas

| Processo | Porta | PM2 | Como sobe |
| --- | --- | --- | --- |
| Editor Next | **4013** | `editor-video` | `npm run deploy` (patch + build + restart) |
| Render Remotion | **4014** só em `127.0.0.1` | `editor-render` | restart no mesmo `deploy` / `pm2 restart editor-render` |
| Studio (dev) | 3333 | não | `pnpm studio` — não é produção |

Versão no ar: `GET /api/version` → `{ version, buildTime }` (selo na UI).

Smoke:

```bash
curl -sS http://127.0.0.1:4014/health
curl -sS http://127.0.0.1:4013/api/render
curl.exe -sS https://editor.macmini-capture.cc/api/version
```

---

## 5. Env

| Variável | Onde | Padrão | Papel |
| --- | --- | --- | --- |
| `RENDER_URL` | `.env.local` do Next | `http://127.0.0.1:4014` | Base do proxy |
| `RENDER_PORT` / `RENDER_HOST` | render | `4014` / `127.0.0.1` | Não expor na LAN / túnel |
| `CAPCUT_HD_SOURCE` | Next e `editor-render` | pasta CapCut no HD | Destino do MP4 Final |
| `NEXT_PUBLIC_APP_VERSION` | build (`npm version patch` no deploy) | — | Selo / `/api/version` |

Sem `NEXT_PUBLIC_*` apontando para a 4014 — o browser nunca fala direto com o render.

---

## 6. Endpoints do render-server

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/health` | `ok`, `busy`, `jobId`, disco, `bundleVersion` |
| `POST` | `/render` | multipart `video` + `props` (+ `saveToCapcut` / `fileName`). **202** `{ jobId }`. **409** se ocupado. **507** se disco &lt; 5 GB |
| `GET` | `/status/:jobId` | `{ progress, stage, error?, capcutSaved?, capcutFileName? }` |
| `GET` | `/progress/:jobId` | SSE — só depurar no Mac (navegador remoto **não** usa) |
| `GET` | `/download/:jobId` | MP4; headers CapCut; apaga `tmp/` depois |
| `GET` | `/media/:jobId` | MP4 de entrada (compositor) |
| `POST` | `/cancel` | Aborta o job ativo |
| `POST` | `/rebundle` | Novo `bundle()` se não estiver `busy` |

Guardas: timeout 10 min, TTL 1 h, `tmp/render/` limpo no boot, um job por vez, `Connection: close` no JSON.

---

## 7. Rascunho (inalterado no essencial)

- Encode no browser (`lib/export/encoder.ts`).
- `saveExportBlob` → “Salvar como” (Chrome) ou Downloads.
- CapCut opcional via checkbox (upload cliente); **não** usa o modal do Final.

---

## 8. Erros e recuperação

| Situação | Mensagem / ação | Cai para rascunho? |
| --- | --- | --- |
| Já tem Final (409) | Já tem um render em andamento | Não |
| Disco &lt; 5 GB (507) | Disco insuficiente | Não |
| 4014 morto (503 / rede) | Não consegui falar com o Mac… Recuperar último export | Não |
| Falha Remotion | Texto do Mac | Não |
| Status pendurado no túnel | Timeout 5s + próximo tick / health / nudge | Não |
| CapCut falhou, job `done` | Download fallback ou Recuperar | Não |
| Operador cancelou | Export cancelado… | — |

`jobId` em `sessionStorage` (`editor.export.lastJob.v1`). **Recuperar último export** retoma poll/download sem reenviar o vídeo.

---

## 9. Testes

```bash
node --experimental-strip-types --test \
  lib/export/final-client.test.ts \
  lib/export/final-task.test.ts \
  lib/export/export-status.test.ts \
  lib/export/render-proxy.test.ts \
  lib/export/render-errors.test.ts \
  lib/export/last-job.test.ts \
  lib/export/save.test.ts \
  render-server/*.test.ts
```

Preferir rodar no **Mac** (path `/Volumes/HD 1Tb/...`). No Windows via SMB, `pnpm test` completo pode travar.

---

## 10. Armadilhas

| Sintoma | Causa | O que fazer |
| --- | --- | --- |
| Barra em 8%, `replies:0`, MP4 já no CapCut | Stream morto no túnel (versão antiga) | Hard refresh; precisa **≥ v1.1.10** |
| “Export cancelado” sem clicar Cancelar | Abort técnico misturado com cancel (≤ v1.1.8) | Hard refresh ≥ v1.1.9 |
| Modal “Salvar como” no Final | CapCut não gravou **ou** build antigo | Conferir `capcutSaved` no status; ≥ v1.1.11 |
| Selo antigo na UI | Cache do browser | Ctrl+Shift+R; `GET /api/version` |
| 409 | Outro Final no Mac | Esperar ou Interromper render |
| Final “offline” | 4014 morto | `curl :4014/health` + `pm2 restart editor-render` |
| Texto congelado no MP4 | CSS transition no `remotion/` | Só `useCurrentFrame` |
| Render lento | Docker Desktop | `/health` avisa |

**Não iniciar a Fase 4** (lote no servidor) até o operador pedir.

---

## 11. Deploy

Caminho estável (Windows → Mac), sobe versão + Next + PM2:

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; export NEXT_TELEMETRY_DISABLED=1; cd /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video && npm run deploy'
```

Detalhes: [`../deploy.md`](../deploy.md). Depois: hard refresh e conferir o selo / `/api/version`.
