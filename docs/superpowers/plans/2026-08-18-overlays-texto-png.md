# Overlays texto e PNG — Implementation Plan

> **Status 2026-08-18:** Tasks 1–7 feitas. Seguimentos (gestos, chips no canvas,
> timeline) estão em `docs/preview-overlays.md` e `docs/timeline-clip.md`, não
> neste plano.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Spec: `docs/superpowers/specs/2026-08-18-overlays-texto-png-design.md`. TDD. Este share **não é git repo** — pular commits.

**Goal:** Inserts `chip` | `text` | `sticker` no mesmo `Composition` v1, com texto estilizado e PNG no preview/export, sem quebrar chips, timeline nem lote.

**Architecture:** `kind` discrimina o draw. Chips continuam CSS no preview e `layoutInserts` no export. Texto/PNG usam `drawStyledText` / `drawImage` no canvas de export e num overlay transparente no preview. PNG de upload vive no IndexedDB `files`; biblioteca no disco via API.

**Tech Stack:** Next.js 16, canvas 2D, `node:test`, rotas App Router.

---

### Task 1: Schema + parse/serialize (TDD)

**Files:** `lib/composition.ts`, `lib/composition.test.ts`

- [ ] Testes: inferência de kind; roundtrip texto; sticker sem src; par inválido drop; blob: fora; chip antigo intacto
- [ ] Tipos `InsertKind`, `texto-livre`, `sticker-png`, campos overlay, `insertKind()`, `isChipInsert()`, `MAX_STICKERS`, clamps de x/y/fontSize/scale
- [ ] `parseInsert` / `serializeComposition` persistem só campos do kind

### Task 2: Catálogo e ops

**Files:** `lib/inserts.ts`, `lib/insert-ops.ts`, `lib/insert-ops.test.ts`, `lib/insert-layout.ts`, `lib/insert-layout.test.ts`, `app/globals.css`

- [ ] Metas `texto-livre` / `sticker-png`; `createInsert` preenche defaults de texto
- [ ] `createStickerInsert` (exige libraryId ou fileId)
- [ ] `nextInsertType` só cicla chips; `applyVariationPreview` só chips; duplicatas só chips
- [ ] `layoutInserts` ignora não-chips
- [ ] Cores `--track-texto` e `--track-sticker`

### Task 3: Resolve + wrap + draw de texto (TDD)

**Files:** `lib/compose/presets.ts`, `lib/compose/resolve-style.ts`, `lib/compose/resolve-style.test.ts`, `lib/compose/wrap-lines.ts`, `lib/compose/wrap-lines.test.ts`, `lib/compose/draw-text.ts`, `lib/compose/fonts.ts`

- [ ] Presets mínimos: `bold-outline`, `caption-clean`, `sticker-quero`, `caption-box`
- [ ] `resolveLayerStyle` + `wrapLines(measureWidth)`
- [ ] `drawStyledText(ctx, resolved, frame)` âncora centro, stroke, pill se bg
- [ ] Mapa `fontId` → família canvas; `ensureComposeFontsReady`

### Task 4: Compositor + preview overlay

**Files:** `lib/export/compositor.ts`, `components/preview-panel.tsx`, `components/overlay-canvas.tsx`

- [ ] `drawFrame`: chips depois stickers depois textos
- [ ] Canvas overlay no preview (object-contain), só se houver overlay ativo
- [ ] Feed/Safe area continuam CSS por cima

### Task 5: UI texto

**Files:** `components/insert-card.tsx`, `components/control-panel.tsx`, `components/video-editor.tsx`, `components/library-panel.tsx`

- [ ] Botão + Texto; card de texto (textarea, preset, fontSize, x, y); sem âncora
- [ ] Biblioteca: elemento Texto livre
- [ ] Header do card: overlays não mostram Topo/Centro/Base

### Task 6: Biblioteca PNG + upload + colar

**Files:** `lib/compose/sticker-library.ts`, testes, `app/api/compose/stickers/library/route.ts`, `app/api/compose/stickers/media/[id]/route.ts`, `lib/project-store.ts`, UI biblioteca, paste no editor

- [ ] List/resolve path; traversal → 404; pasta vazia `[]`
- [ ] Upload/colar → IDB `files` + `createStickerInsert`; teto 20; colar sem vídeo recusa

### Task 7: Verificar

`pnpm test` e `pnpm lint`. Smoke manual: + Texto no preview e no export.
