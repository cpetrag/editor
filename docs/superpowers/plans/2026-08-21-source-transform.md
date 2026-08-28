# Enquadramento do vídeo (scale + pan) Implementation Plan

> **Histórico (2026-08-21).** Contrato vigente: [`docs/enquadramento.md`](../../enquadramento.md). Spec desta fatia: **substituída**. Não executar este plano de novo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Não é git repo: **não commit**. Spec: [`docs/superpowers/specs/2026-08-21-source-transform-design.md`](../specs/2026-08-21-source-transform-design.md).

**Goal:** O operador dá zoom e pan no MP4 de fundo (enquadramento fixo no clipe), com o mesmo rect no preview Remotion, no rascunho e no Final; inserts continuam no frame 9:16.

**Architecture:** Matemática única em `lib/export/cover.ts` (`coverDrawRect` + inverso). Defaults/parse/pan/clamp em `lib/source-transform.ts`. Campo opcional `source.transform` no schema v4. Undo inclui o transform. UI: seleção `{ insert | source }`, chrome no frame, sliders no card Origem.

**Tech Stack:** TypeScript, `node --experimental-strip-types --test`, React client, Remotion `Short`, canvas 1080×1920.

**Não fazer:** git commit, Ken Burns, `contain`/faixa preta, rotação do fundo, pinch, zoom na roda, Fase 3, lote Remotion, encoder.

---

## File map

| Arquivo | Papel |
| --- | --- |
| Modify: `lib/export/cover.ts` | 5º arg `transform`; `transformFromCoverRect` |
| Modify: `lib/export/cover.test.ts` | TDD da conta (spec itens 1–6) |
| Create: `lib/source-transform.ts` | `SourceTransform`, parse, identidade, pan, scale, clamp |
| Create: `lib/source-transform.test.ts` | TDD helpers |
| Create: `lib/preview-selection.ts` | union de seleção |
| Create: `lib/preview-selection.test.ts` | helpers da seleção |
| Modify: `lib/composition.ts` | `CompositionSource.transform`; parse/serialize |
| Modify: `lib/composition.test.ts` | round-trip e clamp |
| Modify: `lib/composition-history.ts` | `HistorySnapshot.sourceTransform` |
| Modify: `lib/composition-history.test.ts` | undo do pan |
| Modify: `lib/commit-source.test.ts` | origem nova sem transform |
| Modify: `lib/project-reset.test.ts` | Novo projeto zera; Limpar inserts mantém |
| Modify: `lib/export/compositor.ts` | `drawVideoCover` usa o transform |
| Modify: `remotion/types.ts` | `video.width/height/transform?` |
| Modify: `remotion/types.test.ts` | `toRenderProps` propaga |
| Modify: `remotion/Short.tsx` | `BackgroundVideo` pelo rect, não `object-fit: cover` |
| Modify: `lib/compose/keyboard-scope.ts` | nudge com vídeo selecionado |
| Modify: `lib/compose/keyboard-scope.test.ts` | `canHandlePreviewNudge` |
| Modify: `components/selection-overlay.tsx` | `showRotate` |
| Modify: `components/overlay-canvas.tsx` | pan/zoom do fundo |
| Modify: `components/preview-panel.tsx` | seleção union; Delete só insert |
| Modify: `components/background-source-card.tsx` | sliders + Reset |
| Modify: `components/video-editor.tsx` | snapshot, patch, seleção |
| Modify: `components/control-panel.tsx` | props de enquadramento |
| Modify: `package.json` | incluir os 3 testes novos |
| Modify: `docs/preview-overlays.md`, `docs/proximo.md`, `docs/README.md` | ops |

`commitReadySource` **não** muda: callers de arquivo/URL já montam `CompositionSource` novo (sem spread do anterior). Restaurar `previousSource` já devolve o objeto inteiro.

---

### Task 1: Matemática do cover + inverso

**Files:**
- Modify: `lib/export/cover.ts`
- Modify: `lib/export/cover.test.ts`

- [ ] **Step 1: Write the failing tests** (append in `lib/export/cover.test.ts`)

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import { coverDrawRect, overlayDrawScale, transformFromCoverRect } from "./cover.ts"

// testes atuais de coverDrawRect e overlayDrawScale permanecem

test("coverDrawRect identity 1080x1920 fills the dest", () => {
  const rect = coverDrawRect(1080, 1920, 1080, 1920, { scale: 1, x: 50, y: 50 })
  assert.ok(Math.abs(rect.dx) < 1e-6)
  assert.ok(Math.abs(rect.dy) < 1e-6)
  assert.ok(Math.abs(rect.dw - 1080) < 1e-6)
  assert.ok(Math.abs(rect.dh - 1920) < 1e-6)
})

test("coverDrawRect scale 2 grows from frame center on 9:16", () => {
  const rect = coverDrawRect(1080, 1920, 1080, 1920, { scale: 2, x: 50, y: 50 })
  assert.ok(Math.abs(rect.dw - 2160) < 1e-6)
  assert.ok(Math.abs(rect.dh - 3840) < 1e-6)
  assert.ok(Math.abs(rect.dx + 540) < 1e-6)
  assert.ok(Math.abs(rect.dy + 960) < 1e-6)
})

