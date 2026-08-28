# Marca d’água — controles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Não é git repo: não commit.** Spec: [`docs/superpowers/specs/2026-08-22-marca-dagua-controles-design.md`](../specs/2026-08-22-marca-dagua-controles-design.md).

**Goal:** Três números globais (opacidade, tamanho, velocidade) na marca d’água, no mesmo raster de preview, rascunho e Final.

**Architecture:** Campos aditivos em `editor.watermark.v1` (`opacityPct`, `fontPx`, `speed`). `normalizeWatermarkPrefs` clampa. Snapshot `WatermarkPaint` leva os três. UI: segunda linha de `<input type="number">` em `WatermarkRow`. Undo e composição **não** mudam.

**Tech Stack:** TypeScript, `node --experimental-strip-types --test`, React client, canvas 1080×1920, Remotion `Short`.

**Não fazer:** git commit, slider, degraus, PNG, cor, speed X/Y separados, bump de schema, encoder novo, `source.watermarked`, deploy/PM2.

---

## File map

| Arquivo | Papel |
| --- | --- |
| Modify: `lib/watermark.ts` | tipos, clamp, 5º arg de `watermarkCenter`, `drawWatermark` lê paint |
| Modify: `lib/watermark.test.ts` | TDD clamp, JSON antigo, 2× vs 1×, t=0 |
| Modify: `lib/watermark-store.test.ts` | round-trip dos três; defaults no JSON antigo |
| Modify: `remotion/types.test.ts` | snapshot inclui os três |
| Modify: `render-server/props.ts` | visual lixo → default, não dropa a marca |
| Modify: `render-server/props.test.ts` | `opacityPct: "x"` mantém watermark |
| Modify: `components/background-source-card.tsx` | segunda linha + `WatermarkNumberField` |
| Modify: `components/control-panel.tsx` | default `DEFAULT_WATERMARK_PREFS` |
| Modify: `docs/enquadramento.md`, `docs/README.md`, `docs/novo-projeto.md`, `docs/proximo.md` | ops; **não** marcar como no ar |
| Modify: spec controles Status | `spec; plano em plans/2026-08-22-marca-dagua-controles.md` |

`video-editor.tsx` já faz `normalize` + `save` em `handleWatermarkPrefs` e manda o objeto inteiro no snapshot. Sem mudança se os tipos crescerem.

`draw-play.ts` / compositor / encoder / overlay / InsertRenderer já passam `WatermarkPaint`.

---

### Task 1: Prefs, clamp e bounce

**Files:**
- Modify: `lib/watermark.ts`
- Modify: `lib/watermark.test.ts`
- Modify: `lib/watermark-store.test.ts`

- [ ] **Step 1: Write the failing tests** (substituir/estender `lib/watermark.test.ts`)

Manter os testes atuais de texto/`loop`/`t=0`/caixa, **atualizando** `deepEqual` que hoje omitem os três campos. Acrescentar:

