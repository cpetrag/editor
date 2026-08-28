# Montador — textos e biblioteca de inserts (documento técnico)

**Atualizado:** 2026-08-18  
**Produto origem:** Shopee Reviews Studio (`gerador/`)  
**Escopo deste doc:** inserção de **texto** (legenda / CTA / texto extra) e **inserts PNG** (biblioteca + upload + colar).  
**Fora:** timeline, soft-cut, scrub, export NLE, cards de review/produto, karaoke ASR.

Pensado para reaproveitar o motor em outro projeto **sem timeline**. Os campos `start`/`end` existem no modelo; o consumidor pode ignorá-los e tratar o insert como sempre visível.

Doc operacional completo do Montador (inclui timeline): [`docs/montador-video-canvas.md`](montador-video-canvas.md).  
Importação de vídeo: [`docs/import-social-platforms.md`](import-social-platforms.md).

---

## 1. O que é este motor

Não é um editor de cortes. É um **compositor de overlays** sobre um frame 9:16:

| Superfície | Resolução |
|---|---|
| Canvas de desenho | **1080 × 1920** (`PLAY_W` / `PLAY_H` em `gerador/lib/reviews-video/timing.js`) |
| Preview na UI | o mesmo canvas com `object-contain` (escala de display ≠ coordenadas de desenho) |
| Inserts | texto estilizado **ou** PNG com alpha |

Ponto único de raster: `renderComposeFrame` em `gerador/lib/compose/drawOverlays.js`. Preview e export usam a **mesma** função. CSS da UI **não** pinta o MP4.

Ordem de pintura (baixo → cima):

```
vídeo / fundo
  → reviews / products     (fora deste doc)
  → stickers (PNG)
  → characters (texto extra)
  → captions (legenda)
  → ctas (CTA)
  → chrome de seleção (só preview)
```

Z-index de hit-test (quem ganha o clique): CTA > legenda > caractere > sticker.

---

## 2. Dois tipos de insert

| Tipo | Trilhas no código | Conteúdo | Tamanho no preview |
|---|---|---|---|
| **Texto** | `captions`, `ctas`, `characters` | string + tipografia + preset visual | handle de canto muda `fontSize` (40–360) |
| **PNG** | `stickers` | imagem com alpha | handle de canto muda `scale` (0.40–2.00) |

Os três kinds de texto compartilham **o mesmo draw** (`drawStyledText`). A diferença é só default de fábrica, catálogo de presets e papel na UI.

PNG **não** é CTA. CTA no Studio é texto com pill/stroke (ex. “Comenta QUERO”). Sticker é bitmap.

---

## 3. Sistema de coordenadas

Posição é **porcentagem do frame**, âncora = **centro** do insert:

```
cx = (x / 100) * 1080
cy = (y / 100) * 1920
```

| Campo | Unidade | Faixa |
|---|---|---|
| `x`, `y` | % | x: 0–100; y: 5–95 (resolve) |
| `rotation` | graus | default 0 (UI de handle de rotação não existe; só campo + texto extra expõe) |
| `fontSize` | px no canvas 1080 | 40–360 |
| `scale` (PNG) | fração da largura do frame | 0.40–2.00; default sticker 0.70 |
| `maxWidthPct` | % da largura | default 84 — wrap / auto-fit |

Conversão tela ↔ canvas (preview `object-contain`): `getCanvasDisplayMetrics`, `screenToCanvas`, `canvasToScreen` em `layoutRegistry.js`. Sem isso, o arraste no preview desalinha do pixel do export.

Resize proporcional, **centro fixo**: `resizePatchForTrack` em `hitTest.js` — texto → `fontSize`; PNG → `scale`.

---

## 4. Texto — três fábricas

Código: `emptyCaption` / `emptyCta` / `emptyCharacter` em `ComposeTab.js`. IDs: `uid("cap"|"cta"|"chr")` (`layers.js`).

### 4.1. Legenda (`captions`)

Nasce **sem** estilo explícito — herda tema → `styleDefaults` → defaults do resolve.

```js
{
  id,                 // "cap-…"
  start, end,         // janela de visibilidade (ignorar se não houver tempo)
  text: "",           // string; "\n" = quebra manual
  // opcional: words[]  (karaoke — NÃO portar se o outro projeto não tem ASR)
  // opcional: STYLE_KEYS (preset, fontFamily, fontSize, color, …)
}
```

Defaults de resolve: `fontSize` 64, fonte `inter-tight` (ou Arial legado se `fontFamily` ausente), `y` 78%, preset `caption-clean`.

Como o operador cria no Studio:

- botão **+** / “adicionar legenda”
- **Legendas do dossiê** (IA) — fora deste doc
- **Legendas do áudio** (Whisper + `words`) — fora deste doc

Para o outro projeto: um `emptyCaption` + editor de `text` basta.

### 4.2. CTA (`ctas`)

Nasce já “Shopee punch”:

```js
{
  id, start, end,
  text: "Comenta QUERO",
  preset: "sticker-quero",     // pill laranja #ee4d2d
  fontSize: 70,
  y: 88,
  fontFamily: "archivo-black",
  animation: "pop",            // legado; draw lê anim via normalizeAnim
  animMs: 1000,
  anim: AnimBlock,             // enter/emphasis/exit
}
```

Toolbar: **+ CTA**. Novos itens passam por `withTrackDefaults` (herdam estilo da faixa se o operador já “aplicou a todas”).

### 4.3. Texto extra (`characters`)

Texto solto, default mais alto no frame:

```js
{
  id, start, end,
  text: "NOVO",
  preset: "bold-outline",
  fontSize: 56,
  x: 50, y: 35,
  fontFamily: "archivo-black",
  anim: AnimBlock,             // default kind "character"
}
```

Toolbar: **+ texto extra**. É o insert de texto “genérico” — o melhor ponto de partida para outro projeto.

### 4.4. O que NÃO copiar do texto

- `words[]` + `wrapWordRuns` (karaoke por palavra, timings ASR).
- `resyncCaptionWords` (reconcilia quebras manuais com timings).
- Importação dossiê / Whisper.

O draw de texto comum (`wrapLines` + pill + stroke) **não** depende disso.

---

## 5. Tipografia e presets visuais

### 5.1. Resolve (contrato obrigatório)

`resolveLayerStyle(layer, kind, { theme, themeId, styleDefaults })` em `gerador/lib/compose/resolveLayerStyle.js`.

**Draw e export nunca leem o layer cru.** Sempre o objeto resolvido.

Cascata (depois ganha):

```
tema (stylePatchFromTheme)
  → styleDefaults[track]     // localStorage por themeId
  → campos explícitos do clip
  → defaults do kind
```

`kind`: `"caption"` | `"cta"` | `"character"` | `"sticker"` | `"review"`.

### 5.2. Campos de texto (resolvidos)

| Campo | Default | Papel |
|---|---|---|
| `fontFamily` | catálogo OFL | id estável (`archivo-black`, `inter-tight`, …) |
| `fontSize` | 64 / 70 / 56 | px no canvas 1080 |
| `fontSizeMode` | `"fixed"` | `"auto-fit"` reduz até caber em `maxWidthPct` (mín. 28px) |
| `fontWeight` | 800 | |
| `uppercase` | false (preset pode forçar) | |
| `letterSpacing` | 0 | relativo ao `fontSize` (em) |
| `lineHeight` | 1.2 | |
| `maxWidthPct` | 84 | wrap |
| `textAlign` | `"center"` | `left` \| `center` \| `right` |
| `color` | do preset | cor explícita no clip **desliga** auto-contraste |
| `bgColor` / `bgOpacity` | do preset | pill |
| `pillRadius` | do preset | 0 = barra; 999 = cápsula |
| `stroke` | `{ width, color }` | contorno 2-pass (preto + halo branco 25%) |
| `shadow` | `{ blur, ox, oy, color }` | no texto se sem fundo; no pill se com fundo |
| `border` / `gradient` | opcional | glass, badge-pill, comment-bait |
| `autoContrast` | true se o preset não pede skip | amostra luma atrás da bbox → texto claro/escuro + scrim |
| `preset` | token visual | ver §5.3 |
| `rotation` | 0 | graus |
| `anim` | `AnimBlock` | ver §8 |

### 5.3. Presets = tokens de pintura, não layout

Catálogo de IDs na UI: `CAPTION_PRESETS` e `CTA_PRESETS` em `gerador/lib/captions/presets.js`.  
Pixels: `presetPaint(preset, kind)` no resolve.

**Legendas**

| id | Visual |
|---|---|
| `caption-clean` | branco + stroke 6px (default) |
| `caption-box` | caixa preta 72% |
| `caption-karaoke` | amarelo + glow (só faz sentido com `words`) |
| `caption-shadow` | sombra dura, sem stroke |
| `caption-stroke` | stroke 8px |
| `caption-minimal` | glow suave |
| `caption-impact` | CAIXA ALTA + sombra deslocada |

**CTA / texto extra** (mesmo catálogo)

