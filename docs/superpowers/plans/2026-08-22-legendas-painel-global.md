# Legendas painel global Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: [`docs/superpowers/specs/2026-08-22-legendas-painel-global-design.md`](../specs/2026-08-22-legendas-painel-global-design.md). TDD nos helpers. Sem runner de componente — UI no smoke.
> Este share **não é git repo** — pular todos os passos de commit.
> Sem `pnpm add`. Windows: `node --experimental-strip-types --test <arquivo>`.
> Sem bump de `Composition.version` (fica **4**). Não alterar `POST /api/ai/captions`, schema, timeline-clip, encoder.

**Goal:** Um bloco de visual (fonte, tamanho, cores, animação, X/Y) para todas as legendas; lista de Inserts sem cards `Legenda`; texto só da linha clicada na timeline.

**Architecture:** Helpers puros em `lib/caption-panel.ts` decidem host de estilo, filtro da lista e estado do textarea. `StyleCustomizePanel` sobe para o bloco Legendas (uma instância, `context="caption"`). Campo de texto recolhível próprio. `stampCaptionStyleRefs` / `applyCaptionPatch` / timeline **não mudam**.

**Tech Stack:** Next.js 16, React 19 client components, `node --experimental-strip-types --test`.

**Não fazer:** git commit, Início/Duração no painel, lista das 18 frases, seguir playhead, redesenhar acordeões, apagar o ramo caption de `insert-card.tsx`.

---

## File map

| Arquivo | Papel |
| --- | --- |
| Create: `lib/caption-panel.ts` | `nonCaptionInserts`, `countCaptionInserts`, `captionStyleHost`, `captionTextEditorState` |
| Create: `lib/caption-panel.test.ts` | TDD dos helpers |
| Create: `components/caption-text-card.tsx` | Fileira recolhível + textarea da caption selecionada |
| Create: `components/caption-visual-panel.tsx` | Thumbs + abas Estilo/Movimento + um `StyleCustomizePanel` |
| Modify: `components/style-customize-panel.tsx` | `context?: "insert" \| "caption"`; esconde “Aplicar a todos os inserts de texto” |
| Modify: `components/control-panel.tsx` | Filtro da lista, contadores, monta Visual + texto |
| Modify: `package.json` | Incluir `lib/caption-panel.test.ts` no script `test` |
| Modify: `docs/legendas.md`, `docs/inserts-ui.md`, `docs/proximo.md`, `docs/README.md` | Contrato do operador |
| Create: `docs/changelog-2026-08-22.md` | O que entrou nesta fatia |

Não mexer: `lib/composition.ts`, `lib/captions.ts`, `components/overlay-canvas.tsx`, `components/timeline-clip.tsx`, rota captions.

---

### Task 1: Helpers do painel (TDD)

**Files:**
- Create: `lib/caption-panel.ts`
- Create: `lib/caption-panel.test.ts`
- Modify: `package.json` (script `test`)

- [ ] **Step 1: Write the failing test**