test("coverDrawRect landscape pan X at 0 and 100 stays covering", () => {
  const left = coverDrawRect(1920, 1080, 1080, 1920, { scale: 1, x: 0, y: 50 })
  assert.ok(Math.abs(left.dx) < 1e-6)
  assert.ok(left.dx + left.dw >= 1080 - 1e-6)
  assert.ok(left.dx <= 1e-6)
  const right = coverDrawRect(1920, 1080, 1080, 1920, { scale: 1, x: 100, y: 50 })
  assert.ok(Math.abs(right.dx - (1080 - right.dw)) < 1e-6)
  assert.ok(right.dx + right.dw >= 1080 - 1e-6)
  assert.ok(right.dx <= 1e-6)
})

test("coverDrawRect taller source pans Y and locks X at 50", () => {
  const mid = coverDrawRect(1080, 2400, 1080, 1920, { scale: 1, x: 50, y: 50 })
  assert.ok(Math.abs(mid.dx) < 1e-6)
  assert.ok(mid.dy < 0)
  const top = coverDrawRect(1080, 2400, 1080, 1920, { scale: 1, x: 50, y: 0 })
  assert.ok(Math.abs(top.dy) < 1e-6)
  const bottom = coverDrawRect(1080, 2400, 1080, 1920, { scale: 1, x: 50, y: 100 })
  assert.ok(Math.abs(bottom.dy - (1920 - bottom.dh)) < 1e-6)
})

test("transformFromCoverRect round-trips coverDrawRect", () => {
  const srcW = 1920
  const srcH = 1080
  const destW = 1080
  const destH = 1920
  const input = { scale: 1.5, x: 40, y: 62 }
  const rect = coverDrawRect(srcW, srcH, destW, destH, input)
  const back = transformFromCoverRect(rect, srcW, srcH, destW, destH)
  const again = coverDrawRect(srcW, srcH, destW, destH, back)
  assert.ok(Math.abs(again.dx - rect.dx) < 1e-6)
  assert.ok(Math.abs(again.dy - rect.dy) < 1e-6)
  assert.ok(Math.abs(again.dw - rect.dw) < 1e-6)
  assert.ok(Math.abs(again.dh - rect.dh) < 1e-6)
})
```

Os dois testes atuais (576×1024 e 1920×1080 **sem** 5º arg) ficam. Sem 5º arg = cover centro.

- [ ] **Step 2: Run tests — expect FAIL** (`transformFromCoverRect` missing / 5º arg ignored)

```
node --experimental-strip-types --test lib/export/cover.test.ts
```

- [ ] **Step 3: Implement `lib/export/cover.ts`**

```ts
export interface CoverRect {
  dx: number
  dy: number
  dw: number
  dh: number
}

export type CoverTransform = {
  scale?: number
  x?: number
  y?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function coverDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
  transform?: CoverTransform | null,
): CoverRect {
  if (!(sourceWidth > 0 && sourceHeight > 0 && destWidth > 0 && destHeight > 0)) {
    return { dx: 0, dy: 0, dw: destWidth, dh: destHeight }
  }
  const zoom = Math.max(1, transform?.scale ?? 1)
  const ax = (transform?.x ?? 50) / 100
  const ay = (transform?.y ?? 50) / 100
  const cover = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const dw = sourceWidth * cover * zoom
  const dh = sourceHeight * cover * zoom
  let dx = destWidth / 2 - ax * dw
  let dy = destHeight / 2 - ay * dh
  if (dw >= destWidth) dx = clamp(dx, destWidth - dw, 0)
  if (dh >= destHeight) dy = clamp(dy, destHeight - dh, 0)
  return { dx, dy, dw, dh }
}

export function transformFromCoverRect(
  rect: CoverRect,
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): { scale: number; x: number; y: number } {
  if (!(sourceWidth > 0 && sourceHeight > 0 && rect.dw > 0 && rect.dh > 0)) {
    return { scale: 1, x: 50, y: 50 }
  }
  const cover = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const rawScale = cover > 0 ? rect.dw / sourceWidth / cover : 1
  const scale = Math.round(clamp(rawScale, 1, 4) * 1000) / 1000
  const x = Math.round(((destWidth / 2 - rect.dx) / rect.dw) * 1000) / 10
  const y = Math.round(((destHeight / 2 - rect.dy) / rect.dh) * 1000) / 10
  return { scale, x: clamp(x, 0, 100), y: clamp(y, 0, 100) }
}

export function overlayDrawScale(outputHeight: number, designHeight: number): number {
  if (!(designHeight > 0)) return 1
  return outputHeight / designHeight
}
```

- [ ] **Step 4: Run tests — expect PASS**

```
node --experimental-strip-types --test lib/export/cover.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 2: `source-transform.ts`

**Files:**
- Create: `lib/source-transform.ts`
- Create: `lib/source-transform.test.ts`
- Modify: `package.json` (`scripts.test` — acrescentar `lib/source-transform.test.ts` depois de `lib/insert-transform.test.ts`)

- [ ] **Step 1: Write the failing test** (`lib/source-transform.test.ts`)

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import { coverDrawRect } from "./export/cover.ts"
import {
  DEFAULT_SOURCE_TRANSFORM,
  clampSourceTransform,
  isIdentitySourceTransform,
  panSourceTransform,
  parseSourceTransform,
  scaleSourceTransform,
  sourceTransformOrDefault,
} from "./source-transform.ts"

