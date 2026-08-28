# Preview: posição, tamanho e chips no canvas

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts  
**Status:** em produção (`editor.macmini-capture.cc`).  
**Origem:** `montador-textos-inserts.md` + spec `docs/superpowers/specs/2026-08-18-overlays-texto-png-design.md`. Enquadramento do fundo: [`enquadramento.md`](enquadramento.md).

Texto livre, PNG, ganchos (chips) e **legendas** se movem e redimensionam no preview com o mouse. Preview e export usam o **mesmo** raster no canvas 1080×1920. CSS **não** pinta insert no vídeo. Look das legendas: [`legendas.md`](legendas.md). Marca d’água: [`marca-dagua.md`](marca-dagua.md).

---

## 1. O que o operador vê

No preview (`object-contain`):

1. Clique no insert **na janela de tempo** → caixa de seleção + 4 cantos + haste/círculo de girar.
2. Fora da janela, insert ainda selecionado → **ghost** tracejado (~25% opacidade), sem alças. Selecionar na lista **move o playhead** para o `start`.
3. Arraste o miolo → move (`x`/`y` em % do frame, âncora centro).
4. Arraste um canto → redimensiona com **centro fixo** (resize radial).
5. Texto e **legenda**: arraste E/W (meio das bordas) → `maxWidthPct` (20–100), centro fixo. Chip e PNG não têm E/W.
6. Arraste o círculo acima da caixa → rotação livre (graus finitos, sem teto ±30°). Legenda nativa gira todas as linhas (`captionStyle.rotation`). PNG grava `insert.rotation`.
7. Setas ±1%; Shift+setas ±5%.
8. Snap ~8 px de tela nas bordas, no centro e nos outros inserts. **Alt** desliga o snap.

**Vídeo de fundo:** contrato em [`enquadramento.md`](enquadramento.md). Clique no vazio seleciona o Vídeo. Arrastar = pan 1:1; roda = zoom no cursor; alças = escala no canto oposto. Sem haste de girar. `x`/`y` = deslocamento do **centro** do vídeo (% do canvas; 0 = centralizado). Sem sliders no card — só **Resetar enquadramento**. Inserts não andam com o MP4. Campo `source.transform` (omitido se identidade `{1,0,0}`). Conta: `getVideoRect` em `lib/export/cover.ts`.

O chrome HTML (`components/selection-overlay.tsx`) é só preview. Não entra no MP4.

---

## 2. Sistema de coordenadas

Canvas real: **1080 × 1920** (`PLAY_W` / `PLAY_H` em `lib/compose/layout.ts`).

O clique **nunca** usa `clientX`/`clientY` cru. Sempre:

```
getCanvasDisplayMetrics(rect) → clientToPlay(clientX, clientY, metrics)
```

`object-contain` deixa letterbox. Fora da área pintada o hit é `inside: false`.

Posição persistida: **% do frame**, centro do insert, 1 casa decimal.

```
cx = (x / 100) * 1080
cy = (y / 100) * 1920
```

| Campo | Quem usa | Faixa persistida | Faixa no draw |
| --- | --- | --- | --- |
| `x` | texto, PNG, chip colocado; legendas via `captionStyle.x` | 0–100 | igual |
| `y` | texto, PNG, chip colocado; legendas via `captionStyle.y` | 0–100 | texto clampa **5–95** em `resolveLayerStyle` |
| `fontSize` | texto; chip com texto; legendas via `captionStyle.fontSize` | texto/legenda 40–360; chip 12–360 (default 13) | igual |
| `scale` | PNG, chip | 0,2–4 (3 casas) | PNG default 0,70; chip default **1** |

Patches de chip/texto/PNG passam por `mergeInsertPatch`. Look de legenda: `mergeCaptionStylePatch` em `composition.captionStyle` (não no insert).

---

## 3. Três kinds no mesmo array

`Composition.version` continua **4**. `kind` discrimina o draw.

| kind | type | Posição | Tamanho no canto |
| --- | --- | --- | --- |
| `text` | `texto-livre` | `x`/`y` sempre | canto → `fontSize` (Estilo: Tamanho da fonte) |
| `sticker` | `sticker-png` | `x`/`y` sempre | canto → `scale` (Movimento: Escala 0,2–4) |
| `chip` | um dos 10 tipos | sem `x`/`y` → empilha por `anchor`; com `x` e `y` → centro livre | canto → `scale`; letra em `fontSize` (Estilo) |
| `caption` | `legenda` | `captionStyle.x` / `.y` (todas as linhas) | canto → `captionStyle.fontSize` |