Create `lib/caption-panel.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import { insertKind, type CompositionInsert } from "./composition.ts"
import {
  CAPTION_TEXT_PLACEHOLDER,
  captionStyleHost,
  captionTextEditorState,
  countCaptionInserts,
  nonCaptionInserts,
} from "./caption-panel.ts"

function chip(id: string): CompositionInsert {
  return {
    id,
    type: "cupom",
    start: 1,
    duration: 2,
    text: "CUPOM",
    anchor: "top",
    animIn: "pop",
    animOut: "none",
  }
}

function caption(id: string, start: number, text: string): CompositionInsert {
  return {
    id,
    type: "legenda",
    kind: "caption",
    start,
    duration: 1.5,
    text,
    words: [],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
  }
}

test("nonCaptionInserts drops captions and keeps chips", () => {
  const inserts = [caption("c1", 0, "oi"), chip("k1"), caption("c2", 3, "hoje")]
  const list = nonCaptionInserts(inserts)
  assert.deepEqual(list.map((item) => item.id), ["k1"])
  assert.equal(countCaptionInserts(inserts), 2)
  assert.equal(insertKind(list[0]!), "chip")
})

test("captionStyleHost prefers the selected caption else the first caption", () => {
  const inserts = [chip("k1"), caption("c1", 0, "oi"), caption("c2", 3, "hoje")]
  assert.equal(captionStyleHost(inserts, "c2")?.id, "c2")
  assert.equal(captionStyleHost(inserts, "k1")?.id, "c1")
  assert.equal(captionStyleHost(inserts, null)?.id, "c1")
  assert.equal(captionStyleHost([chip("k1")], "k1"), null)
})

test("captionTextEditorState is editing only when the selection is a caption", () => {
  const inserts = [chip("k1"), caption("c1", 0, "oi")]
  const editing = captionTextEditorState(inserts, "c1")
  assert.equal(editing.mode, "editing")
  if (editing.mode === "editing") assert.equal(editing.insert.text, "oi")
  const idle = captionTextEditorState(inserts, "k1")
  assert.equal(idle.mode, "placeholder")
  assert.equal(CAPTION_TEXT_PLACEHOLDER, "Clique uma legenda na timeline.")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```
node --experimental-strip-types --test lib/caption-panel.test.ts
```

Expected: FAIL — `Cannot find module './caption-panel.ts'` (ou equivalente).

- [ ] **Step 3: Write minimal implementation**

Create `lib/caption-panel.ts`:

```ts
import { insertKind, type CompositionInsert } from "./composition.ts"

export const CAPTION_TEXT_PLACEHOLDER = "Clique uma legenda na timeline."

export function nonCaptionInserts(inserts: CompositionInsert[]): CompositionInsert[] {
  return inserts.filter((insert) => insertKind(insert) !== "caption")
}

export function countCaptionInserts(inserts: CompositionInsert[]): number {
  let count = 0
  for (const insert of inserts) {
    if (insertKind(insert) === "caption") count += 1
  }
  return count
}

export function captionStyleHost(
  inserts: CompositionInsert[],
  selectedId: string | null,
): CompositionInsert | null {
  const captions = inserts.filter((insert) => insertKind(insert) === "caption")
  if (captions.length === 0) return null
  const selected = captions.find((insert) => insert.id === selectedId)
  return selected ?? captions[0] ?? null
}

export type CaptionTextEditorState =
  | { mode: "placeholder" }
  | { mode: "editing"; insert: CompositionInsert }

export function captionTextEditorState(
  inserts: CompositionInsert[],
  selectedId: string | null,
): CaptionTextEditorState {
  const selected = inserts.find((insert) => insert.id === selectedId)
  if (selected && insertKind(selected) === "caption") {
    return { mode: "editing", insert: selected }
  }
  return { mode: "placeholder" }
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run:

```
node --experimental-strip-types --test lib/caption-panel.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Register the file in `package.json`**

In the `test` script string, insert `lib/caption-panel.test.ts` immediately after `lib/captions.test.ts` (same space-separated list). Do not remove other files.

- [ ] **Step 6: Commit**

Pular (não é git repo).

---

### Task 2: Esconder “Aplicar a todos os inserts de texto”

**Files:**
- Modify: `components/style-customize-panel.tsx` (~linhas 190–224 props; ~463–465 o botão)

- [ ] **Step 1: Add the prop**

In `StyleCustomizePanel` props, after `presetLibrary`, add:

```ts
  context?: "insert" | "caption"
```

In the destructuring, add `context = "insert"`.

- [ ] **Step 2: Gate the button**

Replace the unconditional button (around line 463):

```tsx
        <Button type="button" variant="secondary" size="xs" onClick={onApplyToTrack}>
          Aplicar a todos os inserts de texto
        </Button>
```

with:

```tsx
        {context === "insert" ? (
          <Button type="button" variant="secondary" size="xs" onClick={onApplyToTrack}>
            Aplicar a todos os inserts de texto
          </Button>
        ) : null}
```

Call sites atuais (`insert-card.tsx`) não passam `context` → continuam `"insert"`. Não mudar `insert-card.tsx` nesta task.

- [ ] **Step 3: Commit**

Pular.

---

### Task 3: `CaptionTextCard`

**Files:**
- Create: `components/caption-text-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  CAPTION_TEXT_PLACEHOLDER,
  captionTextEditorState,
} from "@/lib/caption-panel"
import type { Insert } from "@/lib/inserts"
import { cn } from "@/lib/utils"