test("parseSourceTransform ignores garbage and clamps scale 1-4 and x/y 0-100", () => {
  assert.equal(parseSourceTransform(undefined), undefined)
  assert.equal(parseSourceTransform("nope"), undefined)
  assert.equal(parseSourceTransform({ scale: 1, x: 50, y: 50 }), undefined)
  const parsed = parseSourceTransform({ scale: 0, x: -10, y: 200, extra: 1 })
  assert.deepEqual(parsed, { scale: 1, x: 0, y: 100 })
  const zoom = parseSourceTransform({ scale: 9, x: 40, y: 62 })
  assert.deepEqual(zoom, { scale: 4, x: 40, y: 62 })
})

test("isIdentitySourceTransform matches default", () => {
  assert.equal(isIdentitySourceTransform(DEFAULT_SOURCE_TRANSFORM), true)
  assert.equal(isIdentitySourceTransform({ scale: 1.001, x: 50, y: 50 }), false)
})

test("panSourceTransform positive dx decreases x and stays covering", () => {
  const start = { scale: 1, x: 50, y: 50 }
  const next = panSourceTransform(start, 200, 0, 1920, 1080)
  assert.ok(next.x < 50)
  const rect = coverDrawRect(1920, 1080, 1080, 1920, next)
  assert.ok(rect.dx <= 1e-6)
  assert.ok(rect.dx + rect.dw >= 1080 - 1e-6)
})

test("scaleSourceTransform keeps x/y then clamps pan range", () => {
  const next = scaleSourceTransform({ scale: 1, x: 50, y: 50 }, 2, 1080, 1920)
  assert.equal(next.scale, 2)
  assert.equal(next.x, 50)
  assert.equal(next.y, 50)
})

test("clampSourceTransform without source size only clamps numbers", () => {
  const next = clampSourceTransform({ scale: 8, x: -4, y: 140 }, 0, 0)
  assert.deepEqual(next, { scale: 4, x: 0, y: 100 })
})

test("sourceTransformOrDefault fills identity", () => {
  assert.deepEqual(sourceTransformOrDefault(undefined), DEFAULT_SOURCE_TRANSFORM)
})
```

- [ ] **Step 2: Run test — expect ERR_MODULE_NOT_FOUND**

```
node --experimental-strip-types --test lib/source-transform.test.ts
```

- [ ] **Step 3: Implement `lib/source-transform.ts`**

```ts
import { coverDrawRect, transformFromCoverRect, type CoverRect } from "./export/cover.ts"
import { PLAY_H, PLAY_W } from "./compose/layout.ts"

export type SourceTransform = {
  scale: number
  x: number
  y: number
}

export const SOURCE_SCALE_MIN = 1
export const SOURCE_SCALE_MAX = 4
export const DEFAULT_SOURCE_TRANSFORM: SourceTransform = { scale: 1, x: 50, y: 50 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function asFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function clampScale(value: number): number {
  return Math.round(clamp(value, SOURCE_SCALE_MIN, SOURCE_SCALE_MAX) * 1000) / 1000
}

function clampAnchor(value: number): number {
  return Math.round(clamp(value, 0, 100) * 10) / 10
}

export function isIdentitySourceTransform(transform: SourceTransform): boolean {
  return transform.scale === 1 && transform.x === 50 && transform.y === 50
}

export function sourceTransformOrDefault(
  transform: SourceTransform | undefined,
): SourceTransform {
  return transform ?? DEFAULT_SOURCE_TRANSFORM
}

export function parseSourceTransform(raw: unknown): SourceTransform | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const scale = asFinite(record.scale)
  const x = asFinite(record.x)
  const y = asFinite(record.y)
  if (scale === undefined && x === undefined && y === undefined) return undefined
  const next: SourceTransform = {
    scale: clampScale(scale ?? 1),
    x: clampAnchor(x ?? 50),
    y: clampAnchor(y ?? 50),
  }
  return isIdentitySourceTransform(next) ? undefined : next
}

export function clampSourceTransform(
  transform: SourceTransform,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): SourceTransform {
  const rounded: SourceTransform = {
    scale: clampScale(transform.scale),
    x: clampAnchor(transform.x),
    y: clampAnchor(transform.y),
  }
  if (!(sourceWidth > 0 && sourceHeight > 0)) return rounded
  const rect = coverDrawRect(sourceWidth, sourceHeight, destWidth, destHeight, rounded)
  return transformFromCoverRect(rect, sourceWidth, sourceHeight, destWidth, destHeight)
}

function clampMovedRect(
  rect: CoverRect,
  destWidth: number,
  destHeight: number,
): CoverRect {
  let { dx, dy, dw, dh } = rect
  if (dw >= destWidth) dx = clamp(dx, destWidth - dw, 0)
  if (dh >= destHeight) dy = clamp(dy, destHeight - dh, 0)
  return { dx, dy, dw, dh }
}

export function panSourceTransform(
  current: SourceTransform,
  deltaPlayX: number,
  deltaPlayY: number,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): SourceTransform {
  const base = clampSourceTransform(current, sourceWidth, sourceHeight, destWidth, destHeight)
  const rect = coverDrawRect(sourceWidth, sourceHeight, destWidth, destHeight, base)
  const moved = clampMovedRect(
    { ...rect, dx: rect.dx + deltaPlayX, dy: rect.dy + deltaPlayY },
    destWidth,
    destHeight,
  )
  return transformFromCoverRect(moved, sourceWidth, sourceHeight, destWidth, destHeight)
}

