# Animações no canvas — `animIn` / `animOut`

**Data:** 2026-08-19  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado (aguardando publish)  
**Não bumpa** `Composition.version` (continua `2`).  
**Depende:** compositor único (`drawFrame`) e schema `animIn` / `animOut` da Onda 1.

Os campos já existem no JSON e no card (aba Movimento). O canvas pinta o insert
settled o tempo todo. Esta fatia interpola os 6 presets no **mesmo** raster de
preview e export.

---

## Objetivo

Play, scrub e export mostram o frame real da animação em chip, texto livre e
PNG. A caixa de seleção e o hit-test usam a bbox **settled**.

Fora: `AnimBlock` do Studio, duração editável, presets novos, loop no miolo,
undo, handle de rotação, fontes novas, tipos novos, lote, download.

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Catálogo | Os 6 IDs atuais: `none`, `pop`, `slide-up`, `blur-in`, `typewriter`, `shake` |
| Duração | Tempos fixos iguais ao CSS. Se entrada + saída não cabem, as duas encolhem na mesma proporção |
| Saída | Reverso do preset de `animOut` (independente de `animIn`) |
| Pause / scrub / export | Frame real em `t`. Hit-test e chrome de seleção = bbox settled |
| Schema | Sem campo novo. Sem bump de versão |
| `prefers-reduced-motion` | Ignorado no canvas (preview = MP4) |

---

## Arquitetura

Função pura, sem React e sem I/O:

```ts
animAt(insert, time) → AnimPose
```

```ts
interface AnimPose {
  opacity: number     // 1
  scale: number       // 1
  dx: number          // 0, px do canvas 1080×1920
  dy: number          // 0
  blurPx: number      // 0
  clipProgress: number // 1 = tudo visível; 0 = recortado 100% à direita
}
```

`Date.now()` é proibido. Só `insert.start`, `insert.duration`, `insert.animIn`,
`insert.animOut` e `time`.

Layout (`layoutInserts`, hit-test, snap) **não** lê a pose. O draw settled
continua igual; a pose entra só como transform no `ctx` no centro settled.

### Janelas

```
localT = time - insert.start
```

O insert só pinta se `start <= time < start + duration` (já é a regra atual).

Durações nominais (`ANIM_DURATION_SEC`):

| ID | s |
| --- | --- |
| `none` | 0 |
| `pop` | 0,45 |
| `slide-up` | 0,40 |
| `blur-in` | 0,45 |
| `typewriter` | 0,60 |
| `shake` | 0,50 |

Compressão (nunca sobrepor entrada e saída):

```
inDur  = ANIM_DURATION_SEC[animIn]
outDur = ANIM_DURATION_SEC[animOut]
if inDur + outDur > duration:
  k = duration / (inDur + outDur)
  inDur  *= k
  outDur *= k
```

Se um lado é `none` (0 s), o outro não encolhe enquanto couber no insert.

Fase:

```
se inDur > 0 e localT < inDur           → entrada, p = localT / inDur
senão se outDur > 0 e localT >= duration - outDur
                                        → saída,   p = (localT - (duration - outDur)) / outDur
senão                                   → settled (identidade)
```

`p` clampa em `[0, 1]`. Na saída, o preset corre no **reverso** (ver abaixo).
Com insert curto e as duas fases comprimidas, o miolo tem largura 0: o instante
`localT === inDur` cai na saída com `p = 0`, que é identidade.

---

## Presets

Easing por segmento de keyframe, como o CSS:

- `pop`: `cubic-bezier(0.34, 1.56, 0.64, 1)` em cada trecho
- `slide-up` e `blur-in`: `ease-out` = `cubic-bezier(0, 0, 0.58, 1)`
- `shake`: `ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)`
- `typewriter`: `steps(18, end)` — em `p < 1`, `floor(p * 18) / 18`; em `p = 1`, `1`

Porcentagens de keyframe são tempo **linear** da fase. O easing interpola
**dentro** de cada trecho (0→60%, 60%→100%, etc.).

### Entrada (`p` 0→1)

**pop**

| t linear | scale | opacity |
| --- | --- | --- |
| 0% | 0,6 | 0 |
| 60% | 1,08 | 1 |
| 100% | 1 | 1 |

**slide-up:** `dy` 14→0, opacity 0→1.  
**blur-in:** `blurPx` 8→0, opacity 0→1.  
**typewriter:** `clipProgress` 0→1 em 18 degraus; opacity 1.  
**shake:** `dx` nos keyframes 0% / 20% / 40% / 60% / 80% / 100% = 0, −4, 4, −3, 3, 0; opacity 1.  
**none:** identidade.