```ts
const VISUAL = { opacityPct: 22, fontPx: 42, speed: 1 }

test("normalizeWatermarkPrefs fills visual defaults on old { text, loop } JSON", () => {
  const parsed = normalizeWatermarkPrefs({ text: "@a" })
  assert.equal(parsed.text, "@a")
  assert.equal(parsed.loop, true)
  assert.equal(parsed.opacityPct, 22)
  assert.equal(parsed.fontPx, 42)
  assert.equal(parsed.speed, 1)
})

test("normalizeWatermarkPrefs clamps opacity, font and speed", () => {
  assert.equal(normalizeWatermarkPrefs({ opacityPct: 3 }).opacityPct, 8)
  assert.equal(normalizeWatermarkPrefs({ opacityPct: 99 }).opacityPct, 50)
  assert.equal(normalizeWatermarkPrefs({ fontPx: 12.7 }).fontPx, 24)
  assert.equal(normalizeWatermarkPrefs({ speed: 1.1 }).speed, 1)
  assert.equal(normalizeWatermarkPrefs({ speed: 1.2 }).speed, 1.25)
  assert.equal(normalizeWatermarkPrefs({ speed: 0 }).speed, 0.25)
  assert.equal(normalizeWatermarkPrefs({ speed: 9 }).speed, 3)
  assert.equal(normalizeWatermarkPrefs({ opacityPct: "x" }).opacityPct, 22)
})

test("watermarkCenter speed 2 doubles X displacement before wrap", () => {
  const t = 1
  const c1 = watermarkCenter(t, FRAME, BOX, true, 1)
  const c2 = watermarkCenter(t, FRAME, BOX, true, 2)
  const maxX = FRAME.width - WATERMARK_MARGIN_PX - BOX.width / 2
  assert.equal(maxX - c2.x, 2 * (maxX - c1.x))
})

test("watermarkCenter t=0 with speed 2 is still the static corner", () => {
  assert.deepEqual(
    watermarkCenter(0, FRAME, BOX, true, 2),
    watermarkCenter(0, FRAME, BOX, false),
  )
})
```

Atualizar o teste de `watermarkPaintInput`:

```ts
assert.deepEqual(watermarkPaintInput(true, { text: "@loja", loop: false, ...VISUAL }), {
  text: "@loja",
  loop: false,
  ...VISUAL,
})
```

`normalizeWatermarkPrefs(null)` continua `deepEqual` a `DEFAULT_WATERMARK_PREFS` (agora com os três).

`drawWatermark` com `{ text: "@loja", loop: false, ...VISUAL }` ainda chama `fillText` uma vez.

Em `lib/watermark-store.test.ts`, os `deepEqual` de load passam a incluir `...VISUAL` (save de `{ text, loop }` sozinho deve **persistir** os defaults porque `save` já chama `normalize`). Acrescentar:

```ts
test("save then load round-trips opacity font and speed", () => {
  const storage = memoryStorage()
  saveWatermarkPrefs(
    { text: "@a", loop: true, opacityPct: 30, fontPx: 50, speed: 2 },
    storage,
  )
  assert.deepEqual(loadWatermarkPrefs(storage), {
    text: "@a",
    loop: true,
    opacityPct: 30,
    fontPx: 50,
    speed: 2,
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `node --experimental-strip-types --test lib/watermark.test.ts lib/watermark-store.test.ts`

Expected: FAIL — campos / 5º argumento inexistentes.

- [ ] **Step 3: Implement `lib/watermark.ts`**

Tipos:

```ts
export type WatermarkPrefs = {
  text: string
  loop: boolean
  opacityPct: number
  fontPx: number
  speed: number
}

export type WatermarkPaint = {
  text: string
  loop: boolean
  opacityPct: number
  fontPx: number
  speed: number
}

export const DEFAULT_WATERMARK_PREFS: WatermarkPrefs = {
  text: "",
  loop: true,
  opacityPct: 22,
  fontPx: 42,
  speed: 1,
}

