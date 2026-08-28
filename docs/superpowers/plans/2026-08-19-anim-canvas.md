# Animações no canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: `docs/superpowers/specs/2026-08-19-anim-canvas-design.md`. TDD.
> Este share **não é git repo** — pular todos os passos de commit.

**Goal:** Interpolar `animIn` / `animOut` no canvas 1080×1920 (preview e export iguais), com hit-test settled.

**Architecture:** Função pura `animAt(insert, time) → AnimPose`. Layout e hit-test não leem a pose. `applyAnimPose` envolve o draw atual (save/restore por fora), transformando em torno do centro settled. Sem bump de `Composition.version`, sem campo novo, sem UI nova.

**Tech Stack:** TypeScript, canvas 2D, `node --experimental-strip-types --test`.

---

## File map

| File | Responsibility |
| --- | --- |
| Create `lib/compose/anim.ts` | `ANIM_DURATION_SEC`, `IDENTITY_POSE`, `phaseDurations`, `animAt`, `applyAnimPose` |
| Create `lib/compose/anim.test.ts` | Testes da função pura |
| Modify `lib/insert-layout.ts` | `ChipLayout` copia `start`, `duration`, `animIn`, `animOut` |
| Modify `lib/insert-layout.test.ts` | Assert dos campos copiados |
| Modify `lib/compose/draw-chips.ts` | `drawChips(ctx, chips, time, getLogo?)` + apply |
| Modify `lib/compose/draw-text.ts` | `drawStyledText(..., time)` + apply |
| Modify `lib/compose/draw-overlays.ts` | PNG apply; passa `time` ao texto |
| Modify `lib/export/compositor.ts` | passa `time` a `drawChips` |
| Modify `components/overlay-canvas.tsx` | passa `time` a `drawChips` |
| Modify `package.json` | inclui `lib/compose/anim.test.ts` no script `test` |
| Modify `docs/preview-overlays.md` | tira “estado settled” |
| Modify `docs/README.md` | uma frase no compositor |

Não mexer: `hit-test.ts`, `selection-overlay.tsx`, `insert-card.tsx`, `composition.ts` (schema), `globals.css`.

---

### Task 1: `animAt` puro (TDD)

**Files:**
- Create: `lib/compose/anim.test.ts`
- Create: `lib/compose/anim.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import type { CompositionInsert } from "../composition.ts"
import {
  ANIM_DURATION_SEC,
  IDENTITY_POSE,
  animAt,
  phaseDurations,
  type AnimPose,
} from "./anim.ts"

function insert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "i1",
    type: "alerta-desconto",
    start: 0,
    duration: 3,
    text: "OFF",
    anchor: "top",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

function assertIdentity(pose: AnimPose) {
  assert.equal(pose.opacity, IDENTITY_POSE.opacity)
  assert.equal(pose.scale, IDENTITY_POSE.scale)
  assert.equal(pose.dx, IDENTITY_POSE.dx)
  assert.equal(pose.dy, IDENTITY_POSE.dy)
  assert.equal(pose.blurPx, IDENTITY_POSE.blurPx)
  assert.equal(pose.clipProgress, IDENTITY_POSE.clipProgress)
}

test("none/none is identity for any local time inside the insert", () => {
  assertIdentity(animAt(insert(), 0))
  assertIdentity(animAt(insert(), 1.5))
  assertIdentity(animAt(insert(), 2.99))
})

test("middle of a long pop insert is identity", () => {
  const row = insert({ animIn: "pop", animOut: "pop" })
  assertIdentity(animAt(row, 1.5))
})

test("pop at t === start is small and faded", () => {
  const pose = animAt(insert({ animIn: "pop" }), 0)
  assert.ok(pose.scale < 1)
  assert.ok(pose.opacity < 1)
})

test("pop is settled at start + 0.45 on a long insert", () => {
  assertIdentity(animAt(insert({ animIn: "pop" }), 0.45))
})

test("pop out on the last visible instant is small and faded", () => {
  const pose = animAt(insert({ animOut: "pop" }), 2.999)
  assert.ok(pose.scale < 1)
  assert.ok(pose.opacity < 1)
})

test("0.5s pop+pop compresses so phases meet in the middle", () => {
  const row = insert({ animIn: "pop", animOut: "pop", duration: 0.5 })
  const { inDur, outDur } = phaseDurations(row)
  assert.ok(Math.abs(inDur + outDur - 0.5) < 1e-10)
  assertIdentity(animAt(row, 0.25))
  const enter = animAt(row, 0)
  const leave = animAt(row, 0.499)
  assert.ok(enter.scale < 1)
  assert.ok(leave.scale < 1)
})

test("none + pop on 0.5s insert does not shrink the exit", () => {
  const row = insert({ animIn: "none", animOut: "pop", duration: 0.5 })
  const { inDur, outDur } = phaseDurations(row)
  assert.equal(inDur, 0)
  assert.equal(outDur, ANIM_DURATION_SEC.pop)
  assertIdentity(animAt(row, 0))
})

test("typewriter enter has 18 clip steps then 1 when settled", () => {
  const row = insert({ animIn: "typewriter", duration: 3 })
  const seen = new Set<number>()
  for (let i = 0; i < 18; i += 1) {
    const t = ((i + 0.01) / 18) * ANIM_DURATION_SEC.typewriter
    seen.add(animAt(row, t).clipProgress)
  }
  assert.equal(seen.size, 18)
  assert.equal(animAt(row, ANIM_DURATION_SEC.typewriter).clipProgress, 1)
})

test("shake enter keeps opacity at 1", () => {
  const row = insert({ animIn: "shake" })
  assert.equal(animAt(row, 0).opacity, 1)
  assert.equal(animAt(row, 0.2).opacity, 1)
  assert.equal(animAt(row, 0.49).opacity, 1)
})

test("slide-up out moves down and fades", () => {
  const pose = animAt(insert({ animOut: "slide-up" }), 2.999)
  assert.ok(pose.dy > 0)
  assert.ok(pose.opacity < 1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (PowerShell, no `pnpm test` neste share se o pnpm travar):

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/compose/anim.test.ts"
```