export function CaptionTextCard({
  inserts,
  selectedId,
  onChange,
  onBeginInsertGesture,
  onEndInsertGesture,
}: {
  inserts: Insert[]
  selectedId: string | null
  onChange: (id: string, patch: Partial<Insert>) => void
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
}) {
  const state = captionTextEditorState(inserts, selectedId)
  const editingId = state.mode === "editing" ? state.insert.id : null
  const [expanded, setExpanded] = useState(Boolean(editingId))

  useEffect(() => {
    setExpanded(Boolean(editingId))
  }, [editingId])

  if (state.mode === "placeholder") {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">{CAPTION_TEXT_PLACEHOLDER}</p>
      </div>
    )
  }

  const insert = state.insert
  const preview = insert.text?.trim() || "Legenda"

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        expanded ? "border-brand ring-1 ring-brand/40" : "border-border",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/60"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Recolher" : "Expandir"} texto da legenda`}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {preview}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <Field>
            <FieldLabel htmlFor={`caption-text-${insert.id}`}>Texto desta linha</FieldLabel>
            <Textarea
              id={`caption-text-${insert.id}`}
              value={insert.text ?? ""}
              placeholder="Texto da linha"
              rows={3}
              onChange={(event) => onChange(insert.id, { text: event.target.value })}
              onFocus={() => onBeginInsertGesture?.()}
              onBlur={() => onEndInsertGesture?.()}
            />
          </Field>
          <p className="text-[0.7rem] text-muted-foreground">
            Tempo: arraste o clipe na timeline
          </p>
        </div>
      ) : null}
    </div>
  )
}
```

Não colocar Início/Duração. Expandir quando `editingId` muda para uma caption; recolher quando a seleção deixa de ser caption.

- [ ] **Step 2: Commit**

Pular.

---

### Task 4: `CaptionVisualPanel`

**Files:**
- Create: `components/caption-visual-panel.tsx`

- [ ] **Step 1: Create the wrapper**

This is the thumbs that already exist plus **one** `StyleCustomizePanel`. Local tab state (igual ao card antigo).

```tsx
"use client"

import { useState } from "react"

import { CaptionStyleCard } from "@/components/caption-style-card"
import {
  StyleCustomizePanel,
  type PresetLibraryHandlers,
} from "@/components/style-customize-panel"
import { cn } from "@/lib/utils"
import type { CaptionPreset, CaptionStyle, CompositionInsert } from "@/lib/composition"
import type { Insert } from "@/lib/inserts"
import type { StyleLayer, TrackId, UserPreset } from "@/lib/style/types"

type VisualTab = "style" | "motion"

const TABS: Array<{ id: VisualTab; label: string }> = [
  { id: "style", label: "Estilo" },
  { id: "motion", label: "Movimento" },
]

export function CaptionVisualPanel({
  host,
  inserts,
  videoDuration,
  captionStyle,
  captionPreset = "viral",
  userPresets = [],
  onSelectLook,
  tracks,
  projectStyle,
  onPatchStyle,
  onResetField,
  onResetOverrides,
  onResetPosition,
  onApplyPreset,
  onApplyToTrack,
  onBeginGesture,
  onEndGesture,
  presetLibrary,
}: {
  host: CompositionInsert
  inserts: Insert[]
  videoDuration: number
  captionStyle: CaptionStyle
  captionPreset?: CaptionPreset
  userPresets?: UserPreset[]
  onSelectLook: (lookId: string) => void
  tracks?: Partial<Record<TrackId, StyleLayer>>
  projectStyle?: StyleLayer
  onPatchStyle: (path: string, value: unknown) => void
  onResetField: (path: string) => void
  onResetOverrides: () => void
  onResetPosition: () => void
  onApplyPreset: (presetId: string, mode: "preserve" | "clean") => void
  onApplyToTrack: () => void
  onBeginGesture?: () => void
  onEndGesture?: () => void
  presetLibrary?: PresetLibraryHandlers
}) {
  const [tab, setTab] = useState<VisualTab>("style")

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        Visual · todas as linhas
      </p>
      <CaptionStyleCard
        inserts={inserts}
        captionStyle={captionStyle}
        captionPreset={captionPreset}
        userPresets={userPresets}
        onSelectLook={onSelectLook}
      />
      <div
        role="tablist"
        aria-label="Estilo e movimento das legendas"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {TABS.map((item) => {
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <StyleCustomizePanel
        insert={host}
        videoDuration={videoDuration}
        tracks={tracks}
        project={projectStyle}
        captionStyle={captionStyle}
        captionPreset={captionPreset}
        tab={tab}
        context="caption"
        onPatchStyle={onPatchStyle}
        onResetField={onResetField}
        onResetOverrides={onResetOverrides}
        onResetPosition={onResetPosition}
        onApplyPreset={onApplyPreset}
        onApplyToTrack={onApplyToTrack}
        onBeginGesture={onBeginGesture}
        onEndGesture={onEndGesture}
        presetLibrary={presetLibrary}
      />
    </div>
  )
}
```

