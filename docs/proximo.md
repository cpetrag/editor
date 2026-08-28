# O que falta — handoff para a próxima conversa

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts — anúncios afiliado Shopee, vertical 9:16  
**Ao vivo:** https://editor.macmini-capture.cc (PM2 `editor-video` :4013 + `editor-render` :4014)  
**Schema:** `Composition.version` **4** (não bumpa sem motivo)  
**Não é git repo.** `git push` / Vercel **não** sobem produção.

Leia isto + `docs/README.md` + `docs/inserts-ui.md` + `docs/fontes.md` + `docs/novo-projeto.md` + `docs/enquadramento.md` + `docs/marca-dagua.md` + `docs/legendas.md` + `docs/remotion-export.md` + `deploy.md` antes de implementar. Responder em **português Brasil**.

---

## 1. Como publicar (Windows → Mac)

Workspace Windows `N:\Vibecoding\Editor Video` = Mac `/Volumes/HD 1Tb/Vibecoding/Editor Video`. Mesmo volume.

Fluxo estável (app já no ar): `deploy.md` §2 — **não** usar o script completo via SSH (quebra `node_modules`).

```powershell
ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; pm2 delete editor-video'

ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; export NEXT_TELEMETRY_DISABLED=1; cd /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video && ./node_modules/.bin/next build'

ssh mac 'export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:$PATH"; mkdir -p /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/logs; PORT=4013 pm2 start npm --name editor-video --cwd /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video --output /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/logs/pm2-out.log --error /Volumes/HD\ 1Tb/Vibecoding/Editor\ Video/logs/pm2-error.log -- start; pm2 save'
```

Smoke: `curl` `http://127.0.0.1:4013/` e `https://editor.macmini-capture.cc/` → **200**. Pedir **hard refresh** (Ctrl+F5). SSH remoto em aspas **simples**.

---

## 2. Já está no ar — não refazer

Preview e **rascunho** usam o **mesmo** canvas 1080×1920. CSS (Feed / Safe area / caixa de seleção) **não** entra no MP4. **Final** pinta a mesma arte no Mac (Remotion `Short`).

**Exceção 2026-08-21:** a Fase 3 de `docs/inserts-ui.md` (abas novas, timeline arrastável, atalhos extra) **não começou**. Fases 1–2, C.1–C.3, Origem, checklist pré-export, **handles de rotação/E/W**, **Novo projeto / Limpar inserts** e **enquadramento do fundo** já foram publicadas. Gestos CapCut + Reset no card: **2026-08-22** ([`enquadramento.md`](enquadramento.md)). **Não** refazer.

