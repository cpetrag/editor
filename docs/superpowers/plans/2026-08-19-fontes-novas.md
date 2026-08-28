# Fontes novas + pesos honestos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: `docs/superpowers/specs/2026-08-19-fontes-novas-design.md`. TDD.
> Este share **não é git repo** — pular todos os passos de commit.

**Goal:** 9 famílias no picker; dropdown de peso só com o que a fonte tem; preview/export carregam só esses pesos; JSON antigo com peso inválido pinta clampado sem o parse reescrever.

**Architecture:** `WEIGHTS_BY_FONT` + `clampFontWeight` em `insert-style.ts`. Draw (`resolveInsertStyle`) clampa o peso. Persistência só clampa ao **trocar a família** no card. `next/font` + `FONT_OPTIONS` + `ensureComposeFontsReady` leem o mesmo mapa.

**Tech Stack:** Next.js 16 `next/font/google`, TypeScript, `node:test`.

---

## File map

| File | Responsibility |
| --- | --- |
| Modify `lib/compose/insert-style.ts` | `FONT_IDS`, aliases, `WEIGHTS_BY_FONT`, `clampFontWeight`, resolve clampa, patch só clampa se `fontFamily` veio no patch |
| Modify `lib/compose/insert-style.test.ts` | 9 IDs, parse, clamp, weights tables |
| Modify `lib/compose/fonts.ts` | `FAMILIES` + load por `WEIGHTS_BY_FONT` |
| Modify `lib/compose/fonts.test.ts` | Oswald no canvas name; coleta de style |
| Modify `lib/inserts.ts` | 3 `FONT_OPTIONS` |
| Modify `app/layout.tsx` | Oswald, Montserrat, Anton + pesos explícitos |
| Modify `components/insert-style-panel.tsx` | Select de peso + clamp ao trocar fonte |
| Modify `docs/README.md` | 6 → 9 se a lista aparecer; senão uma linha no compositor/UI |
| Modify spec status | implementado (aguardando publish) |

Não mexer: `composition.ts` version, animações, hit-test, tipos de insert.

---

### Task 1: Catálogo + `clampFontWeight` (TDD)

**Files:**
- Modify: `lib/compose/insert-style.ts`
- Modify: `lib/compose/insert-style.test.ts`

- [ ] **Step 1: Update the existing FONT_IDS test and add new tests** in `lib/compose/insert-style.test.ts`

Replace the test `"FONT_IDS lists the six loaded families"` with:

```ts
test("FONT_IDS lists the nine families in spec order", () => {
  assert.deepEqual([...FONT_IDS], [
    "geist",
    "poppins",
    "bebas",
    "archivo",
    "playfair",
    "space",
    "oswald",
    "montserrat",
    "anton",
  ])
})

test("parseFontId accepts the three new canonical ids", () => {
  assert.equal(parseFontId("oswald"), "oswald")
  assert.equal(parseFontId("montserrat"), "montserrat")
  assert.equal(parseFontId("anton"), "anton")
})

test("clampFontWeight snaps down to a weight the family actually has", () => {
  assert.equal(clampFontWeight("bebas", 800), 400)
  assert.equal(clampFontWeight("oswald", 900), 700)
  assert.equal(clampFontWeight("montserrat", 700), 700)
  assert.equal(clampFontWeight("anton", 400), 400)
})

test("WEIGHTS_BY_FONT matches the spec tables", () => {
  assert.deepEqual([...WEIGHTS_BY_FONT.space], [400, 500, 600, 700])
  assert.deepEqual([...WEIGHTS_BY_FONT.bebas], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.archivo], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.anton], [400])
})

test("resolveInsertStyle clamps weight for draw without requiring a persist rewrite", () => {
  const resolved = resolveInsertStyle({
    type: "alerta-desconto",
    style: {
      fontFamily: "bebas",
      fontWeight: 800,
      uppercase: false,
      color: "#ffffff",
      bgColor: null,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadow: "none",
      opacity: 1,
      rotation: 0,
    },
  })
  assert.equal(resolved.fontWeight, 400)
})

test("patchInsertStyle does not clamp weight when only color changes", () => {
  const insert = {
    type: "alerta-desconto" as const,
    style: {
      fontFamily: "bebas" as const,
      fontWeight: 800 as const,
      uppercase: false,
      color: "#ffffff",
      bgColor: null,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadow: "none" as const,
      opacity: 1,
      rotation: 0,
    },
  }
  const patched = patchInsertStyle(insert, { color: "#EE4D2D" })
  assert.equal(patched.fontWeight, 800)
  assert.equal(patched.color, "#EE4D2D")
})

test("patchInsertStyle clamps weight when fontFamily changes", () => {
  const insert = {
    type: "alerta-desconto" as const,
    style: {
      fontFamily: "poppins" as const,
      fontWeight: 800 as const,
      uppercase: false,
      color: "#ffffff",
      bgColor: null,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadow: "none" as const,
      opacity: 1,
      rotation: 0,
    },
  }
  const patched = patchInsertStyle(insert, { fontFamily: "anton" })
  assert.equal(patched.fontFamily, "anton")
  assert.equal(patched.fontWeight, 400)
})
```