Expected: FAIL — `Cannot find module` / `animAt` is not exported.

- [ ] **Step 3: Write `lib/compose/anim.ts`**

```ts
import type { AnimPresetId, CompositionInsert } from "../composition.ts"

export interface AnimPose {
  opacity: number
  scale: number
  dx: number
  dy: number
  blurPx: number
  clipProgress: number
}

export const IDENTITY_POSE: AnimPose = {
  opacity: 1,
  scale: 1,
  dx: 0,
  dy: 0,
  blurPx: 0,
  clipProgress: 1,
}

export const ANIM_DURATION_SEC: Record<AnimPresetId, number> = {
  none: 0,
  pop: 0.45,
  "slide-up": 0.4,
  "blur-in": 0.45,
  typewriter: 0.6,
  shake: 0.5,
}

type AnimFields = Pick<CompositionInsert, "start" | "duration" | "animIn" | "animOut">

export function phaseDurations(insert: AnimFields): { inDur: number; outDur: number } {
  let inDur = ANIM_DURATION_SEC[insert.animIn]
  let outDur = ANIM_DURATION_SEC[insert.animOut]
  const span = inDur + outDur
  if (span > insert.duration && span > 0) {
    const k = insert.duration / span
    inDur *= k
    outDur *= k
  }
  return { inDur, outDur }
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function bezierCoord(t: number, p1: number, p2: number): number {
  const mt = 1 - t
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t
}

function bezierDerivative(t: number, p1: number, p2: number): number {
  const mt = 1 - t
  return 3 * mt * mt * p1 + 6 * mt * t * (p2 - p1) + 3 * t * t * (1 - p2)
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  let t = x
  for (let i = 0; i < 8; i += 1) {
    const current = bezierCoord(t, x1, x2)
    const dx = bezierDerivative(t, x1, x2)
    if (Math.abs(dx) < 1e-6) break
    t = clamp01(t - (current - x) / dx)
  }
  return bezierCoord(t, y1, y2)
}

const easePop = (t: number) => cubicBezier(0.34, 1.56, 0.64, 1, t)
const easeOut = (t: number) => cubicBezier(0, 0, 0.58, 1, t)
const easeInOut = (t: number) => cubicBezier(0.42, 0, 0.58, 1, t)

function steps18(p: number): number {
  if (p >= 1) return 1
  return Math.floor(clamp01(p) * 18) / 18
}

function keyframeValue(
  pLinear: number,
  keys: ReadonlyArray<{ at: number; value: number }>,
  ease: (t: number) => number,
): number {
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (!first || !last) return 0
  if (pLinear <= first.at) return first.value
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]
    const next = keys[i]
    if (!prev || !next) continue
    if (pLinear <= next.at) {
      const span = next.at - prev.at
      const local = span === 0 ? 1 : (pLinear - prev.at) / span
      return lerp(prev.value, next.value, ease(clamp01(local)))
    }
  }
  return last.value
}

function enterPose(preset: AnimPresetId, p: number): AnimPose {
  const t = clamp01(p)
  if (preset === "none") return { ...IDENTITY_POSE }
  if (preset === "pop") {
    return {
      ...IDENTITY_POSE,
      scale: keyframeValue(t, [
        { at: 0, value: 0.6 },
        { at: 0.6, value: 1.08 },
        { at: 1, value: 1 },
      ], easePop),
      opacity: keyframeValue(t, [
        { at: 0, value: 0 },
        { at: 0.6, value: 1 },
        { at: 1, value: 1 },
      ], easePop),
    }
  }
  if (preset === "slide-up") {
    return {
      ...IDENTITY_POSE,
      dy: lerp(14, 0, easeOut(t)),
      opacity: lerp(0, 1, easeOut(t)),
    }
  }
  if (preset === "blur-in") {
    return {
      ...IDENTITY_POSE,
      blurPx: lerp(8, 0, easeOut(t)),
      opacity: lerp(0, 1, easeOut(t)),
    }
  }
  if (preset === "typewriter") {
    return { ...IDENTITY_POSE, clipProgress: steps18(t) }
  }
  return {
    ...IDENTITY_POSE,
    dx: keyframeValue(t, [
      { at: 0, value: 0 },
      { at: 0.2, value: -4 },
      { at: 0.4, value: 4 },
      { at: 0.6, value: -3 },
      { at: 0.8, value: 3 },
      { at: 1, value: 0 },
    ], easeInOut),
  }
}

function exitPose(preset: AnimPresetId, p: number): AnimPose {
  const t = clamp01(p)
  if (preset === "none") return { ...IDENTITY_POSE }
  if (preset === "shake") {
    return { ...enterPose("shake", t), opacity: 1 - t }
  }
  return enterPose(preset, 1 - t)
}

export function animAt(insert: AnimFields, time: number): AnimPose {
  const localT = time - insert.start
  const { inDur, outDur } = phaseDurations(insert)
  if (inDur > 0 && localT < inDur) {
    return enterPose(insert.animIn, localT / inDur)
  }
  if (outDur > 0 && localT >= insert.duration - outDur) {
    return exitPose(insert.animOut, (localT - (insert.duration - outDur)) / outDur)
  }
  return { ...IDENTITY_POSE }
}

export function applyAnimPose(
  ctx: CanvasRenderingContext2D,
  pose: AnimPose,
  box: { cx: number; cy: number; w: number; h: number },
): void {
  ctx.translate(box.cx, box.cy)
  ctx.translate(pose.dx, pose.dy)
  ctx.scale(pose.scale, pose.scale)
  ctx.globalAlpha *= pose.opacity
  if (pose.blurPx > 0) ctx.filter = `blur(${pose.blurPx}px)`
  if (pose.clipProgress < 1) {
    ctx.beginPath()
    ctx.rect(-box.w / 2, -box.h / 2, box.w * pose.clipProgress, box.h)
    ctx.clip()
  }
  ctx.translate(-box.cx, -box.cy)
}
```

