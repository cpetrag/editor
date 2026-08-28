# Legendas estilo compartilhado Implementation Plan

> **Status:** implementado e no ar em 2026-08-20. Checkboxes abaixo são o plano original (histórico).
> Doc canônico: [`docs/legendas.md`](../../legendas.md). Changelog: [`docs/changelog-2026-08-20.md`](../../changelog-2026-08-20.md).
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: `docs/superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md`. TDD.
> Este share **não é git repo** — pular todos os passos de commit.
> Sem `pnpm add`. Windows: `node --experimental-strip-types --test <arquivo>`.
> `lib/composition.ts` **não** importa `lib/captions.ts`. Sem bump de `COMPOSITION_VERSION` (fica 3). Não alterar `POST /api/ai/captions`.

**Goal:** Fonte, tamanho, posição e cores das legendas vivem num `captionStyle` único; editar uma linha ou arrastar no preview muda todas; Viral/Limpo só escolhem o modo de desenho.

**Architecture:** `CaptionStyle` na Composition (parse/serialize/migração da primeira linha antiga). Draw, hit-test e card lêem esse objeto. Inserts `legenda` só têm texto/tempo/words. Undo passa a snapshot `{ inserts, captionStyle }`; `captionPreset` continua fora.

**Tech Stack:** Next.js 16, `node --experimental-strip-types --test`.

---

## File map

| File | Responsibility |
| --- | --- |
| Modify `lib/compose/insert-style.ts` | exportar `parseCssColor` |
| Modify `lib/composition.ts` | `CaptionStyle`, defaults, parse/migrate/serialize, `mergeCaptionStylePatch`, `captionInsertForLayout`; caption sem overlay na linha |
| Modify `lib/composition.test.ts` | parse/serialize/migração/`mergeCaptionStylePatch` |
| Modify `lib/composition-history.ts` | snapshot `{ inserts, captionStyle }` |
| Modify `lib/composition-history.test.ts` | API nova + undo de style sem preset |
| Modify `lib/inserts.ts` | `createInsert("legenda")` sem x/y/fontSize/style |
| Modify `lib/captions.ts` / `lib/captions.test.ts` | linhas novas sem overlay |
| Modify `lib/project-store.test.ts` | fixture ganha `captionStyle` |
| Modify `lib/compose/draw-captions.ts` | pinta com `CaptionStyle` |
| Modify `lib/compose/draw-play.ts` | último arg `captionStyle` |
| Modify `lib/export/compositor.ts` | passa `composition.captionStyle` |
| Modify `lib/compose/hit-test.ts` / teste | bbox já recebe insert mesclado |
| Modify `components/overlay-canvas.tsx` | mescla style; drag/resize → captionStyle |
| Modify `components/preview-panel.tsx` | prop `captionStyle` |
| Modify `components/video-editor.tsx` | history + `applyCaptionStyle`; Gerar legendas não toca style |
| Modify `components/insert-card.tsx` / `insert-style-panel.tsx` | valores e patches no objeto compartilhado |
| Modify `docs/README.md`, `docs/proximo.md`, spec pai | look compartilhado |

Não mexer: encoder, muxer, rota captions, `transcribeMedia`, `pnpm add`.

---

### Task 1: Schema `CaptionStyle` (TDD)

**Files:**
- Modify: `lib/compose/insert-style.ts` — `export` em `parseCssColor`
- Modify: `lib/composition.ts`
- Modify: `lib/composition.test.ts`
- Modify: `lib/project-store.test.ts` — acrescentar `captionStyle: DEFAULT_CAPTION_STYLE` no fixture (o tipo `Composition` vai exigir o campo)

- [ ] **Step 1: Exportar a cor** — em `lib/compose/insert-style.ts` linha ~177, trocar `function parseCssColor` por `export function parseCssColor`.

- [ ] **Step 2: Testes que falham** — no fim de `lib/composition.test.ts`, importar `DEFAULT_CAPTION_STYLE`, `mergeCaptionStylePatch`. Em `sampleComposition`, acrescentar `captionStyle: DEFAULT_CAPTION_STYLE`.