Add `WEIGHTS_BY_FONT`, `clampFontWeight`, `resolveInsertStyle`, `patchInsertStyle` to the test file imports (they already import `FONT_IDS`, `parseFontId`, `resolveInsertStyle` — check the top of the file and extend).

- [ ] **Step 2: Run tests — they must FAIL**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/compose/insert-style.test.ts"
```

Expected: FAIL (`clampFontWeight` not exported / FONT_IDS length 6).

- [ ] **Step 3: Implement in `lib/compose/insert-style.ts`**

1. Append to `FONT_IDS`: `"oswald", "montserrat", "anton"`.

2. After `FONT_WEIGHTS`:

```ts
export const WEIGHTS_BY_FONT: Record<FontId, readonly FontWeight[]> = {
  geist: [400, 500, 600, 700, 800, 900],
  poppins: [400, 500, 600, 700, 800, 900],
  bebas: [400],
  archivo: [400],
  playfair: [400, 500, 600, 700, 800, 900],
  space: [400, 500, 600, 700],
  oswald: [400, 500, 600, 700],
  montserrat: [400, 500, 600, 700, 800, 900],
  anton: [400],
}

export function clampFontWeight(fontId: FontId, weight: FontWeight): FontWeight {
  const allowed = WEIGHTS_BY_FONT[fontId]
  if (allowed.includes(weight)) return weight
  let best: FontWeight | undefined
  for (const next of allowed) {
    if (next <= weight) best = next
  }
  return best ?? allowed[0] ?? 400
}
```

3. `FONT_ALIASES` add:

```ts
  oswald: "oswald",
  montserrat: "montserrat",
  anton: "anton",
```

4. `resolveInsertStyle` — after building `merged` (typeDefault ± style ± brand font), return clamped weight for **draw**:

```ts
export function resolveInsertStyle(
  insert: { type: string; style?: InsertStyle },
  brandFontId = "geist",
): InsertStyle {
  const typeDefault = DEFAULT_STYLE_BY_TYPE[insert.type] ?? CHIP_DEFAULT
  const merged: InsertStyle = insert.style
    ? { ...typeDefault, ...insert.style }
    : {
        ...typeDefault,
        fontFamily: parseFontId(brandFontId) ?? typeDefault.fontFamily,
      }
  const fontFamily = parseFontId(merged.fontFamily) ?? merged.fontFamily
  return {
    ...merged,
    fontFamily,
    fontWeight: clampFontWeight(fontFamily, merged.fontWeight),
  }
}
```

5. `patchInsertStyle` must **not** go through the clamped resolve for the weight when the patch is unrelated. Implement as unclamped merge, then clamp only if `patch.fontFamily` is set:

```ts
export function patchInsertStyle(
  insert: { type: string; style?: InsertStyle },
  patch: Partial<InsertStyle>,
  brandFontId = "geist",
): InsertStyle {
  const typeDefault = DEFAULT_STYLE_BY_TYPE[insert.type] ?? CHIP_DEFAULT
  const base: InsertStyle = insert.style
    ? { ...typeDefault, ...insert.style }
    : {
        ...typeDefault,
        fontFamily: parseFontId(brandFontId) ?? typeDefault.fontFamily,
      }
  const merged: InsertStyle = { ...base, ...patch }
  const fontFamily = parseFontId(merged.fontFamily) ?? merged.fontFamily
  const fontWeight =
    patch.fontFamily !== undefined
      ? clampFontWeight(fontFamily, merged.fontWeight)
      : merged.fontWeight
  return { ...merged, fontFamily, fontWeight }
}
```

Do not clamp inside `parseInsertStyle`.

- [ ] **Step 4: Re-run insert-style tests — all PASS**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/compose/insert-style.test.ts"
```

