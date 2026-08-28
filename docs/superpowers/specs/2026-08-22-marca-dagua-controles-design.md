# Marca d’água — opacidade, tamanho e velocidade

**Data:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** no ar 2026-08-22 (`editor.macmini-capture.cc`). Plano em `plans/2026-08-22-marca-dagua-controles.md`.  
**Base:** [`2026-08-22-marca-dagua-design.md`](2026-08-22-marca-dagua-design.md) (já no ar).  
**Não bumpa** `Composition.version` (continua **4**). Sem encoder novo. Sem PNG.

Não confundir com `source.watermarked` (Shopee). Esta fatia só torna editáveis três constantes da marca **nossa**.

## Objetivo

O operador ajusta, com três números, a opacidade, o tamanho e a velocidade de loop da marca. Os valores são **do editor** (iguais em todos os vídeos), como o handle e o Parado|Loop. Preview, rascunho e Final pintam o mesmo raster.

## Decisões

| Tema | Escolha |
| --- | --- |
| UI | **C:** três `<input type="number">` compactos (não slider, não degraus) |
| Persistência | **A:** mesmo `localStorage` `editor.watermark.v1` |
| Velocidade | **A:** um multiplicador. `1` = bounce atual (90 / 110 px/s). Eixos juntos |
| Por vídeo | Só o checkbox **Marca**. Os números não entram na composição |
| Undo | Continua **só** o toggle. Números = handle (sem histórico) |
| Novo projeto | **Não** zera os números |
| Schema / PNG / cor / X·Y separados / checklist | Fora |

## O que o operador vê

Segunda linha **dentro** de `WatermarkRow`, abaixo de Marca / handle / Parado|Loop. Mesmo card, nos dois estados (vídeo pronto e dashed vazio). Sem parágrafo de ajuda.

```
Opac. [22] %    Tam. [42]    Vel. [1] ×
```

| Campo | Atributos | `aria-label` |
| --- | --- | --- |
| Opac. | `min=8` `max=50` `step=1` | Opacidade da marca d'água |
| Tam. | `min=24` `max=80` `step=1` | Tamanho da marca d'água |
| Vel. | `min=0.25` `max=3` `step=0.25` | Velocidade da marca d'água |

- **Vel.** fica `disabled` quando Parado. O valor permanece no storage; ligar Loop de novo usa o mesmo número.
- Campo number vazio enquanto digita: **não** grava `NaN`.
- `onChange` só commita se o número for finito **e** estiver em `[min, max]` (digitar `2` de `22` não vira `8`).
- No `blur`: vazio / inválido restaura o persistido; finito fora da faixa (ou `1.1` de Vel.) commita e o campo mostra o valor canônico (`3` → `8`, `1.1` → `1`).
- Clique nos números já está coberto por `closest("…, input, …")` — não seleciona o Vídeo.

## Persistência

Chave inalterada: `editor.watermark.v1`. Campos **aditivos**. JSON antigo `{ text, loop }` continua válido.

```ts
type WatermarkPrefs = {
  text: string
  loop: boolean
  opacityPct: number  // 8–50, inteiro
  fontPx: number      // 24–80, inteiro, px no quadro 1080
  speed: number       // 0,25–3, passo 0,25
}

const DEFAULT_WATERMARK_PREFS: WatermarkPrefs = {
  text: "",
  loop: true,
  opacityPct: 22,
  fontPx: 42,
  speed: 1,
}
```

`normalizeWatermarkPrefs`:

1. Texto e `loop` como hoje (trim, `\n` → espaço, máx. 40, loop default `true`).
2. `opacityPct`: se não for number finito → **22**. Senão `clamp(round(n), 8, 50)`.
3. `fontPx`: se não for number finito → **42**. Senão `clamp(round(n), 24, 80)`.
4. `speed`: se não for number finito → **1**. Senão `clamp(round(n / 0.25) * 0.25, 0.25, 3)`.

JSON lixo / ausente → default completo (incluindo os três números). Falha ao gravar → `console.warn` já existente; memória segue.

`ControlPanel` default de `watermarkPrefs` passa a ser `DEFAULT_WATERMARK_PREFS` (não `{ text: "", loop: true }`).

## Snapshot de pintura / export

`WatermarkPaint` ganha os mesmos três campos. `watermarkPaintInput` copia prefs **já normalizadas** (enabled + texto não vazio):

```ts
{ text, loop, opacityPct, fontPx, speed }
```

O Mac não lê `localStorage`. Preview (`OverlayCanvas`), rascunho (`ExportOptions.watermark`) e Final (`toRenderProps` → `RenderProps.watermark`) recebem esse objeto.