`CaptionStyleCard` hoje já tem borda/padding próprios — fica um card dentro do bloco. Aceitável nesta fatia (YAGNI: não refatorar o thumb card). `onApplyToTrack` continua obrigatório no tipo do painel; o botão não renderiza com `context="caption"`.

- [ ] **Step 2: Commit**

Pular.

---

### Task 5: Ligar no `control-panel.tsx`

**Files:**
- Modify: `components/control-panel.tsx`

- [ ] **Step 1: Imports**

After the `CaptionStyleCard` import, replace that import usage with the new panels (pode deixar `CaptionStyleCard` só se ainda referenciado — depois desta task **não** deve ser). Add:

```tsx
import { CaptionTextCard } from "@/components/caption-text-card"
import { CaptionVisualPanel } from "@/components/caption-visual-panel"
```

Add to the `@/lib/insert-ops` import block (keep existing named imports) and add caption-panel:

```tsx
import {
  captionStyleHost,
  countCaptionInserts,
  nonCaptionInserts,
} from "@/lib/caption-panel"
```

Remove `import { CaptionStyleCard } from "@/components/caption-style-card"` if unused.

- [ ] **Step 2: Derived state**

Replace:

```tsx
  const orderedInserts = useMemo(() => sortInsertsByStart(inserts), [inserts])
  const hasCaptions = inserts.some((insert) => insertKind(insert) === "caption")
```

with:

```tsx
  const captionCount = useMemo(() => countCaptionInserts(inserts), [inserts])
  const hasCaptions = captionCount > 0
  const orderedInserts = useMemo(
    () => sortInsertsByStart(nonCaptionInserts(inserts)),
    [inserts],
  )
  const styleHost = useMemo(
    () => captionStyleHost(inserts, selectedId),
    [inserts, selectedId],
  )
```

Keep `overflowing` / `duplicateGroups` on the **full** `inserts` array (spec: avisos incluem captions).

- [ ] **Step 3: Bloco Legendas**

Replace the Legendas `<section>` (the one with `GenerateCaptionsButton` + `CaptionStyleCard` / empty copy) with:

```tsx
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Legendas</h2>
              {captionCount > 0 ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
                  {captionCount}
                </span>
              ) : null}
            </div>
            <GenerateCaptionsButton
              duration={videoDuration}
              disabled={!canGenerateCaptions}
              loadMedia={loadAiMedia}
              onGenerate={onGenerateCaptions}
              onStatus={onAiStatus}
            />
            {hasCaptions && styleHost ? (
              <>
                <CaptionVisualPanel
                  host={styleHost}
                  inserts={inserts}
                  videoDuration={videoDuration}
                  captionStyle={captionStyle}
                  captionPreset={captionPreset}
                  userPresets={presetLibrary?.presets}
                  onSelectLook={onApplyCaptionLook}
                  tracks={tracks}
                  projectStyle={projectStyle}
                  onPatchStyle={(path, value) => onPatchInsertStyle(styleHost.id, path, value)}
                  onResetField={(path) => onResetInsertStyleField(styleHost.id, path)}
                  onResetOverrides={() => onResetInsertStyleOverrides(styleHost.id)}
                  onResetPosition={() => onResetInsertPosition(styleHost.id)}
                  onApplyPreset={onApplyStylePreset}
                  onApplyToTrack={() => onApplyStyleToTrack(styleHost.id)}
                  onBeginGesture={onBeginInsertGesture}
                  onEndGesture={onEndInsertGesture}
                  presetLibrary={presetLibrary}
                />
                <CaptionTextCard
                  inserts={inserts}
                  selectedId={selectedId}
                  onChange={onChangeInsert}
                  onBeginInsertGesture={onBeginInsertGesture}
                  onEndInsertGesture={onEndInsertGesture}
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                O estilo das legendas aparece depois de gerar.
              </p>
            )}
          </section>
```

Patches passam `styleHost.id`. Com caption selecionada, host é ela; senão a primeira. `stampCaptionStyleRefs` no editor já replica o `styleRef` em todas.

- [ ] **Step 4: Badge e vazio de Inserts**

Replace `{inserts.length}` in the Inserts header badge with `{orderedInserts.length}`.

Replace the empty-state branch:

```tsx
            {inserts.length === 0 ? (
```

with a three-way:

```tsx
            {orderedInserts.length === 0 ? (
              hasCaptions ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum chip, texto ou PNG ainda.
                </p>
              ) : (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <Sparkles className="mb-1 size-5 text-muted-foreground/70" />
                <p className="text-sm font-medium text-foreground">
                  Nenhum insert ainda
                </p>
                <p className="text-xs text-muted-foreground">
                  Comece pelo gancho — os 2 primeiros segundos.
                </p>
              </div>
              )
            ) : (
```

Close the extra paren so JSX matches. The `orderedInserts.map` that already renders `InsertCard` stays; it now only sees chips/texto/PNG.

`insertKind` may become unused in this file — if the linter says so, remove `import { insertKind } from "@/lib/composition"`. `onChangeCaptionStyle` pode ficar na props (video-editor ainda passa); não é obrigatório remover nesta fatia.

- [ ] **Step 5: Typecheck / helpers still green**

Run:

```
node --experimental-strip-types --test lib/caption-panel.test.ts
```

Expected: PASS.

If `npx tsc --noEmit` is used in this repo, run it. Expected: no new errors in the files touched.

- [ ] **Step 6: Commit**

Pular.

---

### Task 6: Docs do operador

**Files:**
- Modify: `docs/legendas.md`
- Modify: `docs/inserts-ui.md`
- Modify: `docs/proximo.md`
- Modify: `docs/README.md`
- Create: `docs/changelog-2026-08-22.md`

- [ ] **Step 1: `docs/legendas.md`**

Update the header status line to mention painel global (2026-08-22).

In the table “Três camadas de look”, change the UI column for estilo compartilhado from “card da linha + arraste no preview” to “bloco Visual em Legendas + arraste no preview”.

In “O que o operador vê”, replace items 2 and 5 with:

```
2. Bloco **Legendas** (acima de Inserts): **Gerar legendas**, bloco **Visual** (thumbs + Estilo/Movimento, um só, vale para todas) e um campo de **texto** recolhível da linha selecionada na timeline.
5. Tempo (início/duração) só na timeline (trim / mover o clipe). No painel: corrigir o texto da linha clicada. Lista de **Inserts** não mostra cards `Legenda`.
```

Add a row to the file table:

```
| `components/caption-text-card.tsx` | Texto recolhível da caption selecionada |
| `components/caption-visual-panel.tsx` | Visual global (thumbs + StyleCustomizePanel) |
| `lib/caption-panel.ts` | Filtro da lista, host de estilo, estado do textarea |
```

