# Biblioteca prova social + texto livre — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Checkboxes (`- [ ]`) track tasks. Do not commit unless the user asks.

**Goal:** Só três tipos na lista de adicionar (estrelas, comentário TikTok, texto livre); a barra do texto livre liga/desliga fundo e sombra e ajusta o raio, no mesmo `styleRef` que o preview/export já pintam.

**Architecture:** Allowlist `ADDABLE_ELEMENT_TYPES` alimenta `pickerInsertTypes()` e `visibleElements()`. Chips fora da lista continuam no catálogo/motor. Controles da barra fazem patch em `styleRef.overrides` (`text.background.*`, `text.shadows`), que `drawOverlayInserts` já faz `deepMerge` em cima do preset.

**Tech Stack:** TypeScript, Node test runner, React, canvas Remotion/compose.

**Spec:** `docs/superpowers/specs/2026-08-24-biblioteca-prova-texto-design.md`

---

## Files

- Modify: `lib/inserts.ts` — `ADDABLE_ELEMENT_TYPES`, `isAddableElementType`, `pickerInsertTypes`, `libraryAddable` em `texto-livre` e nos chips ocultos
- Modify: `lib/library-catalog.ts` — `visibleElements` usa a allowlist
- Modify: `lib/insert-picker.test.ts`, `lib/library-catalog.test.ts`
- Create: `lib/text-presets/bar.ts` + `lib/text-presets/bar.test.ts`
- Modify: `lib/text-presets/index.ts` — reexport
- Modify: `components/text-floating-bar.tsx`, `components/overlay-canvas.tsx`
- Modify: `components/element-picker.tsx`, `components/library-panel.tsx` — lista plana, sem grupos de categoria

Não apagar `ELEMENT_PRESETS` / tipos de chip. Não mudar PNG, fontes, templates, `createInsert`.

---

### Task 1: Allowlist de tipos adicionáveis

**Files:**
- Modify: `lib/inserts.ts`
- Modify: `lib/insert-picker.test.ts`
- Modify: `lib/library-catalog.ts`
- Modify: `lib/library-catalog.test.ts`

- [ ] **Step 1: Teste vermelho do picker**

Em `lib/insert-picker.test.ts` substituir o teste atual por:

```ts
test("picker de elementos só oferece prova social e texto livre", () => {
  const values = pickerInsertTypes().map((item) => item.value).sort()
  assert.deepEqual(values, ["bubble-comentario", "estrelas", "texto-livre"].sort())
})

test("picker de elementos não oferece chips ocultos nem png/legenda", () => {
  const values = pickerInsertTypes().map((item) => item.value)
  for (const hidden of ["logo-shopee", "seta", "contador", "sticker-png", "legenda", "cupom"]) {
    assert.equal(values.includes(hidden), false, hidden)
  }
})
```

Manter o teste de templates.

- [ ] **Step 2: Rodar e ver falhar**

```
node --experimental-strip-types --test lib/insert-picker.test.ts
```

Esperado: falha porque `texto-livre` não entra e `logo-shopee` entra.

- [ ] **Step 3: Implementar allowlist**

Em `lib/inserts.ts`:

```ts
export const ADDABLE_ELEMENT_TYPES = ["estrelas", "bubble-comentario", "texto-livre"] as const
export type AddableElementType = (typeof ADDABLE_ELEMENT_TYPES)[number]

export function isAddableElementType(type: string): type is AddableElementType {
  return (ADDABLE_ELEMENT_TYPES as readonly string[]).includes(type)
}

export function pickerInsertTypes(): InsertTypeMeta[] {
  return INSERT_TYPES.filter((item) => isAddableElementType(item.value))
}
```

Em cada entrada de `INSERT_TYPES` que **não** está na allowlist (incluindo `sticker-png` e `legenda`): `libraryAddable: false`. Em `texto-livre`: **remover** `libraryAddable: false` (passa a ser addable).

- [ ] **Step 4: Teste vermelho de `visibleElements`**

Trocar o teste `visibleElements hides, renames and appends duplicates` em `lib/library-catalog.test.ts` para:

```ts
test("visibleElements só lista prova social e texto livre", () => {
  const ids = visibleElements(EMPTY_LIBRARY_CATALOG).map((item) => item.id).sort()
  assert.deepEqual(ids, ["bubble-comentario", "estrelas", "texto-livre"].sort())
})

test("visibleElements ignora extra de tipo oculto e aceita extra de estrelas", () => {
  const withCupom = duplicateElement(EMPTY_LIBRARY_CATALOG, {
    id: "cupom",
    type: "cupom",
    label: "Selo de Cupom",
  })
  assert.equal(
    visibleElements(withCupom.catalog).some((item) => item.type === "cupom"),
    false,
  )
  const withStars = duplicateElement(EMPTY_LIBRARY_CATALOG, {
    id: "estrelas",
    type: "estrelas",
    label: "Avaliação (estrelas)",
  })
  const copy = visibleElements(withStars.catalog).find((item) => item.id === withStars.copy.id)
  assert.ok(copy)
  assert.equal(copy.type, "estrelas")
})
```

- [ ] **Step 5: Filtrar `visibleElements`**

Em `lib/library-catalog.ts`, built-in: `isAddableElementType(item.value) && !hidden.has(item.value)`. Extras: só se `isAddableElementType(item.type)`.

Importar `isAddableElementType` de `./inserts.ts`.

- [ ] **Step 6: Rodar testes**

```
node --experimental-strip-types --test lib/insert-picker.test.ts lib/library-catalog.test.ts
```

Esperado: pass.

---

### Task 2: Lista plana na UI

**Files:**
- Modify: `components/element-picker.tsx`
- Modify: `components/library-panel.tsx`

- [ ] **Step 1: Picker sem categorias**

Em `ElementPicker`, em vez de `categories.map`, um único `grid` com `types` (já filtrado por `pickerInsertTypes()`). Manter a seção de templates/combos.

- [ ] **Step 2: Biblioteca sem grupos**

Em `ElementsGrid`, um `grid` único com `elements` (já filtrado). Sem `CATEGORY_LABELS`.

Não há teste de componente obrigatório; a allowlist cobre o contrato.

---

### Task 3: Patch de fundo / sombra / raio no `styleRef`

**Files:**
- Create: `lib/text-presets/bar.test.ts`
- Create: `lib/text-presets/bar.ts`
- Modify: `lib/text-presets/index.ts`

O draw em `lib/compose/draw-overlays.ts` faz `deepMerge(painted, ref.overrides)` no caminho legado. Os patches da barra **só** mexem em `styleRef`.

Usar `patchStyleRef` de `lib/style/edit-style.ts` (exportado em `lib/style/index.ts` se já estiver; senão import direto).

Sombra padrão: `SHADOW_SHORTCUTS.soft`. Fundo ao ligar: `text.background.enabled = true`; se não houver cor no override, também `text.background.color = "#111111"`, `mode = "bloco"`, `opacity = 88`.

- [ ] **Step 1: Testes vermelhos**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import type { CompositionInsert } from "../composition.ts"
import { TEXT_INSERT_TYPE } from "../composition.ts"
import { applyTextBackground, applyTextShadow, nudgeTextRadius } from "./bar.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: TEXT_INSERT_TYPE,
    kind: "text",
    start: 0,
    duration: 3,
    text: "OFERTA",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

test("applyTextBackground liga enabled no styleRef", () => {
  const next = { ...textInsert(), ...applyTextBackground(textInsert(), true) }
  assert.equal(next.styleRef?.overrides?.text?.background?.enabled, true)
  const off = { ...next, ...applyTextBackground(next, false) }
  assert.equal(off.styleRef?.overrides?.text?.background?.enabled, false)
})

test("applyTextShadow liga soft e desliga para array vazio", () => {
  const on = { ...textInsert(), ...applyTextShadow(textInsert(), true) }
  assert.ok((on.styleRef?.overrides?.text?.shadows?.length ?? 0) > 0)
  const off = { ...on, ...applyTextShadow(on, false) }
  assert.equal(off.styleRef?.overrides?.text?.shadows?.length, 0)
})

