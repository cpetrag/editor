# Novo projeto e Limpar inserts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Não é git repo: **não commit**. Spec: [`docs/superpowers/specs/2026-08-21-novo-projeto-design.md`](../specs/2026-08-21-novo-projeto-design.md).

**Goal:** Botão **Novo projeto** (zera sessão, inclusive o MP4) no cabeçalho e **Limpar inserts** no Origem (MP4 fica, undo).

**Architecture:** Funções puras em `lib/project-reset.ts`. Persistência imediata via `saveCompositionJson` já existente. IndexedDB `files.delete` pelos ids de `projectFileIds`. Chrome em `control-panel.tsx` / `background-source-card.tsx`; orquestração em `video-editor.tsx`. Sem Dialog, sem schema v5.

**Tech Stack:** TypeScript, `node --experimental-strip-types --test`, React client, localStorage + IndexedDB.

**Não fazer:** git commit, encoder, Fase 3, apagar presets, `import-downloads`, Dialog shadcn.

---

## File map

| Arquivo | Papel |
| --- | --- |
| Create: `lib/project-reset.ts` | `newProjectComposition`, `clearInsertsArt`, `projectFileIds` |
| Create: `lib/project-reset.test.ts` | TDD das três funções |
| Modify: `lib/project-store.test.ts` | round-trip do documento vazio (sem seed, sem fileId) |
| Modify: `package.json` | incluir `lib/project-reset.test.ts` no script `test` |
| Modify: `components/control-panel.tsx` | cabeçalho dois cliques; props `onNewProject` / `exporting` já existe |
| Modify: `components/background-source-card.tsx` | **Limpar inserts** ao lado de Trocar |
| Modify: `components/video-editor.tsx` | hydrate-safe reset, delete blobs, undo em Limpar |
| Modify: `docs/proximo.md` | fatia no ar / backlog |

---

### Task 1: Funções puras

**Files:**
- Create: `lib/project-reset.ts`
- Create: `lib/project-reset.test.ts`
- Modify: `package.json` (script `test`)
- Modify: `lib/project-store.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/project-reset.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  type Composition,
} from "./composition.ts"
import { createDefaultComposition } from "./composition.ts"
import {
  clearInsertsArt,
  newProjectComposition,
  projectFileIds,
} from "./project-reset.ts"

function sample(): Composition {
  const base = createDefaultComposition()
  return {
    ...base,
    source: {
      ...base.source,
      duration: 12,
      fileName: "a.mp4",
      fileId: "vid-1",
    },
    captionStyle: { ...DEFAULT_CAPTION_STYLE, rotation: 15, y: 40 },
    captionPreset: "limpo",
    styleRef: { presetId: "hormozi" },
    inserts: [
      {
        id: "t1",
        type: "texto-livre",
        kind: "text",
        start: 0,
        duration: 2,
        anchor: "center",
        animIn: "none",
        animOut: "none",
        text: "oi",
      },
      {
        id: "p1",
        type: "png",
        kind: "sticker",
        start: 1,
        duration: 2,
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        fileId: "png-1",
      },
      {
        id: "p2",
        type: "png",
        kind: "sticker",
        start: 2,
        duration: 2,
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        fileId: "png-1",
      },
    ],
  }
}

test("newProjectComposition is empty v4 without fileId or inserts", () => {
  const next = newProjectComposition()
  assert.equal(next.version, COMPOSITION_VERSION)
  assert.equal(next.inserts.length, 0)
  assert.equal(next.source.duration, 0)
  assert.equal(next.source.fileId, undefined)
  assert.equal(next.source.fileName, "")
})

test("clearInsertsArt keeps the video and resets art", () => {
  const next = clearInsertsArt(sample())
  assert.equal(next.source.fileId, "vid-1")
  assert.equal(next.source.duration, 12)
  assert.equal(next.inserts.length, 0)
  assert.equal(next.captionPreset, "viral")
  assert.equal(next.captionStyle.rotation, 0)
  assert.equal(next.styleRef, undefined)
})

test("projectFileIds unique video + stickers + extras", () => {
  const ids = projectFileIds(sample(), ["prev-9", "vid-1", ""])
  assert.deepEqual([...ids].sort(), ["png-1", "prev-9", "vid-1"])
})
```