Documentos antigos sem `kind` continuam chip empilhado. Serialize de chip **omite** `x`/`y`/`scale` se não existirem.

Topo / Centro / Base no card **apaga** `x` e `y` e devolve o chip à faixa. Escala fica no card mesmo empilhado; X/Y só aparecem depois de colocado.

O lote (`applyVariationPreview`) continua permutando só `anchor` de chips. Chip com posição livre mantém `x`/`y`.

---

## 4. Ordem de pintura e hit-test

Baixo → cima:

```
vídeo
  → chips (`layoutInserts` + `drawChips`)
  → stickers PNG
  → textos
  → captions (`drawCaptionInserts`)
  → marca d’água (`drawWatermark`, se ligada)
  → chrome de seleção (preview)
  → Feed / Safe area (preview CSS, nunca no MP4)
```

Hit-test (`lib/compose/hit-test.ts`): **caption > texto > PNG > chip**. Empate no mesmo kind: o último do array. Caption/texto factory passam por `layoutOverlayInsertForPlay` antes de `approxBox` (caixa segue o paint, não o `fontSize` achatado). Hit-test **não** inclui a marca.

Chip empilhado usa a caixa de `layoutInserts` (`chipPlayBox`). Chip livre usa `measureChipSize` + centro `%`.

Primeiro resize (ou move) de chip empilhado grava `x`/`y` do centro atual — passa a ser posição livre.

Play / scrub / export interpolam `animIn`/`animOut` via `animAt` no canvas. Hit-test e a caixa de seleção usam a bbox settled.

---

## 5. Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/compose/layout.ts` | 1080×1920, métricas `object-contain`, % ↔ px |
| `lib/compose/hit-test.ts` | bbox, clique, `resizePatchForTrack` |
| `lib/compose/preview-snap.ts` | snap e nudge |
| `lib/compose/draw-chips.ts` | raster dos ganchos (preview e export) |
| `lib/compose/draw-overlays.ts` | texto + PNG |
| `lib/compose/draw-captions.ts` | karaoke; lê `captionStyle` |
| `lib/compose/anim.ts` | interpolação in/out |
| `lib/insert-layout.ts` | empilhar vs posição livre; `chipHasFreePosition` |
| `lib/export/compositor.ts` | `drawFrame` chama `drawPlayInserts` (chips → PNG → texto → captions → marca d’água) |
| `lib/watermark.ts` | bounce + `drawWatermark`; contrato [`marca-dagua.md`](marca-dagua.md) |
| `lib/export/cover.ts` | `getVideoRect` / `coverDrawRect` (enquadramento do MP4) |
| `lib/source-transform.ts` | parse `space:offset`, pan, zoom ancorado, clamp de `source.transform` |
| `lib/preview-selection.ts` | seleção `{ insert \| source }` no preview |
| `lib/compose/caption-layout.ts` | `layoutOverlayInsertForPlay` / `stampPaintedLayout` |
| `components/overlay-canvas.tsx` | canvas + gestos de insert **e** do vídeo de fundo |
| `components/selection-overlay.tsx` | caixa e cantos HTML; variante `ghost` |
| `components/insert-card.tsx` | âncora, X/Y, tamanho/escala; caption nativa grava `captionStyle` |
| `lib/composition.ts` | parse/serialize, `mergeInsertPatch`, `mergeCaptionStylePatch`, `captionInsertForLayout` |

Testes: `lib/compose/layout.test.ts`, `hit-test.test.ts`, `preview-handles.test.ts`, `preview-snap.test.ts`, `lib/compose/anim.test.ts`, `lib/insert-layout.test.ts`, `lib/compose/caption-layout.test.ts`, `lib/composition.test.ts`, `lib/export/cover.test.ts`, `lib/source-transform.test.ts`.

---

## 6. Fora desta fatia

Handles N/S, `textAlign` no card, slider de `maxWidthPct` no card (o handle E/W é a UI), auth do Studio, substituir os 10 chips por presets de texto (abordagem B). Undo: [`legendas.md`](legendas.md) e `lib/composition-history.ts`. Karaoke e look das legendas: [`legendas.md`](legendas.md). Marca d’água: [`marca-dagua.md`](marca-dagua.md). Animações interpoladas: `docs/superpowers/specs/2026-08-19-anim-canvas-design.md`. Enquadramento do MP4: [`enquadramento.md`](enquadramento.md).