export const WATERMARK_OPACITY = 0.22
export const WATERMARK_FONT_PX = 42
export const WATERMARK_MARGIN_PX = 48
export const WATERMARK_SPEED_X = 90
export const WATERMARK_SPEED_Y = 110
export const WATERMARK_OPACITY_PCT_MIN = 8
export const WATERMARK_OPACITY_PCT_MAX = 50
export const WATERMARK_FONT_PX_MIN = 24
export const WATERMARK_FONT_PX_MAX = 80
export const WATERMARK_SPEED_MIN = 0.25
export const WATERMARK_SPEED_MAX = 3
export const WATERMARK_SPEED_STEP = 0.25
```

`normalizeWatermarkPrefs`: texto/`loop` como hoje; depois:

```ts
function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clampRound(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function clampSpeed(value: number): number {
  const snapped = Math.round(value / WATERMARK_SPEED_STEP) * WATERMARK_SPEED_STEP
  return Math.min(WATERMARK_SPEED_MAX, Math.max(WATERMARK_SPEED_MIN, snapped))
}
```

- `opacityPct`: `finiteNumber` → `clampRound(n, 8, 50)` senão `22`
- `fontPx`: `clampRound(n, 24, 80)` senão `42`
- `speed`: `clampSpeed(n)` senão `1`

Se `raw` não for object, `return { ...DEFAULT_WATERMARK_PREFS }`.

`watermarkPaintInput`: se enabled + texto, `return { text: prefs.text, loop: prefs.loop, opacityPct: prefs.opacityPct, fontPx: prefs.fontPx, speed: prefs.speed }`.

`watermarkCenter(..., loop, speed = 1)`:

```ts
  if (!loop) return { x: xRange.max, y: yRange.max }
  return {
    x: pingPong(t, xRange.min, xRange.max, WATERMARK_SPEED_X * speed),
    y: pingPong(t, yRange.min, yRange.max, WATERMARK_SPEED_Y * speed),
  }
```

`drawWatermark`: `const visual = normalizeWatermarkPrefs(paint)` (paint parcial / snapshots velhos pegam default). `globalAlpha = visual.opacityPct / 100`. Fonte `800 ${visual.fontPx}px`. Caixa `{ width, height: visual.fontPx }`. Centro com `paint.loop` e `visual.speed`.

Manter `WATERMARK_OPACITY` exportado (`0.22`) para não quebrar imports; **não** usá-lo no draw.

- [ ] **Step 4: Run tests**

Run: `node --experimental-strip-types --test lib/watermark.test.ts lib/watermark-store.test.ts`

Expected: PASS

Não commit.

---

### Task 2: Snapshot Remotion / render-server

**Files:**
- Modify: `remotion/types.test.ts`
- Modify: `render-server/props.ts`
- Modify: `render-server/props.test.ts`

`toRenderProps` já faz `watermarkPaintInput(enabled, normalizeWatermarkPrefs(prefs))` — depois da Task 1 o snapshot **já** leva os três. Só os asserts e o sanitize mudam. `InsertRenderer` intocado.

- [ ] **Step 1: Update failing assertions + new sanitize test**

Em `remotion/types.test.ts`, o caso `withText` (prefs só `{ text, loop }`) deve esperar defaults visuais:

```ts
  assert.deepEqual(withText.watermark, {
    text: "@loja",
    loop: false,
    opacityPct: 22,
    fontPx: 42,
    speed: 1,
  })
```

Acrescentar no mesmo teste (ou teste novo):

```ts
  const custom = toRenderProps({
    composition,
    videoSrc: "https://cdn.example.com/clip.mp4",
    watermarkPrefs: {
      text: "@loja",
      loop: true,
      opacityPct: 30,
      fontPx: 50,
      speed: 2,
    },
  })
  assert.deepEqual(custom.watermark, {
    text: "@loja",
    loop: true,
    opacityPct: 30,
    fontPx: 50,
    speed: 2,
  })
```

Em `render-server/props.test.ts`, o caso `ok` hoje espera só `{ text, loop }`. Passa a:

```ts
  assert.deepEqual(ok.watermark, {
    text: "@loja",
    loop: true,
    opacityPct: 22,
    fontPx: 42,
    speed: 1,
  })
```

Acrescentar:

```ts
test("parseRenderProps keeps watermark when opacityPct is junk", () => {
  const parsed = parseRenderProps(
    JSON.stringify({
      ...defaultRenderProps,
      watermark: { text: "@loja", loop: true, opacityPct: "x" },
    }),
  )
  assert.equal(parsed.watermark?.text, "@loja")
  assert.equal(parsed.watermark?.opacityPct, 22)
  assert.equal(parsed.watermark?.fontPx, 42)
  assert.equal(parsed.watermark?.speed, 1)
})
```

O teste de `{ text: 1, loop: "yes" }` continua omitindo **todo** o campo.

- [ ] **Step 2: Run to verify fail**

Run: `node --experimental-strip-types --test remotion/types.test.ts render-server/props.test.ts`

Expected: FAIL no sanitize (`opacityPct` ausente / `"x"` dropa ou não normaliza).

- [ ] **Step 3: Implement `sanitizeWatermark`**

Em `render-server/props.ts`, importar `normalizeWatermarkPrefs` de `../lib/watermark.ts`.

Depois de validar `text` string + `loop` boolean + `text.trim()` não vazio:

```ts
  const visual = normalizeWatermarkPrefs(record)
  return {
    ...value,
    watermark: {
      text: visual.text,
      loop: visual.loop,
      opacityPct: visual.opacityPct,
      fontPx: visual.fontPx,
      speed: visual.speed,
    },
  }
```

Usar `visual.text` (já trimado) em vez de um segundo trim solto. Se `text`/`loop` inválidos, **delete** `watermark` como hoje.

- [ ] **Step 4: Run tests**

Run: `node --experimental-strip-types --test remotion/types.test.ts render-server/props.test.ts lib/watermark.test.ts`

Expected: PASS

Não commit.

---

### Task 3: UI no card Origem

**Files:**
- Modify: `components/background-source-card.tsx`
- Modify: `components/control-panel.tsx`

- [ ] **Step 1: `WatermarkNumberField` no mesmo arquivo do card**

Importar de `@/lib/watermark`:

```ts
import {
  WATERMARK_FONT_PX_MAX,
  WATERMARK_FONT_PX_MIN,
  WATERMARK_OPACITY_PCT_MAX,
  WATERMARK_OPACITY_PCT_MIN,
  WATERMARK_SPEED_MAX,
  WATERMARK_SPEED_MIN,
  WATERMARK_SPEED_STEP,
  type WatermarkPrefs,
} from "@/lib/watermark"
```

Componente no **mesmo** arquivo (não card extra):

```tsx
import { useEffect, useState } from "react"

function WatermarkNumberField({
  value,
  onCommit,
  disabled,
  ariaLabel,
  min,
  max,
  step,
  suffix,
  label,
}: {
  value: number
  onCommit: (next: number) => void
  disabled?: boolean
  ariaLabel: string
  min: number
  max: number
  step: number
  suffix?: string
  label: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  return (
    <label className="flex min-w-0 items-center gap-1 text-[0.65rem] text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-7 w-14 rounded-md border border-border bg-background px-1 text-xs tabular-nums disabled:opacity-50"
        value={draft}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          if (raw.trim() === "") return
          const next = Number(raw)
          if (!Number.isFinite(next)) return
          onCommit(next)
        }}
        onBlur={() => {
          setDraft(String(value))
        }}
      />
      {suffix ? <span className="shrink-0">{suffix}</span> : null}
    </label>
  )
}
```

O `useState` extra exige importar `useEffect` junto com `useRef, useState` já no arquivo.

- [ ] **Step 2: Segunda linha em `WatermarkRow`**

Depois do `ToggleGroup`, ainda **dentro** do `div` que tem `border-t` (ou um wrapper: primeira linha flex, segunda linha flex). Spec: segunda linha abaixo. Estrutura:

```tsx
    <div
      className="mt-2 flex min-w-0 flex-col gap-1.5 border-t border-border pt-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {/* checkbox + handle + ToggleGroup iguais aos de hoje */}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <WatermarkNumberField
          label="Opac."
          suffix="%"
          value={prefs.opacityPct}
          min={WATERMARK_OPACITY_PCT_MIN}
          max={WATERMARK_OPACITY_PCT_MAX}
          step={1}
          ariaLabel="Opacidade da marca d'água"
          onCommit={(opacityPct) => onPrefsChange?.({ ...prefs, opacityPct })}
        />
        <WatermarkNumberField
          label="Tam."
          value={prefs.fontPx}
          min={WATERMARK_FONT_PX_MIN}
          max={WATERMARK_FONT_PX_MAX}
          step={1}
          ariaLabel="Tamanho da marca d'água"
          onCommit={(fontPx) => onPrefsChange?.({ ...prefs, fontPx })}
        />
        <WatermarkNumberField
          label="Vel."
          suffix="×"
          value={prefs.speed}
          min={WATERMARK_SPEED_MIN}
          max={WATERMARK_SPEED_MAX}
          step={WATERMARK_SPEED_STEP}
          disabled={!prefs.loop}
          ariaLabel="Velocidade da marca d'água"
          onCommit={(speed) => onPrefsChange?.({ ...prefs, speed })}
        />
      </div>
    </div>