`14`, `8`, `4`, `3` são px do canvas 1080×1920. O preview usa `object-contain`
no canvas inteiro; export e preview batem.

### Saída (reverso)

A saída usa o mesmo keyframe com progresso `1 - p` no campo de movimento, e
opacity indo para 0 quando o preset de entrada também ia de 0→1.

| Preset | Saída |
| --- | --- |
| `pop` | scale e opacity dos keyframes com `p` invertido (encolhe e some) |
| `slide-up` | `dy` 0→14, opacity 1→0 |
| `blur-in` | `blurPx` 0→8, opacity 1→0 |
| `typewriter` | `clipProgress` 1→0 em 18 degraus (some da direita para a esquerda) |
| `shake` | `dx` com os mesmos keyframes da entrada (treme de novo, `p` 0→1) **e** opacity 1→0 (senão não some) |
| `none` | identidade; corte seco no fim da janela do insert |

`animIn` e `animOut` são independentes: pop na entrada e slide-up na saída é
válido. Cada fase avalia só o ID daquela fase.

---

## Apply no canvas

Ordem, no **centro settled** `(cx, cy)`:

1. `ctx.save()`
2. `translate(cx, cy)`
3. `translate(dx, dy)`
4. `scale(scale, scale)`
5. `globalAlpha *= styleOpacity * pose.opacity` (chips: `paint.opacity`)
6. se `blurPx > 0`: `ctx.filter = blur(${blurPx}px)`
7. se `clipProgress < 1`: clip retângulo settled, origem no canto esquerdo,
   largura `settledWidth * clipProgress`, altura `settledHeight` (coords locais
   após o translate ao centro: `x = -w/2`, `y = -h/2`)
8. draw atual (já traduz de volta ao canto se precisar)
9. `ctx.restore()`

Rotação do estilo (aba Estilo) permanece no draw atual; a animação **não** soma
ângulo.

Hit-test, snap, arraste e `selection-overlay` ignoram a pose.

---

## Integração

`drawFrame(ctx, video, composition, time, …)` já recebe `time`.

| Unidade | Faz |
| --- | --- |
| `lib/compose/anim.ts` | `ANIM_DURATION_SEC`, easing, `animAt` |
| `lib/insert-layout.ts` | `ChipLayout` ganha `start`, `duration`, `animIn`, `animOut` (cópia do insert). Caixa settled **não** muda |
| `lib/compose/draw-chips.ts` | `drawChips(ctx, chips, time, …)`; `animAt` + apply (save/restore **por fora** do draw atual, para não brigar com a rotação do estilo) |
| `lib/compose/draw-text.ts` | `drawStyledText(ctx, insert, frame, brandFontId, time)`; apply no centro do bloco |
| `lib/compose/draw-overlays.ts` | passa `time` ao texto e ao PNG; apply no PNG no centro da imagem |
| Hit-test / overlay HTML | intocado |

CSS `.ins-*` em `app/globals.css` pode ficar. O canvas não lê essas classes.

Typewriter em chip e PNG usa o mesmo clip no retângulo settled.

Blur usa `ctx.filter`. Caminho de MP4 já é Chrome/Edge; sem fallback.

---

## Persistência e UI

Nada muda no card, no parse ou no serialize. Projetos antigos com `animIn: "pop"`
passam a **mostrar** o pop (antes o campo era ignorado no canvas). Isso é o
comportamento desejado, não uma migração.

---

## Testes

`lib/compose/anim.test.ts`, sem canvas:

- Miolo (depois da entrada, antes da saída) → identidade
- `pop` em `time === start` → `scale < 1` e `opacity < 1`
- `pop` em `time === start + 0,45` (insert longo) → identidade
- Último instante visível com `animOut: "pop"` → `scale < 1` e `opacity < 1`
- Insert 0,5 s com pop+pop → `inDur + outDur === 0,5`; nunca os dois ativos; no meio (`localT = 0,25`) identidade
- `animIn: "none"` + `animOut: "pop"` em insert 0,5 s → entrada não comprime; `outDur === 0,45`
- Typewriter: 18 valores distintos de `clipProgress` no intervalo aberto; `p = 1` → `1`
- Shake na entrada: `opacity === 1` o tempo todo
- `none`/`none` → identidade em qualquer `localT` interno

Draw/hit-test existentes continuam passando (bbox settled).

---

## Fora desta fatia

- `AnimBlock` (enter / emphasis / exit com `durationMs`)
- Duração ou easing no card
- Presets novos (`fade`, `slide-down`, …)
- Loop / ênfase no miolo
- Handle de rotação, handles E/W, undo
- Fontes novas, tipos novos, lote, pipeline de download
- Honrar `prefers-reduced-motion` no canvas