- [ ] **Step 2: `docs/inserts-ui.md` §2.1**

Replace “Bloco **Legendas** (acima de Inserts): **Gerar legendas** + card **Estilo das legendas**.” with:

```
Bloco **Legendas** (acima de Inserts): **Gerar legendas** + visual global (thumbs Limpo/Viral/factory **e** acordeões Estilo/Movimento, uma vez) + texto da linha selecionada na timeline. Cards `Legenda` **não** entram na lista de Inserts.
```

- [ ] **Step 3: `docs/proximo.md`**

In the bullet “14. **Legendas — fatia A + estilo compartilhado**”, append:

```
**Painel global 2026-08-22:** visual uma vez no bloco Legendas; Inserts sem cards de linha; texto só da selecionada; tempo na timeline.
```

In the Card row of the file table, add `caption-visual-panel.tsx` / `caption-text-card.tsx`.

- [ ] **Step 4: `docs/README.md`**

Where it lists `control-panel.tsx` / `caption-style-card.tsx`, add the two new components. In the look row (“UI: card Estilo das legendas”), say “UI: bloco Visual em Legendas”.

- [ ] **Step 5: Create `docs/changelog-2026-08-22.md`**

```markdown
# Sessão 2026-08-22

O que entrou **no ar** neste dia. Índice: [`README.md`](README.md).
Publicar: [`../deploy.md`](../deploy.md) §2 + hard refresh (Ctrl+F5).
**Não é git repo.**

---

## A. Legendas — painel global

Spec: [`superpowers/specs/2026-08-22-legendas-painel-global-design.md`](superpowers/specs/2026-08-22-legendas-painel-global-design.md).
Ops: [`legendas.md`](legendas.md).

Fonte, tamanho, cores, animação e X/Y ficam num bloco **Visual** na seção Legendas (um controle, todas as linhas). A lista de Inserts não mostra cards `Legenda`. Texto da frase só no campo recolhível da linha clicada na timeline; tempo só no clipe.

Schema v4 inalterado. Whisper / `POST /api/ai/captions` inalterado.
```

- [ ] **Step 6: Commit**

Pular.

---

### Task 7: Smoke manual

Não há teste de DOM. Conferir no `pnpm dev` (porta **4013**):

- [ ] **Step 1: Gerar ~18 legendas**

Lista de Inserts **não** ganha 18 cards. Badge de Inserts conta só chips/texto/PNG. Badge de Legendas mostra 18. Timeline ainda tem os clipes.

- [ ] **Step 2: Visual global**

Mover o slider de tamanho no bloco Legendas (sem ter linha selecionada) muda o preview de **todas**. Não aparece o botão “Aplicar a todos os inserts de texto”. Arrastar a caixa no preview continua movendo todas.

- [ ] **Step 3: Texto**

Clicar o 4º clipe de legenda abre o textarea com essa frase. Sem Início/Duração. Recolher/expandir no chevron. Clicar um chip recolhe e mostra “Clique uma legenda na timeline.”

- [ ] **Step 4: Tempo**

Trim na timeline muda quando a frase aparece. Gerar de novo preserva fonte/cores. Ctrl+Z desfaz texto e visual.

- [ ] **Step 5: Commit**

Pular.

---

## Self-review (plan vs spec)

| Spec | Task |
| --- | --- |
| Inserts filtra captions + contador | 1 (helper) + 5 (UI) |
| Visual uma vez no bloco Legendas | 4 + 5 |
| Esconder “Aplicar a todos os inserts de texto” | 2 |
| Texto recolhível da selecionada; sem Início/Duração | 3 + 5 |
| Host = selecionada ou primeira | 1 + 5 |
| Sem captions: some Visual/texto | 5 |
| Overflow/duplicata no array completo | 5 (não filtrar `overflowing`) |
| Docs operador | 6 |
| Sem schema / rota / timeline-clip | file map “Não mexer” |
| `carryCaptionStyleRef` intacto | nenhuma task mexe `lib/captions.ts` / `style-preset.ts` |