| id | Visual |
|---|---|
| `bold-outline` | stroke + sombra (default texto extra) |
| `sticker-quero` | pill Shopee `#ee4d2d` |
| `bar-bottom` / `story-bar` | barra preta |
| `neon-soft` | `#b8ff66` + glow, sem stroke |
| `badge-pill` | gradiente laranja, raio 999 |
| `urgent-red` / `pulse-offer` | fundo sólido + uppercase |
| `soft-white` / `glass` / `link-pill` | fundo claro / vidro / link |
| `shopee-orange` | pill + drop shadow `#b83520` |
| `arrow-tap` / `comment-bait` / `pop-word` | azul / gradiente roxo / ciano |

Mudar `preset` **não** apaga `text` nem `x`/`y`. Cor/fundo explícitos no clip sobrescrevem o paint.

### 5.4. Webfonts (self-hosted SIL OFL)

`gerador/lib/compose/fonts/catalog.js` + arquivos em `/fonts/compose/*.woff2`.

| id | family | peso | papel |
|---|---|---|---|
| `anton` | Anton | 400 | hook |
| `archivo-black` | Archivo Black | 400 | hook (default CTA) |
| `montserrat-extrabold` | Montserrat | 800 | hook |
| `bebas-neue` | Bebas Neue | 400 | condensed |
| `barlow-condensed` | Barlow Condensed | 700 | condensed |
| `oswald` | Oswald | 700 | condensed |
| `inter-tight` | Inter Tight | 700 | caption (default legenda) |
| `figtree` | Figtree | 700 | caption |
| `outfit` | Outfit | 700 | caption |
| `kanit` | Kanit | 700 | promo |

Legado mapeado: `arial`/`helvetica` → `inter-tight`; `arial-black`/`impact` → `archivo-black`.

Antes de desenhar: `ensureComposeFontsReady(project)` (`document.fonts.load`). Sem isso, canvas cai em fallback e o preview diverge do export.

CSS gerado: `composeFontFaceCss()`. UI do picker: `FONT_PICKER` (sem ids legado).

### 5.5. Wrap e alinhamento

`wrapLines(ctx, text, maxW)` — `\n` primeiro, depois quebra por palavra (`measureText`).  
Âncora vertical: o **bloco inteiro** fica centrado em `y` (linhas extras crescem para cima e para baixo).  
`balancedLineBreak(text, measureWidth)` — insere **um** `\n` no ponto que equilibra largura (helper opcional, não automático no draw).

---

## 6. Como o texto entra na sessão (UI)

Não há “biblioteca de textos” no disco. Inserção é **fábrica em memória**:

| Ação | Resultado |
|---|---|
| **+ CTA** | `emptyCta` + `withTrackDefaults` |
| **+ texto extra** | `emptyCharacter` |
| adicionar legenda | `emptyCaption` (vazio) |
| duplo clique no preview (trilha de texto) | `InlineTextEditor` (contentEditable sobre o canvas) |
| Enter | confirma; Shift+Enter = nova linha; Esc = cancela |
| arrastar miolo | `x`/`y` % |
| arrastar canto | `fontSize` |
| setas | nudge de posição (preview) |

`InlineTextEditor.js`: overlay HTML posicionado pela bbox do `layoutRegistry` (mesmas métricas do canvas). Enquanto edita, o canvas pode ocultar o texto (`hideTextIds`) para não desenhar em dobro.

Campos de estilo: `StyleFields.js` + grid `StyleThumbGrid.js` (miniaturas de preset e fonte). Capacidades por faixa em `STYLE_CAPABILITIES` — captions/ctas/characters são iguais (texto extra ainda expõe rotação).

Copiar estilo: `STYLE_KEYS` (em `timelineSnap.js`, apesar do nome — é lista de campos visuais, **não** timing/texto):

```
preset, fontSize, fontSizeMode, fontFamily, fontWeight, uppercase,
letterSpacing, lineHeight, maxWidthPct, textAlign, color, bgColor,
bgOpacity, pillRadius, stroke, shadow, autoContrast, rotation,
animation, animMs, anim, x, y, scale, enterAnim, exitAnim
```

Propagar: `applyStyleToTrack` (`stylePropagation.js`) — escopo só este / daqui em diante / todos. “Todos” também vira `styleDefaults[track]` para **próximos** inserts.

Temas built-in (`userPresets.js`): `shopee-punch`, `clean-caption`, `neon-promo`. Sessão do projeto **não** persiste; tema + styleDefaults + “meus presets” ficam em `localStorage`.

---

## 7. Biblioteca de inserts PNG

Insert bitmap = trilha `stickers`. Spec: `docs/superpowers/specs/2026-08-03-montador-stickers-png-design.md`.

### 7.1. Modelo