| Fatia | Spec / notas |
| --- | --- |
| Onda 1: schema, persistência, export MediaRecorder, import URL | `docs/superpowers/specs/2026-08-18-onda-1-destravar-design.md` |
| Texto livre + PNG + chips no canvas, arraste/resize | `docs/preview-overlays.md` |
| Timeline in/out/move/Delete | `docs/timeline-clip.md` |
| Estilo por insert (`style`, paleta Shopee, aba Estilo) | schema v2 |
| Animações no canvas (6 presets; hit-test = bbox settled) | `docs/superpowers/specs/2026-08-19-anim-canvas-design.md` |
| 16 fontes + pesos honestos + picker com preview | [`fontes.md`](fontes.md) (**no ar 2026-08-22**). Spec 19/08: `docs/superpowers/specs/2026-08-19-fontes-novas-design.md` |
| Tamanho da fonte (px) na Estilo p/ texto **e chips**; Escala 0,2–4 no Movimento | `docs/superpowers/specs/2026-08-19-tamanho-fonte-chips-design.md` |
| Undo/redo do snapshot `{ inserts, captionStyle, sourceTransform? }` (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) + toast **Desfazer** ao apagar | no ar; `sourceTransform` no snapshot desde o enquadramento 2026-08-21 |
| UI Inserts Fases 1–2 (painel honesto, lista plana, card de legendas, + Elemento, ghost/seek) | **no ar 2026-08-21.** [`inserts-ui.md`](inserts-ui.md) |
| Origem e revelação progressiva (card de vídeo não destrutivo, SourceImport, painel progressivo) | **no ar 2026-08-21.** Schema v4 aditivo. **Não é** a Fase 3 de `inserts-ui.md`. |
| Checklist pré-export (avisos, não bloqueia) | **no ar 2026-08-21.** `lib/export-checklist.ts`; lista acima do botão em `control-panel.tsx`. |
| Handles de rotação + E/W no preview | **no ar 2026-08-21.** Spec [`2026-08-21-preview-handles-design.md`](superpowers/specs/2026-08-21-preview-handles-design.md). |
| Novo projeto + Limpar inserts | **no ar 2026-08-21.** Spec [`2026-08-21-novo-projeto-design.md`](superpowers/specs/2026-08-21-novo-projeto-design.md). Cabeçalho: Novo projeto (dois cliques). Origem: Limpar inserts (undo). |
| Enquadramento do fundo (scale + pan no MP4) | **no ar 2026-08-22.** Contrato [`enquadramento.md`](enquadramento.md). Clique no vazio = Vídeo; arraste = pan; roda = zoom no cursor; alças = escala no canto oposto. Card: só **Resetar enquadramento** (abaixo de Limpar inserts). `x`/`y` = offset do centro (0 = centro). Disco: `space: "offset"`. |
| IA real (Gerar estrutura + ganchos + Whisper + 1 PNG 1024×1536 transparente) | no ar; [`docs/ia-real.md`](ia-real.md); chave `OPENAI_API_KEY` no `.env.local` |
| Legendas: Gerar legendas + Viral/Limpo + `captionStyle` compartilhado (cores, fonte, X/Y) | [`2026-08-20-legendas-estilo-compartilhado-design.md`](superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md) |
| Export Final Remotion (fases 0–3): Composition `Short`, CLI, servidor `:4014`, toggle Rascunho/Final, Salvar como, barra por passo | [`remotion-export.md`](remotion-export.md) |
| Marca d’água texto/`@handle` (global handle+loop, toggle por vídeo, bounce) | **no ar 2026-08-22.** Spec [`2026-08-22-marca-dagua-design.md`](superpowers/specs/2026-08-22-marca-dagua-design.md). Card Origem: linha **Marca / handle / Loop**. Não é `source.watermarked` (Shopee). |
| Marca d’água Opac./Tam./Vel. (globais, mesmos `editor.watermark.v1`) | **no ar 2026-08-22.** Spec [`2026-08-22-marca-dagua-controles-design.md`](superpowers/specs/2026-08-22-marca-dagua-controles-design.md). Segunda linha no card Origem. Preview/rascunho/Final usam o snapshot. |

**Tamanho / escala (contrato atual):**

- Estilo: **Tamanho da fonte** (px). Texto e **legenda** 40–360. Chip com texto 12–360 (default 13 se ausente). Logo/ícone sem texto: sem slider de fonte.
- Movimento: **Escala 0,2–4** (chip e PNG). Texto livre e **legenda**: só X/Y, sem Escala. Legenda grava X/Y em `captionStyle` (todas as linhas).
- Resize no preview: texto → `fontSize` do insert; **legenda** → `captionStyle.fontSize`; chip/PNG → `scale`.
- Peso: só os reais da família; 1 peso → Select desabilitado, label **peso fixo**.

**Fontes (ordem):** geist, poppins, bebas, archivo, playfair, space, oswald, montserrat, anton.  
`WEIGHTS_BY_FONT` em `lib/compose/insert-style.ts`. Parse **não** reescreve peso inválido; draw clampa.

---

## 3. Falta fazer (backlog)

### P0 — publicar o que já está no disco

Fases 1–2 + Origem + checklist pré-export + handles de rotação/E/W + Novo projeto / Limpar inserts + enquadramento do fundo + **marca d’água** (handle/loop + Opac./Tam./Vel.): **feito** (2026-08-21; gestos CapCut e marca 2026-08-22). **Não** mexer no encoder. **Não** refazer C.1–C.3.

### P1 — editor (próxima conversa, escolha uma)

0. **Fase 3 da UI de inserts** (só se o operador pedir): abas extras, timeline mais editável, atalhos extra. Continua **intocada**. Não confundir com Origem e revelação progressiva (já no ar). Sem schema v5.

1. **Checklist pré-export** — **no ar 2026-08-21.** Avisos: insert &lt; 0,8 s, overlap temporal (só texto/chip/PNG), colisão espacial (insert×insert ou insert×uma legenda), safe area (legenda isenta da faixa de baixo), contraste da pintura (sem amostrar o MP4). Não bloqueia o export; clique seleciona o insert.

2. **Handles extras no preview** — **no ar 2026-08-21.** Rotação arrastável (haste + círculo; ângulo livre). E/W só em texto/legenda (`maxWidthPct`). PNG pinta `insert.rotation`. Legenda nativa: `captionStyle.rotation` compartilhado.

