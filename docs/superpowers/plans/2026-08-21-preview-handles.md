# Preview handles (rotação + E/W) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Não é git repo: **não commit**. Spec: [`docs/superpowers/specs/2026-08-21-preview-handles-design.md`](../specs/2026-08-21-preview-handles-design.md).

**Goal:** Alça de girar (haste + círculo) em texto, chip, PNG e legenda nativa; E/W só em texto/legenda gravando `maxWidthPct`; ângulo livre; schema v4 aditivo.

**Architecture:** Matemática pura em `lib/compose/preview-handles.ts`. Chrome HTML em `selection-overlay.tsx` (não entra no MP4). Gestos em `overlay-canvas.tsx` no mesmo padrão move/resize (`clientToPlay`). Raster: `drawSticker` + `captionStyle.rotation` + overlay de `insert.rotation` no paint factory. Preview = export.

**Tech Stack:** TypeScript, `node --experimental-strip-types --test`, React client, canvas 1080×1920.

**Não fazer:** git commit, encoder, Fase 3, slider de `maxWidthPct` no card, IA prompt, snap 15°, handles N/S.

---

## File map

| Arquivo | Papel |
| --- | --- |
| Create: `lib/compose/preview-handles.ts` | `angleDegFromCenter`, `rotationFromDrag`, `localPoint`, `maxWidthPctFromEdgeDrag` |
| Create: `lib/compose/preview-handles.test.ts` | TDD da matemática |
| Modify: `lib/compose/insert-style.ts` | parse sem clamp ±30° |
| Modify: `lib/compose/insert-style.test.ts` | 45 persiste; −90 persiste |
| Modify: `lib/composition.ts` | `CaptionStyle.rotation`, parse/merge/serialize, `captionInsertForLayout` |
| Modify: `lib/composition.test.ts` | round-trip `captionStyle.rotation` |
| Modify: `lib/compose/hit-test.ts` | `approxBox` do sticker copia `rotation` |
| Modify: `lib/compose/hit-test.test.ts` | PNG `rotation: 15` |
| Modify: `lib/insert-layout.ts` | `chipPlayBox.rotation`; factory honra `insert.rotation` |
| Modify: `lib/style/caption-map.ts` | `rotation: style.rotation` |
| Modify: `lib/style/editor-style.ts` | overlay `insert.rotation` como já faz com x/y/fontSize |
| Modify: `lib/compose/caption-layout.ts` | patch `text.rotation` nas factory captions |
| Modify: `lib/compose/draw-overlays.ts` | `ctx.rotate` no PNG |
| Modify: `components/selection-overlay.tsx` | E/W + haste/círculo |
| Modify: `components/overlay-canvas.tsx` | modos `rotate` e `ew` |
| Modify: `components/video-editor.tsx` | `captionLookFromPatch` / `captionLookFromStylePath` com `rotation` |
| Modify: `components/style-customize-panel.tsx` | NumberInput sem min/max −30/30 |
| Modify: `components/insert-style-panel.tsx` | range −30/30 vira número sem teto |
| Modify: `package.json` | incluir o teste novo |
| Modify: `docs/preview-overlays.md`, `docs/proximo.md` | ops |

---

### Task 1: Matemática dos gestos

**Files:**
- Create: `lib/compose/preview-handles.ts`
- Create: `lib/compose/preview-handles.test.ts`
- Modify: `package.json` (script `test`)

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  angleDegFromCenter,
  rotationFromDrag,
  localPoint,
  maxWidthPctFromEdgeDrag,
} from "./preview-handles.ts"

test("angleDegFromCenter: leste = 0, sul = 90 (Y para baixo)", () => {
  assert.equal(angleDegFromCenter({ x: 0, y: 0 }, { x: 10, y: 0 }), 0)
  assert.equal(angleDegFromCenter({ x: 0, y: 0 }, { x: 0, y: 10 }), 90)
})

test("rotationFromDrag soma o delta e unwrap de ±180", () => {
  assert.equal(rotationFromDrag(10, 0, 45), 55)
  const crossed = rotationFromDrag(0, 170, -170)
  assert.ok(Math.abs(crossed - 20) < 1e-6)
})

test("maxWidthPctFromEdgeDrag: E aumenta com +localX; W com −localX; clampa 20–100", () => {
  assert.equal(maxWidthPctFromEdgeDrag(50, 54, 1080, "e"), 60)
  assert.equal(maxWidthPctFromEdgeDrag(50, -54, 1080, "w"), 60)
  assert.equal(maxWidthPctFromEdgeDrag(84, 5000, 1080, "e"), 100)
  assert.equal(maxWidthPctFromEdgeDrag(30, -5000, 1080, "e"), 20)
})