```ts
test("parseComposition reads captionStyle", () => {
  const parsed = parseComposition({
    ...sampleComposition({
      captionStyle: {
        ...DEFAULT_CAPTION_STYLE,
        y: 60,
        highlightColor: "#00E5FF",
        bgColor: "rgba(0,0,0,0.4)",
      },
    }),
  })
  assert.equal(parsed.captionStyle.y, 60)
  assert.equal(parsed.captionStyle.highlightColor, "#00E5FF")
  assert.equal(parsed.captionStyle.bgColor, "rgba(0,0,0,0.4)")
})

test("parseComposition defaults invalid captionStyle fields", () => {
  const parsed = parseComposition({
    ...sampleComposition(),
    captionStyle: { y: "nope", fontSize: 9999, highlightColor: "yellow" },
  })
  assert.equal(parsed.captionStyle.y, DEFAULT_CAPTION_STYLE.y)
  assert.equal(parsed.captionStyle.fontSize, FONT_SIZE_MAX)
  assert.equal(parsed.captionStyle.highlightColor, DEFAULT_CAPTION_STYLE.highlightColor)
})

test("parseComposition migrates captionStyle from the first caption insert", () => {
  const parsed = parseComposition({
    ...sampleComposition({ captionStyle: undefined as never }),
    captionStyle: undefined,
    inserts: [
      {
        id: "c1",
        type: "legenda",
        kind: "caption",
        start: 0,
        duration: 2,
        text: "oi",
        words: [],
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        x: 40,
        y: 60,
        fontSize: 80,
      },
    ],
  })
  assert.equal(parsed.captionStyle.x, 40)
  assert.equal(parsed.captionStyle.y, 60)
  assert.equal(parsed.captionStyle.fontSize, 80)
  assert.equal(parsed.captionStyle.highlightColor, "#FFE500")
})

test("serializeComposition always writes captionStyle and omits caption overlay fields", () => {
  const parsed = parseComposition(
    sampleComposition({
      captionStyle: { ...DEFAULT_CAPTION_STYLE, y: 61 },
      inserts: [
        {
          id: "c1",
          type: "legenda",
          kind: "caption",
          start: 0,
          duration: 2,
          text: "oi",
          words: [],
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
        },
      ],
    }),
  )
  const again = JSON.parse(serializeComposition(parsed)) as {
    captionStyle?: { y?: number }
    inserts: Array<{ x?: number; y?: number; fontSize?: number; style?: unknown }>
  }
  assert.equal(again.captionStyle?.y, 61)
  assert.equal(again.inserts[0]?.x, undefined)
  assert.equal(again.inserts[0]?.y, undefined)
  assert.equal(again.inserts[0]?.fontSize, undefined)
  assert.equal(again.inserts[0]?.style, undefined)
})

test("mergeCaptionStylePatch clamps fontSize and x", () => {
  const next = mergeCaptionStylePatch(DEFAULT_CAPTION_STYLE, { fontSize: 10, x: 200 })
  assert.equal(next.fontSize, 40)
  assert.equal(next.x, 100)
})
```

O teste de migração precisa passar um JSON **cru** (sem `captionStyle` no objeto). Se `sampleComposition` sempre inclui o campo, montar o input à mão como no teste (spread e `captionStyle: undefined` no objeto passado a `parseComposition`).

- [ ] **Step 3: Rodar e ver falhar**

```
node --experimental-strip-types --test lib/composition.test.ts
```

Expected: FAIL (`DEFAULT_CAPTION_STYLE` / `mergeCaptionStylePatch` não existem, ou `captionStyle` ausente no tipo).

- [ ] **Step 4: Implementar** em `lib/composition.ts`:

Importar `type FontId`, `type FontWeight`, `parseFontId`, `clampFontWeight`, `parseCssColor` de `./compose/insert-style.ts`.