Acréscimo em `lib/project-store.test.ts` (depois dos testes existentes):

```ts
test("saved empty project round-trips without fileId", () => {
  const storage = memoryStorage()
  const empty = createDefaultComposition()
  saveCompositionJson(empty, storage)
  const loaded = loadCompositionJson(storage)
  assert.equal(loaded?.inserts.length, 0)
  assert.equal(loaded?.source.fileId, undefined)
  assert.equal(loaded?.source.duration, 0)
})
```

Importar `createDefaultComposition` no store test.

- [ ] **Step 2: Run tests to verify they fail**

```powershell
node --experimental-strip-types --test lib/project-reset.test.ts
```

Expected: FAIL (`Cannot find module` / `ERR_MODULE_NOT_FOUND` para `./project-reset.ts`).

- [ ] **Step 3: Write minimal implementation**

`lib/project-reset.ts`:

```ts
import {
  createDefaultComposition,
  insertKind,
  type Composition,
} from "./composition.ts"

export function newProjectComposition(): Composition {
  return createDefaultComposition()
}

export function clearInsertsArt(composition: Composition): Composition {
  const fresh = createDefaultComposition()
  return {
    ...composition,
    inserts: [],
    captionPreset: fresh.captionPreset,
    captionStyle: { ...fresh.captionStyle },
    tracks: fresh.tracks,
    styleRef: undefined,
  }
}

export function projectFileIds(
  composition: Composition,
  extraIds: string[] = [],
): string[] {
  const ids = new Set<string>()
  const sourceId = composition.source.fileId
  if (sourceId) ids.add(sourceId)
  for (const insert of composition.inserts) {
    if (insertKind(insert) === "sticker" && insert.fileId) ids.add(insert.fileId)
  }
  for (const extra of extraIds) {
    if (extra) ids.add(extra)
  }
  return [...ids]
}
```

Em `lib/project-store.test.ts` importar `createDefaultComposition`.

No `package.json` script `test`, inserir `lib/project-reset.test.ts` logo após `lib/project-store.test.ts`.

- [ ] **Step 4: Run tests to verify they pass**

```powershell
node --experimental-strip-types --test lib/project-reset.test.ts lib/project-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Não commit (não é git repo).

---

### Task 2: Cabeçalho Novo projeto (dois cliques)

**Files:**
- Modify: `components/control-panel.tsx`

- [ ] **Step 1: Add props and header UI**

No `ControlPanelProps` e no destructuring:

```ts
onNewProject: () => void
```

No topo do componente, estado:

```ts
const [newProjectArmed, setNewProjectArmed] = useState(false)
```

`useEffect` para timeout 6 s quando `newProjectArmed`. `useEffect` para `setNewProjectArmed(false)` quando `exporting`.

Header vira `justify-between`. À direita:

```tsx
{newProjectArmed ? (
  <div className="ml-auto flex shrink-0 items-center gap-1">
    <Button
      type="button"
      variant="destructive"
      size="xs"
      disabled={exporting}
      onClick={() => {
        setNewProjectArmed(false)
        onNewProject()
      }}
    >
      Confirmar
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={() => setNewProjectArmed(false)}
    >
      Cancelar
    </Button>
  </div>
) : (
  <Button
    type="button"
    variant="ghost"
    size="xs"
    className="ml-auto shrink-0"
    disabled={exporting}
    onClick={() => setNewProjectArmed(true)}
  >
    Novo projeto
  </Button>
)}
```

Importar `useState` / `useEffect` de React (hoje o arquivo só tem `useMemo` — passar para `import { useEffect, useMemo, useState } from "react"`).

- [ ] **Step 2: No unit test for JSX.** Visual: botão no header.

- [ ] **Step 3: Commit** — não commit.

---

### Task 3: Limpar inserts no Origem

**Files:**
- Modify: `components/background-source-card.tsx`
- Modify: `components/control-panel.tsx` (passar props)

- [ ] **Step 1: Props no card**

```ts
canClearInserts: boolean
onClearInserts: () => void
```

No bloco com **Trocar**, um segundo botão outline xs:

```tsx
<Button
  type="button"
  variant="outline"
  size="xs"
  disabled={!canClearInserts}
  onClick={onClearInserts}