3. **Enquadramento do fundo** — **no ar 2026-08-22.** Contrato [`enquadramento.md`](enquadramento.md). Clique no vazio = Vídeo; arraste / roda / alças. Card Origem: só **Resetar enquadramento**. Spec 2026-08-21 (sliders, âncora 50/50) **não** vale mais.

### P2 — editor / timeline

4. Snap/ripple entre clipes na timeline (hoje: trim/move + snap de **posição** no canvas, não entre clipes).
5. Controles de texto que o schema já tem mas a UI não expõe: `textAlign`. `maxWidthPct` no preview (handles E/W); slider no card continua fora.
6. Duração editável das animações (hoje tempos fixos CSS; compressão se in+out &gt; duration). Sem `AnimBlock` do Studio.
7. Presets novos de anim / loop no miolo — só se o operador pedir.

### P3 — produção de anúncio

8. **IA — fatias seguintes** (a base já está no ar; ver `docs/ia-real.md`): regenerar um insert, botão “gerar outra imagem”, formulário produto/oferta/persona. Não refazer o cano Whisper/Mini/PNG.
9. **Lote no servidor (Fase 4 Remotion)** — o lote atual só permuta âncoras no JSON e exporta no browser. Spec: [`2026-08-20-remotion-render-design.md`](superpowers/specs/2026-08-20-remotion-render-design.md) Fase 4. Sequencial no `:4014`, progresso `variante 3/20`, ZIP + `manifest.json`, checar disco antes. **Não começar** até o operador aceitar o Final pontual. Worker ffmpeg antigo (item histórico) fica substituído por esta fatia.
10. Campo “cole o link do produto”, kit de marca em `brand`, manifesto + UTM + reimport CSV.

### P4 — paridade Studio (depois)

11. Substituir os 10 chips por presets de texto (**abordagem B**). Ver `docs/montador-textos-inserts.md`.
12. Tipos novos de insert (além dos 10 chips + texto + PNG).
13. Biblioteca de imports: listar / apagar / thumbs (hoje baixa e abre; cache em `data/import-downloads/` sem UI).
14. **Legendas — fatia A + estilo compartilhado (feito):** Gerar legendas, preset Viral/Limpo, `captionStyle` único (fonte, tamanho, X/Y, cor, destaque, fundo, contorno). Editar numa linha muda todas. **Painel global 2026-08-22:** visual uma vez no bloco Legendas; Inserts sem cards de linha; texto só da selecionada; tempo na timeline. **Restante:** split/merge por palavra, export SRT, botão **+ Legenda**, chunk &gt; 25 MB.
15. Upload de fonte TTF, Inter Tight, pesos 200/300, alias `montserrat-extrabold`.
16. Cards de review Shopee.

Não misturar P3/P4 numa fatia de P1.

---

## 4. Nits conhecidos (não são o próximo épico)

- Campo **Cor de fundo** às vezes mostra `rgba(0,0,0)` em vez de hex / “Sem fundo”.
- **Gerar com IA** (`lib/ai-prompt.ts`) ainda oferece só as 9 fontes de 19/08. O picker tem 16 ([`fontes.md`](fontes.md) §7). Não misturar com outra fatia.
- Warnings Turbopack de `fs` em `sticker-library.ts` / `ytdlp.ts` — pré-existentes, não bloqueiam.
- **D6 aberto:** `.meta.json` do yt-dlp **não** tem `fps` nem `codec`. `composition.source.fps` continua 30 até o operador decidir (não estender o job nesta fatia). Reels 60 fps ainda erram “Duração (frames)”.
- GET `/api/import/download/:id` devolve `ImportJob` (title/platform/sourceUrl), **não** o `.meta.json`. `watermarked` da Shopee não chega no cliente sem estender o endpoint.
- Faxina de servidor: `.part` órfão (~61 MB, Shorts 403) — fora desta fatia.
- Importação p90 > ~15 s: aí vira tarefa com fila. Hoje o download fica no card e o painel continua interativo.

---

## 5. Arquivos-chave