```ts
export const DEFAULT_CAPTION_HIGHLIGHT = "#FFE500"
export const DEFAULT_CAPTION_COLOR = "#FFFFFF"
export const DEFAULT_CAPTION_BG = "rgba(0,0,0,0.72)"
export const DEFAULT_CAPTION_STROKE = "#000000"
export const DEFAULT_CAPTION_STROKE_WIDTH = 6

export interface CaptionStyle {
  x: number
  y: number
  fontSize: number
  maxWidthPct: number
  fontFamily: FontId
  fontWeight: FontWeight
  color: string
  highlightColor: string
  bgColor: string
  strokeColor: string
  strokeWidth: number
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  x: DEFAULT_CAPTION_X,
  y: DEFAULT_CAPTION_Y,
  fontSize: DEFAULT_CAPTION_FONT_SIZE,
  maxWidthPct: DEFAULT_MAX_WIDTH_PCT,
  fontFamily: "geist",
  fontWeight: 800,
  color: DEFAULT_CAPTION_COLOR,
  highlightColor: DEFAULT_CAPTION_HIGHLIGHT,
  bgColor: DEFAULT_CAPTION_BG,
  strokeColor: DEFAULT_CAPTION_STROKE,
  strokeWidth: DEFAULT_CAPTION_STROKE_WIDTH,
}

export function mergeCaptionStylePatch(
  style: CaptionStyle,
  patch: Partial<CaptionStyle>,
): CaptionStyle {
  const next = { ...style, ...patch }
  next.x = clamp(roundTenths(next.x), OVERLAY_X_MIN, OVERLAY_X_MAX)
  next.y = clamp(roundTenths(next.y), OVERLAY_Y_MIN, OVERLAY_Y_MAX)
  next.fontSize = Math.round(clamp(next.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
  next.maxWidthPct = clamp(next.maxWidthPct, 20, 100)
  next.fontFamily = parseFontId(next.fontFamily) ?? DEFAULT_CAPTION_STYLE.fontFamily
  next.fontWeight = clampFontWeight(next.fontFamily, next.fontWeight)
  next.strokeWidth = Math.round(clamp(next.strokeWidth, 0, 12))
  next.color = parseCssColor(next.color) ?? DEFAULT_CAPTION_COLOR
  next.highlightColor = parseCssColor(next.highlightColor) ?? DEFAULT_CAPTION_HIGHLIGHT
  next.bgColor = parseCssColor(next.bgColor) ?? DEFAULT_CAPTION_BG
  next.strokeColor = parseCssColor(next.strokeColor) ?? DEFAULT_CAPTION_STROKE
  return next
}

export function captionInsertForLayout(
  insert: CompositionInsert,
  style: CaptionStyle,
): CompositionInsert {
  if (insertKind(insert) !== "caption") return insert
  return {
    ...insert,
    x: style.x,
    y: style.y,
    fontSize: style.fontSize,
    maxWidthPct: style.maxWidthPct,
    style: {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      uppercase: false,
      color: style.color,
      bgColor: style.bgColor,
      strokeWidth: style.strokeWidth,
      strokeColor: style.strokeColor,
      shadow: "none",
      opacity: 1,
      rotation: 0,
    },
  }
}
```

`parseCaptionStyle(raw, fallback = DEFAULT_CAPTION_STYLE)`: se `raw` não for objeto, devolver `{ ...fallback }`. Senão `mergeCaptionStylePatch(fallback, campos lidos)`. `fontSize` 9999 clampa em 360 (o teste usa `FONT_SIZE_MAX`). `highlightColor: "yellow"` não passa em `parseCssColor` → default.

**Migração** em `parseComposition`, **antes** de `parseInsert` descartar overlay — ler `input.inserts` cru:

```ts
function migrateCaptionStyle(input: Record<string, unknown>): CaptionStyle {
  if (isRecord(input.captionStyle)) {
    return parseCaptionStyle(input.captionStyle)
  }
  const rawInserts = Array.isArray(input.inserts) ? input.inserts : []
  const rawCaption = rawInserts.find(
    (item) => isRecord(item) && (item.type === "legenda" || item.kind === "caption"),
  )
  if (!isRecord(rawCaption)) return { ...DEFAULT_CAPTION_STYLE }
  const style = isRecord(rawCaption.style) ? rawCaption.style : {}
  return parseCaptionStyle({
    x: rawCaption.x,
    y: rawCaption.y,
    fontSize: rawCaption.fontSize,
    maxWidthPct: rawCaption.maxWidthPct,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    color: style.color,
    bgColor: style.bgColor === null ? undefined : style.bgColor,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
  })
}
```

`parseInsert` no ramo `caption`: **não** copiar `x`/`y`/`fontSize`/`maxWidthPct`/`style`/`fontFamily`/`rotation` para o insert. Só `kind`, `text`, `words`, `anchor`, `animIn`/`Out` `"none"`.

`serializeInsert` ramo caption:

```ts
return {
  id: insert.id,
  type: insert.type,
  kind: "caption",
  start: insert.start,
  duration: insert.duration,
  text: insert.text ?? "",
  anchor: insert.anchor,
  animIn: "none",
  animOut: "none",
  words: insert.words ?? [],
}
```

Não espalhar `base.style`.

