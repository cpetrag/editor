# Onda 1 — Destravar Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD. Spec: `docs/superpowers/specs/2026-08-18-onda-1-destravar-design.md`.

**Goal:** O botão Renderizar baixa um MP4 H.264 local; F5 restaura composição + vídeo; timings não corrompem decimal nem esticam a timeline.

**Architecture:** `Composition` v1 é a fonte da verdade. Preview CSS consome o JSON; export desenha o mesmo JSON num canvas e grava via MediaRecorder MP4 (fallback WebCodecs + `mp4-muxer`). Persistência: JSON no localStorage, blob no IndexedDB.

**Tech Stack:** Next.js 16, React 19, Vitest, fake-indexeddb, mp4-muxer.

---

### Task 1: Tooling

**Files:** `package.json`, `vitest.config.ts`

- [ ] Instalar `vitest`, `fake-indexeddb`, `happy-dom` (dev) e `mp4-muxer` (dep)
- [ ] Script `"test": "vitest run"`
- [ ] Alias `@` → raiz do projeto

### Task 2: parseDecimal + formatTimecode (TDD)

**Files:** `lib/parse-decimal.test.ts`, `lib/parse-decimal.ts`

Casos: `1.5`→1.5, `1,5`→1.5, `05`→5, `2,50`→2.5, `""`→null, `"abc"`→null, `"-5"`→-5, `"1.2.3"`→null, `" 1.5 "`→1.5. `formatTimecode(2.5)`→`"0:02,5"`.

### Task 3: Composition parse/clamp/serialize (TDD)

**Files:** `lib/composition.ts`, `lib/composition.test.ts`

- parse v1 válido; rejeita version≠1; descarta campos extra; migra `startTime`/`position`
- `clampInsert` start 999, duration -5, start+dur > vídeo
- serialize nunca emite `blob:` nem `startTime`/`position`
- `Insert` da UI = `CompositionInsert`

### Task 4: insert-layout (TDD)

**Files:** `lib/insert-layout.ts`, `lib/insert-layout.test.ts`

Âncoras top/center/bottom em 1080×1920; dois inserts na mesma âncora têm y diferente.

### Task 5: project-store (TDD)

**Files:** `lib/project-store.ts`, `lib/project-store.test.ts`

Roundtrip JSON; nunca grava `blob:`; fileId sem blob retorna null; QuotaExceededError propaga.

### Task 6: Rename start/anchor na UI e catálogos

**Files:** `lib/inserts.ts`, `lib/ai-prompt.ts`, templates, `video-editor.tsx`, `insert-card.tsx`, `preview-panel.tsx`, `library-panel.tsx`

`startTime`→`start`, `position`→`anchor`. `VideoCompositionProps` removido. `InsertPosition` alias de `InsertAnchor`.

### Task 7: Parser decimal + clamp na UI

**Files:** `components/insert-card.tsx`, `components/preview-panel.tsx`, `components/control-panel.tsx`

Campos text+inputMode decimal; timecode ao lado; `totalDuration = source.duration || 15`; duração visível no painel.

### Task 8: Persistência no VideoEditor

**Files:** `components/video-editor.tsx`

Hidrata F5; debounce 300ms; IDB no attach; mensagem reanexar.

### Task 9: Compositor + encoder

**Files:** `lib/export/compositor.ts`, `lib/export/encoder.ts`

`drawFrame`; MediaRecorder mp4; fallback WebCodecs; progresso; abort; download `slug_export.mp4`. Feed/Safe area fora.

### Task 10: Wire export na UI

**Files:** `components/video-editor.tsx`, `components/preview-panel.tsx`, `components/control-panel.tsx`, `components/ai-generate-button.tsx`, `components/batch-panel.tsx`

Botão com motivo / Cancelar; barra + aria-live; batch lê/escreve `composition.batch`.

### Task 11: Verificar

`pnpm test` e `pnpm lint` passam.