- [ ] **Step 5: Skip commit**

---

### Task 2: Canvas families + `fonts.load`

**Files:**
- Modify: `lib/compose/fonts.ts`
- Modify: `lib/compose/fonts.test.ts`

- [ ] **Step 1: Add tests to `lib/compose/fonts.test.ts`**

```ts
import { canvasFontFamily, fontIdsUsedInComposition } from "./fonts.ts"

test("canvasFontFamily maps the three new ids", () => {
  assert.match(canvasFontFamily("oswald"), /Oswald/)
  assert.match(canvasFontFamily("montserrat"), /Montserrat/)
  assert.match(canvasFontFamily("anton"), /Anton/)
})

test("fontIdsUsedInComposition collects oswald from insert.style", () => {
  const ids = fontIdsUsedInComposition(
    composition({
      inserts: [
        {
          id: "a",
          type: "alerta-desconto",
          start: 0,
          duration: 2,
          anchor: "top",
          animIn: "none",
          animOut: "none",
          style: {
            fontFamily: "oswald",
            fontWeight: 600,
            uppercase: false,
            color: "#ffffff",
            bgColor: null,
            strokeWidth: 0,
            strokeColor: "#000000",
            shadow: "none",
            opacity: 1,
            rotation: 0,
          },
        },
      ],
    }),
  )
  assert.ok(ids.includes("oswald"))
  assert.ok(ids.includes("geist"))
})
```

Use the existing `composition()` helper in that file.

- [ ] **Step 2: Run fonts tests — FAIL until FAMILIES updated**

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/compose/fonts.test.ts"
```

- [ ] **Step 3: Update `lib/compose/fonts.ts`**

Import `WEIGHTS_BY_FONT`, `parseFontId`, type `FontId` from `./insert-style.ts`.

Add to `FAMILIES`:

```ts
  oswald: '"Oswald", sans-serif',
  montserrat: "Montserrat, sans-serif",
  anton: "Anton, sans-serif",
```

Replace `LOAD_WEIGHTS` loop with:

```ts
    const weights = WEIGHTS_BY_FONT[id as FontId] ?? [400]
    for (const weight of weights) {
      loads.push(document.fonts.load(`${weight} 56px ${family}`))
    }
```

Delete the unused `LOAD_WEIGHTS` constant.

- [ ] **Step 4: Re-run fonts tests — PASS**

- [ ] **Step 5: Skip commit**

---

### Task 3: `FONT_OPTIONS` + `layout.tsx`

**Files:**
- Modify: `lib/inserts.ts`
- Modify: `app/layout.tsx`

No new unit test required (library/lote already map `FONT_OPTIONS`). After Task 1, `parseFontId` already accepts the ids.

- [ ] **Step 1: Append to `FONT_OPTIONS` in `lib/inserts.ts`** (after Space Grotesk):

```ts
  { id: "oswald", label: "Oswald", family: "var(--font-oswald)", vibe: "Condensada · anúncio" },
  { id: "montserrat", label: "Montserrat", family: "var(--font-montserrat)", vibe: "Geométrica · hook" },
  { id: "anton", label: "Anton", family: "var(--font-anton)", vibe: "Display · impacto" },