```js
{
  id: "stk-…",
  label: string,                 // nome do arquivo | "upload" | "colar"
  src: string,                   // URL da API  OU  blob:/dataUrl
  sourceKind: "library" | "upload" | "paste",
  libraryId: string | null,      // só se sourceKind === "library"
  start, end,                    // default duração 3s no “agora”
  x: 50, y: 78,                  // centro inferior
  scale: 0.70,                   // 0.40–2.00
  anim: { enter, emphasis, exit } // default: pop / pulse-loop / fade, 400ms
}
```

Factory: `createSticker` em `gerador/lib/compose/stickers.js`.  
Limite de sessão: **20** (`MAX_STICKERS`).  
PNG da biblioteca **não** é copiado para o store do projeto — a sessão guarda a URL `/api/compose/stickers/media/{id}`. Upload/colar usam `URL.createObjectURL` (só memória).

Draw: mesmo `drawImage` dos cards, **sem** sombra (alpha limpo). `resolveLayerStyle(..., "sticker")` só devolve posição/escala/`anim`.

### 7.2. Três origens

| Origem | Como | `src` |
|---|---|---|
| **Biblioteca** | pasta de PNGs no disco; grid no painel Stickers | `/api/compose/stickers/media/{id}` |
| **Upload** | `<input type="file" accept="image/*">` | `blob:` |
| **Colar** | `Ctrl+V` / `Cmd+V` — qualquer `clipboardData` `image/*` | `blob:` |

Regra de paste no Studio: imagem na área de transferência **sempre** vira sticker (nunca review). Sem vídeo na sessão → erro curto, não cria item.

Não há `+` vazio na trilha: insert só via biblioteca / upload / colar.

### 7.3. Biblioteca no disco

`gerador/lib/compose/stickerLibrary.js`.

- Root: `STICKER_PNG_DIR` (strip de aspas; path com espaço precisa de aspas no `.env`). Default: `../PNG` a partir do cwd `gerador/` (pasta `PNG/` na raiz do monorepo).
- Só **raiz**, só `.png` (case-insensitive). Sem subpastas, sem busca, sem categorias.
- Id estável: slug NFKD do basename + 10 chars SHA-1 do nome do arquivo (`stickerIdFromRel`). Ex.: `seta-oferta-a1b2c3d4e5`.
- Path traversal bloqueado: id não pode ter `..` `/` `\`; resolve + `startsWith` no root.

APIs (auth `requireAiAuth`):

| Rota | Papel |
|---|---|
| `GET /api/compose/stickers/library` | `{ ok, items: [{ id, name, mediaUrl }] }` — pasta vazia/ausente → `items: []` (não 500) |
| `GET /api/compose/stickers/media/[id]` | stream `image/png`, cache 1 h |

UI: painel Stickers, bloco **Biblioteca PNG** colapsável; thumb = o próprio `mediaUrl` (sem gerar JPEG). Clique no item → `createSticker({ sourceKind: "library", libraryId, src: mediaUrl })`.

Preview: `Map<stickerId, HTMLImageElement>` (`stickerImages`), hidratado quando `src` muda.

---

## 8. Animação (opcional no outro projeto)

Schema único `AnimBlock`:

```js
{
  enter:    { type, durationMs, delayMs, easing },
  emphasis: { type, durationMs, delayMs, easing },  // durationMs = período do loop
  exit:     { type, durationMs, delayMs, easing },
}
```

`f(t)` puro: `layerAnimAt(resolved, timeSec)` em `anim/eval.js` → `{ opacity, scale, dx, dy, rotate, blurPx, typeProgress, … }`. Sem `Date.now()`.

Catálogo: `anim/catalog.js` (`pop`, `fade`, `slide-*`, `pulse-loop`, `shine-sweep`, …).  
UI: `AnimPhasesPanel.js`.  
Migração legado (`animation` + `animMs`) só no `normalizeAnim` — items novos já nascem com `anim`.

Se o outro projeto **não** tiver relógio de composição, pinte com transform identidade (`opacity: 1, scale: 1`) e ignore `anim`. O restante (texto + PNG) continua válido.

Regra de pause no Studio: em `localT <= 0` a enter está **settled** (progresso 1), para o insert não nascer invisível com o playhead parado no início.

---

## 9. Layout registry e seleção

Cada frame, `drawStyledText` / `drawReview` empilha `LayoutEntry`:

```js
{ id, track, x, y, w, h, rotation, font, fontSize, color, text, zIndex }
```

`x,y,w,h` em **px do canvas 1080×1920** (não %). Hit-test com rotação: `pointInLayoutEntry`. Chrome de seleção (contorno + 4 handles) **só no preview**, nunca no record.

Mapa de nomes: `captions` ↔ `legenda`, `ctas` ↔ `cta`, `characters` ↔ `caractere`, `stickers` ↔ `sticker`.

---

## 10. O que portar (checklist)

Núcleo reutilizável, **sem timeline**:

```
gerador/lib/compose/
  layers.js              # uid, clamp, MIN/MAX_LAYER_SCALE  (activeAt opcional)
  fonts/catalog.js
  ensureFonts.js
  resolveLayerStyle.js   # + presetPaint
  styleDefaults.js       # se quiser herança / localStorage
  stylePropagation.js    # se quiser “aplicar a todos”
  userPresets.js         # temas; ou só os tokens de presetPaint
  stickers.js            # createSticker
  stickerLibrary.js      # list + resolve path
  layoutRegistry.js      # coords canvas ↔ tela, hit
  hitTest.js             # approxBox, resizePatchForTrack
  drawOverlays.js        # wrapLines, drawStyledText, drawReview(sticker), renderComposeFrame
  balancedWrap.js        # opcional