`applyAnimPose` deixa o contexto em coords absolutas do canvas, mas escaladas/deslocadas em torno do centro. O draw atual (que usa `chip.x` / `chip.y`) continua válido.

- [ ] **Step 4: Run tests to verify they pass**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/compose/anim.test.ts"
```

Expected: PASS, all tests.

- [ ] **Step 5: Add the file to `package.json` script `test`**

In the `test` script string, append ` lib/compose/anim.test.ts` after `lib/compose/fonts.test.ts`.

- [ ] **Step 6: Skip commit** (não é git repo)

---

### Task 2: `ChipLayout` carrega os campos de anim

**Files:**
- Modify: `lib/insert-layout.ts`
- Modify: `lib/insert-layout.test.ts`

- [ ] **Step 1: Write the failing test** (append to `lib/insert-layout.test.ts`)

```ts
test("layout copies start duration animIn animOut onto each chip", () => {
  const chips = layoutInserts(
    [
      insert({
        id: "t",
        anchor: "top",
        text: "POP",
        start: 1.2,
        duration: 4,
        animIn: "pop",
        animOut: "slide-up",
      }),
    ],
    2,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 1)
  assert.equal(chips[0]?.start, 1.2)
  assert.equal(chips[0]?.duration, 4)
  assert.equal(chips[0]?.animIn, "pop")
  assert.equal(chips[0]?.animOut, "slide-up")
})
```

`insert()` already spreads `patch`, so `start` / `animIn` override the defaults.

- [ ] **Step 2: Run the new test to verify it fails**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/insert-layout.test.ts"
```

