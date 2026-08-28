# Undo/redo dos inserts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: `docs/superpowers/specs/2026-08-19-undo-inserts-design.md`. TDD.
> Este share **não é git repo** — pular todos os passos de commit.

**Goal:** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y desfaz e refaz só o array `inserts`, com um gesto (arraste, timeline, slider, digitação) valendo um passo.

**Architecture:** Módulo puro `lib/composition-history.ts` guarda snapshots de `inserts` (`past` / `future`, teto 50). O `video-editor.tsx` é o hub: mutação discreta chama `commitDiscrete`; gesto chama `beginInsertGesture` / `endInsertGesture`. Sem toast, sem botões, sem bump de schema, sem persistir a pilha.

**Tech Stack:** TypeScript, React (App Router), `node --experimental-strip-types --test`.

---

## File map

| File | Responsibility |
| --- | --- |
| Create `lib/is-editable-target.ts` | `isEditableTarget` compartilhado |
| Create `lib/is-editable-target.test.ts` | `null` não é editável |
| Create `lib/composition-history.ts` | snapshots, undo/redo, gesto, atalho |
| Create `lib/composition-history.test.ts` | casos da spec |
| Modify `package.json` | inclui os dois testes no script `test` |
| Modify `components/overlay-canvas.tsx` | importa `isEditableTarget`; begin/end no arraste |
| Modify `components/preview-panel.tsx` | idem na timeline; passa callbacks ao canvas |
| Modify `components/insert-style-panel.tsx` | begin/end nos `input[type=range]` |
| Modify `components/insert-card.tsx` | begin/end em texto (focus/blur); encaminha props |
| Modify `components/control-panel.tsx` | encaminha begin/end aos cards |
| Modify `components/video-editor.tsx` | refs de history/gesto; hub; listener Ctrl+Z |
| Modify `docs/README.md` | uma frase: Ctrl+Z desfaz inserts |
| Modify `docs/proximo.md` | tira undo do P1 (foi feito) |

Não mexer: `lib/composition.ts` (schema), encoder, `handleMediaInfo` (não registra histórico), `EditorNav`.

---

### Task 1: `isEditableTarget` extraído

**Files:**
- Create: `lib/is-editable-target.ts`
- Create: `lib/is-editable-target.test.ts`
- Modify: `components/overlay-canvas.tsx` (apagar a função local, importar)
- Modify: `components/preview-panel.tsx` (idem)

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import { isEditableTarget } from "./is-editable-target.ts"