`sanitizeWatermark` no render-server:

- `text` / `loop` inválidos ou texto vazio → omite **todo** o `watermark` (igual hoje; o job não cai).
- Objeto válido: `text` + `loop` + `opacityPct` / `fontPx` / `speed` **normalizados**. Campo visual lixo ou ausente → default, **não** descarta a marca.

`toCliRenderProps` continua espalhando `...props`.

## Pintura

Constantes-base (em `speed === 1`) permanecem:

```
WATERMARK_MARGIN_PX = 48
WATERMARK_SPEED_X = 90
WATERMARK_SPEED_Y = 110
```

`drawWatermark`:

- `globalAlpha = paint.opacityPct / 100`
- fonte `800 ${paint.fontPx}px Geist`
- altura da caixa de bounce = `paint.fontPx` (não bounding box da fonte)
- `watermarkCenter(t, frame, box, loop, speed)` com `speed` default **1** (testes antigos sem o 5º arg continuam no bounce atual)
- ping-pong: `WATERMARK_SPEED_X * speed` e `WATERMARK_SPEED_Y * speed`
- `t = 0` continua no canto inferior direito, qualquer `speed` (`pingPong` com `u = 0` → `max`)
- paint parcial (só `text` + `loop`) pinta com defaults visuais — snapshots velhos não quebram
- texto vazio / `null` → no-op

`loop === false` ignora `speed` na posição (canto estático). O campo na UI só está desabilitado.

## Fluxo

```
editor.watermark.v1 { text, loop, opacityPct, fontPx, speed }
        + composition.watermarkEnabled
                    ↓
        snapshot WatermarkPaint?   (enabled && text)
                    ↓
 OverlayCanvas / drawFrame / InsertRenderer → drawWatermark
```

`handleWatermarkPrefs` já faz `normalize` + `save`. Estender o objeto; **não** passar pelos três números em `historyPresent`.

## Arquivos (delta)

| Arquivo | Mudança |
| --- | --- |
| `lib/watermark.ts` | tipos, clamp, `watermarkCenter` 5º arg, `drawWatermark` lê paint |
| `lib/watermark.test.ts` | clamp, JSON antigo, `2×` vs `1×` no mesmo `t`, `t=0` |
| `lib/watermark-store.test.ts` | round-trip dos três campos |
| `remotion/types.ts` + testes | snapshot inclui os três |
| `render-server/props.ts` + testes | visual lixo → default, não dropa a marca |
| `components/background-source-card.tsx` | segunda linha de numbers |
| `components/control-panel.tsx` | default `DEFAULT_WATERMARK_PREFS` |
| `components/video-editor.tsx` | sem lógica extra além do prefs já existente |

`draw-play`, compositor, encoder, overlay: já recebem `WatermarkPaint`; só o conteúdo do objeto muda.

## Erros

| Caso | Comportamento |
| --- | --- |
| Prefs `{ text, loop }` de antes | Números = 22 / 42 / 1 |
| `opacityPct: "x"` no storage | 22 |
| `speed: 0` / negativo | 0,25 |
| `speed: 9` | 3 |
| `fontPx: 12.7` | 24 (round 13 → clamp 24) |
| Input number vazio | Não grava; blur restaura |
| Parado + Vel. 2 | Storage 2; posição estática; Loop volta a 2× |
| `source.watermarked` | Intocado |

## Testes

TDD, estender os arquivos já citados:

1. `normalizeWatermarkPrefs({ text: "@a" })` preenche 22 / 42 / 1 e `loop: true`.
2. Clamp: `opacityPct: 3` → 8; `99` → 50; `fontPx: 12.7` → 24; `speed: 1.1` → 1; `speed: 1.2` → 1,25; `0` → 0,25.
3. `watermarkCenter(t, …, true, 2)` no eixo X, com `t` pequeno o bastante para não wrappar: deslocamento a partir do canto = **2×** o de `speed 1`.
4. `watermarkCenter(0, …, true, 2)` = canto estático.
5. `watermarkPaintInput(true, prefsCompletas)` inclui os três campos.
6. `toRenderProps` com enabled + texto copia os três (não só `text`/`loop`).
7. `parseRenderProps` com `{ text, loop, opacityPct: "x" }` **mantém** a marca, `opacityPct === 22`.
8. Store: save `{ text: "@a", loop: true, opacityPct: 30, fontPx: 50, speed: 2 }` → load igual.

## Fora desta fatia

- PNG / cor / tile
- Slider ou degraus (foi rejeitado)
- Velocidade X e Y separadas
- Aviso no checklist de export
- Bump de schema, encoder novo, Fase 3
- Remover watermark da Shopee