`serializeComposition` e `createDefaultComposition`: `captionStyle: composition.captionStyle` / `DEFAULT_CAPTION_STYLE`.

`Composition` ganha `captionStyle: CaptionStyle`.

- [ ] **Step 5: Testes PASS** + `lib/project-store.test.ts` com `captionStyle: DEFAULT_CAPTION_STYLE`.

```
node --experimental-strip-types --test lib/composition.test.ts lib/project-store.test.ts
```

Expected: PASS.

---

### Task 2: Undo inclui `captionStyle` (TDD)

**Files:**
- Modify: `lib/composition-history.ts`
- Modify: `lib/composition-history.test.ts`
- Modify: `components/video-editor.tsx` (assinaturas; wiring completo de look é Task 6, mas o compile não pode quebrar — adaptar `beginInsertGesture` / `undo` / `applyInserts` / `applyHistoryPresent` para o snapshot)

- [ ] **Step 1: Testes** — no topo de `lib/composition-history.test.ts`:

```ts
import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from "./composition.ts"
import type { HistorySnapshot } from "./composition-history.ts"

function snap(
  inserts: CompositionInsert[],
  captionStyle: CaptionStyle = DEFAULT_CAPTION_STYLE,
): HistorySnapshot {
  return { inserts, captionStyle }
}
```

Trocar cada chamada para passar `snap(array)` e ler `result.present.inserts`. Exemplo do primeiro teste:

```ts
test("pushPast + undo restores the previous array including deleted id", () => {
  const before = snap([chip("a"), chip("b")])
  const after = snap([chip("a")])
  const pushed = pushPast(emptyHistory(), before, after)
  const result = undo(pushed, after)
  assert.equal(result.present.inserts.length, 2)
  assert.equal(result.present.inserts[1]?.id, "b")
})
```

Novos testes:

```ts
test("undo restores captionStyle and not captionPreset", () => {
  const before = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, color: "#FF0000" })
  const after = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, color: "#00FF00" })
  const pushed = pushPast(emptyHistory(), before, after)
  const result = undo(pushed, after)
  assert.equal(result.present.captionStyle.color, "#FF0000")
  assert.equal(result.present.inserts[0]?.id, "a")
})

test("gesture snapshot restores captionStyle from baseline", () => {
  const baseline = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, y: 72 })
  const end = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, y: 50 })
  const gesture = beginInsertGesture(baseline)
  const closed = endInsertGesture(emptyHistory(), gesture, end)
  const undone = undo(closed.history, end)
  assert.equal(undone.present.captionStyle.y, 72)
})
```

Não guardar `captionPreset` no snapshot (não existe no tipo).

- [ ] **Step 2: Rodar e ver falhar**

```
node --experimental-strip-types --test lib/composition-history.test.ts
```

- [ ] **Step 3: Implementar** — substituir o módulo por snapshot:

```ts
import type { CaptionStyle, CompositionInsert } from "./composition.ts"

export interface HistorySnapshot {
  inserts: CompositionInsert[]
  captionStyle: CaptionStyle
}

export interface InsertHistory {
  past: HistorySnapshot[]
  future: HistorySnapshot[]
}

export interface InsertGesture {
  active: boolean
  baseline: HistorySnapshot | null
}

export function cloneSnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as HistorySnapshot
}

export function snapshotsEqual(a: HistorySnapshot, b: HistorySnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function pushPast(
  history: InsertHistory,
  before: HistorySnapshot,
  after: HistorySnapshot,
): InsertHistory {
  if (snapshotsEqual(before, after)) return history
  const past = [...history.past, cloneSnapshot(before)]
  while (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}

export function undo(
  history: InsertHistory,
  present: HistorySnapshot,
): { history: InsertHistory; present: HistorySnapshot } { /* igual, cloneSnapshot */ }

export function redo(history, present): { history: InsertHistory; present: HistorySnapshot } { /* igual */ }

export function beginInsertGesture(
  present: HistorySnapshot,
  current?: InsertGesture,
): InsertGesture {
  if (current?.active) return current
  return { active: true, baseline: cloneSnapshot(present) }
}

export function endInsertGesture(
  history: InsertHistory,
  gesture: InsertGesture,
  present: HistorySnapshot,
): { history: InsertHistory; gesture: InsertGesture } {
  if (!gesture.active || !gesture.baseline) {
    return { history, gesture: emptyGesture() }
  }
  return {
    history: pushPast(history, gesture.baseline, present),
    gesture: emptyGesture(),
  }
}

export function commitDiscrete(
  history: InsertHistory,
  gesture: InsertGesture,
  before: HistorySnapshot,
  after: HistorySnapshot,
): { history: InsertHistory; gesture: InsertGesture } {
  const closed = endInsertGesture(history, gesture, before)
  return {
    history: pushPast(closed.history, before, after),
    gesture: closed.gesture,
  }
}
```