>
  Limpar inserts
</Button>
```

Em `ControlPanel`: `canClearInserts={inserts.length > 0}` e `onClearInserts` (nova prop). Só renderiza o card; o botão só existe no estado “vídeo pronto” (já é o branch que tem Trocar).

- [ ] **Step 2: Commit** — não commit.

---

### Task 4: Orquestração no VideoEditor

**Files:**
- Modify: `components/video-editor.tsx`

- [ ] **Step 1: Helpers de revoke de stickers**

Já existe `stickerBlobUrls` + `revokeObjectUrl`. Ao resetar, revogar todas as URLs em `stickerBlobUrls` e limpar o record.

- [ ] **Step 2: `startNewProject`**

```ts
const startNewProject = useCallback(() => {
  const prev = compositionRef.current
  const extra = previousSource?.fileId ? [previousSource.fileId] : []
  const ids = projectFileIds(prev, extra)
  importAbortRef.current?.abort()
  importAbortRef.current = null
  for (const url of Object.values(stickerBlobUrls)) {
    URL.revokeObjectURL(url)
  }
  setStickerBlobUrls({})
  revokeObjectUrl()
  const next = newProjectComposition()
  compositionRef.current = next
  setComposition(next)
  saveCompositionJson(next)
  historyRef.current = emptyHistory()
  gestureRef.current = emptyGesture()
  setSelectedInsertId(null)
  setBackgroundUrl("")
  setDraftUrl("")
  setFileName("")
  setMissingFile(false)
  setQuotaWarning("")
  setImportState({ status: "idle" })
  setReplacingSource(false)
  setPreviousSource(null)
  setBurnedInWarning(false)
  setPasteCandidate(null)
  setActiveTemplateId(null)
  setUndoToast(null)
  setLiveMessage("Projeto novo")
  previewRef.current?.seek(0)
  void Promise.all(ids.map((id) => fileStoreRef.current.delete(id))).catch(
    (error: unknown) => {
      console.error("[editor] falha ao apagar arquivos do projeto", error)
    },
  )
}, [previousSource, revokeObjectUrl, stickerBlobUrls])
```

Se `PreviewHandle` não tiver `seek`, omitir essa linha (hoje o playhead vive no preview; F5/reset visual sem seek explícito é aceitável se a API não existir). Checar `PreviewHandle` e só chamar se existir.

- [ ] **Step 3: `clearInserts`**

```ts
const clearInserts = useCallback(() => {
  const prev = compositionRef.current
  const stickerIds = projectFileIds({ ...prev, source: { ...prev.source, fileId: undefined } })
  applyComposition(() => clearInsertsArt(prev), "discrete")
  setSelectedInsertId(null)
  for (const id of stickerIds) {
    const url = stickerBlobUrls[id]
    if (url) URL.revokeObjectURL(url)
  }
  setStickerBlobUrls((current) => {
    const next = { ...current }
    for (const id of stickerIds) delete next[id]
    return next
  })
  setUndoToast("Inserts apagados")
  void Promise.all(stickerIds.map((id) => fileStoreRef.current.delete(id))).catch(
    (error: unknown) => {
      console.error("[editor] falha ao apagar PNGs", error)
    },
  )
}, [applyComposition, stickerBlobUrls])
```

`projectFileIds` com `fileId` do source omitido só coleta stickers.

Passar `onNewProject={startNewProject}` e `onClearInserts={clearInserts}` ao `ControlPanel`.

- [ ] **Step 4: Smoke mental** — F5 após Novo projeto não pode cair no `if (stored)` com o JSON antigo.

- [ ] **Step 5: Commit** — não commit.

---

### Task 5: Docs

**Files:**
- Modify: `docs/proximo.md`

- [ ] **Step 1:** Em “Já está no ar”, linha: Novo projeto + Limpar inserts (spec `2026-08-21-novo-projeto-design.md`). Não misturar com Fase 3.

- [ ] **Step 2:** Commit — não commit.

---

## Verificação

```powershell
node --experimental-strip-types --test lib/project-reset.test.ts lib/project-store.test.ts
```

Smoke manual depois do `next build` (fora desta sessão se o operador não pedir deploy): Novo projeto → Origem vazio → F5 vazio; Limpar inserts → Desfazer.
