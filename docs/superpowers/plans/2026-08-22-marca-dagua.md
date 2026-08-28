# Marca d’água global Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Não é git repo: não commit.** Spec: [`docs/superpowers/specs/2026-08-22-marca-dagua-design.md`](../specs/2026-08-22-marca-dagua-design.md).

**Goal:** Marca d’água opcional de texto/`@handle`, global no editor, com toggle por vídeo e bounce determinístico no mesmo raster do preview, rascunho e Final.

**Architecture:** Prefs `{ text, loop }` em `localStorage` `editor.watermark.v1`. `composition.watermarkEnabled?: boolean` (v4 aditivo, omitido = off). Pintura em `drawWatermark` no fim de `drawPlayInserts`. Export Final manda snapshot em `RenderProps.watermark`. UI: uma linha no card **Vídeo de fundo**.

**Tech Stack:** TypeScript, `node --experimental-strip-types --test`, React client, canvas 1080×1920, Remotion `Short`.

**Não fazer:** git commit, PNG, slider de opacidade, tile, checklist de export, encoder novo, Fase 3, bump de schema, mexer em `source.watermarked`.

---

## File map

| Arquivo | Papel |
| --- | --- |
| Create: `lib/watermark.ts` | constantes, normalize, `watermarkCenter`, `watermarkPaintInput`, `drawWatermark` |
| Create: `lib/watermark.test.ts` | TDD da matemática e do no-op |
| Create: `lib/watermark-store.ts` | load/save `editor.watermark.v1` |
| Create: `lib/watermark-store.test.ts` | TDD do storage; Novo projeto não apaga |
| Modify: `lib/composition.ts` | `watermarkEnabled?`; parse/serialize |
| Modify: `lib/composition.test.ts` | round-trip do toggle |
| Modify: `lib/composition-history.ts` | `HistorySnapshot.watermarkEnabled?` |
| Modify: `lib/composition-history.test.ts` | undo do toggle |
| Modify: `lib/compose/draw-play.ts` | último passo: `drawWatermark` |
| Modify: `lib/export/compositor.ts` | `drawFrame` recebe snapshot |
| Modify: `lib/export/encoder.ts` | `ExportOptions.watermark` |
| Modify: `remotion/types.ts` | `RenderProps.watermark?`; `toRenderProps` |
| Modify: `remotion/types.test.ts` | snapshot só se enabled + texto |
| Modify: `remotion/InsertRenderer.tsx` | passa snapshot |
| Modify: `render-server/props.ts` | omite watermark malformado |
| Modify: `render-server/props.test.ts` | JSON com watermark lixo não quebra o job |
| Modify: `components/overlay-canvas.tsx` | pinta mesmo sem inserts; passa snapshot |
| Modify: `components/preview-panel.tsx` | prop `watermark` |
| Modify: `components/background-source-card.tsx` | linha Marca / handle / Loop |
| Modify: `components/control-panel.tsx` | props da linha |
| Modify: `components/video-editor.tsx` | estado, persistência, undo, export |
| Modify: `package.json` | incluir os 2 testes novos |
| Modify: `docs/preview-overlays.md`, `docs/README.md`, `docs/enquadramento.md`, `docs/novo-projeto.md`, `docs/proximo.md` | ops |

---

### Task 1: Matemática e pintura pura