| Área | Onde |
| --- | --- |
| Schema / clamp | `lib/composition.ts` (`CaptionStyle`, `mergeCaptionStylePatch`, `captionInsertForLayout`, `insertHasFontSize`) |
| Estilo / fontes | [`fontes.md`](fontes.md); `lib/compose/insert-style.ts`, `lib/compose/fonts.ts`, `lib/fonts.ts`, `app/layout.tsx`, `remotion/load-fonts.ts`, `components/font-option-label.tsx` |
| Draw | `lib/compose/draw-text.ts`, `draw-chips.ts`, `draw-captions.ts`, `lib/export/compositor.ts` |
| Chips layout | `lib/insert-layout.ts` (`measureChipSize`, `fontPx`) |
| Undo | `lib/composition-history.ts` — snapshot `{ inserts, captionStyle, sourceTransform?, watermarkEnabled? }` |
| Enquadramento fundo | `lib/source-transform.ts`, `lib/export/cover.ts`, `lib/preview-selection.ts`; Reset no `background-source-card.tsx` |
| Marca d’água | [`docs/marca-dagua.md`](marca-dagua.md); `lib/watermark.ts`, `lib/watermark-store.ts`; UI em `background-source-card.tsx` |
| Preview | `components/overlay-canvas.tsx`, `selection-overlay.tsx` (ghost fora da janela; haste/círculo + E/W) |
| Gestos de alça | `lib/compose/preview-handles.ts` |
| Card | `components/insert-card.tsx`, `style-customize-panel.tsx`; looks de legenda em `caption-style-card.tsx`, `caption-visual-panel.tsx`, `caption-text-card.tsx` |
| UI inserts | [`docs/inserts-ui.md`](inserts-ui.md); `element-picker.tsx`, `lib/style/editor-style.ts` |
| Origem | `lib/commit-source.ts`, `lib/source-url.ts`, `lib/import-errors.ts`, `lib/recent-sources.ts`, `components/background-source-card.tsx` |
| Novo projeto | `lib/project-reset.ts`; cabeçalho em `control-panel.tsx`; orquestra `video-editor.tsx` |
| Checklist pré-export | `lib/export-checklist.ts`, `lib/export-checklist.test.ts`, footer em `components/control-panel.tsx` |
| IA | `docs/ia-real.md`; `lib/ai-generate.ts`, `ai-openai.ts`, `app/api/ai/` |
| Legendas | [`docs/legendas.md`](legendas.md); `lib/captions.ts`, `lib/compose/draw-captions.ts`, `app/api/ai/captions/` |
| Export Final | [`docs/remotion-export.md`](remotion-export.md); `remotion/`, `render-server/`, `lib/export/final-client.ts`, `app/api/render/` |
| Deploy | `deploy.md` |

Testes: `pnpm test` (`node --experimental-strip-types --test` — lista em `package.json`). Sem git: **não commit** a menos que o operador peça (e não há repo).

---

## 6. Regras que a próxima conversa deve manter

- Preview = rascunho (mesmo `drawFrame`). Final = Remotion `Short` no Mac. Não pintar insert via CSS no MP4.
- Sem hardcode de API keys. Sem bump de `Composition.version` sem campo incompatível.
- TDD nas fatias de lógica (`lib/*.test.ts`). UI segue o padrão dos sliders da aba Estilo.
- Chip `fontSize` não estica logo/PNG; `scale` é o multiplicador do insert inteiro.
- Look de **legenda** nativo vive em `captionStyle`; factory vive em `styleRef` da linha. Hormozi ≠ `captionPreset`. `composition.ts` não importa `captions.ts`.
- Não reexportar `lib/style-preset.ts` em `lib/style/index.ts`.
- IA: chave só em `.env.local` (`OPENAI_API_KEY`). Não usar `gpt-image-2` (sem alpha). Sem visão de frames sem pedido.

---

## 7. Prompt curto para colar na próxima conversa

```
Continua o Editor de Inserts (N:\Vibecoding\Editor Video).
Leia docs/proximo.md, docs/README.md, docs/inserts-ui.md, docs/novo-projeto.md, docs/enquadramento.md, docs/marca-dagua.md, docs/legendas.md, docs/ia-real.md e docs/remotion-export.md.
Produção: PM2 editor-video porta 4013, PM2 editor-render porta 4014 (127.0.0.1), https://editor.macmini-capture.cc
Deploy: deploy.md §2 (Next) + remotion-export.md §3 (`pm2 restart editor-render`).
Schema v4. Origem, Fases 1–2, checklist pré-export, handles de rotação/E/W, Novo projeto / Limpar inserts, enquadramento CapCut e marca d’água (handle/loop + Opac./Tam./Vel.) já no ar. Responder em pt-BR.
Quero fazer: [Fase 3 inserts | lote Fase 4 | …]
```