Expected: FAIL — `start` undefined on chip.

- [ ] **Step 3: Extend `ChipLayout` and copy fields in `makeChip`**

In `lib/insert-layout.ts`:

1. Import `AnimPresetId` from `./composition.ts`.
2. Add to `ChipLayout`:

```ts
  start: number
  duration: number
  animIn: AnimPresetId
  animOut: AnimPresetId
```

3. Add helper and use it in the three `return { ... }` of `makeChip`:

```ts
function animCopy(insert: CompositionInsert) {
  return {
    start: insert.start,
    duration: insert.duration,
    animIn: insert.animIn,
    animOut: insert.animOut,
  }
}
```

Each return becomes `{ id: insert.id, ...animCopy(insert), x: 0, y: 0, ... }`.

Do **not** change `x`/`y`/`width`/`height`. Hit-test stays settled.

- [ ] **Step 4: Re-run layout tests**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/insert-layout.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Skip commit**

---

### Task 3: Apply nos chips

**Files:**
- Modify: `lib/compose/draw-chips.ts`
- Modify: `lib/export/compositor.ts`
- Modify: `components/overlay-canvas.tsx`

- [ ] **Step 1: Change `drawChips` signature and wrap each chip**

Imports:

```ts
import { animAt, applyAnimPose } from "./anim.ts"
```

Signature (time **before** optional `getLogo`):

```ts
export function drawChips(
  ctx: CanvasRenderingContext2D,
  chips: ChipLayout[],
  time: number,
  getLogo?: (src: string) => CanvasImageSource | null,
): void {
```

Inside the loop, **outer** save/apply **before** the existing `ctx.save()` that handles rotation:

```ts
  for (const chip of chips) {
    const cx = chip.x + chip.width / 2
    const cy = chip.y + chip.height / 2
    ctx.save()
    applyAnimPose(ctx, animAt(chip, time), {
      cx,
      cy,
      w: chip.width,
      h: chip.height,
    })
    ctx.save()
    ctx.translate(cx, cy)
    if (chip.paint.rotation) ctx.rotate((chip.paint.rotation * Math.PI) / 180)
    ctx.globalAlpha *= chip.paint.opacity
    ctx.translate(-cx, -cy)
    // ... existing paint ...
    ctx.restore()
    ctx.restore()
  }
```

Critical: change `ctx.globalAlpha = chip.paint.opacity` to `ctx.globalAlpha *= chip.paint.opacity`. Assignment would apagar `pose.opacity`.

Every `ctx.restore()` that used to close the inner save (including the early `continue` no modo logo) precisa de um segundo `restore` para o apply.

Logo branch today:

```
      ctx.restore()
      continue
```

Becomes:

```
      ctx.restore()
      ctx.restore()
      continue
```

- [ ] **Step 2: Pass `time` at both call sites**

`lib/export/compositor.ts` — the `drawChips` call is after `layoutInserts(..., time, ...)`:

```ts
  drawChips(ctx, chips, time, getLogoImage)
```

`components/overlay-canvas.tsx`:

```ts
      drawChips(ctx, chips, time, (src) => {
        if (src !== logoSrc) return null
        const logo = logoRef.current
        if (logo && logo.naturalWidth > 0) return logo
        return null
      })
```