**Files:**
- Create: `lib/watermark.ts`
- Create: `lib/watermark.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_WATERMARK_PREFS,
  WATERMARK_FONT_PX,
  WATERMARK_MARGIN_PX,
  normalizeWatermarkPrefs,
  watermarkCenter,
  watermarkPaintInput,
  drawWatermark,
} from "./watermark.ts"

const FRAME = { width: 1080, height: 1920 }
const BOX = { width: 120, height: WATERMARK_FONT_PX }

test("normalizeWatermarkPrefs trims, turns newlines into spaces, and caps at 40", () => {
  const parsed = normalizeWatermarkPrefs({ text: "  @loja\nnome  ", loop: false })
  assert.equal(parsed.text, "@loja nome")
  assert.equal(parsed.loop, false)
})

test("normalizeWatermarkPrefs defaults loop to true and empty text on junk", () => {
  assert.deepEqual(normalizeWatermarkPrefs(null), DEFAULT_WATERMARK_PREFS)
  assert.equal(normalizeWatermarkPrefs({ text: "x" }).loop, true)
  assert.equal(normalizeWatermarkPrefs({ text: "   " }).text, "")
  assert.equal(normalizeWatermarkPrefs({ text: "a".repeat(50) }).text.length, 40)
})

test("watermarkCenter loop off is bottom-right inside the margin", () => {
  const c = watermarkCenter(0, FRAME, BOX, false)
  assert.equal(c.x, FRAME.width - WATERMARK_MARGIN_PX - BOX.width / 2)
  assert.equal(c.y, FRAME.height - WATERMARK_MARGIN_PX - BOX.height / 2)
})

test("watermarkCenter t=0 loop on matches loop off", () => {
  assert.deepEqual(
    watermarkCenter(0, FRAME, BOX, true),
    watermarkCenter(0, FRAME, BOX, false),
  )
})

test("watermarkCenter stays inside the usable box for several times", () => {
  const minX = WATERMARK_MARGIN_PX + BOX.width / 2
  const maxX = FRAME.width - WATERMARK_MARGIN_PX - BOX.width / 2
  const minY = WATERMARK_MARGIN_PX + BOX.height / 2
  const maxY = FRAME.height - WATERMARK_MARGIN_PX - BOX.height / 2
  for (const t of [0, 1, 10, 100]) {
    const c = watermarkCenter(t, FRAME, BOX, true)
    assert.ok(c.x >= minX - 1e-6 && c.x <= maxX + 1e-6, `x at t=${t}`)
    assert.ok(c.y >= minY - 1e-6 && c.y <= maxY + 1e-6, `y at t=${t}`)
  }
})

test("watermarkPaintInput is null unless enabled and text exist", () => {
  assert.equal(watermarkPaintInput(true, { text: "", loop: true }), null)
  assert.equal(watermarkPaintInput(false, { text: "@loja", loop: true }), null)
  assert.deepEqual(watermarkPaintInput(true, { text: "@loja", loop: false }), {
    text: "@loja",
    loop: false,
  })
})

test("drawWatermark with empty text does not call fillText", () => {
  let fills = 0
  const ctx = {
    save() {},
    restore() {},
    measureText: () => ({ width: 10 }),
    fillText: () => {
      fills += 1
    },
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D
  drawWatermark(ctx, 1, FRAME, null)
  drawWatermark(ctx, 1, FRAME, { text: "", loop: true })
  assert.equal(fills, 0)
  drawWatermark(ctx, 1, FRAME, { text: "@loja", loop: false })
  assert.equal(fills, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test lib/watermark.test.ts`

Expected: FAIL — `Cannot find module './watermark.ts'`

- [ ] **Step 3: Write `lib/watermark.ts`**