Manter `emptyHistory`, `emptyGesture`, `HISTORY_LIMIT`, `historyShortcut`, `canUndo`, `canRedo`. Remover `cloneInserts` / `insertsEqual` **ou** deixá-los como wrappers de `snapshot.inserts` se algum teste ainda importar — os testes atuais não precisam deles; apagar se nada mais importar.

Em `video-editor.tsx`, helper local:

```ts
function historyPresent(composition: Composition): HistorySnapshot {
  return {
    inserts: composition.inserts,
    captionStyle: composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
  }
}
```

`beginInsertHistory`: `beginInsertGesture(historyPresent(compositionRef.current), gestureRef.current)`.

`endInsertHistory`: `endInsertGesture(history, gesture, historyPresent(compositionRef.current))`.

`applyInserts`: `commitDiscrete(..., historyPresent({...prev, inserts: prevInserts}), historyPresent({...prev, inserts: nextInserts}))` — `captionStyle` igual nos dois lados.

`applyHistoryPresent(snapshot)`: aplica `inserts` **e** `captionStyle`.

`undo`/`redo` no keydown: passar e restaurar o snapshot completo.

`createDefaultComposition` já terá `captionStyle` (Task 1). Estado inicial do editor: garantir `captionStyle` no seed.

- [ ] **Step 4: PASS**

```
node --experimental-strip-types --test lib/composition-history.test.ts lib/composition.test.ts
```

---

### Task 3: Linhas novas sem overlay (TDD)

**Files:**
- Modify: `lib/inserts.ts` `createInsert` ramo `legenda` — remover `x`, `y`, `fontSize`, `maxWidthPct`, `textAlign`
- Modify: `lib/captions.test.ts` se algum insert criado via `linesToCaptionInserts` assertar `x`/`fontSize`

- [ ] **Step 1: Teste** em `lib/captions.test.ts`:

```ts
test("linesToCaptionInserts does not copy overlay look onto the line", () => {
  const [insert] = linesToCaptionInserts(
    [{ text: "oi", start: 0, duration: 1, words: [{ text: "oi", start: 0, end: 1 }] }],
    10,
  )
  assert.equal(insert?.x, undefined)
  assert.equal(insert?.y, undefined)
  assert.equal(insert?.fontSize, undefined)
  assert.equal(insert?.style, undefined)
})
```

- [ ] **Step 2: Rodar** `node --experimental-strip-types --test lib/captions.test.ts` — FAIL se `createInsert` ainda preenche x/y.

- [ ] **Step 3: `createInsert` caption:**

```ts
if (type === CAPTION_INSERT_TYPE) {
  return {
    ...newInsertId(),
    type,
    kind: "caption",
    start: 0,
    duration: 3,
    text: "",
    words: [],
    animIn: "none",
    animOut: "none",
    anchor: "bottom",
  }
}
```

- [ ] **Step 4: PASS** `lib/captions.test.ts`. Hit-test continua passando `x/y/fontSize` no fixture (simula insert já mesclado).

---

### Task 4: Draw usa `CaptionStyle`

**Files:**
- Modify: `lib/compose/draw-captions.ts`
- Modify: `lib/compose/draw-play.ts`
- Modify: `lib/export/compositor.ts`
- Modify: `components/overlay-canvas.tsx` (assinatura; mescla na Task 5)
- Modify: `components/preview-panel.tsx`

- [ ] **Step 1:** `drawCaptionLine` ganha arg `style: CaptionStyle`. Remover constantes `ACTIVE`/`IDLE`/`STROKE` fixas. Layout:

```ts
const display = captionInsertForLayout(
  { ...insert, text: preset === "viral" ? (insert.text ?? "").toLocaleUpperCase("pt-BR") : insert.text },
  style,
)
```

Importar `captionInsertForLayout` de `../composition.ts`.

Viral: se `style.strokeWidth > 0`, `strokeStyle = style.strokeColor`, `lineWidth = style.strokeWidth * strokeScale`. Fill: `isWordActive ? style.highlightColor : style.color`. Sem caixa.