test("null is not an editable target", () => {
  assert.equal(isEditableTarget(null), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```
node --experimental-strip-types --test lib/is-editable-target.test.ts
```

Expected: FAIL, módulo não existe.

- [ ] **Step 3: Write minimal implementation**

`lib/is-editable-target.ts`:

```ts
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}
```

Em `overlay-canvas.tsx` e `preview-panel.tsx`: apagar a função local e:

```ts
import { isEditableTarget } from "@/lib/is-editable-target"
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```
node --experimental-strip-types --test lib/is-editable-target.test.ts
```

Expected: PASS (1 test).

---

### Task 2: `composition-history` (TDD, todos os casos da spec)

**Files:**
- Create: `lib/composition-history.test.ts`
- Create: `lib/composition-history.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import type { CompositionInsert } from "./composition.ts"
import {
  HISTORY_LIMIT,
  beginInsertGesture,
  commitDiscrete,
  emptyHistory,
  endInsertGesture,
  historyShortcut,
  pushPast,
  redo,
  undo,
} from "./composition-history.ts"

function chip(id: string, text = "OFF"): CompositionInsert {
  return {
    id,
    type: "alerta-desconto",
    start: 0,
    duration: 2,
    text,
    anchor: "top",
    animIn: "none",
    animOut: "none",
  }
}

test("pushPast + undo restores the previous array including deleted id", () => {
  const before = [chip("a"), chip("b")]
  const after = [chip("a")]
  const pushed = pushPast(emptyHistory(), before, after)
  const result = undo(pushed, after)
  assert.equal(result.present.length, 2)
  assert.equal(result.present[1]?.id, "b")
  assert.equal(result.history.past.length, 0)
  assert.equal(result.history.future.length, 1)
})

test("undo then redo returns the array from after the action", () => {
  const before = [chip("a")]
  const after = [chip("a"), chip("b")]
  const pushed = pushPast(emptyHistory(), before, after)
  const undone = undo(pushed, after)
  const redone = redo(undone.history, undone.present)
  assert.equal(redone.present.length, 2)
  assert.equal(redone.present[1]?.id, "b")
  assert.equal(redone.history.future.length, 0)
})

test("pushPast after undo clears future", () => {
  const a = [chip("a")]
  const b = [chip("a"), chip("b")]
  const c = [chip("c")]
  const pushed = pushPast(emptyHistory(), a, b)
  const undone = undo(pushed, b)
  const next = pushPast(undone.history, undone.present, c)
  assert.equal(next.future.length, 0)
  assert.equal(undo(next, c).present[0]?.id, "a")
})

test("pushPast with equal JSON does not grow past", () => {
  const inserts = [chip("a", "OFF")]
  const same = [chip("a", "OFF")]
  const next = pushPast(emptyHistory(), inserts, same)
  assert.equal(next.past.length, 0)
})

test("51 pushes keep only 50; oldest is dropped", () => {
  let history = emptyHistory()
  let present = [chip("0")]
  for (let i = 1; i <= 51; i++) {
    const next = [chip(String(i))]
    history = pushPast(history, present, next)
    present = next
  }
  assert.equal(history.past.length, HISTORY_LIMIT)
  const first = undo(history, present)
  assert.notEqual(first.present[0]?.id, "0")
})

test("gesture with three patches is one pushPast; undo returns baseline", () => {
  const baseline = [chip("a", "OFF")]
  const end = [{ ...chip("a", "x"), x: 40, y: 50 }]
  const gesture = beginInsertGesture(baseline)
  const closed = endInsertGesture(emptyHistory(), gesture, end)
  assert.equal(closed.history.past.length, 1)
  const undone = undo(closed.history, end)
  assert.equal(undone.present[0]?.text, "OFF")
  assert.equal(undone.present[0]?.x, undefined)
})

test("endInsertGesture with no change leaves past empty", () => {
  const inserts = [chip("a")]
  const gesture = beginInsertGesture(inserts)
  const closed = endInsertGesture(emptyHistory(), gesture, inserts)
  assert.equal(closed.history.past.length, 0)
  assert.equal(closed.gesture.active, false)
})

test("undo with empty past leaves present unchanged", () => {
  const present = [chip("a")]
  const result = undo(emptyHistory(), present)
  assert.equal(result.present[0]?.id, "a")
  assert.equal(result.history.past.length, 0)
})

test("commitDiscrete while a gesture is open records baseline then the discrete step", () => {
  const baseline = [chip("a"), chip("b")]
  const dragged = [{ ...chip("a"), x: 10 }, chip("b")]
  const deleted = [{ ...chip("a"), x: 10 }]
  const gesture = beginInsertGesture(baseline)
  const committed = commitDiscrete(emptyHistory(), gesture, dragged, deleted)
  assert.equal(committed.gesture.active, false)
  const once = undo(committed.history, deleted)
  assert.equal(once.present.length, 2)
  assert.equal(once.present[0]?.x, 10)
  const twice = undo(once.history, once.present)
  assert.equal(twice.present[0]?.x, undefined)
})

test("beginInsertGesture while already active keeps the first baseline", () => {
  const first = beginInsertGesture([chip("a")])
  const second = beginInsertGesture([chip("b")], first)
  assert.equal(second.baseline?.[0]?.id, "a")
})

test("historyShortcut maps ctrl/meta z y and shift+z", () => {
  assert.equal(
    historyShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false }),
    "undo",
  )
  assert.equal(
    historyShortcut({ key: "Z", ctrlKey: false, metaKey: true, shiftKey: true }),
    "redo",
  )
  assert.equal(
    historyShortcut({ key: "y", ctrlKey: true, metaKey: false, shiftKey: false }),
    "redo",
  )
  assert.equal(
    historyShortcut({ key: "z", ctrlKey: false, metaKey: false, shiftKey: false }),
    null,
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```
node --experimental-strip-types --test lib/composition-history.test.ts
```

Expected: FAIL, módulo não existe.

- [ ] **Step 3: Write the implementation**

`lib/composition-history.ts`:

```ts
import type { CompositionInsert } from "./composition.ts"

export const HISTORY_LIMIT = 50

export interface InsertHistory {
  past: CompositionInsert[][]
  future: CompositionInsert[][]
}

export interface InsertGesture {
  active: boolean
  baseline: CompositionInsert[] | null
}

export function emptyHistory(): InsertHistory {
  return { past: [], future: [] }
}

export function emptyGesture(): InsertGesture {
  return { active: false, baseline: null }
}

export function cloneInserts(inserts: CompositionInsert[]): CompositionInsert[] {
  return JSON.parse(JSON.stringify(inserts)) as CompositionInsert[]
}

export function insertsEqual(a: CompositionInsert[], b: CompositionInsert[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function canUndo(history: InsertHistory): boolean {
  return history.past.length > 0
}

export function canRedo(history: InsertHistory): boolean {
  return history.future.length > 0
}

export function pushPast(
  history: InsertHistory,
  before: CompositionInsert[],
  after: CompositionInsert[],
): InsertHistory {
  if (insertsEqual(before, after)) return history
  const past = [...history.past, cloneInserts(before)]
  while (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}

export function undo(
  history: InsertHistory,
  present: CompositionInsert[],
): { history: InsertHistory; present: CompositionInsert[] } {
  if (history.past.length === 0) {
    return { history, present }
  }
  const past = history.past.slice(0, -1)
  const snapshot = history.past[history.past.length - 1]
  if (!snapshot) return { history, present }
  return {
    history: {
      past,
      future: [...history.future, cloneInserts(present)],
    },
    present: cloneInserts(snapshot),
  }
}

export function redo(
  history: InsertHistory,
  present: CompositionInsert[],
): { history: InsertHistory; present: CompositionInsert[] } {
  if (history.future.length === 0) {
    return { history, present }
  }
  const future = history.future.slice(0, -1)
  const snapshot = history.future[history.future.length - 1]
  if (!snapshot) return { history, present }
  return {
    history: {
      past: [...history.past, cloneInserts(present)],
      future,
    },
    present: cloneInserts(snapshot),
  }
}

export function beginInsertGesture(
  present: CompositionInsert[],
  current?: InsertGesture,
): InsertGesture {
  if (current?.active) return current
  return { active: true, baseline: cloneInserts(present) }
}

export function endInsertGesture(
  history: InsertHistory,
  gesture: InsertGesture,
  present: CompositionInsert[],
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
  before: CompositionInsert[],
  after: CompositionInsert[],
): { history: InsertHistory; gesture: InsertGesture } {
  const closed = endInsertGesture(history, gesture, before)
  return {
    history: pushPast(closed.history, before, after),
    gesture: closed.gesture,
  }
}

export function historyShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): "undo" | "redo" | null {
  if (!event.ctrlKey && !event.metaKey) return null
  const key = event.key.toLowerCase()
  if (key === "y") return "redo"
  if (key !== "z") return null
  return event.shiftKey ? "redo" : "undo"
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```
node --experimental-strip-types --test lib/composition-history.test.ts
```

Expected: PASS, todos os testes.

---

### Task 3: registrar testes no `package.json`

**Files:**
- Modify: `package.json` (script `test`)

- [ ] **Step 1: Acrescentar os arquivos no script**

No array de arquivos do `"test"`, depois de `lib/composition.test.ts`, incluir:

`lib/is-editable-target.test.ts lib/composition-history.test.ts`

Manter o comando `node --experimental-strip-types --test …`.

- [ ] **Step 2: Rodar os dois testes novos**

```
node --experimental-strip-types --test lib/is-editable-target.test.ts lib/composition-history.test.ts
```

Expected: PASS.

---

### Task 4: hub no `video-editor.tsx`

**Files:**
- Modify: `components/video-editor.tsx`

- [ ] **Step 1: Imports e refs**

Junto dos outros imports de `lib/`:

```ts
import {
  beginInsertGesture,
  canRedo,
  canUndo,
  commitDiscrete,
  emptyGesture,
  emptyHistory,
  endInsertGesture,
  historyShortcut,
} from "@/lib/composition-history"
import { isEditableTarget } from "@/lib/is-editable-target"
```

Depois dos `useState` existentes, ainda no corpo de `VideoEditor`:

```ts
  const historyRef = useRef(emptyHistory())
  const gestureRef = useRef(emptyGesture())
  const compositionRef = useRef(composition)
  compositionRef.current = composition
```

- [ ] **Step 2: helpers `beginInsertHistory`, `endInsertHistory`, `applyInserts`, `applyHistoryPresent`**

Colocar **antes** de `patchInserts` (hoje ~linha 326). `applyInserts` substitui o corpo de `patchInserts`.

```ts
  const beginInsertHistory = useCallback(() => {
    gestureRef.current = beginInsertGesture(
      compositionRef.current.inserts,
      gestureRef.current,
    )
  }, [])

  const endInsertHistory = useCallback(() => {
    const closed = endInsertGesture(
      historyRef.current,
      gestureRef.current,
      compositionRef.current.inserts,
    )
    historyRef.current = closed.history
    gestureRef.current = closed.gesture
  }, [])

  const applyHistoryPresent = useCallback((nextInserts: Insert[]) => {
    setComposition((prev) => clampComposition({ ...prev, inserts: nextInserts }))
    setSelectedInsertId((current) =>
      current && nextInserts.some((insert) => insert.id === current) ? current : null,
    )
  }, [])

  const applyInserts = useCallback(
    (updater: (inserts: Insert[]) => Insert[], mode: "discrete" | "gesture") => {
      setComposition((prev) => {
        const nextInserts = updater(prev.inserts)
        if (mode === "discrete") {
          const committed = commitDiscrete(
            historyRef.current,
            gestureRef.current,
            prev.inserts,
            nextInserts,
          )
          historyRef.current = committed.history
          gestureRef.current = committed.gesture
        }
        return clampComposition({ ...prev, inserts: nextInserts })
      })
      setActiveTemplateId(null)
    },
    [],
  )

  const patchInserts = useCallback(
    (updater: (inserts: Insert[]) => Insert[]) => {
      applyInserts(
        updater,
        gestureRef.current.active ? "gesture" : "discrete",
      )
    },
    [applyInserts],
  )
```

- [ ] **Step 3: mutações que hoje não passam por `patchInserts`**

Trocar o `setComposition` que altera `inserts` nestas funções para `applyInserts(..., "discrete")`, **exceto** `handleMediaInfo`.

`addInsert`: o `setComposition` interno vira:

```ts
    applyInserts((prev) => {
      const created = createInsert(nextInsertType(prev))
      created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
      addedId = created.id
      return [...prev, created]
    }, "discrete")
```

(`nextInsertType` hoje recebe `prev.inserts`; manter a mesma chamada: `nextInsertType(prev)` se `prev` já é o array.)

Mesmo padrão em `addTextInsert`, `addLibrarySticker` (o ramo que faz `[...prev.inserts, created]`) e `persistStickerFile` (o `setComposition` que adiciona o sticker).

`removeInsert` deve **forçar** discreto (Delete no meio de um arraste não pode ser silent):

```ts
  const removeInsert = useCallback(
    (id: string) => {
      applyInserts((prev) => prev.filter((insert) => insert.id !== id), "discrete")
      setSelectedInsertId((current) => (current === id ? null : current))
    },
    [applyInserts],
  )
```

`applyTemplate`:

```ts
    applyInserts(() => instantiateTemplate(template), "discrete")
    setActiveTemplateId(template.id)
    setActiveTab("editor")
```

`applyAIInserts`:

```ts
    applyInserts(() => generated, "discrete")
```

`handleMediaInfo`: **não** chamar `applyInserts`. Continua `setComposition` com clamp de duração, sem `commitDiscrete`.

- [ ] **Step 4: listener de teclado**

Um `useEffect` no `VideoEditor`:

```ts
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (gestureRef.current.active) return
      const action = historyShortcut(event)
      if (!action) return
      if (action === "undo" && !canUndo(historyRef.current)) return
      if (action === "redo" && !canRedo(historyRef.current)) return
      event.preventDefault()
      const present = compositionRef.current.inserts
      const result =
        action === "undo"
          ? undo(historyRef.current, present)
          : redo(historyRef.current, present)
      historyRef.current = result.history
      applyHistoryPresent(result.present)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [applyHistoryPresent])
```

Importar `undo` e `redo` no mesmo import de `composition-history`.

- [ ] **Step 5: passar begin/end ao preview e ao painel**

Onde renderiza `PreviewPanel`, acrescentar:

```ts
          onBeginInsertGesture={beginInsertHistory}
          onEndInsertGesture={endInsertHistory}
```

Onde renderiza `ControlPanel`, os mesmos dois props.

Hidratação (`setComposition(stored)`): não mexe em `historyRef` (já nasce `emptyHistory()`).

---

### Task 5: gesto no preview e na timeline

**Files:**
- Modify: `components/overlay-canvas.tsx`
- Modify: `components/preview-panel.tsx`

- [ ] **Step 1: props no canvas**

Acrescentar em `OverlayCanvas`:

```ts
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
```

Em `beginMove` e `beginResize`, **antes** de escrever `dragRef`:

```ts
    onBeginInsertGesture?.()
```

Em `onUp` (o que zera `dragRef`), **depois** de `dragRef.current = null`:

```ts
      onEndInsertGesture?.()
```

Setas do teclado **não** chamam begin/end (passo discreto via `onPatchInsert` / `changeInsert`).

- [ ] **Step 2: props no `PreviewPanel`**

Na interface:

```ts
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
```

Desestruturar e passar ao `OverlayCanvas`.

No `onPointerDown` da `TimelineClipBar` (onde hoje monta `dragRef.current = { id, mode, ... }`), chamar `onBeginInsertGesture?.()` depois de `onSelectInsert`.

No `onUp` da timeline (o `useEffect` que escuta `pointerup`), chamar `onEndInsertGesture?.()` sempre que `dragRef.current` existia, **depois** de limpar o drag (mesmo se `dragging` for false: `endInsertGesture` sem mudança não empilha).

---

### Task 6: sliders e texto no card

**Files:**
- Modify: `components/insert-style-panel.tsx`
- Modify: `components/insert-card.tsx`
- Modify: `components/control-panel.tsx`

- [ ] **Step 1: `InsertStyleFields`**

Acrescentar props opcionais:

```ts
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
```

Em **cada** `input type="range"` (fonte, contorno, opacidade, rotação):

```ts
                onPointerDown={() => onBeginInsertGesture?.()}
                onPointerUp={() => onEndInsertGesture?.()}
                onPointerCancel={() => onEndInsertGesture?.()}
```

Select, swatch e toggle **não** ganham gesto.

- [ ] **Step 2: `InsertCard`**

Mesmos dois props. Encaminhar a `InsertStyleFields`.

No `Textarea` e no `Input` de texto do chip (`onChange` de `text`):

```ts
                    onFocus={() => onBeginInsertGesture?.()}
                    onBlur={() => onEndInsertGesture?.()}
```

`TimeField` / `OverlayNumberField` usam `onCommit` (já é um passo discreto). Não abrir gesto.

- [ ] **Step 3: `ControlPanel`**

Acrescentar `onBeginInsertGesture` e `onEndInsertGesture` na interface e passar a cada `InsertCard`.

---

### Task 7: docs

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/proximo.md`
- Modify: `docs/superpowers/specs/2026-08-19-undo-inserts-design.md` (status)

- [ ] **Step 1: README**

Na seção 3 (Composition), uma frase:

`Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y desfaz e refaz só o array inserts (memória da sessão, teto 50). Delete continua imediato.`

Corrigir o título da seção 3 se ainda disser “v1”: o const é `COMPOSITION_VERSION = 2` (nit já listado no `proximo.md`).

- [ ] **Step 2: proximo.md**

Remover o item 1 (Undo/redo) da lista P1. Renumera checklist e handles para 1 e 2. Em “Já está no ar”, uma linha: undo/redo dos inserts (atalho, sem toast).

- [ ] **Step 3: spec**

`**Status:** implementado` (publish à parte, `deploy.md` §2).

---

### Task 8: verificação manual (depois do código)

Não é teste automatizado.

- [ ] Apagar insert (lixeira e Delete) → Ctrl+Z restaura o mesmo `id`, no mesmo tempo
- [ ] Arrastar no preview → um Ctrl+Z volta ao ponto de `pointerdown`
- [ ] Slider de fonte → um Ctrl+Z ao soltar
- [ ] Digitar texto no card → um Ctrl+Z no blur, não por letra
- [ ] Ctrl+Z com o campo de texto focado **não** desfaz o anúncio (undo nativo do input)
- [ ] F5: composição atual permanece; Ctrl+Z não desfaz sessão anterior
- [ ] Carregar vídeo (`handleMediaInfo`) não cria passo de undo
- [ ] `node --experimental-strip-types --test lib/composition-history.test.ts lib/is-editable-target.test.ts` verde

Deploy: só quando o operador pedir, `deploy.md` §2.

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Snapshots `pushPast` / `undo` / `redo` / teto 50 / no-op igual | 2 |
| Gesto begin/end sem empilhar no meio | 2, 5, 6 |
| `commitDiscrete` fecha gesto aberto | 2, 4 (`removeInsert`) |
| Só `inserts`; `handleMediaInfo` fora | 4 |
| Atalhos + `isEditableTarget` | 1, 2, 4 |
| Sem toast / sem botões / sem schema | (não há task de UI nova) |
| Seleção: mantém id se existir | 4 `applyHistoryPresent` |
| Docs | 7 |