```ts
import { canvasFontFamily } from "./compose/fonts.ts"

export type WatermarkPrefs = {
  text: string
  loop: boolean
}

export type WatermarkPaint = {
  text: string
  loop: boolean
}

export type WatermarkFrame = { width: number; height: number }
export type WatermarkBox = { width: number; height: number }

export const DEFAULT_WATERMARK_PREFS: WatermarkPrefs = { text: "", loop: true }
export const WATERMARK_OPACITY = 0.22
export const WATERMARK_FONT_PX = 42
export const WATERMARK_MARGIN_PX = 48
export const WATERMARK_SPEED_X = 90
export const WATERMARK_SPEED_Y = 110
const TEXT_MAX = 40

export function normalizeWatermarkPrefs(raw: unknown): WatermarkPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WATERMARK_PREFS }
  const record = raw as Record<string, unknown>
  let text = typeof record.text === "string" ? record.text : ""
  text = text.replace(/\n/g, " ").trim()
  if (text.length > TEXT_MAX) text = text.slice(0, TEXT_MAX)
  const loop = record.loop === undefined ? true : record.loop === true
  return { text, loop }
}

export function watermarkPaintInput(
  enabled: boolean | undefined,
  prefs: WatermarkPrefs,
): WatermarkPaint | null {
  if (enabled !== true || !prefs.text) return null
  return { text: prefs.text, loop: prefs.loop }
}

function axisRange(frameSize: number, boxSize: number): { min: number; max: number } {
  const half = boxSize / 2
  const min = WATERMARK_MARGIN_PX + half
  const max = frameSize - WATERMARK_MARGIN_PX - half
  if (!(max >= min)) {
    const mid = frameSize / 2
    return { min: mid, max: mid }
  }
  return { min, max }
}

export function pingPong(t: number, min: number, max: number, speed: number): number {
  const range = max - min
  if (!(range > 0) || !(speed > 0)) return max
  const span = 2 * range
  let u = (t * speed) % span
  if (u < 0) u += span
  return u <= range ? max - u : min + (u - range)
}

export function watermarkCenter(
  t: number,
  frame: WatermarkFrame,
  box: WatermarkBox,
  loop: boolean,
): { x: number; y: number } {
  const xRange = axisRange(frame.width, box.width)
  const yRange = axisRange(frame.height, box.height)
  if (!loop) return { x: xRange.max, y: yRange.max }
  return {
    x: pingPong(t, xRange.min, xRange.max, WATERMARK_SPEED_X),
    y: pingPong(t, yRange.min, yRange.max, WATERMARK_SPEED_Y),
  }
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  time: number,
  frame: WatermarkFrame,
  paint: WatermarkPaint | null | undefined,
): void {
  const text = paint?.text
  if (!text) return
  ctx.save()
  ctx.globalAlpha = WATERMARK_OPACITY
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${WATERMARK_FONT_PX}px ${canvasFontFamily("geist")}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const width = ctx.measureText(text).width
  const center = watermarkCenter(
    time,
    frame,
    { width, height: WATERMARK_FONT_PX },
    paint.loop,
  )
  ctx.fillText(text, center.x, center.y)
  ctx.restore()
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `node --experimental-strip-types --test lib/watermark.test.ts`

Expected: PASS (todos os testes)

---

### Task 2: Storage global

**Files:**
- Create: `lib/watermark-store.ts`
- Create: `lib/watermark-store.test.ts`
- Modify: `lib/project-reset.ts` — **não muda comportamento**; o teste só prova que `newProjectComposition` não toca a chave.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import { newProjectComposition } from "./project-reset.ts"
import {
  WATERMARK_STORAGE_KEY,
  loadWatermarkPrefs,
  saveWatermarkPrefs,
} from "./watermark-store.ts"

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
  }
}

test("save then load round-trips normalized prefs", () => {
  const storage = memoryStorage()
  saveWatermarkPrefs({ text: "  @loja  ", loop: false }, storage)
  assert.deepEqual(loadWatermarkPrefs(storage), { text: "@loja", loop: false })
})

test("junk JSON yields the default prefs", () => {
  const storage = memoryStorage({ [WATERMARK_STORAGE_KEY]: "{not json" })
  assert.deepEqual(loadWatermarkPrefs(storage), { text: "", loop: true })
})

test("newProjectComposition does not clear watermark prefs", () => {
  const storage = memoryStorage()
  saveWatermarkPrefs({ text: "@loja", loop: true }, storage)
  newProjectComposition()
  assert.deepEqual(loadWatermarkPrefs(storage), { text: "@loja", loop: true })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test lib/watermark-store.test.ts`

Expected: FAIL — módulo ausente

- [ ] **Step 3: Write `lib/watermark-store.ts`**

```ts
import type { StorageLike } from "./project-store.ts"
import {
  DEFAULT_WATERMARK_PREFS,
  normalizeWatermarkPrefs,
  type WatermarkPrefs,
} from "./watermark.ts"

export const WATERMARK_STORAGE_KEY = "editor.watermark.v1"

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function loadWatermarkPrefs(
  storage: StorageLike | null = defaultStorage(),
): WatermarkPrefs {
  if (!storage) return { ...DEFAULT_WATERMARK_PREFS }
  try {
    const raw = storage.getItem(WATERMARK_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WATERMARK_PREFS }
    return normalizeWatermarkPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_WATERMARK_PREFS }
  }
}

export function saveWatermarkPrefs(
  prefs: WatermarkPrefs,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(
      WATERMARK_STORAGE_KEY,
      JSON.stringify(normalizeWatermarkPrefs(prefs)),
    )
  } catch (error) {
    console.warn("[editor] não gravei a marca d'água", error)
  }
}
```

