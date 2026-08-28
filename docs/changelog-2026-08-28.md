# Sessão 2026-08-28

O que entrou **no ar** neste dia (export Final). Índice: [`README.md`](README.md).  
Ops: [`remotion-export.md`](remotion-export.md).  
Publicar: [`../deploy.md`](../deploy.md) — `npm run deploy` + hard refresh (Ctrl+Shift+R).  
**Não é git repo.**

Versão final do dia: **v1.1.11** (`GET /api/version`).

---

## A. Bug: Final travava com Mac já `done`

### Sintoma

- UI em “O Mac está gerando o vídeo…” (~8%), cronômetro andando, `replies:0`.
- No Mac o job terminava, arquivo na pasta CapCut, `/status` respondia `stage:"done"` em ~80–180 ms se consultado à mão.
- Às vezes aparecia “Export cancelado” **sem** o operador cancelar.

### Causa raiz

1. Túnel Cloudflare: streams HTTP com headers ok e **corpo pendurado** — `await response.json()` / `body.cancel()` prendiam para sempre.
2. Arquitetura com **dois loops** (poll principal + watchdog) + `AbortSignal` compartilhado → timeout técnico virava “cancelado” e estados inconsistentes.

### Correções (v1.1.4 → v1.1.10)

| Versão | Mudança |
| --- | --- |
| v1.1.4–1.1.5 | Singleton fora do React, watchdog, `useSyncExternalStore` estável |
| v1.1.6–1.1.7 | Deadline headers+corpo, stall no download, abandon body sem await eterno |
| v1.1.8 | `userCancelled` — abort técnico não vira “Export cancelado” |
| v1.1.9 | **Um loop só** (`pollFinalUntilDone` / `watchJobUntilDone`); sem watchdog paralelo |
| v1.1.10 | Proxy **bufferiza JSON** + `Connection: close`; poll por `setInterval` + **XHR** com timeout; `nudgeMacIdle` quando health diz Mac livre; CapCut probe |

Critério de aceite: com Mac em `done`, a UI detecta em poucos segundos e fecha o ciclo. `replies` sobe durante o render.

Arquivos: `lib/export/final-task.ts`, `final-client.ts`, `render-proxy.ts`, `render-errors.ts`, `last-job.ts`, `hooks/use-final-export-task.ts`, `components/video-editor.tsx`, `control-panel.tsx`.

---

## B. UX: nome CapCut antes do render (v1.1.11)

### Pedido

O nome já vinha pré-preenchido no painel. O operador quer **confirmar/editar o nome certo** antes de iniciar o Final. Destino = **só pasta CapCut** (sem “Salvar como” do Chrome no fim).

### Comportamento

1. Clica **Renderizar** (modo Final) → modal “Nome do arquivo no CapCut” (pré-preenchido).
2. Edita → **Iniciar render** (Enter) ou Cancelar / Esc.
3. POST sempre com `saveToCapcut=1` e o nome do modal.
4. Se `capcutSaved` → **não** baixa o MP4 pelo túnel e **não** abre `showSaveFilePicker`.
5. Mensagem: `Vídeo salvo na pasta CapCut: <nome>.mp4`.
6. Rascunho inalterado (ainda pode usar Salvar como + CapCut opcional).

### Textos da barra (Final)

- “Baixando…” / “Confirmando o arquivo na pasta CapCut…” (substitui “Escolha onde salvar…”).

---

## C. Deploy do dia

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; export NEXT_TELEMETRY_DISABLED=1; cd /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video && npm run deploy'
```

Smoke: `curl.exe -s https://editor.macmini-capture.cc/api/version` → `"version":"1.1.11"`.

---

## D. Testes tocados

- `lib/export/final-client.test.ts`
- `lib/export/final-task.test.ts` (incl. “CapCut já salvo não baixa”)
- `lib/export/export-status.test.ts` (`formatCapcutOnlySavedMessage`)
- `lib/export/render-proxy.test.ts`, `render-errors.test.ts`, `last-job.test.ts`