export function scaleSourceTransform(
  current: SourceTransform,
  factor: number,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): SourceTransform {
  return clampSourceTransform(
    { ...current, scale: current.scale * factor },
    sourceWidth,
    sourceHeight,
    destWidth,
    destHeight,
  )
}

export function sourceScaleRangeLabel(): string {
  return "Escala 1–4"
}
```

- [ ] **Step 4: Run tests — expect PASS**

```
node --experimental-strip-types --test lib/source-transform.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 3: Schema v4 em `composition.ts`

**Files:**
- Modify: `lib/composition.ts` (`CompositionSource`, `parseSource`, `serializeComposition`)
- Modify: `lib/composition.test.ts`

- [ ] **Step 1: Write the failing tests** (append in `lib/composition.test.ts`)

```ts
test("parseComposition omits identity source.transform and clamps zoom", () => {
  const identity = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 1, x: 50, y: 50 },
    },
  })
  assert.equal(identity.source.transform, undefined)
  const json = JSON.parse(serializeComposition(identity)) as { source: { transform?: unknown } }
  assert.equal(json.source.transform, undefined)

  const zoomed = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 1.5, x: 40, y: 62 },
    },
  })
  assert.deepEqual(zoomed.source.transform, { scale: 1.5, x: 40, y: 62 })
  const again = parseComposition(JSON.parse(serializeComposition(zoomed)))
  assert.deepEqual(again.source.transform, { scale: 1.5, x: 40, y: 62 })

  const clamped = parseComposition({
    ...sampleComposition(),
    source: {
      ...sampleComposition().source,
      transform: { scale: 9, x: -10, y: 40 },
    },
  })
  assert.equal(clamped.source.transform?.scale, 4)
  assert.equal(clamped.source.transform?.x, 0)
})
```

- [ ] **Step 2: Run — expect FAIL** (`source.transform` dropped)

```
node --experimental-strip-types --test lib/composition.test.ts
```

- [ ] **Step 3: Wire parse/serialize**

No topo de `lib/composition.ts`:

```ts
import {
  isIdentitySourceTransform,
  parseSourceTransform,
  type SourceTransform,
} from "./source-transform.ts"

export type { SourceTransform }
```

Em `CompositionSource`, depois de `watermarked?`:

```ts
transform?: SourceTransform
```

Em `parseSource`, no objeto de retorno:

```ts
...(parseSourceTransform(record.transform)
  ? { transform: parseSourceTransform(record.transform) }
  : {}),
```

Chamar `parseSourceTransform` **uma vez**:

```ts
const transform = parseSourceTransform(record.transform)
return {
  // ...campos atuais
  ...(transform ? { transform } : {}),
}
```

Em `serializeComposition`, dentro de `source:`:

```ts
...(composition.source.transform &&
!isIdentitySourceTransform(composition.source.transform)
  ? { transform: composition.source.transform }
  : {}),
```

- [ ] **Step 4: Run — expect PASS**

```
node --experimental-strip-types --test lib/composition.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 4: Undo inclui `source.transform`

**Files:**
- Modify: `lib/composition-history.ts`
- Modify: `lib/composition-history.test.ts`

- [ ] **Step 1: Write the failing test**

Em `lib/composition-history.test.ts`, importar `type SourceTransform` não é obrigatório. Append:

```ts
test("undo restores sourceTransform pan", () => {
  const before = snap([chip("a")])
  const after: HistorySnapshot = {
    ...snap([chip("a")]),
    sourceTransform: { scale: 1.5, x: 40, y: 62 },
  }
  const pushed = pushPast(emptyHistory(), before, after)
  const undone = undo(pushed, after)
  assert.equal(undone.present.sourceTransform, undefined)
  const redone = redo(undone.history, undone.present)
  assert.deepEqual(redone.present.sourceTransform, { scale: 1.5, x: 40, y: 62 })
})
```

- [ ] **Step 2: Run — expect FAIL** (excess property / undefined)

```
node --experimental-strip-types --test lib/composition-history.test.ts
```

- [ ] **Step 3: Add field**

`lib/composition-history.ts`:

```ts
import type { SourceTransform } from "./source-transform.ts"

export interface HistorySnapshot {
  inserts: CompositionInsert[]
  captionStyle: CaptionStyle
  tracks?: Partial<Record<TrackId, TrackStyle>>
  styleRef?: StyleRef
  sourceTransform?: SourceTransform
}
```

`cloneSnapshot` / `snapshotsEqual` já usam JSON — o campo entra sozinho.

- [ ] **Step 4: Run — expect PASS**

```
node --experimental-strip-types --test lib/composition-history.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 5: Trocar MP4 zera; Limpar inserts mantém

**Files:**
- Modify: `lib/commit-source.test.ts`
- Modify: `lib/project-reset.test.ts`

Não mudar `commitReadySource` nem `clearInsertsArt` se os testes já passarem com o comportamento atual (replace substitui o objeto; clear não toca `source`).

- [ ] **Step 1: Write tests**

`lib/commit-source.test.ts`:

```ts
test("commitReadySource with a fresh next source drops previous transform", () => {
  const prev = sampleComposition(
    sampleSource({ transform: { scale: 2, x: 30, y: 40 } }),
  )
  const next = sampleSource({ fileId: "file-2", fileName: "novo.mp4", duration: 8 })
  const committed = commitReadySource(prev, next)
  assert.equal(committed.source.fileId, "file-2")
  assert.equal(committed.source.transform, undefined)
})
```

`lib/project-reset.test.ts` — no `sample()`, pôr transform no source; nos asserts:

```ts
test("newProjectComposition is empty v4 without fileId or inserts", () => {
  const next = newProjectComposition()
  // ...asserts atuais
  assert.equal(next.source.transform, undefined)
})

test("clearInsertsArt keeps the video transform", () => {
  const base = sample()
  const withTransform = {
    ...base,
    source: { ...base.source, transform: { scale: 1.8, x: 42, y: 55 } },
  }
  const next = clearInsertsArt(withTransform)
  assert.deepEqual(next.source.transform, { scale: 1.8, x: 42, y: 55 })
  assert.equal(next.inserts.length, 0)
})
```

Ajustar o teste `clearInsertsArt keeps the video and resets art` existente: ele pode continuar; o novo cobre transform.

- [ ] **Step 2: Run — expect PASS** (sem mudança de produto se callers já não copiam transform)

```
node --experimental-strip-types --test lib/commit-source.test.ts lib/project-reset.test.ts
```

Se `sampleSource({ transform })` falhar tipagem, a Task 3 já exportou o campo.

- [ ] **Step 3: Não commit**

---

### Task 6: Rascunho + Remotion usam o mesmo rect

**Files:**
- Modify: `lib/export/compositor.ts`
- Modify: `remotion/types.ts`
- Modify: `remotion/types.test.ts`
- Modify: `remotion/Short.tsx`

- [ ] **Step 1: Write the failing Remotion test** (append em `remotion/types.test.ts`)

```ts
test("toRenderProps copies source size and transform onto video", () => {
  const composition = sampleComposition({
    source: {
      duration: 18,
      fps: 30,
      width: 1920,
      height: 1080,
      fileName: "anuncio.mp4",
      transform: { scale: 1.5, x: 40, y: 62 },
    },
  })
  const props = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
  })
  assert.equal(props.video.width, 1920)
  assert.equal(props.video.height, 1080)
  assert.deepEqual(props.video.transform, { scale: 1.5, x: 40, y: 62 })
})
```

- [ ] **Step 2: Run — expect FAIL**

```
node --experimental-strip-types --test remotion/types.test.ts
```

- [ ] **Step 3: Implement mapping + draw + CSS rect**

`remotion/types.ts` — `RenderProps.video`:

```ts
video: {
  src: string
  durationInSeconds: number
  width?: number
  height?: number
  transform?: Composition["source"]["transform"]
}
```

`toRenderProps`:

```ts
video: {
  src: videoSrc,
  durationInSeconds: composition.source.duration,
  width: composition.source.width,
  height: composition.source.height,
  ...(composition.source.transform
    ? { transform: composition.source.transform }
    : {}),
},
```

`lib/export/compositor.ts` — `drawVideoCover` passa a receber `composition` (ou o transform). Assinatura mínima:

```ts
function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  transform: Composition["source"]["transform"],
): void {
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, width, height)
  const srcW = video.videoWidth || video.width
  const srcH = video.videoHeight || video.height
  const rect = coverDrawRect(srcW, srcH, width, height, transform)
  ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
}
```

Em `drawFrame`, `drawVideoCover(ctx, video, width, height, composition.source.transform)`.

`remotion/Short.tsx`:

```ts
import { coverDrawRect } from "../lib/export/cover.ts"
import type { RenderProps } from "./types.ts"

function BackgroundVideo({
  src,
  width,
  height,
  sourceWidth,
  sourceHeight,
  transform,
}: {
  src: string
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  transform: RenderProps["video"]["transform"]
}) {
  const env = useRemotionEnvironment()
  const rect = coverDrawRect(sourceWidth, sourceHeight, width, height, transform)
  const style: CSSProperties = {
    position: "absolute",
    left: rect.dx,
    top: rect.dy,
    width: rect.dw,
    height: rect.dh,
    objectFit: "fill",
  }
  if (!src) return null
  if (env.isPlayer || src.startsWith("blob:")) {
    return <Html5Video src={src} style={style} />
  }
  return <OffthreadVideo src={src} style={style} />
}

export function Short(props: RenderProps) {
  const frame = useCurrentFrame()
  const time = secondsFromFrame(frame, props.fps)
  loadRenderFonts(props)
  const env = useRemotionEnvironment()
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <BackgroundVideo
        src={props.video.src}
        width={props.width}
        height={props.height}
        sourceWidth={props.video.width ?? props.width}
        sourceHeight={props.video.height ?? props.height}
        transform={props.video.transform}
      />
      {props.audio ? (
        <Html5Audio src={props.audio.src} volume={props.audio.volume} />
      ) : null}
      {env.isPlayer ? null : <InsertRenderer props={props} time={time} />}
    </AbsoluteFill>
  )
}
```

`defaultRenderProps.video` pode omitir width/height (fallback = composition size).

- [ ] **Step 4: Run — expect PASS**