- [ ] **Step 4: Run tests**

Run: `node --experimental-strip-types --test lib/watermark-store.test.ts`

Expected: PASS

---

### Task 3: `watermarkEnabled` na composição

**Files:**
- Modify: `lib/composition.ts`
- Modify: `lib/composition.test.ts`

- [ ] **Step 1: Write the failing tests** (append in `lib/composition.test.ts`)

```ts
test("parseComposition keeps watermarkEnabled only when it is boolean true", () => {
  const on = parseComposition({ ...sampleComposition(), watermarkEnabled: true })
  assert.equal(on.watermarkEnabled, true)
  const off = parseComposition({ ...sampleComposition(), watermarkEnabled: false })
  assert.equal(off.watermarkEnabled, undefined)
  const junk = parseComposition({ ...sampleComposition(), watermarkEnabled: "true" })
  assert.equal(junk.watermarkEnabled, undefined)
  const missing = parseComposition(sampleComposition())
  assert.equal(missing.watermarkEnabled, undefined)
})

test("serializeComposition omits watermarkEnabled unless true", () => {
  const on = JSON.parse(serializeComposition(sampleComposition({ watermarkEnabled: true }))) as {
    watermarkEnabled?: boolean
  }
  assert.equal(on.watermarkEnabled, true)
  const off = JSON.parse(serializeComposition(sampleComposition())) as {
    watermarkEnabled?: boolean
  }
  assert.equal(off.watermarkEnabled, undefined)
})

test("createDefaultComposition has no watermarkEnabled", () => {
  assert.equal(createDefaultComposition().watermarkEnabled, undefined)
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --experimental-strip-types --test lib/composition.test.ts`

Expected: FAIL — `watermarkEnabled` não existe no tipo / parse ignora o campo

- [ ] **Step 3: Minimal schema change**

Em `lib/composition.ts`, no `interface Composition`, depois de `customPresets?`:

```ts
  watermarkEnabled?: boolean
```

Em `parseComposition`, no objeto passado a `clampComposition`, depois de `customPresets`:

```ts
    ...(input.watermarkEnabled === true ? { watermarkEnabled: true } : {}),
```

Em `serializeComposition`, no `payload`, depois de `customPresets`:

```ts
    ...(composition.watermarkEnabled === true ? { watermarkEnabled: true } : {}),
```

Não incluir o campo em `createDefaultComposition()`. Não tocar em `source.watermarked`.

- [ ] **Step 4: Run tests**

Run: `node --experimental-strip-types --test lib/composition.test.ts`

Expected: PASS

---

### Task 4: Undo do toggle

**Files:**
- Modify: `lib/composition-history.ts`
- Modify: `lib/composition-history.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
test("pushPast treats watermarkEnabled change as a new snapshot", () => {
  const before = snap([chip("a")])
  const after: HistorySnapshot = { ...snap([chip("a")]), watermarkEnabled: true }
  const pushed = pushPast(emptyHistory(), before, after)
  assert.equal(pushed.past.length, 1)
  const undone = undo(pushed, after)
  assert.equal(undone.present.watermarkEnabled, undefined)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types --test lib/composition-history.test.ts`

Expected: FAIL de tipo ou `watermarkEnabled` ignorado — se `snapshotsEqual` já serializa o campo extra, o teste pode passar assim que o tipo existir. Primeiro acrescente o campo ao tipo.

- [ ] **Step 3: Add the field**

Em `HistorySnapshot`:

```ts
  watermarkEnabled?: boolean
```

Nada mais: `snapshotsEqual` já usa `JSON.stringify`. Omitido vs `true` já difere.

- [ ] **Step 4: Run tests**

Run: `node --experimental-strip-types --test lib/composition-history.test.ts`

