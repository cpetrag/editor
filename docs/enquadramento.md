# Enquadramento do vídeo de fundo

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** em produção (`editor-video` :4013 + `editor-render` :4014).  
**Schema:** `Composition.version` **4** (campo aditivo; não bumpa).  
**Spec antiga (âncora 50/50, sliders):** [`superpowers/specs/2026-08-21-source-transform-design.md`](superpowers/specs/2026-08-21-source-transform-design.md) — **substituída** por este contrato.

Uma transformação só, do primeiro ao último frame. Sem keyframe, sem Ken Burns, sem enquadramento por trecho. Inserts (texto, chip, PNG, legenda) ficam no frame 9:16 e **não** andam com o MP4.

---

## 1. O que o operador vê

Com origem pronta (`hasPlayableSource`):

1. Clique no vazio **dentro** do frame 9:16 → seleciona o **Vídeo**. Arrastar o miolo **move** o vídeo 1:1 com o cursor.
2. Clique num insert → o insert ganha, como sempre (caixa, cantos, haste, E/W se couber).
3. Vídeo selecionado: borda no frame 1080×1920, quatro alças nos cantos, **sem** haste de girar e **sem** E/W. `aria-label` **Enquadrar vídeo**. Cursor `grab` / `grabbing`.
4. **Roda do mouse** (e pinch de trackpad com Ctrl no `wheel`) dá zoom **ancorado no cursor** — o ponto sob o ponteiro fica parado.
5. Alça de canto: escala com proporção travada, âncora no **canto oposto do retângulo do vídeo**. **Alt** ancora no centro do frame.
6. **Shift** no arraste trava no eixo dominante (só X ou só Y).
7. Perto do centro (`|x|` ou `|y|` &lt; 0,6 %) prende em 0 e mostra guia. **Alt** desliga o snap.
8. Durante o arraste aparece a **safe area** (mesmo overlay CSS do botão Safe; não entra no MP4).
9. Duplo clique no vazio do vídeo, ou **Resetar enquadramento**, volta ao cover centralizado.
10. Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z: um arraste inteiro (ou um gesto de roda até soltar) = **um** passo de undo.

### Card Origem

No quadro do nome do vídeo, coluna da direita, nesta ordem:

1. **Trocar**
2. **Limpar inserts**
3. **Resetar enquadramento** — desabilitado no default (`source.transform` ausente)

Na **coluna do nome**, duas linhas de marca d’água (contrato: [`marca-dagua.md`](marca-dagua.md)): **Marca / handle / Loop** e **Opac. / Tam. / Vel.** Checkbox **Marca** é deste vídeo; o resto é global (`editor.watermark.v1`).

**Não há** campos Escala / X / Y. Ajuste só no preview (e teclado). Clique no card (fora de botões, links, **input, label, textarea**) também seleciona o Vídeo.

**Trocar** MP4 zera o enquadramento. Restaurar origem anterior devolve o transform antigo. **Limpar inserts** e **Novo projeto** seguem [`novo-projeto.md`](novo-projeto.md); Limpar inserts **não** mexe no enquadramento.

### Teclado (vídeo selecionado)

| Tecla | Efeito |
| --- | --- |
| Setas | move **1 px** de canvas |
| Shift+setas | **10 px** |
| Delete / Backspace | **não** apaga a origem |

---

## 2. Modelo de estado (fonte única)

```ts
type Framing = {
  scale: number  // 1..4; 1 = cover que preenche o canvas
  x: number      // deslocamento do CENTRO do vídeo, % da largura do canvas; 0 = centralizado
  y: number      // idem na altura
}
const DEFAULT_FRAMING = { scale: 1, x: 0, y: 0 }
```

`SourceTransform` é alias de `Framing`. Nada de pixels de preview no JSON. Preview, rascunho e Final leem os **mesmos** três números.

Identidade (`1, 0, 0`) **omite** `source.transform` no serialize. Ausente = default.

---

## 3. Geometria (uma função)

`getVideoRect(framing, VW, VH, CW = 1080, CH = 1920)` em `lib/export/cover.ts`. `coverDrawRect` é wrapper com a ordem antiga de argumentos.

```
baseScale = max(CW / VW, CH / VH)     // cover: preenche sem barras
eff       = baseScale * framing.scale
drawW     = VW * eff
drawH     = VH * eff
centerX   = CW / 2 + (framing.x / 100) * CW
centerY   = CH / 2 + (framing.y / 100) * CH
left      = centerX - drawW / 2
top       = centerY - drawH / 2
```

Depois o clamp: se `drawW ≥ CW`, `|offsetX|` não deixa aparecer preto (`dx ∈ [CW - drawW, 0]`); se `drawW < CW`, força centro. Idem em Y. Com `MIN = 1` o cover já garante preenchimento; o único knobs para zoom-out com barras é `FRAMING_SCALE_MIN`.

`evenRenderRect` arredonda largura/altura para par (ffmpeg) e recalcula o offset. Preview vs esse rect: **±1 px** (`lib/export/cover.test.ts`). O Final atual **não** usa ffmpeg: Remotion `Short` e o rascunho canvas chamam `getVideoRect`.