gerador/lib/captions/presets.js
  # CAPTION_PRESETS, CTA_PRESETS, FONT_*, FONT_MIN/MAX, resolveY
  # (pode extrair só as constantes; o resto é legado ASS)

gerador/components/compose/
  StyleFields.js
  StyleThumbGrid.js
  InlineTextEditor.js
  # AnimPhasesPanel.js só se for portar anim
```

APIs se houver pasta de PNGs:

```
app/api/compose/stickers/library/route.js
app/api/compose/stickers/media/[id]/route.js
```

Assets: `/fonts/compose/*.woff2` + pasta `PNG/` (ou `STICKER_PNG_DIR`).

### Deixar de fora neste recorte

| Peça | Por quê |
|---|---|
| `TimelineStrip.js`, `timelineSnap.js` (exceto `STYLE_KEYS`) | o outro projeto não tem timeline |
| `videoEdit.js`, soft-cut, Range de mídia | editor de vídeo |
| `record.js` / convert FFmpeg | pipeline de export do Studio |
| Reviews / products / seed de cards | domínio Shopee |
| Karaoke `words`, Whisper, dossiê IA | conteúdo timed |
| `activeAt` | só precisa se houver janela temporal; senão desenhe todos os inserts |

Ainda assim copie `STYLE_KEYS` de `timelineSnap.js` (ou extraia para um `styleKeys.js`) — é o contrato de cópia de estilo, não a timeline.

---

## 11. Frame mínimo para o outro projeto

Estado suficiente:

```js
{
  texts: [ /* emptyCharacter-like */ ],
  stickers: [ /* createSticker-like */ ],
}
```

Loop de preview:

1. `ensureComposeFontsReady`
2. `ensureComposeCanvas(canvas, dpr)`
3. `renderComposeFrame(ctx, { backgroundImage ou video, timeSec: 0, project: { characters: texts, stickers, captions: [], ctas: [] }, stickerImages, hideTextIds })`
4. Gestos: hit-test → drag `x`/`y` → corner `fontSize`/`scale`
5. Inserir texto = push `emptyCharacter()`; inserir PNG = `createSticker` ou item da library

Se não houver relógio, passe `timeSec` constante e `start: 0`, `end: 1e9` (ou adapte `activeAt` para sempre retornar a lista).

---

## 12. Testes do núcleo (já no repo)

```bash
cd gerador
node --test \
  lib/compose/__tests__/stickerLibrary.test.mjs \
  lib/compose/__tests__/stickers.test.mjs \
  lib/compose/__tests__/textAlign.test.mjs \
  lib/compose/__tests__/balancedWrap.test.mjs \
  lib/compose/__tests__/drawOverlays.test.mjs \
  lib/compose/__tests__/resolveLayerStyle.test.mjs \
  lib/compose/__tests__/styleDefaults.test.mjs \
  lib/compose/__tests__/hitTest.test.mjs \
  lib/compose/__tests__/layoutRegistry.test.mjs
```

---

## 13. Specs de origem

| Doc | Recorte útil |
|---|---|
| `docs/superpowers/specs/2026-07-27-montador-tipografia-anim-design.md` | schema tipografia + `presetPaint` + webfonts |
| `docs/superpowers/specs/2026-08-03-montador-stickers-png-design.md` | biblioteca / upload / colar |
| `docs/superpowers/specs/2026-07-27-montador-resize-preview-design.md` | handles de tamanho |
| `docs/superpowers/specs/2026-07-28-montador-preview-wysiwyg-design.md` | editor inline + coords |