Expected: PASS

---

### Task 5: Pintar no compositor

**Files:**
- Modify: `lib/compose/draw-play.ts`
- Modify: `lib/export/compositor.ts`
- Modify: `lib/export/encoder.ts`

- [ ] **Step 1: Extend `drawPlayInserts`**

Em `lib/compose/draw-play.ts`:

```ts
import { drawWatermark, type WatermarkPaint } from "../watermark.ts"
```

Último parâmetro opcional:

```ts
  watermark?: WatermarkPaint | null,
): void {
```

No `try`, **depois** de `drawCaptionInserts(...)`:

```ts
    drawWatermark(ctx, time, PLAY_FRAME, watermark)
```

- [ ] **Step 2: Thread through `drawFrame`**

`lib/export/compositor.ts` — assinatura:

```ts
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  composition: Composition,
  time: number,
  _fontFamily: string,
  blobUrls: Record<string, string> = {},
  scale?: number,
  watermark?: import("../watermark.ts").WatermarkPaint | null,
): void {
```

Preferir import nomeado no topo:

```ts
import type { WatermarkPaint } from "../watermark.ts"
```

Na chamada de `drawPlayInserts`, último arg: `watermark ?? null`.

- [ ] **Step 3: `ExportOptions`**

`lib/export/encoder.ts`:

```ts
import type { WatermarkPaint } from "../watermark.ts"

export interface ExportOptions {
  video: HTMLVideoElement
  composition: Composition
  fontFamily: string
  signal: AbortSignal
  onProgress: (progress: ExportProgress) => void
  stickerBlobUrls?: Record<string, string>
  watermark?: WatermarkPaint | null
}
```

Nas **duas** chamadas `drawFrame(...)` (MediaRecorder e WebCodecs), passar `options.watermark` como 8º argumento (depois de `scale` se a WebCodecs não passa scale — hoje a assinatura é `blobUrls` depois `scale?`. Manter posição: `drawFrame(ctx, video, composition, time, fontFamily, options.stickerBlobUrls, undefined, options.watermark)`).

- [ ] **Step 4: Typecheck the three files**

Run: `node --experimental-strip-types --test lib/watermark.test.ts lib/composition.test.ts`

Expected: PASS. `draw-play` não tem teste próprio; a integração entra na Task 6.

---

### Task 6: Snapshot no Remotion / render-server

**Files:**
- Modify: `remotion/types.ts`
- Modify: `remotion/types.test.ts`
- Modify: `remotion/InsertRenderer.tsx`
- Modify: `render-server/props.ts`
- Modify: `render-server/props.test.ts`

- [ ] **Step 1: Write the failing tests** (append `remotion/types.test.ts`)

```ts
test("toRenderProps copies watermark only when enabled and text is set", () => {
  const composition = sampleComposition({ watermarkEnabled: true })
  const withText = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "@loja", loop: false },
  })
  assert.deepEqual(withText.watermark, { text: "@loja", loop: false })

  const empty = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "", loop: true },
  })
  assert.equal(empty.watermark, undefined)

  const off = toRenderProps({
    composition: sampleComposition(),
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: { text: "@loja", loop: true },
  })
  assert.equal(off.watermark, undefined)
})
```

Append `render-server/props.test.ts`:

```ts
test("parseRenderProps keeps a valid watermark and drops a malformed one", () => {
  const ok = parseRenderProps(
    JSON.stringify({
      ...defaultRenderProps,
      watermark: { text: "@loja", loop: true },
    }),
  )
  assert.deepEqual(ok.watermark, { text: "@loja", loop: true })

  const bad = parseRenderProps(
    JSON.stringify({
      ...defaultRenderProps,
      watermark: { text: 1, loop: "yes" },
    }),
  )
  assert.equal(bad.watermark, undefined)
})
```

- [ ] **Step 2: Run to verify fail**

Run: `node --experimental-strip-types --test remotion/types.test.ts render-server/props.test.ts`

Expected: FAIL — `watermarkPrefs` / `watermark` inexistentes

- [ ] **Step 3: Implement types + parse**

`remotion/types.ts`:

```ts
import {
  normalizeWatermarkPrefs,
  watermarkPaintInput,
  type WatermarkPaint,
  type WatermarkPrefs,
} from "../lib/watermark.ts"
```

Em `RenderProps`:

```ts
  watermark?: WatermarkPaint
```

`toRenderProps` ganha `watermarkPrefs?: WatermarkPrefs` no input. No return, depois de `customPresets`:

```ts
    ...(watermarkPaintInput(
      composition.watermarkEnabled,
      normalizeWatermarkPrefs(input.watermarkPrefs ?? {}),
    )
      ? {
          watermark: watermarkPaintInput(
            composition.watermarkEnabled,
            normalizeWatermarkPrefs(input.watermarkPrefs ?? {}),
          )!,
        }
      : {}),
```

Evitar chamar duas vezes — guardar em `const paint = watermarkPaintInput(...)`.

`toCliRenderProps` já espalha `...props`; o campo segue.

`remotion/InsertRenderer.tsx` — na chamada `drawPlayInserts` em `paintInserts`, último arg: `props.watermark ?? null`.

`render-server/props.ts` — depois de `isRenderProps`, sanitizar:

```ts
function sanitizeWatermark(value: RenderProps): RenderProps {
  const raw = (value as { watermark?: unknown }).watermark
  if (!raw || typeof raw !== "object") {
    const { watermark: _drop, ...rest } = value as RenderProps & { watermark?: unknown }
    void _drop
    return rest
  }
  const record = raw as Record<string, unknown>
  if (typeof record.text !== "string" || typeof record.loop !== "boolean") {
    const { watermark: _drop, ...rest } = value
    void _drop
    return rest
  }
  const text = record.text.trim()
  if (!text) {
    const { watermark: _drop, ...rest } = value
    void _drop
    return rest
  }
  return { ...value, watermark: { text, loop: record.loop } }
}
```

Em `parseRenderProps`, `return sanitizeWatermark(parsed)`.

Se `watermark` estiver ausente, `sanitizeWatermark` não deve apagar outros campos: se `raw` é `undefined`, return `value` intacto (sem destructure que remove undefined key). Corrigir:

```ts
function sanitizeWatermark(value: RenderProps): RenderProps {
  if (!("watermark" in value) || value.watermark === undefined) return value
  const raw = value.watermark as unknown
  if (!raw || typeof raw !== "object") {
    const rest = { ...value }
    delete rest.watermark
    return rest
  }
  const record = raw as Record<string, unknown>
  if (typeof record.text !== "string" || typeof record.loop !== "boolean") {
    const rest = { ...value }
    delete rest.watermark
    return rest
  }
  const text = record.text.trim()
  if (!text) {
    const rest = { ...value }
    delete rest.watermark
    return rest
  }
  return { ...value, watermark: { text, loop: record.loop } }
}
```

- [ ] **Step 4: Run tests**

Run: `node --experimental-strip-types --test remotion/types.test.ts render-server/props.test.ts`

Expected: PASS

---

### Task 7: Preview canvas pinta sem inserts

**Files:**
- Modify: `components/overlay-canvas.tsx`
- Modify: `components/preview-panel.tsx`

Hoje `hasLayer = inserts.length > 0` **apaga** o canvas se não há inserts — a marca sozinha não apareceria.

- [ ] **Step 1: OverlayCanvas prop**

Adicionar `watermark?: WatermarkPaint | null` nas props (importar tipo de `lib/watermark.ts`).

Trocar:

```ts
  const hasLayer = inserts.length > 0 || Boolean(watermark)
```

Na chamada `drawPlayInserts`, último arg: `watermark ?? null`.

Incluir `watermark` no array de deps do `useEffect` de pintura.

`ensureComposeFontsReady` aceita `string | readonly string[]`. A marca pinta em Geist 800:

```ts
await ensureComposeFontsReady([
  ...fontIdsForRender({ brand: { fontId }, inserts, captionStyle }),
  ...(watermark?.text ? ["geist"] : []),
])
```

- [ ] **Step 2: PreviewPanel**