Limpo: caixa `style.bgColor`; fill igual; sem stroke; sem maiúsculas (o `display.text` já não uppercasou).

`drawCaptionInserts(..., preset, brandFontId, style)`.

- [ ] **Step 2:** `drawPlayInserts` último arg `captionStyle: CaptionStyle = DEFAULT_CAPTION_STYLE`. Passar a `drawCaptionInserts`.

- [ ] **Step 3:** `drawFrame` em `lib/export/compositor.ts`:

```ts
drawPlayInserts(
  ctx,
  composition.inserts,
  time,
  composition.brand.fontId,
  composition.brand.logo,
  stickerImageMap(composition, blobUrls),
  getLogoImage,
  composition.captionPreset ?? "viral",
  composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
)
```

- [ ] **Step 4:** Overlay/preview recebem `captionStyle` e passam a `drawPlayInserts`. Sem mesclar inserts ainda (Task 5). Typecheck: default `DEFAULT_CAPTION_STYLE`.

Não há teste de canvas. Conferir que `lib/composition.test.ts` e `lib/captions.test.ts` ainda passam.

---

### Task 5: Overlay mescla look no clone (hit-test / drag)

**Files:**
- Modify: `components/overlay-canvas.tsx`
- Modify: `lib/compose/hit-test.test.ts` — um teste documentando que bbox de caption **sem** x cai no default só se o caller mesclar; os testes atuais já passam x/y no fixture (mantém)

- [ ] **Step 1:** No overlay, `const laidOut = inserts.map((i) => captionInsertForLayout(i, captionStyle))`. Usar `laidOut` em `drawPlayInserts`, loop de `layoutInsertText`, `hitTestOverlays`, `approxBox`.

Maiúsculas Viral no clone de layout: `captionInsertForLayout` já põe x/y; o overlay ainda faz `text: toLocaleUpperCase` no Viral **depois** do layout helper — aplicar no clone:

```ts
const layoutInsert =
  kind === "caption" && captionPreset === "viral"
    ? { ...captionInsertForLayout(insert, captionStyle), text: (insert.text ?? "").toLocaleUpperCase("pt-BR") }
    : kind === "caption"
      ? captionInsertForLayout(insert, captionStyle)
      : insert
```

- [ ] **Step 2:** Drag/resize: se `insertKind(drag.base) === "caption"`, **não** chamar `onPatchInsert` com x/y/fontSize do insert. Nova prop:

```ts
onPatchCaptionStyle?: (patch: Partial<CaptionStyle>) => void
```

Move: `onPatchCaptionStyle({ x: pctX, y: pctY })`. Resize: `onPatchCaptionStyle({ fontSize: next })` usando o mesmo `resizePatchForTrack` no clone mesclado (ele já devolve `{ fontSize }`).

`preview-panel.tsx` / `video-editor.tsx`: passar o callback (implementação real na Task 6; neste passo um no-op quebra o drag — então Task 5 e 6 podem ser o mesmo PR mental: **fazer o callback na Task 6 imediatamente depois**). Implementar o handler vazio só se o TypeScript exigir; preferir completar Task 6 em seguida.

- [ ] **Step 3:** PASS hit-test (fixtures com x/y).

---

### Task 6: Editor — `applyCaptionStyle` + history

**Files:**
- Modify: `components/video-editor.tsx`

- [ ] **Step 1:** `applyCaptionStyle(patch: Partial<CaptionStyle>, mode: "discrete" | "gesture")`:

```ts
const prev = compositionRef.current
const nextStyle = mergeCaptionStylePatch(prev.captionStyle, patch)
if (mode === "discrete") {
  const committed = commitDiscrete(
    historyRef.current,
    gestureRef.current,
    historyPresent(prev),
    { inserts: prev.inserts, captionStyle: nextStyle },
  )
  historyRef.current = committed.history
  gestureRef.current = committed.gesture
}
const next = { ...prev, captionStyle: nextStyle }
compositionRef.current = next
setComposition(next)
```

Gesto: `beginInsertHistory` já snapshotou style; `pointermove` chama `applyCaptionStyle(patch, "gesture")` (sem `commitDiscrete`); `endInsertHistory` no pointerup.