```
node --experimental-strip-types --test remotion/types.test.ts remotion/purity.test.ts lib/export/cover.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 7: Seleção `insert | source` + teclado

**Files:**
- Create: `lib/preview-selection.ts`
- Create: `lib/preview-selection.test.ts`
- Modify: `lib/compose/keyboard-scope.ts`
- Modify: `lib/compose/keyboard-scope.test.ts`
- Modify: `package.json` (acrescentar `lib/preview-selection.test.ts`)

- [ ] **Step 1: Write failing tests**

`lib/preview-selection.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  insertIdOf,
  isSourceSelected,
  type PreviewSelection,
} from "./preview-selection.ts"

test("insertIdOf and isSourceSelected are exclusive", () => {
  const insert: PreviewSelection = { kind: "insert", id: "a" }
  const source: PreviewSelection = { kind: "source" }
  assert.equal(insertIdOf(insert), "a")
  assert.equal(isSourceSelected(insert), false)
  assert.equal(insertIdOf(source), null)
  assert.equal(isSourceSelected(source), true)
  assert.equal(insertIdOf(null), null)
})
```

`lib/compose/keyboard-scope.test.ts` — append:

```ts
import { canHandlePreviewNudge } from "./keyboard-scope.ts"

test("canHandlePreviewNudge is false without target even with source selected", () => {
  assert.equal(
    canHandlePreviewNudge({ defaultPrevented: false, target: null }, { kind: "source" }),
    false,
  )
})
```

- [ ] **Step 2: Run — expect FAIL**

```
node --experimental-strip-types --test lib/preview-selection.test.ts lib/compose/keyboard-scope.test.ts
```

- [ ] **Step 3: Implement**

`lib/preview-selection.ts`:

```ts
export type PreviewSelection =
  | { kind: "insert"; id: string }
  | { kind: "source" }
  | null

export function insertIdOf(selection: PreviewSelection): string | null {
  return selection?.kind === "insert" ? selection.id : null
}

export function isSourceSelected(selection: PreviewSelection): boolean {
  return selection?.kind === "source"
}
```

`lib/compose/keyboard-scope.ts` — manter `canHandleInsertNudge`; acrescentar:

```ts
import { insertIdOf, type PreviewSelection } from "../preview-selection.ts"

export function canHandlePreviewNudge(
  event: { defaultPrevented: boolean; target: EventTarget | null },
  selection: PreviewSelection,
): boolean {
  if (selection?.kind === "source") {
    return canHandleInsertNudge(event, "source")
  }
  return canHandleInsertNudge(event, insertIdOf(selection))
}
```

`canHandleInsertNudge(..., "source")` reusa a regra do stage (`[data-preview-stage]` → true). O id `"source"` **não** casa com `data-insert-id` de card, então setas no card de insert não mexem o vídeo. Clique no card Origem não precisa de nudge pelo card.

- [ ] **Step 4: Run — expect PASS**

```
node --experimental-strip-types --test lib/preview-selection.test.ts lib/compose/keyboard-scope.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 8: Chrome e gestos no preview

**Files:**
- Modify: `components/selection-overlay.tsx`
- Modify: `components/overlay-canvas.tsx`
- Modify: `components/preview-panel.tsx`

- [ ] **Step 1: `showRotate` no overlay**

Em `selection-overlay.tsx`, no ramo não-ghost, acrescentar `showRotate?: boolean` (default **true**). Só renderizar a haste + círculo se `showRotate !== false`.

No `sr-only` do miolo, se `showRotate === false`, texto **Enquadrar vídeo**; senão **Mover overlay**.

- [ ] **Step 2: OverlayCanvas — props novas e drag do fundo**

Novas props em `overlay-canvas.tsx`:

```ts
selection?: PreviewSelection
sourceWidth?: number
sourceHeight?: number
sourceTransform?: SourceTransform
onSelect?: (selection: PreviewSelection) => void
onPatchSourceTransform?: (transform: SourceTransform) => void
```

Manter `selectedInsertId` / `onSelectInsert` **só se** ainda forem usados internamente; o painel passa `selection` + `onSelect`. Preferir substituir:

- `selectedInsertId` → `insertIdOf(selection)`
- `onSelectInsert?.(id)` → `onSelect?.({ kind: "insert", id })`
- miss dentro do frame → `onSelect?.({ kind: "source" })` e, se já era source, começa pan

Estender `DragState`:

```ts
| {
    mode: "source-pan"
    startPlay: { x: number; y: number }
    base: SourceTransform
  }
| {
    mode: "source-resize"
    center: { x: number; y: number }
    startDist: number
    base: SourceTransform
  }
```

`onStagePointerDown`: se `!hit` e `play.inside`:

```ts
onSelect?.({ kind: "source" })
if (!(sourceWidth > 0 && sourceHeight > 0)) return
onBeginInsertGesture?.()
dragRef.current = {
  mode: "source-pan",
  startPlay: { x: play.playX, y: play.playY },
  base: sourceTransformOrDefault(sourceTransform),
}
```

No `onMove` do effect, ramos:

```ts
if (drag.mode === "source-pan") {
  const next = panSourceTransform(
    drag.base,
    play.playX - drag.startPlay.x,
    play.playY - drag.startPlay.y,
    sourceWidth,
    sourceHeight,
  )
  onPatchSourceTransform?.(next)
  return
}
if (drag.mode === "source-resize") {
  const factor = scaleFactorFromDrag(
    drag.center,
    { x: play.playX, y: play.playY },
    drag.startDist,
  )
  onPatchSourceTransform?.(
    scaleSourceTransform(drag.base, factor, sourceWidth, sourceHeight),
  )
  return
}
```