`components/preview-panel.tsx`: prop `watermark?: WatermarkPaint | null` e passar para `<OverlayCanvas watermark={watermark} />`.

Quem chama PreviewPanel (`video-editor.tsx`) entra na Task 8.

---

### Task 8: UI no card Origem + wiring

**Files:**
- Modify: `components/background-source-card.tsx`
- Modify: `components/control-panel.tsx`
- Modify: `components/video-editor.tsx`

- [ ] **Step 1: Linha compacta no card**

Importar `ToggleGroup` / `ToggleGroupItem` e o tipo `WatermarkPrefs`.

Props novas:

```ts
  watermarkEnabled?: boolean
  watermarkPrefs: WatermarkPrefs
  onWatermarkEnabledChange?: (enabled: boolean) => void
  onWatermarkPrefsChange?: (prefs: WatermarkPrefs) => void
```

Função no mesmo arquivo (não card extra):

```tsx
function WatermarkRow({
  enabled,
  prefs,
  canEnable,
  onEnabledChange,
  onPrefsChange,
}: {
  enabled: boolean
  prefs: WatermarkPrefs
  canEnable: boolean
  onEnabledChange?: (enabled: boolean) => void
  onPrefsChange?: (prefs: WatermarkPrefs) => void
}) {
  return (
    <div
      className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-border pt-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label className="flex shrink-0 items-center gap-1 text-[0.7rem] font-medium text-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-brand"
          checked={enabled}
          disabled={!canEnable}
          aria-label="Marca d'água neste vídeo"
          onChange={(event) => onEnabledChange?.(event.target.checked)}
        />
        Marca
      </label>
      <input
        type="text"
        maxLength={40}
        placeholder="@minhaloja"
        aria-label="Handle da marca d'água"
        className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 text-xs"
        value={prefs.text}
        onChange={(event) =>
          onPrefsChange?.({ ...prefs, text: event.target.value })
        }
      />
      <ToggleGroup
        value={[prefs.loop ? "loop" : "still"]}
        onValueChange={(value) => {
          const next = value[0]
          if (next === "loop") onPrefsChange?.({ ...prefs, loop: true })
          if (next === "still") onPrefsChange?.({ ...prefs, loop: false })
        }}
        variant="outline"
        className="shrink-0"
        aria-label="Movimento da marca d'água"
      >
        <ToggleGroupItem value="still" className="h-7 px-2 text-[0.65rem]">
          Parado
        </ToggleGroupItem>
        <ToggleGroupItem value="loop" className="h-7 px-2 text-[0.65rem]">
          Loop
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
```

No estado **playable** (`playable && !showEditor`): a linha vai **na coluna do nome**, depois dos links, **não** na coluna Trocar. Estender o `closest`:

```ts
if ((event.target as HTMLElement).closest?.("button, a, input, label, textarea")) return
```

No estado vazio / Trocar (card dashed): a mesma `<WatermarkRow>` no fim do card, `canEnable={playable}`.

Sem parágrafo de ajuda.

- [ ] **Step 2: ControlPanel**

Receber e encaminhar as 4 props para `BackgroundSourceCard`. Defaults: `watermarkPrefs = { text: "", loop: true }`, `watermarkEnabled = false`.

- [ ] **Step 3: VideoEditor**

Imports: `loadWatermarkPrefs`, `saveWatermarkPrefs`, `watermarkPaintInput`, `normalizeWatermarkPrefs`, tipos.

Estado:

```ts
const [watermarkPrefs, setWatermarkPrefs] = useState(() => loadWatermarkPrefs())
```

`historyPresent`:

```ts
function historyPresent(composition: Composition): HistorySnapshot {
  return {
    inserts: composition.inserts,
    captionStyle: composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
    tracks: composition.tracks,
    styleRef: composition.styleRef,
    sourceTransform: composition.source.transform,
    ...(composition.watermarkEnabled === true ? { watermarkEnabled: true } : {}),
  }
}
```

`applyHistoryPresent` — restaurar o toggle sem deixar `false` persistido se o spec omite:

```ts
    const next = clampComposition({
      ...compositionRef.current,
      inserts: snapshot.inserts,
      captionStyle: snapshot.captionStyle,
      tracks: snapshot.tracks,
      styleRef: snapshot.styleRef,
      source: snapshot.sourceTransform
        ? { ...sourceRest, transform: snapshot.sourceTransform }
        : sourceRest,
      watermarkEnabled: snapshot.watermarkEnabled === true ? true : undefined,
    })
```

Handlers:

```ts
  const handleWatermarkEnabled = useCallback((enabled: boolean) => {
    applyComposition((current) => ({
      ...current,
      watermarkEnabled: enabled ? true : undefined,
    }), "discrete")
  }, [applyComposition])

  const handleWatermarkPrefs = useCallback((prefs: typeof watermarkPrefs) => {
    const next = normalizeWatermarkPrefs(prefs)
    setWatermarkPrefs(next)
    saveWatermarkPrefs(next)
  }, [])
```

`const watermarkPaint = watermarkPaintInput(composition.watermarkEnabled, watermarkPrefs)`

Passar `watermark={watermarkPaint}` ao `PreviewPanel`.

`runDraft`: `watermark: watermarkPaint` em `exportComposition`.

`toRenderProps({ ..., watermarkPrefs })` no export Final.

Novo projeto **não** chama `saveWatermarkPrefs` nem zera o estado de prefs (o `useState` inicial já veio do storage; não resetar no `onNewProject`).

---

### Task 9: package.json + docs de ops

**Files:**
- Modify: `package.json` (`scripts.test`) — acrescentar `lib/watermark.test.ts lib/watermark-store.test.ts` na lista (junto dos outros `lib/`).
- Modify: `docs/preview-overlays.md` §4 — ordem:

```
vídeo
  → chips
  → stickers PNG
  → textos
  → captions
  → marca d’água (`drawWatermark`, se ligada)
  → chrome de seleção (preview)
  → Feed / Safe area (preview CSS, nunca no MP4)
```

Hit-test **não** inclui a marca.

- Modify: `docs/README.md` §6 persistência — linha `editor.watermark.v1` (handle + loop). `watermarkEnabled` no JSON da composição.
- Modify: `docs/enquadramento.md` § Card Origem — uma linha **Marca / handle / Loop** na coluna do nome.
- Modify: `docs/novo-projeto.md` — Novo projeto **mantém** handle/loop do editor; o checkbox nasce desligado (composição nova).
- Modify: `docs/proximo.md` — item feito na tabela “Já está no ar” quando publicar; até lá, não marcar como no ar.
- Modify: spec status → pode ficar “spec; plano em `plans/2026-08-22-marca-dagua.md`”.

- [ ] **Step 1: Add the two test files to `package.json` `scripts.test`**

- [ ] **Step 2: Run the focused suite**

Run:

```
node --experimental-strip-types --test lib/watermark.test.ts lib/watermark-store.test.ts lib/composition.test.ts lib/composition-history.test.ts remotion/types.test.ts render-server/props.test.ts
```

Expected: PASS

- [ ] **Step 3: Update the ops docs listed above**

Não publicar. Não PM2. Não encoder.

---

## Self-review (spec coverage)

| Spec | Task |
| --- | --- |
| Prefs globais `{ text, loop }` + chave `editor.watermark.v1` | 1–2 |
| Normalize trim / `\n` / 40 / loop default | 1 |
| Storage lixo → default; quota warn | 2 (`console.warn` no save) |
| `watermarkEnabled` v4 aditivo; omitido = off | 3 |
| Novo projeto não apaga prefs | 2 + 8 |
| Undo só do toggle | 4 + 8 `historyPresent` |
| Bounce `f(t)`, t=0 = canto | 1 |
| `drawPlayInserts` último | 5 |
| Snapshot Final / parse omite lixo | 6 |
| Preview pinta sem inserts | 7 |
| Linha no card Origem, stopPropagation | 8 |
| Rascunho `drawFrame` recebe snapshot | 5 + 8 |
| Geist 800, 0.22, 42px, branco | 1 `drawWatermark` |
| Sem hit-test / timeline / PNG / checklist | não há task — não implementar |
| `source.watermarked` intocado | 3 |
