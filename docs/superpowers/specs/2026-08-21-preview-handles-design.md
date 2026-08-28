# Handles de rotação e E/W no preview

**Data:** 2026-08-21  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado e no ar (2026-08-21)  
**Ops:** [`docs/preview-overlays.md`](../../preview-overlays.md)  
**Não bumpa** `Composition.version` (continua **4**). Campo aditivo em `captionStyle`.  
**Não é** a Fase 3 de `docs/inserts-ui.md`.

## Objetivo

O operador gira o insert no preview (hoje só slider −30° a 30° em Estilo → Avançado) e, em texto/legenda, muda a largura de wrap pelos lados. Cantos (resize radial, centro fixo) continuam. Chrome HTML não entra no MP4. Preview = export no raster.

## Decisões

| Tema | Escolha |
| --- | --- |
| Recorte | Rotação **e** E/W na mesma fatia |
| Layout das alças | **A:** haste + círculo acima do topo; E/W = quadrados iguais aos cantos, no meio das bordas |
| E/W grava | Só texto e legenda: `maxWidthPct` (20–100). Chip e PNG **não** mostram E/W |
| Quem gira | Texto, chip, PNG e legenda nativa |
| Legenda | `captionStyle.rotation` compartilhado (girar uma linha gira todas, igual X/Y) |
| Faixa do ângulo | Livre (grau finito). Parse **não** corta em ±30° |
| Centro | Rotação e E/W mantêm o centro da caixa. E e W fazem o mesmo gesto simétrico |
| Snap | Nenhum (sem 15°) |
| Ghost | Sem alças |
| Slider −30° a 30° | Sai desta fatia. Número em Avançado continua, sem teto ±30° |
| Encoder / Fase 3 / `textAlign` | Fora |

## O que o operador vê

Caixa de seleção atual (`selection-overlay.tsx`, borda sky) **mais**:

1. Quatro cantos iguais aos de hoje (todos os kinds selecionáveis na janela de tempo).
2. Texto e **legenda**: dois quadrados E/W no meio das bordas esquerda e direita (eixo local da caixa já rotacionada).
3. Todos os kinds acima: haste vertical do meio do topo até um **círculo** (alça de girar). Sempre visível, sem hover.
4. Fora da janela de tempo: ghost tracejado, **sem** alças.

Clique no círculo gira. Clique em E/W muda wrap. Clique no canto continua fonte/escala. Clique no miolo continua mover. `stopPropagation` nas alças, como nos cantos.

## Persistência

Schema **v4**. Sem campo incompatível.

| Kind | Ângulo | E/W |
| --- | --- | --- |
| `text` | Dual-write já existente: `style.rotation` e `styleRef.overrides.text.rotation` | `maxWidthPct` no insert (já existe, 20–100) |
| `chip` | Idem, via paint do chip (`style` / factory `text.rotation`) | — |
| `sticker` | `insert.rotation` (campo top-level já opcional). `drawSticker` aplica `ctx.rotate` no centro | — |
| `caption` | `captionStyle.rotation` (novo, default **0**). `parseCaptionStyle` / `mergeCaptionStylePatch` / serialize sempre gravam | `captionStyle.maxWidthPct` (já existe) |

Regras do ângulo:

- Só persiste se `Number.isFinite`. Sem clamp ±30° em `parseInsertStyle`, factory, `mergeInsertPatch` nem no NumberInput de Avançado.
- Ausente → 0. Não normalizar para (−180, 180] nesta fatia: o gesto soma delta ao valor atual (pode passar de 360 se o operador girar várias voltas).
- IA (`lib/ai-prompt.ts` “−30 a 30”) **não** muda nesta fatia.

Undo: o snapshot `{ inserts, captionStyle }` já cobre. Primeiro giro de chip empilhado **não** grava `x`/`y` (rotação é paint, não posição livre).

## Gestos (coords do play)

O clique **nunca** usa `clientX`/`clientY` cru. Sempre `getCanvasDisplayMetrics` → `clientToPlay`.

Funções puras (novo módulo, p.ex. `lib/compose/preview-handles.ts`):

```ts
angleDegFromCenter(center: Point, pointer: Point): number
// atan2, graus. 0 = leste do centro, sentido horário no canvas (Y cresce para baixo).

rotationFromDrag(startRotation: number, startPointerDeg: number, nowPointerDeg: number): number
// startRotation + (now − start), sem wrap.

maxWidthPctFromEdgeDrag(startWidthPct: number, localDxPx: number, playW: number): number
// centro fixo: delta de meia-largura. Clamp 20–100.
```

Durante o drag: patch ao vivo (mesmo padrão do resize). Pointer up: um único commit no histórico.

E/W: o delta é no **eixo X local** da caixa (desfazer `box.rotation` no vetor ponteiro−centro). Leste e oeste aumentam/diminuem `maxWidthPct` com o centro `%` intacto.

Alças são HTML. Não alteram `drawFrame`. Rotação do **raster** (texto, chip, PNG, legenda) entra no canvas — preview e Final.

## Compositor / bbox

- `approxBox` do sticker passa a copiar `insert.rotation` (a seleção segue o PNG).
- Caption nativa: `layoutOverlayInsertForPlay` / stamp lê `captionStyle.rotation` (hoje a nativa força 0).
- Hit-test já desrotaciona por `box.rotation`; incluir o PNG nisso.
- `captionStyleToInsertStyle` deixa de cravar `rotation: 0`; usa o valor do `CaptionStyle`.

## Testes

TDD em `lib/compose/preview-handles.test.ts` (e acréscimos em `hit-test` / `caption-layout` / `composition`):

1. Giro de 90° a partir do centro: valor esperado.
2. E/W: `maxWidthPct` clampa 20 e 100; centro não muda.
3. Chip curto de overlap **não** entra aqui; PNG com `rotation: 15` → `approxBox.rotation === 15`.
4. `parseCaptionStyle({ rotation: 40 })` persiste 40; omitido → 0.
5. `parseInsertStyle({ rotation: 45 })` persiste 45 (não corta em 30).

UI: sem teste de pixel. Conferir à mão: texto, chip, PNG, duas linhas de legenda girando juntas; E/W só no texto/legenda; export rascunho mostra o mesmo ângulo.

## Fora desta fatia

- Handles N/S, `textAlign` no card, slider de `maxWidthPct` no card (o handle **é** a UI).
- Fase 3 inserts-ui, encoder, lote, D6 fps.
- Rotação interpolada de `animIn`/`loop` (já existe em `animAt.rotate`; é outra pose, não este campo).
- Restart de `editor-render` só se o Remotion importar os arquivos de draw alterados; o chrome HTML não exige.

## Aceite

1. Selecionar um texto: 4 cantos + E/W + haste/círculo. Arrastar o círculo gira o glyph e a caixa juntos, sem teto.
2. Duas legendas: girar uma aplica o mesmo ângulo nas duas; E/W muda o wrap de todas.
3. PNG gira no preview **e** no rascunho/Final.
4. Chip empilhado gira no lugar, continua na faixa.
5. Ghost sem alças. Export **não** pinta haste nem quadrados.