Incluir `sourceWidth`, `sourceHeight`, `onPatchSourceTransform` nas deps do effect.

Quando `isSourceSelected(selection)` e `metrics`/`hostBox`:

```tsx
<SelectionOverlay
  box={{ cx: PLAY_W / 2, cy: PLAY_H / 2, w: PLAY_W, h: PLAY_H }}
  metrics={metrics}
  host={hostBox}
  showRotate={false}
  showEdgeHandles={false}
  onMovePointerDown={(event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const play = clientToPlay(event.clientX, event.clientY, metrics)
    if (!play.inside || !(sourceWidth > 0 && sourceHeight > 0)) return
    onBeginInsertGesture?.()
    dragRef.current = {
      mode: "source-pan",
      startPlay: { x: play.playX, y: play.playY },
      base: sourceTransformOrDefault(sourceTransform),
    }
  }}
  onResizePointerDown={(corner, event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (!(sourceWidth > 0 && sourceHeight > 0)) return
    const play = clientToPlay(event.clientX, event.clientY, metrics)
    const center = { x: PLAY_W / 2, y: PLAY_H / 2 }
    const pointer = play.inside ? { x: play.playX, y: play.playY } : center
    onBeginInsertGesture?.()
    dragRef.current = {
      mode: "source-resize",
      center,
      startDist: Math.hypot(pointer.x - center.x, pointer.y - center.y),
      base: sourceTransformOrDefault(sourceTransform),
    }
  }}
  onEdgePointerDown={() => {}}
  onRotatePointerDown={() => {}}
/>
```

Nudge no `onKeyDown` do overlay: se `canHandlePreviewNudge` e `isSourceSelected(selection)` e setas, **±1 / ±5 no `x`/`y`** (spec), depois o clamp do cover:

```ts
const nudged = nudgePercents(
  sourceTransformOrDefault(sourceTransform),
  event.key,
  event.shiftKey,
)
onPatchSourceTransform?.(
  clampSourceTransform(nudged, sourceWidth, sourceHeight),
)
event.preventDefault()
```

Ramo insert continua com `nudgePercents` como hoje, usando `canHandlePreviewNudge` + `insertIdOf`.

- [ ] **Step 3: PreviewPanel**

Trocar `selectedInsertId` + `onSelectInsert` por:

```ts
selection: PreviewSelection
onSelect?: (selection: PreviewSelection) => void
onPatchSourceTransform?: (transform: SourceTransform) => void
sourceWidth: number
sourceHeight: number
sourceTransform?: SourceTransform
```

Timeline `selected={insertIdOf(selection) === insert.id}`.

Delete/Backspace: só se `insertIdOf(selection)` for string.

Passar as props ao `OverlayCanvas`.

`onSelectInsert` em `video-editor` vira `onSelect`.

- [ ] **Step 4: Typecheck mental / `pnpm test` da lógica** (UI sem teste de DOM)

```
node --experimental-strip-types --test lib/source-transform.test.ts lib/preview-selection.test.ts lib/compose/keyboard-scope.test.ts
```

- [ ] **Step 5: Não commit**

---

### Task 9: Card Origem + `video-editor` orquestra

**Files:**
- Modify: `components/background-source-card.tsx`
- Modify: `components/control-panel.tsx`
- Modify: `components/video-editor.tsx`

- [ ] **Step 1: Campos no Origem**

Props novas de `BackgroundSourceCard`:

```ts
sourceSelected?: boolean
onSelectSource?: () => void
onPatchTransform?: (transform: SourceTransform) => void
onResetTransform?: () => void
```

Com `hasPlayableSource(source)` e **não** `missingFile`, abaixo da faixa atual (depois dos botões Trocar/Limpar, antes de `PreviousNote`):

Grid 2 colunas com três `Field` (padrão `OverlayNumberField` de `insert-card.tsx`: `parseDecimal`, vírgula, blur/Enter):

- id `source-scale`, label `sourceScaleRangeLabel()`, min 1 max 4, decimals 3, value `source.transform?.scale ?? 1`
- id `source-x`, label `X (%)`, 0–100, decimals 1
- id `source-y`, label `Y (%)`, 0–100, decimals 1

`onCommit` chama `onPatchTransform(clampSourceTransform({ ...sourceTransformOrDefault(source.transform), [campo]: value }, source.width, source.height))`.

Botão **Resetar enquadramento**: `variant="outline" size="xs"`, `disabled={source.transform === undefined}`, `onClick={onResetTransform}`.

`onPointerDown` no container da faixa atual (não nos `Button`/`a`): `onSelectSource?.()`. Não disparar se o target for botão ou link (`event.target.closest("button, a")`).

Sliders `disabled` se `!playable || missingFile`.

- [ ] **Step 2: ControlPanel**

Encaminhar as 4 props do Origem. `selectedId` continua sendo `insertIdOf(selection)` para os cards de insert.

- [ ] **Step 3: VideoEditor**

```ts
const [selection, setSelection] = useState<PreviewSelection>(null)
```