```

Sem parágrafo de ajuda. `handleWatermarkPrefs` no editor já normaliza — `onCommit` pode mandar o número cru.

A mesma `WatermarkRow` já é usada nos dois estados do card; não duplicar.

- [ ] **Step 3: Default do ControlPanel**

Em `components/control-panel.tsx`:

```ts
import { DEFAULT_WATERMARK_PREFS, type WatermarkPrefs } from "@/lib/watermark"
```

Trocar:

```ts
  watermarkPrefs = DEFAULT_WATERMARK_PREFS,
```

Não `{ text: "", loop: true }`.

Não alterar `video-editor.tsx` (já persiste o objeto inteiro, sem histórico).

- [ ] **Step 4: Typecheck mental / `tsc` se o ambiente permitir**

`npx tsc --noEmit` (o projeto pode skipar types no build; rode mesmo assim se `tsc` existir).

Não commit.

---

### Task 4: Docs de ops

**Files:**
- Modify: `docs/enquadramento.md` (Card Origem — mencionar Opac./Tam./Vel.)
- Modify: `docs/README.md` §6 — `editor.watermark.v1` inclui os três números
- Modify: `docs/novo-projeto.md` — Novo projeto **mantém** os números
- Modify: `docs/proximo.md` — **não** colocar na tabela “Já está no ar”; nota P0 “controles no disco, aguardando publicar”
- Modify: `docs/superpowers/specs/2026-08-22-marca-dagua-controles-design.md` Status → `spec; plano em plans/2026-08-22-marca-dagua-controles.md`

- [ ] **Step 1: Editar os docs acima** (sem deploy, sem PM2)

- [ ] **Step 2: Run the focused suite**

Run:

```
node --experimental-strip-types --test lib/watermark.test.ts lib/watermark-store.test.ts remotion/types.test.ts render-server/props.test.ts
```

Expected: PASS

Não commit. Não publicar.

---

## Self-review (spec coverage)

| Spec | Task |
| --- | --- |
| Tipos + defaults 22 / 42 / 1 | 1 |
| Clamp 8–50, 24–80, 0,25–3 passo 0,25 | 1 |
| JSON antigo | 1 |
| Bounce `speed` 5º arg; t=0 canto; 2× | 1 |
| `drawWatermark` lê paint / parcial → default | 1 |
| Store round-trip | 1 |
| Snapshot `toRenderProps` | 2 (asserts; código já flui) |
| Sanitize visual lixo não dropa | 2 |
| Malformed text/loop ainda dropa | 2 |
| Number inputs + empty/blur | 3 |
| Vel. disabled em Parado | 3 |
| ControlPanel default completo | 3 |
| Undo / composição / Novo projeto | sem task extra (já está) |
| Docs; não marcar no ar | 4 |
| Sem slider / PNG / schema bump / `source.watermarked` | não há task |

---

## Handoff

Depois de implementar: smoke no editor — mudar Opac./Tam./Vel., conferir preview; Parado desabilita Vel.; F5 mantém números; Novo projeto mantém; rascunho/Final só depois de publicar.