test("localPoint desfaz a rotação da caixa", () => {
  const p = localPoint({ x: 0, y: 0 }, { x: 0, y: 10 }, 90)
  assert.ok(Math.abs(p.x - 10) < 1e-6)
  assert.ok(Math.abs(p.y) < 1e-6)
})
```

Fórmula E/W (centro fixo, alça acompanha o ponteiro): `widthPct += 2 * signedDx / playW * 100`. East: `signedDx = localDx`. West: `signedDx = -localDx`. 54 px → `2*54/1080*100 = 10`.

- [ ] **Step 2: Run test — expect ERR_MODULE_NOT_FOUND**

```
node --experimental-strip-types --test lib/compose/preview-handles.test.ts
```

- [ ] **Step 3: Implement `preview-handles.ts`**

```ts
import type { Point } from "./hit-test.ts"

export function angleDegFromCenter(center: Point, pointer: Point): number {
  return (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI
}

function unwrapDelta(fromDeg: number, toDeg: number): number {
  let delta = toDeg - fromDeg
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

export function rotationFromDrag(
  startRotation: number,
  startPointerDeg: number,
  nowPointerDeg: number,
): number {
  return startRotation + unwrapDelta(startPointerDeg, nowPointerDeg)
}

export function localPoint(center: Point, pointer: Point, rotationDeg: number): Point {
  const dx = pointer.x - center.x
  const dy = pointer.y - center.y
  const rad = (-rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

export function maxWidthPctFromEdgeDrag(
  startWidthPct: number,
  localDxPx: number,
  playW: number,
  edge: "e" | "w",
): number {
  const signed = edge === "e" ? localDxPx : -localDxPx
  const next = startWidthPct + ((2 * signed) / playW) * 100
  return Math.min(100, Math.max(20, next))
}
```

- [ ] **Step 4: Tests pass. Add file to `package.json` `test` script.**

---

### Task 2: Parse — ângulo livre + `captionStyle.rotation`

**Files:** `lib/compose/insert-style.ts`, `lib/compose/insert-style.test.ts`, `lib/composition.ts`, `lib/composition.test.ts`

- [ ] **Step 1: Change the existing clamp test**

In `insert-style.test.ts` the case `rotation: -90` expects `-30`. Change expect to `-90`. Add:

```ts
test("parseInsertStyle keeps rotation beyond ±30", () => {
  assert.equal(parseInsertStyle({ rotation: 45 })?.rotation, 45)
})
```

Add in `composition.test.ts`:

```ts
test("parseComposition reads captionStyle.rotation; omitido vira 0", () => {
  const withRot = parseComposition({
    ...sampleComposition({ captionStyle: { ...DEFAULT_CAPTION_STYLE, rotation: 40 } }),
  })
  assert.equal(withRot.captionStyle.rotation, 40)
  const parsed = parseComposition({ ...sampleComposition() })
  assert.equal(parsed.captionStyle.rotation, 0)
})
```

- [ ] **Step 2: Run — insert-style fails on −30 vs −90**

- [ ] **Step 3: Implement**

`parseInsertStyle`: `parsed.rotation = rotation` (finite), no clamp.

`CaptionStyle`: `rotation: number`. `DEFAULT_CAPTION_STYLE.rotation = 0`. `mergeCaptionStylePatch`: se finite, grava; senão 0. `parseCaptionStyle` lê `raw.rotation`. `captionInsertForLayout` usa `rotation: style.rotation` no `style`. `serializeComposition` já dumpa o objeto `captionStyle`.

- [ ] **Step 4: Tests pass (update any fixture that lacks `rotation` if TS quebra).**

---

### Task 3: Bbox segue o giro (PNG + chip)

**Files:** `lib/compose/hit-test.ts`, `lib/compose/hit-test.test.ts`, `lib/insert-layout.ts`

- [ ] **Step 1: Failing tests**

```ts
test("approxBox for sticker copies insert.rotation", () => {
  const box = approxBox(stickerInsert({ rotation: 15, scale: 0.7 }))
  assert.equal(box?.rotation, 15)
})
```

(`stickerInsert` already exists in that file.)

- [ ] **Step 2: Run — `rotation` undefined**

- [ ] **Step 3:** `approxBox` sticker: `rotation: insert.rotation ?? 0`. Chip livre: `rotation: insert.rotation ?? insert.style?.rotation`. `chipPlayBox` inclui `rotation: chip.paint.rotation`. `chipFactoryLook` / paint final: se `typeof insert.rotation === "number"`, usa esse valor (overlay do preview, como fontSize).

- [ ] **Step 4: Tests pass.**

---

### Task 4: Raster — PNG e legenda nativa

**Files:** `lib/compose/draw-overlays.ts`, `lib/style/caption-map.ts`, `lib/style/editor-style.ts`, `lib/compose/caption-layout.ts`

- [ ] **Step 1:** Test caption layout copies rotation (extend `caption-layout.test.ts`):

```ts
test("layoutOverlayInsertForPlay stamps captionStyle.rotation", () => {
  const laid = layoutOverlayInsertForPlay(
    caption(),
    { ...DEFAULT_CAPTION_STYLE, rotation: 12 },
    "viral",
    null,
    {},
  )
  assert.equal(laid.style?.rotation, 12)
})
```

- [ ] **Step 2: Fail (hoje crava 0)**

- [ ] **Step 3:** `captionStyleToInsertStyle`: `rotation: style.rotation`. `captionInsertForLayout` já no Task 2. `resolveStyleForEditor` overlay:

```ts
...(typeof insert.rotation === "number" ? { rotation: insert.rotation } : {}),
```

`applyCaptionStylePatchToRefs`: `if (typeof patch.rotation === "number") updates.push(["text.rotation", patch.rotation])`.

`drawSticker` after `applyAnimPose`:

```ts
const rotation = insert.rotation ?? 0
if (rotation) {
  ctx.translate(cx, cy)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)
}
```

- [ ] **Step 4: Tests pass.**

---

### Task 5: Chrome + gestos

**Files:** `components/selection-overlay.tsx`, `components/overlay-canvas.tsx`, `components/video-editor.tsx`

`SelectionOverlay` (não-ghost):

- prop `showEdgeHandles?: boolean` (true só texto/caption)
- botões E/W (mesmas classes dos cantos, `left-0 top-1/2 -translate-x-1/2 -translate-y-1/2` / `right-0 …`)
- haste: `div` absoluto `left-1/2 -translate-x-1/2 bottom-full h-5 w-px bg-sky-400`
- círculo: `button` `left-1/2 -translate-x-1/2` acima da haste, `size-3 rounded-full`

`DragState` ganha:

```ts
| { mode: "rotate"; id; center; startRotation; startPointerDeg; base }
| { mode: "ew"; id; edge: "e" | "w"; center; startWidthPct; startLocalX; rotationDeg; base }
```

`onMove`:

- rotate: `clientToPlay` → `rotationFromDrag` → caption: `onPatchCaptionStyle({ rotation })`; senão `onPatchInsert(id, { rotation })`
- ew: `localPoint` → `maxWidthPctFromEdgeDrag` → caption: `onPatchCaptionStyle({ maxWidthPct })`; texto: `onPatchInsert({ maxWidthPct })`

`startRotation`: `box.rotation ?? 0`. `startWidthPct`: caption usa `captionStyle.maxWidthPct`; texto usa `insert.maxWidthPct ?? 84`.

`video-editor.tsx`:

```ts
if (path === "text.rotation" && typeof value === "number") return { rotation: value }
// captionLookFromPatch:
if (typeof patch.rotation === "number") look.rotation = patch.rotation
```

Não unstack chip no giro.

- [ ] **Step 1–4:** Sem teste de pixel. Conferir `tsc --noEmit`.

---

### Task 6: UI numérica sem ±30° + docs

**Files:** `components/style-customize-panel.tsx`, `components/insert-style-panel.tsx`, `docs/preview-overlays.md`, `docs/proximo.md`

- Tirar `min={-30} max={30}` do NumberInput de rotação.
- No `insert-style-panel`, trocar o `<input type="range" min={-30} max={30}>` por número (mesmo padrão do NumberInput / input numérico) sem teto.
- `preview-overlays.md` §1: itens 7–8 (girar, E/W). Tirar “Handles E/W, rotate” de §6.
- `proximo.md`: P1.2 código local; `maxWidthPct` no preview (P2.5 parcial: handle sim, slider no card não).

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Matemática atan2 / unwrap / E/W clamp | 1 |
| Sem clamp ±30 parse + captionStyle.rotation | 2 |
| bbox PNG/chip | 3 |
| draw PNG + legenda nativa + dual-write factory | 4 |
| Chrome A + gestos + ghost sem alças | 5 |
| Slider some; docs | 6 |

## Aceite manual

Texto: 4 cantos + E/W + círculo; giro sem teto. Duas legendas giram juntas. PNG gira no preview. Chip empilhado gira na faixa. Ghost sem alças. Rascunho não pinta haste.