Substituir `setSelectedInsertId(id)` por `setSelection({ kind: "insert", id })`.  
`setSelectedInsertId(null)` → `setSelection(null)` (Novo projeto, etc.).  
Ao apagar insert: se `insertIdOf(selection) === id`, `setSelection(null)`.

`historyPresent`:

```ts
function historyPresent(composition: Composition): HistorySnapshot {
  return {
    inserts: composition.inserts,
    captionStyle: composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
    tracks: composition.tracks,
    styleRef: composition.styleRef,
    sourceTransform: composition.source.transform,
  }
}
```

`applyHistoryPresent`:

```ts
const { transform: _ignored, ...sourceRest } = compositionRef.current.source
const next = clampComposition({
  ...compositionRef.current,
  inserts: snapshot.inserts,
  captionStyle: snapshot.captionStyle,
  tracks: snapshot.tracks,
  styleRef: snapshot.styleRef,
  source: snapshot.sourceTransform
    ? { ...sourceRest, transform: snapshot.sourceTransform }
    : sourceRest,
})
```

Seleção após undo:

```ts
setSelection((current) => {
  if (current?.kind === "source") return current
  if (current?.kind === "insert" && snapshot.inserts.some((item) => item.id === current.id)) {
    return current
  }
  return null
})
```

Patch do fundo (gesto = sem `commitDiscrete` extra; o `beginInsertGesture`/`endInsertGesture` do overlay já fecha o snapshot):

```ts
const patchSourceTransform = useCallback((transform: SourceTransform, mode: "discrete" | "gesture") => {
  applyComposition((prev) => {
    const next = clampSourceTransform(transform, prev.source.width, prev.source.height)
    const { transform: _drop, ...rest } = prev.source
    return {
      ...prev,
      source: isIdentitySourceTransform(next) ? rest : { ...rest, transform: next },
    }
  }, mode)
}, [applyComposition])
```

Reset (discrete): `patchSourceTransform(DEFAULT_SOURCE_TRANSFORM, "discrete")`.

Preview: `selection={selection}` `onSelect={setSelection}` `onPatchSourceTransform={(t) => patchSourceTransform(t, gestureRef.current.active ? "gesture" : "discrete")}` `onBeginInsertGesture={beginInsertHistory}` `onEndInsertGesture={endInsertHistory}` (já existem para inserts).

Origem: `onSelectSource={() => setSelection({ kind: "source" })}`.

Confirmar que `nextSource` em `commitReadySource` **não** espalha `compositionRef.current.source` (já é objeto literal novo — Task 5).

- [ ] **Step 4: Run full unit suite**

```
pnpm test
```

Expected: PASS (todos os arquivos da lista em `package.json`).

- [ ] **Step 5: Não commit**

---

### Task 10: Docs

**Files:**
- Modify: `docs/preview-overlays.md`
- Modify: `docs/proximo.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-08-21-source-transform-design.md` (status)

- [x] **Step 1: preview-overlays.md**

Depois do item 8 da §1, parágrafo:

> **Vídeo de fundo:** clique no vazio do frame seleciona o Vídeo. Miolo = pan; cantos = zoom (`scale` 1–4 em cima do cover). Sem haste de girar. `x`/`y` = ponto da origem no centro do frame (0–100). Inserts não andam com o MP4. Campo `source.transform` (omitido se identidade). Conta: `coverDrawRect` em `lib/export/cover.ts`.

- [x] **Step 2: proximo.md**

Em “Já está no ar”, **não** marcar publicado até o deploy. Nesta fatia, só acrescentar em P1/P2:

> Enquadramento do fundo (spec `2026-08-21-source-transform-design.md`): no disco; publicar com `deploy.md` §2 + restart `editor-render`.

Quando o operador pedir publish, mover para a tabela “já está”.

- [x] **Step 3: README.md** §3

Na lista do schema, uma linha:

> `source.transform?`: `{ scale, x, y }` — zoom/pan fixo do MP4 (1–4, âncora 0–100). Ausente = cover 50/50.

Ctrl+Z: snapshot passa a `{ inserts, captionStyle, sourceTransform }`.

- [x] **Step 4: Spec status** → `implementado no disco (ainda não publicado)` se a fatia compilou.

- [x] **Step 5: Não commit**

---

## Self-review (spec coverage)

| Spec | Task |
| --- | --- |
| Transform estático, scale 1–4, x/y 0–100 | 1–3 |
| Sem faixa preta / clamp no draw | 1–2 |
| Inserts no frame | 6 (fundo só no vídeo), 8 (overlay de inserts inalterado) |
| Gesto vazio / cantos / sem roda | 8 |
| Card Origem + Reset | 9 |
| Undo | 4 + 9 `historyPresent` |
| Trocar MP4 zera; restaurar previous; Limpar inserts mantém | 5 + 9 (`nextSource` literal) |
| Preview = rascunho = Final | 6 |
| Teclado setas; Delete não apaga origem | 7–8 |
| Schema v4, omite identidade | 3 |
| Sem Ken Burns / contain / Fase 3 | fora |
| Testes 1–11 | 1, 2, 3, 4, 5 |

Placeholders: nenhum TBD. Tipos: `SourceTransform` em `lib/source-transform.ts`; `CoverTransform` só na conta; `PreviewSelection` em `lib/preview-selection.ts`.