```

- [ ] **Step 2: `app/layout.tsx`**

Import `Oswald`, `Montserrat`, `Anton` from `next/font/google`.

Geist stays **without** `weight` (fonte variável; o tipo do Next recusa array). Geist_Mono unchanged.

Playfair and Space Grotesk get explicit weights:

```ts
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-playfair',
  display: 'block',
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space',
  display: 'block',
})
```

Add:

```ts
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'block',
})
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'block',
})
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'block',
})
```

Append `oswald.variable`, `montserrat.variable`, `anton.variable` to `fontVariables`.

If `next build` later fails because a font rejects `weight`, drop `weight` only for that family and keep `variable` + `display: 'block'`. Do not add Inter Tight.

- [ ] **Step 3: Skip commit**

---

### Task 4: Aba Estilo — pesos honestos

**Files:**
- Modify: `components/insert-style-panel.tsx`

- [ ] **Step 1: Imports**

Replace `FONT_WEIGHTS` import with `WEIGHTS_BY_FONT` (keep `FontId`, `FontWeight`, `patchInsertStyle`, etc.).

- [ ] **Step 2: Font Select `onValueChange`**

Change from `update({ fontFamily: value as FontId })` to:

```ts
onValueChange={(value) => {
  const fontFamily = value as FontId
  update({ fontFamily })
}}
```

`patchInsertStyle` already clampa when `fontFamily` is in the patch (Task 1). This is enough.

- [ ] **Step 3: Weight Select items**

```ts
const weightOptions = WEIGHTS_BY_FONT[style.fontFamily] ?? [400]
```

If `style.fontWeight` is not in `weightOptions` (JSON antigo, draw já clampou via `patchInsertStyle` empty patch… wait).

`const style = patchInsertStyle(insert, {}, brandFontId)` — empty patch must **not** clamp (Task 1). So the Select `value={String(style.fontWeight)}` could be `"800"` on Bebas while options are only `400` — Radix Select breaks.

Fix: for the **displayed** weight in the Select, use `clampFontWeight(style.fontFamily, style.fontWeight)` as the Select `value`. Do not persist until the user changes font or weight.

```ts
import { WEIGHTS_BY_FONT, clampFontWeight, ... } from "@/lib/compose/insert-style"

const style = patchInsertStyle(insert, {}, brandFontId)
const weightOptions = WEIGHTS_BY_FONT[style.fontFamily] ?? [400]
const weightValue = clampFontWeight(style.fontFamily, style.fontWeight)
```

Select:

```ts
value={String(weightValue)}
onValueChange={(value) => update({ fontWeight: Number(value) as FontWeight })}
...
{weightOptions.map((weight) => (
  <SelectItem key={weight} value={String(weight)}>
    {weight}
  </SelectItem>
))}
```

Changing weight still persists 400 if they pick 400, which is correct. Showing 400 while JSON still has 800 until they touch weight/font is OK (honest UI, parse não reescreve). If that's confusing, only persist on font change (already clamped) — do **not** auto-write on mount.

- [ ] **Step 4: Skip commit**

---

### Task 5: Docs

**Files:**
- Modify: `docs/README.md` (stack / UI: as 6 fontes → 9; mencionar pesos por família)
- Modify: `docs/superpowers/specs/2026-08-19-fontes-novas-design.md` — **Status:** implementado (aguardando publish)

If README lists exactly six font names, update that sentence. Do not rewrite the whole README.

- [ ] **Step 1: Edit docs**
- [ ] **Step 2: Skip commit**

---

## Verification

```
node --experimental-strip-types --test "n:/Vibecoding/Editor Video/lib/compose/insert-style.test.ts" "n:/Vibecoding/Editor Video/lib/compose/fonts.test.ts"
```

Manual after `deploy.md`: Biblioteca mostra Oswald/Montserrat/Anton; aba Estilo em Bebas só 400; Poppins 800 → Anton vira 400; export de texto Oswald 600 usa Oswald no MP4.

---

## Spec coverage

| Spec | Task |
| --- | --- |
| 9 IDs + aliases | 1 |
| WEIGHTS_BY_FONT + clamp | 1 |
| resolve clampa; parse não; patch só na troca de família | 1 |
| canvas families + fonts.load | 2 |
| FONT_OPTIONS + next/font | 3 |
| Select honesto | 4 |
| Docs | 5 |