test("nudgeTextRadius não muda se o fundo está off", () => {
  const insert = textInsert()
  const next = nudgeTextRadius(insert, 8)
  assert.equal(next.styleRef, undefined)
})

test("nudgeTextRadius sobe o raio com fundo on", () => {
  const on = { ...textInsert(), ...applyTextBackground(textInsert(), true) }
  const nudged = { ...on, ...nudgeTextRadius(on, 8) }
  assert.ok((nudged.styleRef?.overrides?.text?.background?.radius ?? 0) >= 8)
})
```

Ajustar asserts ao shape real de `overrides` (`DeepPartial<InsertStyle>`: `overrides.text.background.enabled`).

- [ ] **Step 2: Rodar — falha (módulo ausente)**

```
node --experimental-strip-types --test lib/text-presets/bar.test.ts
```

- [ ] **Step 3: Implementar `bar.ts`**

```ts
export function applyTextBackground(insert: CompositionInsert, enabled: boolean): Partial<CompositionInsert>
export function applyTextShadow(insert: CompositionInsert, enabled: boolean): Partial<CompositionInsert>
export function nudgeTextRadius(insert: CompositionInsert, delta: number): Partial<CompositionInsert>
export function textBackgroundEnabledOf(insert: CompositionInsert): boolean
export function textShadowEnabledOf(insert: CompositionInsert): boolean
```

`nudgeTextRadius`: se `textBackgroundEnabledOf` for false, `return {}`. Clamp radius 0–80. Default radius ao ligar fundo: 16.

- [ ] **Step 4: Testes verdes**

```
node --experimental-strip-types --test lib/text-presets/bar.test.ts
```

- [ ] **Step 5: Reexport em `lib/text-presets/index.ts`**

---

### Task 4: Barra flutuante

**Files:**
- Modify: `components/text-floating-bar.tsx`
- Modify: `components/overlay-canvas.tsx`

- [ ] **Step 1: Props novas na barra**

`backgroundOn`, `shadowOn`, `radius`, `radiusEnabled`, `onBackground`, `onShadow`, `onNudgeRadius`.

Botões:
- Fundo — `aria-pressed={backgroundOn}` `aria-label="Fundo do texto"`
- Sombra — `aria-label="Sombra do texto"`
- `−` / `+` raio — `aria-label="Diminuir arredondamento"` / `Aumentar arredondamento"`, `disabled={!radiusEnabled}`

O botão atual de preenchimento (`onFill` / ciclo de box mode) **sai** — o spec pede on/off, não ciclo.

- [ ] **Step 2: Ligar no canvas**

Em `overlay-canvas.tsx`, no `TextFloatingBar`:

```ts
backgroundOn={textBackgroundEnabledOf(selectedVisible)}
shadowOn={textShadowEnabledOf(selectedVisible)}
radiusEnabled={textBackgroundEnabledOf(selectedVisible)}
onBackground={(on) => onPatchInsert?.(id, applyTextBackground(selectedVisible, on))}
onShadow={(on) => onPatchInsert?.(id, applyTextShadow(selectedVisible, on))}
onNudgeRadius={(delta) => onPatchInsert?.(id, nudgeTextRadius(selectedVisible, delta))}
```

Delta ±4.

- [ ] **Step 3: Regressão**

```
node --experimental-strip-types --test lib/insert-picker.test.ts lib/library-catalog.test.ts lib/text-presets/bar.test.ts lib/elements/paint.test.ts lib/composition.test.ts lib/captions/regression.test.ts
```

Esperado: pass.

---

## Coverage vs spec

| Requisito | Task |
| --- | --- |
| Só 3 tipos no picker | 1 |
| Só 3 na Biblioteca | 1 + 2 |
| Extra cupom some; extra estrelas fica | 1 |
| Combos intactos | 1 (teste templates) |
| Fundo/sombra/raio no mesmo style | 3–4 |
| Sem ciclo none/pill/block no botão | 4 (remove onFill) |
| Motor/chips antigos | sem delete de presets |
| PNG/fontes/templates | intocado |