- [ ] **Step 3: Run the existing test suite that still has no canvas**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/insert-layout.test.ts" "n:/Vibecoding/Editor Video/lib/compose/anim.test.ts" "n:/Vibecoding/Editor Video/lib/compose/hit-test.test.ts"
```

Expected: PASS. Hit-test unchanged.

- [ ] **Step 4: Skip commit**

---

### Task 4: Apply em texto e PNG

**Files:**
- Modify: `lib/compose/draw-text.ts`
- Modify: `lib/compose/draw-overlays.ts`

- [ ] **Step 1: `drawStyledText` ganha `time` e apply no centro do bloco**

Import `animAt` e `applyAnimPose` de `./anim.ts`.

```ts
export function drawStyledText(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  frame: { width: number; height: number },
  brandFontId: string,
  time: number,
): void {
```

After computing `blockW`, `blockH`, `cx`, `cy` and **before** `ctx.translate(cx, cy)`:

```ts
  applyAnimPose(ctx, animAt(insert, time), {
    cx,
    cy,
    w: blockW,
    h: blockH,
  })
```

The existing `ctx.save()` at the top already wraps the function; `applyAnimPose` must run **after** that save (it already does — save is at the start, measure, then apply, then translate/rotate). Keep `ctx.globalAlpha *= style.opacity` as multiply.

Call site in `draw-overlays.ts`:

```ts
    drawStyledText(ctx, insert, frame, brandFontId, time)
```

- [ ] **Step 2: Wrap `drawSticker` the same way**

In `drawSticker`, after computing `width`, `height`, `cx`, `cy`, before `drawImage`:

```ts
  ctx.save()
  applyAnimPose(ctx, animAt(insert, time), { cx, cy, w: width, h: height })
  ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height)
  ctx.restore()
```

Pass `time` into `drawSticker`:

```ts
function drawSticker(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  frame: { width: number; height: number },
  image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
  time: number,
): void {
```

Call: `drawSticker(ctx, insert, frame, image, time)`.

Imports at top of `draw-overlays.ts`:

```ts
import { animAt, applyAnimPose } from "./anim.ts"
```

- [ ] **Step 3: Typecheck the draw call chain**

There is no `tsc` script. Grep remaining old signatures:

```
rg "drawChips\(|drawStyledText\(" --glob "*.{ts,tsx}" -g "!node_modules"
```

Expected: only the definitions plus compositor / overlay-canvas / draw-overlays, all with `time`.

- [ ] **Step 4: Skip commit**

---

### Task 5: Docs

**Files:**
- Modify: `docs/preview-overlays.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-08-19-anim-canvas-design.md` (status)

- [ ] **Step 1: `docs/preview-overlays.md` §6**

Replace the line that lists “animações interpoladas (hoje estado settled)” with: animações interpoladas estão em `docs/superpowers/specs/2026-08-19-anim-canvas-design.md`.

Add a short § after §4 (or a bullet in §1):

Play / scrub / export interpolam `animIn`/`animOut` via `animAt` no canvas. Hit-test e a caixa de seleção usam a bbox settled.

- [ ] **Step 2: `docs/README.md` §5**

After the sentence about `drawFrame`, add:

Cada insert ativo passa por `animAt(insert, time)` antes do paint (`pop`, `slide-up`, `blur-in`, `typewriter`, `shake`). A caixa de seleção ignora a pose.

In §10, do **not** list canvas in/out animation as remaining work.

- [ ] **Step 3: Spec status**

In `docs/superpowers/specs/2026-08-19-anim-canvas-design.md`, set **Status:** implementado (aguardando publish).

- [ ] **Step 4: Skip commit**

---

## Verification

```
node --experimental-strip-types --test lib/compose/anim.test.ts lib/insert-layout.test.ts lib/compose/hit-test.test.ts lib/compose/layout.test.ts lib/composition.test.ts
```

Manual (depois do `deploy.md`, não neste plano): no preview, insert 3 s, Entrada Pop, Saída Slide up — no início cresce, no fim desce. Arrastar no primeiro frame ainda pega a caixa grande. Export MP4 deve mostrar o mesmo.

---

## Spec coverage

| Spec | Task |
| --- | --- |
| `animAt` + durações + compressão | 1 |
| Presets + reverso + shake fade out | 1 |
| `applyAnimPose` ordem | 1 + 3 + 4 |
| ChipLayout campos | 2 |
| draw chips / compositor / overlay | 3 |
| texto + PNG | 4 |
| Hit-test intocado | 3 (só re-roda testes) |
| Sem bump de versão / sem UI | — não há task |
| Docs | 5 |