Mouse → canvas: `getCanvasDisplayMetrics` + `pointerInPlay` / `clientToPlay`. `k` = `displayScale` = largura pintada / 1080, via `ResizeObserver` do stage (não `window.resize`). Delta de arraste **nunca** em pixels de tela crus: `x += (dxCanvas / CW) * 100`.

---

## 4. Gestos e performance

Pointer Events (não `mouse*`). `setPointerCapture` no pan.

| Gesto | Matemática |
| --- | --- |
| Pan | `x += (dxCanvas / CW) * 100` (vídeo segue a mão) |
| Roda | `factor = exp(-deltaY * 0.0015)`; pinch (`ctrlKey`) usa `0.003`. Zoom em torno do ponto do cursor (`scaleSourceTransformAt`) |
| Alça | fator = dist(ponteiro, pivô) / dist inicial; pivô = canto oposto do **vídeo**; Alt = centro do frame |
| Snap | depois do clamp; `FRAMING_CENTER_SNAP = 0.6` |

Durante `pointermove` / roda: **não** commita o composition a cada evento. Mutação de `ref` + `element.style` no wrapper `[data-source-framing]` (dentro do Player Remotion) coalescida em `requestAnimationFrame`. Commit no `pointerup` (ou debounce ~140 ms na roda) = um passo de undo (`beginInsertGesture` / `endInsertGesture`). O `<video>` **não** é remontado.

O `PreviewPanel` está em `memo` para o live do arraste não regravar o estilo do Remotion por cima da mutação DOM.

---

## 5. Persistência e migração

JSON (memória **sem** `space`):

```json
"transform": { "scale": 1.5, "x": -8, "y": 4, "space": "offset" }
```

| Disco | Significado |
| --- | --- |
| `space: "offset"` (gravação atual) | `x`/`y` = deslocamento do centro; 0 = centro |
| sem `space` (fatia 2026-08-21) | `x`/`y` = âncora 0–100 (ponto da origem no centro do frame; default 50/50). `parseSourceTransform` converte usando `source.width` / `.height` |

Identidade antiga `{ scale: 1, x: 50, y: 50 }` vira omitido. Identidade nova `{ 1, 0, 0 }` idem.

`Trocar` MP4: callers de `commitReadySource` **não** copiam `transform`. `previousSource` é o objeto inteiro.

---

## 6. Preview, rascunho, Final

| Superfície | Onde |
| --- | --- |
| Conta | `lib/export/cover.ts` (`getVideoRect`) |
| Parse / serialize / pan / zoom / clamp / snap | `lib/source-transform.ts` |
| Schema | `lib/composition.ts` (`parseSource`, `serializeSourceTransform`) |
| Undo | `HistorySnapshot.sourceTransform` |
| Preview | Remotion Player (`remotion/Short.tsx`) + chrome em `overlay-canvas.tsx` |
| Rascunho | `drawVideoCover` em `lib/export/compositor.ts` |
| Final | o mesmo `Short` no `editor-render` :4014 |

Mudou `remotion/` → rebuild Next **e** `pm2 restart editor-render`. Só UI do card → só `editor-video`.

---

## 7. Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/export/cover.ts` | `getVideoRect`, `evenRenderRect`, `coverDrawRect`, `Framing` |
| `lib/source-transform.ts` | parse (`space`), serialize, pan, `scaleSourceTransformAt`, nudge 1 px, clamp |
| `lib/composition.ts` | grava `transform` + `space: "offset"`; omite identidade |
| `lib/composition-history.ts` | snapshot `sourceTransform` |
| `lib/preview-selection.ts` | `{ kind: "source" }` |
| `remotion/Short.tsx` | wrapper `[data-source-framing]` com o rect |
| `lib/export/compositor.ts` | rascunho |
| `components/overlay-canvas.tsx` | pan, roda, alças, rAF, undo no pointerup |
| `components/selection-overlay.tsx` | borda e cantos do frame |
| `components/background-source-card.tsx` | Resetar enquadramento (abaixo de Limpar inserts) |
| `components/preview-panel.tsx` | safe area durante o arraste |
| `components/video-editor.tsx` | `patchSourceTransform` discrete/gesture |

Testes: `lib/export/cover.test.ts` (inclui ±1 px), `lib/source-transform.test.ts`, `lib/composition.test.ts`, `remotion/types.test.ts`.

---

## 8. Fora deste contrato

- Keyframes / Ken Burns / enquadramento por trecho
- Sliders Escala / X / Y no card
- Guardar pixels de preview no JSON
- Duplicar a fórmula entre preview e render
- `mouse*` events / `window.resize`
- Substituir o Remotion Player por um `<video>` HTML 1080×1920 (remontaria o playback)
- Pipeline ffmpeg `overlay=` no Final (existe `evenRenderRect` se um dia entrar)
- Zoom-out com barras pretas (`FRAMING_SCALE_MIN` continua 1)