- [ ] **Step 2:** `changeInsert`: se caption e o patch só tem `text` / `start` / `duration` / `words` → `applyCaptionPatch` como hoje. Se o patch tiver `x`/`y`/`fontSize`/`style` → **não** aplicar no insert; `applyCaptionStyle` com os campos equivalentes (`style.color` → `color`, etc.). Overlay deve preferir `onPatchCaptionStyle` para não misturar.

- [ ] **Step 3:** `setCaptionPreset` inalterado (sem history).

- [ ] **Step 4:** Gerar legendas / Gerar estrutura: não atribuir `captionStyle`. Seed do editor e `createDefaultComposition` já trazem o default.

Passar `captionStyle` e `onChangeCaptionStyle` / `onPatchCaptionStyle` ao painel e overlay.

---

### Task 7: Card Estilo / Movimento

**Files:**
- Modify: `components/insert-style-panel.tsx`
- Modify: `components/insert-card.tsx`
- Modify: `components/control-panel.tsx` (prop drilling)

- [ ] **Step 1:** Props novas no style panel quando `kind === "caption"`:

```ts
captionStyle: CaptionStyle
onChangeCaptionStyle: (patch: Partial<CaptionStyle>) => void
```

Ler fonte/peso/tamanho/cores de `captionStyle`, não de `insert.style` / `insert.fontSize`.

Mostrar para caption (além de fonte/peso/tamanho):

- ColorField “Cor” → `color` (sem allowEmpty)
- ColorField “Destaque” → `highlightColor`
- ColorField “Fundo” → `bgColor` (sem allowEmpty; nunca null)
- Contorno: slider `strokeWidth` 0–12 + ColorField `strokeColor`

**Não** mostrar: predefinição, caixa alta, sombra, opacidade, rotação, paleta que chama `patchInsertStyle` no insert.

`update` de caption: `onChangeCaptionStyle(patch)` — **não** `onChange(insert.id, { style })`.

Tamanho: `onChangeCaptionStyle({ fontSize })` com `rangeGestureHandlers` (gesto no history via `onBeginInsertGesture`).

- [ ] **Step 2:** Movimento no `insert-card`: se caption, X/Y de `captionStyle`; `onCommit` → `onChangeCaptionStyle({ x })` / `{ y }`. Sem escala.

- [ ] **Step 3:** Conteúdo inalterado (`onChange` da linha).

Viral/Limpo no `control-panel` continua só `captionPreset`.

---

### Task 8: Docs e conferência

**Files:**
- Modify: `docs/README.md` — `captionStyle` na Composition; look não é por linha
- Modify: `docs/proximo.md` — item 14: estilo compartilhado + cores
- Modify: `docs/superpowers/specs/2026-08-19-legendas-automaticas-design.md` — nota no schema: overlay da linha moveu para `captionStyle` (spec 2026-08-20)
- Spec 2026-08-20: status permanece “não implementado” até o smoke/deploy

- [ ] **Step 1:** Rodar

```
node --experimental-strip-types --test lib/composition.test.ts lib/composition-history.test.ts lib/captions.test.ts lib/compose/hit-test.test.ts lib/project-store.test.ts
```

Expected: PASS.

- [ ] **Step 2:** Smoke no Mac depois do `deploy.md` §2: gerar legendas; mudar cor/destaque/fundo/fonte/Y numa linha → todas mudam; Viral/Limpo não apaga cor; gerar de novo mantém look; Ctrl+Z desfaz a cor; export = preview.

---

## Critério de pronto (spec)

Cobre os 7 itens da spec § Critério de pronto. Fora: painel no header, reset via Viral/Limpo, `maxWidthPct` na UI, sombra, undo do preset.

---

## Spec coverage (self-review)

| Requisito | Task |
| --- | --- |
| `captionStyle` parse/serialize/defaults | 1 |
| Migração da primeira caption | 1 |
| Caption JSON sem x/y/style | 1, 3 |
| `mergeCaptionStylePatch` | 1 |
| `captionInsertForLayout` | 1, 4, 5 |
| Undo `{ inserts, captionStyle }`, sem preset | 2 |
| `createInsert` / gerar sem overlay | 3, 6 |
| Draw Viral/Limpo com cores do objeto | 4 |
| Drag/resize → captionStyle | 5, 6 |
| Card Estilo/Movimento | 7 |
| Gerar de novo preserva style | 6 |
| Docs | 8 |
| Sem import captions em composition | 1 (só insert-style) |
| Sem bump version / sem rota captions | todas |
