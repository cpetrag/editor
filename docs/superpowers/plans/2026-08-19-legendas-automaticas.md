# Legendas automáticas Implementation Plan

> **Status:** fatia A implementada e no ar (2026-08-19). Look compartilhado: plano [`2026-08-20-legendas-estilo-compartilhado.md`](2026-08-20-legendas-estilo-compartilhado.md). Doc canônico: [`docs/legendas.md`](../../legendas.md).
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: `docs/superpowers/specs/2026-08-19-legendas-automaticas-design.md`. TDD.
> Este share **não é git repo** — pular todos os passos de commit.
> Sem `pnpm add`. Deps já existem. Windows: `node --experimental-strip-types --test <arquivo>`.

**Goal:** Botão Gerar legendas transcreve o vídeo com Whisper (palavra a palavra), cria inserts `legenda` na timeline, pinta karaoke no canvas (Viral/Limpo) e o MP4 sai igual ao preview.

**Architecture:** Helpers puros em `lib/captions.ts` (agrupar, palavra ativa, reflow, retarget, replace). Schema ganha `kind: "caption"`, `type: "legenda"`, `captionPreset`. Whisper `verbose_json` numa rota irmã `POST /api/ai/captions`. Draw no mesmo `drawPlayInserts` (legendas por último). `applyCaptionPatch` no editor — `composition.ts` **não** importa `captions.ts` (evita ciclo).

**Tech Stack:** Next.js 16, OpenAI Whisper REST, Zod já no projeto, `node --experimental-strip-types --test`.

---

## File map

| File | Responsibility |
| --- | --- |
| Create `lib/captions.ts` | group, active, reflow, retarget, parse Whisper, pipeline, lines→inserts, replace, applyCaptionPatch |
| Create `lib/captions.test.ts` | todos os casos da spec (sem rede) |
| Create `lib/compose/draw-captions.ts` | paint karaoke (frase + palavra ativa) |
| Create `app/api/ai/captions/route.ts` | multipart → pipeline |
| Create `components/generate-captions-button.tsx` | botão sem popover |
| Modify `lib/composition.ts` | kind/type/defaults/parse/serialize; **sem** import de captions |
| Modify `lib/composition.test.ts` | parse `legenda` + `captionPreset` |
| Modify `lib/inserts.ts` | meta `legenda` (`libraryAddable: false`) |
| Modify `lib/insert-ops.ts` | `TYPE_LABELS.legenda` |
| Modify `lib/compose/hit-test.ts` | caption = texto (bbox + resize `fontSize`); hit captions antes de texto |
| Modify `lib/compose/hit-test.test.ts` | bbox e resize de caption |
| Modify `lib/compose/draw-play.ts` | `captionPreset`; draw captions por último |
| Modify `lib/export/compositor.ts` | passa preset |
| Modify `components/overlay-canvas.tsx` | passa preset; layout caption no hit-test |
| Modify `lib/ai-openai.ts` | `transcribeCaptionWords` |
| Modify `lib/ai-client.ts` | `requestCaptions` |
| Modify `lib/ai-schema.ts` | warning `words-estimated` (const separado, não misturar com generate) |
| Modify `components/control-panel.tsx` | botão + toggle Viral/Limpo |
| Modify `components/insert-card.tsx` | card caption |
| Modify `components/insert-style-panel.tsx` | caption: fonte/tamanho/peso; sem cor/caixa/predefinição |
| Modify `components/video-editor.tsx` | apply captions; `applyCaptionPatch`; Gerar estrutura preserva captions |
| Modify `package.json` | `lib/captions.test.ts` no script `test` |
| Modify `docs/README.md`, `docs/proximo.md` | item 14 no ar |

Não mexer: encoder, muxer, `COMPOSITION_VERSION` (fica 3), `transcribeMedia` do Gerar estrutura.

---

### Task 1: Matemática das palavras (TDD)

**Files:**
- Create: `lib/captions.test.ts`
- Create: `lib/captions.ts`

- [ ] **Step 1: Teste que falha** — criar `lib/captions.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  groupCaptionLines,
  activeCaptionWord,
  reflowCaptionWords,
  retargetCaptionWords,
} from "./captions.ts"

function w(text: string, start: number, end: number) {
  return { text, start, end }
}

test("groupCaptionLines starts a new line after a pause > 0.4s", () => {
  const lines = groupCaptionLines([w("oi", 0, 0.3), w("hoje", 1.0, 1.3)])
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "oi")
  assert.equal(lines[1]?.text, "hoje")
  assert.equal(lines[1]?.start, 1)
  assert.equal(lines[1]?.words[0]?.start, 0)
})

test("groupCaptionLines starts a new line after . ? !", () => {
  const lines = groupCaptionLines([w("fim.", 0, 0.4), w("Ok", 0.45, 0.8)])
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "fim.")
  assert.equal(lines[1]?.text, "Ok")
})

test("groupCaptionLines breaks before a word that would pass 32 characters", () => {
  const words = ["aaaa", "bbbb", "cccc", "dddd", "eeee", "ffff", "gggg"].map((text, i) =>
    w(text, i * 0.3, i * 0.3 + 0.25),
  )
  const lines = groupCaptionLines(words)
  assert.ok(lines.length >= 2)
  assert.ok((lines[0]?.text.length ?? 99) <= 32)
})

test("groupCaptionLines merges a trailing line shorter than 0.5s into the previous", () => {
  const lines = groupCaptionLines([w("longa", 0, 1.0), w("x", 1.5, 1.7)])
  assert.equal(lines.length, 1)
  assert.equal(lines[0]?.text, "longa x")
  assert.ok((lines[0]?.duration ?? 0) >= 0.5)
})

test("groupCaptionLines stretches a single short line to 0.5s", () => {
  const lines = groupCaptionLines([w("oi", 0, 0.2)])
  assert.equal(lines.length, 1)
  assert.equal(lines[0]?.duration, 0.5)
  assert.equal(lines[0]?.words[0]?.end, 0.2)
})

test("activeCaptionWord returns the word in range", () => {
  const words = [w("a", 0, 0.4), w("b", 0.5, 1)]
  assert.equal(activeCaptionWord(words, 0.2)?.text, "a")
  assert.equal(activeCaptionWord(words, 0.7)?.text, "b")
})

test("activeCaptionWord keeps the previous word in a gap", () => {
  const words = [w("a", 0, 0.4), w("b", 0.5, 1)]
  assert.equal(activeCaptionWord(words, 0.45)?.text, "a")
})

test("activeCaptionWord is null before the first word", () => {
  assert.equal(activeCaptionWord([w("a", 0.2, 0.5)], 0.05), null)
})

test("reflowCaptionWords splits duration by character weight", () => {
  const words = reflowCaptionWords("um dois tres", 3)
  assert.equal(words.length, 3)
  assert.equal(words[0]?.text, "um")
  assert.ok(Math.abs((words[0]?.end ?? 0) - 0.6) < 1e-9)
  assert.ok(Math.abs((words[1]?.end ?? 0) - 1.8) < 1e-9)
  assert.equal(words[2]?.end, 3)
})

test("retargetCaptionWords drops words that start outside the new window", () => {
  const prev = { start: 0, duration: 2, words: [w("a", 0, 1), w("b", 1.2, 2)] }
  const next = retargetCaptionWords(prev, { ...prev, duration: 1 })
  assert.equal(next.words.length, 1)
  assert.equal(next.words[0]?.text, "a")
  assert.equal(next.words[0]?.end, 1)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```
node --experimental-strip-types --test lib/captions.test.ts
```

Expected: `Cannot find module` / export missing.

- [ ] **Step 3: Implementação mínima** — `lib/captions.ts`:

```ts
export interface CaptionWord {
  text: string
  start: number
  end: number
}

export interface CaptionLine {
  text: string
  start: number
  duration: number
  words: CaptionWord[]
}

const PAUSE_GAP = 0.4
const MAX_LINE_CHARS = 32
const MIN_LINE = 0.5
const MIN_WORD = 0.05

function endsSentence(text: string): boolean {
  return /[.?!]$/.test(text.trim())
}

function toRelative(lineStart: number, words: CaptionWord[]): CaptionWord[] {
  return words.map((word) => ({
    text: word.text,
    start: Math.max(0, word.start - lineStart),
    end: Math.max(0, word.end - lineStart),
  }))
}

function flushLine(absWords: CaptionWord[]): CaptionLine | null {
  if (absWords.length === 0) return null
  const start = absWords[0]!.start
  const lastEnd = absWords[absWords.length - 1]!.end
  let duration = lastEnd - start
  if (duration < MIN_LINE) duration = MIN_LINE
  return {
    text: absWords.map((word) => word.text).join(" "),
    start,
    duration,
    words: toRelative(start, absWords),
  }
}

export function groupCaptionLines(words: CaptionWord[]): CaptionLine[] {
  const cleaned = words.filter((word) => word.text.trim() && word.end > word.start)
  const raw: CaptionWord[][] = []
  let current: CaptionWord[] = []
  for (const word of cleaned) {
    const prev = current[current.length - 1]
    const nextText = current.length
      ? `${current.map((item) => item.text).join(" ")} ${word.text}`
      : word.text
    const pause = prev ? word.start - prev.end : 0
    const shouldBreak =
      current.length > 0 &&
      (pause > PAUSE_GAP || endsSentence(prev!.text) || nextText.length > MAX_LINE_CHARS)
    if (shouldBreak) {
      raw.push(current)
      current = [word]
    } else {
      current.push(word)
    }
  }
  if (current.length) raw.push(current)

  const lines = raw.map(flushLine).filter((line): line is CaptionLine => line !== null)
  if (lines.length >= 2) {
    const last = lines[lines.length - 1]!
    const lastAbs = last.duration
    const lastNative = last.words.length
      ? last.words[last.words.length - 1]!.end
      : last.duration
    if (lastNative < MIN_LINE) {
      const prev = lines[lines.length - 2]!
      const mergedAbs = [
        ...prev.words.map((word) => ({
          text: word.text,
          start: prev.start + word.start,
          end: prev.start + word.end,
        })),
        ...last.words.map((word) => ({
          text: word.text,
          start: last.start + word.start,
          end: last.start + word.end,
        })),
      ]
      const merged = flushLine(mergedAbs)
      if (merged) {
        lines.splice(lines.length - 2, 2, merged)
      }
    }
    void lastAbs
  }
  return lines
}

export function activeCaptionWord(words: CaptionWord[], local: number): CaptionWord | null {
  if (words.length === 0) return null
  for (const word of words) {
    if (local >= word.start && local < word.end) return word
  }
  let previous: CaptionWord | null = null
  for (const word of words) {
    if (word.start > local) return previous
    previous = word
  }
  return previous
}

export function reflowCaptionWords(text: string, duration: number): CaptionWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const weights = tokens.map((token) => Math.max(1, token.length))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const words: CaptionWord[] = []
  let cursor = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const share = (weights[index]! / total) * duration
    const span = Math.max(MIN_WORD, share)
    const end = index === tokens.length - 1 ? duration : Math.min(duration, cursor + span)
    words.push({ text: tokens[index]!, start: cursor, end })
    cursor = end
  }
  return words
}

export function retargetCaptionWords<T extends { start: number; duration: number; words: CaptionWord[] }>(
  prev: T,
  next: T,
): T {
  const windowStart = next.start
  const windowEnd = next.start + next.duration
  const kept: CaptionWord[] = []
  for (const word of prev.words) {
    const absStart = prev.start + word.start
    const absEnd = prev.start + word.end
    if (absStart >= windowEnd || absEnd <= windowStart) continue
    const start = Math.max(0, absStart - windowStart)
    const end = Math.min(next.duration, absEnd - windowStart)
    if (end > start) kept.push({ text: word.text, start, end })
  }
  return { ...next, words: kept }
}
```

Ajuste fino se o teste de merge falhar: a segunda linha `x` (1.5–1.7) tem pausa 0,5 > 0,4 então nasce sozinha com duration esticada 0,5; o pós-processo deve fundir porque a duração **nativa** (0,2) é &lt; 0,5. Use `last.words.at(-1).end` como duração nativa, não o `duration` já esticado.

- [ ] **Step 4: Rodar o teste e ver passar**

```
node --experimental-strip-types --test lib/captions.test.ts
```

Expected: PASS.

---

### Task 2: Parse do Whisper + pipeline (TDD, sem rede)

**Files:**
- Modify: `lib/captions.test.ts`
- Modify: `lib/captions.ts`

- [ ] **Step 1: Testes que falham** — acrescentar:

```ts
import { parseWhisperCaptionResult, runCaptionsPipeline } from "./captions.ts"

test("parseWhisperCaptionResult reads words from verbose_json", () => {
  const parsed = parseWhisperCaptionResult({
    words: [{ word: "oi", start: 0, end: 0.3 }],
  })
  assert.equal(parsed.estimated, false)
  assert.equal(parsed.words[0]?.text, "oi")
})

test("parseWhisperCaptionResult estimates words from segments", () => {
  const parsed = parseWhisperCaptionResult({
    segments: [{ start: 0, end: 2, text: "oi hoje" }],
  })
  assert.equal(parsed.estimated, true)
  assert.equal(parsed.words.length, 2)
  assert.equal(parsed.words[0]?.text, "oi")
  assert.equal(parsed.words[1]?.end, 2)
})

test("runCaptionsPipeline returns 422-empty when there is no speech", async () => {
  await assert.rejects(
    () =>
      runCaptionsPipeline(
        { duration: 10, mediaBytes: 100 },
        { transcribe: async () => ({}) },
      ),
    (error: Error) => error.message === "captions-empty",
  )
})

test("runCaptionsPipeline groups words and flags estimated timings", async () => {
  const result = await runCaptionsPipeline(
    { duration: 10, mediaBytes: 100 },
    {
      transcribe: async () => ({
        segments: [{ start: 0, end: 2, text: "oi hoje" }],
      }),
    },
  )
  assert.ok(result.lines.length >= 1)
  assert.deepEqual(result.warnings, ["words-estimated"])
})
```

- [ ] **Step 2: Rodar e ver falhar**

```
node --experimental-strip-types --test lib/captions.test.ts
```

- [ ] **Step 3: Implementar** no fim de `lib/captions.ts`:

```ts
export const CAPTION_WARNINGS = ["words-estimated"] as const
export type CaptionWarning = (typeof CAPTION_WARNINGS)[number]

export interface WhisperCaptionPayload {
  words?: Array<{ word?: string; text?: string; start?: number; end?: number }>
  segments?: Array<{ start?: number; end?: number; text?: string }>
}

export function parseWhisperCaptionResult(payload: WhisperCaptionPayload): {
  words: CaptionWord[]
  estimated: boolean
} {
  const rawWords = Array.isArray(payload.words) ? payload.words : []
  const fromWords: CaptionWord[] = []
  for (const item of rawWords) {
    const text = String(item.word ?? item.text ?? "").trim()
    const start = Number(item.start)
    const end = Number(item.end)
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    fromWords.push({ text, start, end })
  }
  if (fromWords.length) return { words: fromWords, estimated: false }

  const estimated: CaptionWord[] = []
  for (const segment of payload.segments ?? []) {
    const text = String(segment.text ?? "").trim()
    const start = Number(segment.start)
    const end = Number(segment.end)
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const tokens = text.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const span = (end - start) / tokens.length
    tokens.forEach((token, index) => {
      const wordStart = start + index * span
      estimated.push({
        text: token,
        start: wordStart,
        end: index === tokens.length - 1 ? end : wordStart + span,
      })
    })
  }
  return { words: estimated, estimated: estimated.length > 0 }
}

export async function runCaptionsPipeline(
  _input: { duration: number; mediaBytes: number },
  deps: { transcribe: () => Promise<WhisperCaptionPayload> },
): Promise<{ lines: CaptionLine[]; warnings: CaptionWarning[] }> {
  const payload = await deps.transcribe()
  const parsed = parseWhisperCaptionResult(payload)
  if (parsed.words.length === 0) throw new Error("captions-empty")
  const lines = groupCaptionLines(parsed.words)
  if (lines.length === 0) throw new Error("captions-empty")
  return {
    lines,
    warnings: parsed.estimated ? ["words-estimated"] : [],
  }
}
```

- [ ] **Step 4: Testes PASS** no mesmo comando.

---

### Task 3: Schema Composition (TDD)

**Files:**
- Modify: `lib/composition.ts`
- Modify: `lib/composition.test.ts`

- [ ] **Step 1: Testes que falham** — no fim de `lib/composition.test.ts`:

```ts
test("parseComposition reads caption inserts and captionPreset", () => {
  const parsed = parseComposition({
    ...sampleComposition({
      captionPreset: "limpo",
      inserts: [
        {
          id: "c1",
          type: "legenda",
          kind: "caption",
          start: 1,
          duration: 2,
          text: "Esse cupom",
          words: [{ text: "Esse", start: 0, end: 0.4 }, { text: "cupom", start: 0.4, end: 1.2 }],
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
          x: 50,
          y: 72,
          fontSize: 64,
        },
      ],
    }),
  })
  assert.equal(parsed.version, 3)
  assert.equal(parsed.captionPreset, "limpo")
  assert.equal(insertKind(parsed.inserts[0]!), "caption")
  assert.equal(parsed.inserts[0]?.words?.length, 2)
  assert.equal(isChipInsert(parsed.inserts[0]!), false)
})

test("parseComposition defaults invalid captionPreset to viral", () => {
  const parsed = parseComposition({
    ...sampleComposition({ captionPreset: "neon" as never }),
  })
  assert.equal(parsed.captionPreset, "viral")
})

test("serializeComposition always writes captionPreset", () => {
  const parsed = parseComposition(sampleComposition())
  const again = JSON.parse(serializeComposition(parsed)) as { captionPreset?: string }
  assert.equal(again.captionPreset, "viral")
})
```

`sampleComposition` precisa aceitar `captionPreset` no patch — o tipo `Composition` ainda não tem o campo: o teste falha na compilação/assert, o que serve.

- [ ] **Step 2: Rodar e ver falhar**

```
node --experimental-strip-types --test lib/composition.test.ts
```

- [ ] **Step 3: Implementar em `lib/composition.ts`**

Constantes e tipos (junto dos existentes):

```ts
export type InsertKind = "chip" | "text" | "sticker" | "caption"
export type CaptionPreset = "viral" | "limpo"
export const CAPTION_INSERT_TYPE = "legenda" as const
export const DEFAULT_CAPTION_X = 50
export const DEFAULT_CAPTION_Y = 72
export const DEFAULT_CAPTION_FONT_SIZE = 64
export const DEFAULT_CAPTION_PRESET: CaptionPreset = "viral"

export type InsertType =
  | /* ...chips... */
  | "texto-livre"
  | "sticker-png"
  | "legenda"

export interface CaptionWord {
  text: string
  start: number
  end: number
}

export interface CompositionInsert {
  /* campos atuais */
  words?: CaptionWord[]
}

export interface Composition {
  version: typeof COMPOSITION_VERSION
  source: CompositionSource
  brand: CompositionBrand
  inserts: CompositionInsert[]
  batch: CompositionBatch
  output: CompositionOutput
  captionPreset: CaptionPreset
}
```

- `INSERT_TYPES` inclui `"legenda"`.
- `isKind`: também `"caption"`.
- `insertKind`: `if (insert.type === CAPTION_INSERT_TYPE) return "caption"`.
- `insertHasFontSize`: `if (kind === "caption" || kind === "text") return true`.
- `resolvedKind`: `type === CAPTION_INSERT_TYPE` → `"caption"`. `kind === "caption" && type !== CAPTION_INSERT_TYPE` → `null`. Chip + `legenda` → `null`.
- `parseCaptionWords(raw, duration)`: dropa item sem text ou com tempos inválidos; clampa `end` em `duration`.
- `parseInsert`: ramo `kind === "caption"` igual ao texto (x/y/fontSize/maxWidthPct/textAlign) + defaults `x 50`, `y 72`, `fontSize 64`, `animIn/Out "none"`, `anchor "bottom"`, `words: parseCaptionWords(...)`.
- `parseCaptionPreset(raw)`: `"limpo"` ou `"viral"`.
- `parseComposition`: `captionPreset: parseCaptionPreset(input.captionPreset)`.
- `serializeInsert`: ramo caption com `kind: "caption"`, words, iguais ao texto (sem `preset` de texto).
- `serializeComposition`: `captionPreset: composition.captionPreset`.
- `createDefaultComposition`: `captionPreset: "viral"`.
- `mergeInsertPatch`: clampa x/y/fontSize/maxWidthPct também para `caption` (tratar `caption` como `text` nesses ifs).

**Não** chamar reflow/retarget aqui.

- [ ] **Step 4: Testes PASS**

```
node --experimental-strip-types --test lib/composition.test.ts
```

---

### Task 4: Inserts, replace, patch (TDD)

**Files:**
- Modify: `lib/captions.ts`
- Modify: `lib/captions.test.ts`
- Modify: `lib/inserts.ts`
- Modify: `lib/insert-ops.ts`

- [ ] **Step 1: Testes que falham** — em `lib/captions.test.ts`:

```ts
import { CAPTION_INSERT_TYPE, insertKind, type CompositionInsert } from "./composition.ts"
import { linesToCaptionInserts, replaceCaptionInserts, applyCaptionPatch } from "./captions.ts"

function chip(): CompositionInsert {
  return {
    id: "chip-1",
    type: "alerta-desconto",
    start: 0,
    duration: 2,
    text: "OFF",
    anchor: "top",
    animIn: "pop",
    animOut: "none",
  }
}

test("replaceCaptionInserts keeps chips and texts and appends new captions", () => {
  const oldCaption: CompositionInsert = {
    id: "old",
    type: CAPTION_INSERT_TYPE,
    kind: "caption",
    start: 0,
    duration: 1,
    text: "velha",
    words: [],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
  }
  const incoming = linesToCaptionInserts(
    [{ text: "nova", start: 1, duration: 2, words: [{ text: "nova", start: 0, end: 2 }] }],
    10,
  )
  const next = replaceCaptionInserts([chip(), oldCaption], incoming)
  assert.equal(next.length, 2)
  assert.equal(next[0]?.type, "alerta-desconto")
  assert.equal(insertKind(next[1]!), "caption")
  assert.equal(next[1]?.text, "nova")
})

test("applyCaptionPatch reflows words when text changes", () => {
  const insert = linesToCaptionInserts(
    [{ text: "um dois", start: 0, duration: 2, words: [{ text: "um", start: 0, end: 1 }] }],
    10,
  )[0]!
  const patched = applyCaptionPatch(insert, { text: "um dois tres" })
  assert.equal(patched.words?.length, 3)
})

test("applyCaptionPatch retargets words when duration shrinks", () => {
  const insert = linesToCaptionInserts(
    [{
      text: "a b",
      start: 0,
      duration: 2,
      words: [{ text: "a", start: 0, end: 1 }, { text: "b", start: 1.2, end: 2 }],
    }],
    10,
  )[0]!
  const patched = applyCaptionPatch(insert, { duration: 1 })
  assert.equal(patched.words?.length, 1)
  assert.equal(patched.words?.[0]?.text, "a")
})
```

- [ ] **Step 2: Rodar e ver falhar** `lib/captions.test.ts`.

- [ ] **Step 3: Implementar**

Em `lib/inserts.ts` — item em `INSERT_TYPES` (não addable):

```ts
{
  value: "legenda",
  label: "Legenda",
  category: "atencao",
  colorClass: "bg-track-desconto",
  dotVar: "var(--track-desconto)",
  hasText: true,
  libraryAddable: false,
}
```

Em `createInsert`, ramo `type === CAPTION_INSERT_TYPE` / `"legenda"`:

```ts
return {
  ...newInsertId(),
  type: "legenda",
  kind: "caption",
  start: 0,
  duration: 3,
  text: "",
  words: [],
  animIn: "none",
  animOut: "none",
  anchor: "bottom",
  x: DEFAULT_CAPTION_X,
  y: DEFAULT_CAPTION_Y,
  fontSize: DEFAULT_CAPTION_FONT_SIZE,
  maxWidthPct: DEFAULT_MAX_WIDTH_PCT,
  textAlign: "center",
}
```

Importar as constantes de `composition.ts`.

Em `lib/insert-ops.ts` `TYPE_LABELS`: `"legenda": "Legenda"`.

Em `lib/captions.ts`:

```ts
import {
  CAPTION_INSERT_TYPE,
  clampInsert,
  insertKind,
  mergeInsertPatch,
  type CompositionInsert,
} from "./composition.ts"
import { createInsert } from "./inserts.ts"

export function linesToCaptionInserts(lines: CaptionLine[], videoDuration: number): CompositionInsert[] {
  return lines.map((line) => {
    const created = createInsert(CAPTION_INSERT_TYPE)
    created.text = line.text
    created.start = line.start
    created.duration = line.duration
    created.words = line.words
    created.animIn = "none"
    created.animOut = "none"
    return clampInsert(created, videoDuration > 0 ? videoDuration : line.start + line.duration)
  })
}

export function replaceCaptionInserts(
  current: CompositionInsert[],
  incoming: CompositionInsert[],
): CompositionInsert[] {
  const kept = current.filter((insert) => insertKind(insert) !== "caption")
  return [...kept, ...incoming]
}

export function applyCaptionPatch(
  insert: CompositionInsert,
  patch: Partial<CompositionInsert>,
): CompositionInsert {
  const next = mergeInsertPatch(insert, patch)
  if (insertKind(next) !== "caption") return next
  if (typeof patch.text === "string" && patch.text !== insert.text) {
    return { ...next, words: reflowCaptionWords(next.text ?? "", next.duration) }
  }
  if (patch.start !== undefined || patch.duration !== undefined) {
    return retargetCaptionWords(
      { start: insert.start, duration: insert.duration, words: insert.words ?? [] },
      { start: next.start, duration: next.duration, words: next.words ?? [] },
    ).words
      ? { ...next, words: retargetCaptionWords(
          { start: insert.start, duration: insert.duration, words: insert.words ?? [] },
          { start: next.start, duration: next.duration, words: next.words ?? insert.words ?? [] },
        ).words }
      : next
  }
  return next
}
```

Deixe `applyCaptionPatch` limpo: uma chamada a `retargetCaptionWords` e espalhe `words` no `next`. Sem o ternário duplicado.

- [ ] **Step 4: Testes PASS** `lib/captions.test.ts`.

---

### Task 5: Hit-test (TDD)

**Files:**
- Modify: `lib/compose/hit-test.ts`
- Modify: `lib/compose/hit-test.test.ts`

- [ ] **Step 1: Teste que falha** — em `hit-test.test.ts`:

```ts
function captionInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "c1",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 3,
    text: "Esse cupom",
    words: [],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 72,
    fontSize: 64,
    ...patch,
  }
}

test("approxBox returns a phrase box for caption inserts", () => {
  const box = approxBox(captionInsert())
  assert.ok(box)
  assert.ok((box?.w ?? 0) > 0)
  assert.ok((box?.h ?? 0) > 0)
})

test("resizePatchForTrack changes caption fontSize", () => {
  const patch = resizePatchForTrack(captionInsert({ fontSize: 64 }), 2)
  assert.equal(patch.fontSize, 128)
})

test("hitTestOverlays prefers caption over free text at the same point", () => {
  const caption = captionInsert({ y: 35, text: "LEGENDA" })
  const text = textInsert({ y: 35, text: "TEXTO" })
  const hit = hitTestOverlays([text, caption], 540, 672)
  assert.equal(hit?.id, "c1")
})
```

O ponto `(540, 672)` é 50%/35% de 1080×1920. Se o teste de hit for instável, use o `cx/cy` de `approxBox(caption)` como ponto.

- [ ] **Step 2: Rodar e ver falhar** `lib/compose/hit-test.test.ts`.

- [ ] **Step 3: Em `approxBox`**, tratar `caption` como texto (cair no `layoutInsertText`). Em `resizePatchForTrack`, `kind === "text" || kind === "caption"` → `fontSize`. Em `hitTestOverlays`, coletar `captions` e testá-las **antes** de `texts`.

- [ ] **Step 4: PASS**.

---

### Task 6: Draw karaoke

**Files:**
- Create: `lib/compose/draw-captions.ts`
- Modify: `lib/compose/draw-play.ts`
- Modify: `lib/export/compositor.ts`
- Modify: `components/overlay-canvas.tsx`

- [ ] **Step 1: `lib/compose/draw-captions.ts`**

```ts
import type { CaptionPreset, CompositionInsert } from "../composition.ts"
import { activeCaptionWord } from "../captions.ts"
import { layoutInsertText, canvasTextMeasure } from "./layout-text.ts"
import { resolveLayerStyle } from "./resolve-style.ts"

const ACTIVE = "#FFE500"
const IDLE = "#FFFFFF"
const STROKE = { width: 6, color: "#000000" }

function isActive(insert: CompositionInsert, time: number): boolean {
  return time >= insert.start && time < insert.start + insert.duration
}

export function drawCaptionLine(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  time: number,
  preset: CaptionPreset,
  brandFontId: string,
): void {
  if (!isActive(insert, time)) return
  const style = resolveLayerStyle(insert, brandFontId)
  const display = {
    ...insert,
    text: preset === "viral" ? (insert.text ?? "").toUpperCase() : insert.text,
  }
  const layout = layoutInsertText(
    display,
    brandFontId,
    { width: ctx.canvas.width || 1080, height: ctx.canvas.height || 1920 },
    canvasTextMeasure(ctx, style.fontWeight, style.fontFamily),
  )
  if (!layout) return
  const local = time - insert.start
  const active = activeCaptionWord(insert.words ?? [], local)
  const lineHeight = layout.effectiveFontSize * style.lineHeight
  const strokeScale = layout.effectiveFontSize / Math.max(1, style.fontSize)

  ctx.save()
  ctx.translate(layout.cx, layout.cy)
  ctx.font = `${style.fontWeight} ${layout.effectiveFontSize}px ${style.fontFamily}`
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"

  if (preset === "limpo") {
    const padX = layout.effectiveFontSize * 0.4
    const padY = layout.effectiveFontSize * 0.22
    ctx.fillStyle = "rgba(0,0,0,0.72)"
    const x = -layout.blockW / 2 - padX
    const y = -layout.blockH / 2 - padY
    const r = 8 * strokeScale
    ctx.beginPath()
    ctx.roundRect(x, y, layout.blockW + padX * 2, layout.blockH + padY * 2, r)
    ctx.fill()
  }

  const tokens = (preset === "viral" ? (insert.text ?? "").toUpperCase() : (insert.text ?? "")).split(/\s+/)
  const sourceWords = insert.words ?? []
  let tokenIndex = 0
  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
    const line = layout.lines[lineIndex] ?? ""
    const pieces = line.split(/\s+/).filter(Boolean)
    const lineWidth = ctx.measureText(line).width
    let x = -lineWidth / 2
    const y = -layout.blockH / 2 + lineHeight / 2 + lineIndex * lineHeight
    for (const piece of pieces) {
      const word = sourceWords[tokenIndex]
      const fill = word && active && word.text.toLowerCase() === wordMatch(piece, sourceWords[tokenIndex]?.text)
        ? ACTIVE
        : word && active && word === sourceWords[tokenIndex] && norm(piece) === norm(word.text)
          ? ACTIVE
          : IDLE
      const width = ctx.measureText(piece).width
      if (preset === "viral") {
        ctx.lineJoin = "round"
        ctx.strokeStyle = STROKE.color
        ctx.lineWidth = STROKE.width * strokeScale
        ctx.strokeText(piece, x, y)
      }
      ctx.fillStyle = fill === ACTIVE || (active && tokenIndex >= 0 && sourceWords[tokenIndex] === active)
        ? ACTIVE
        : IDLE
      ctx.fillText(piece, x, y)
      x += width + ctx.measureText(" ").width
      tokenIndex += 1
    }
  }
  ctx.restore()
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

function wordMatch(piece: string, word: string | undefined): boolean {
  return Boolean(word && norm(piece) === norm(word))
}
```

Pinte ativo quando `sourceWords[tokenIndex] === active` (referência). Ignore o ternário confuso do rascunho acima — implementação final:

```ts
const isWordActive = sourceWords[tokenIndex] === active
ctx.fillStyle = isWordActive ? ACTIVE : IDLE
```

Viral: stroke + fill. Limpo: caixa + fill, sem stroke.

- [ ] **Step 2: `drawPlayInserts`** ganha último arg opcional `captionPreset: CaptionPreset = "viral"`. Depois de `drawOverlayInserts`, loop nos inserts com `insertKind === "caption"` e `drawCaptionLine(...)`.

`draw-overlays.ts` já ignora caption (só `text` e `sticker`) — não precisa mudar se `insertKind` estiver certo.

- [ ] **Step 3: `drawFrame` em `lib/export/compositor.ts`** passa `composition.captionPreset ?? "viral"` para `drawPlayInserts`.

- [ ] **Step 4: `overlay-canvas.tsx`** passa o mesmo preset. No mapa de layouts do hit-test, incluir `kind === "caption"` com `layoutInsertText` (texto em maiúsculas se preset viral, para a bbox bater).

Não há teste de pixel. Smoke mental: preview e export chamam a mesma função.

---

### Task 7: Rota e client

**Files:**
- Modify: `lib/ai-openai.ts`
- Modify: `lib/ai-client.ts`
- Create: `app/api/ai/captions/route.ts`

- [ ] **Step 1: `transcribeCaptionWords` em `lib/ai-openai.ts`** (não alterar `transcribeMedia`):

```ts
export async function transcribeCaptionWords(
  bytes: Uint8Array,
  mime: string,
  filename: string,
): Promise<WhisperCaptionPayload> {
  const key = getOpenAiApiKey()
  if (!key) throw new Error("missing-key")
  const body = new FormData()
  body.set("model", transcribeModel())
  body.set("file", new Blob([bytes], { type: mime || "application/octet-type" }), filename)
  body.set("response_format", "verbose_json")
  body.set("timestamp_granularities[]", "word")
  body.set("language", "pt")
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  })
  if (!response.ok) throw new Error("transcript-failed")
  return (await response.json()) as WhisperCaptionPayload
}
```

Usar `application/octet-stream` (não `octet-type`). Importar `WhisperCaptionPayload` de `lib/captions.ts`.

- [ ] **Step 2: `app/api/ai/captions/route.ts`**

```ts
import { parseDuration } from "@/lib/ai-generate"
import { WHISPER_MAX_BYTES } from "@/lib/ai-schema"
import { getOpenAiApiKey, transcribeCaptionWords } from "@/lib/ai-openai"
import { runCaptionsPipeline } from "@/lib/captions"

export const runtime = "nodejs"
export const maxDuration = 90

export async function POST(req: Request): Promise<Response> {
  if (!getOpenAiApiKey()) {
    return Response.json({ error: "IA não configurada no servidor." }, { status: 503 })
  }
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Formulário inválido" }, { status: 400 })
  }
  const duration = parseDuration(form.get("duration"))
  const media = form.get("media")
  const file = media instanceof File && media.size > 0 ? media : null
  if (!file) return Response.json({ error: "Carregue um vídeo." }, { status: 400 })
  if (file.size > WHISPER_MAX_BYTES) {
    return Response.json({ error: "Arquivo acima de 25 MB." }, { status: 400 })
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await runCaptionsPipeline(
      { duration, mediaBytes: file.size },
      {
        transcribe: () => transcribeCaptionWords(bytes, file.type, file.name || "audio.mp4"),
      },
    )
    return Response.json(result)
  } catch (error) {
    console.error("[editor] falha em /api/ai/captions", error instanceof Error ? error.message : error)
    if (error instanceof Error && error.message === "missing-key") {
      return Response.json({ error: "IA não configurada no servidor." }, { status: 503 })
    }
    if (error instanceof Error && error.message === "captions-empty") {
      return Response.json({ error: "Não encontramos fala no áudio." }, { status: 422 })
    }
    return Response.json({ error: "Não foi possível transcrever o áudio." }, { status: 502 })
  }
}
```

- [ ] **Step 3: `requestCaptions` em `lib/ai-client.ts`**

```ts
export async function requestCaptions(input: {
  duration: number
  media: File
}): Promise<{ lines: CaptionLine[]; warnings: string[] }> {
  if (input.media.size > WHISPER_MAX_BYTES) {
    throw new AiRequestError("Arquivo acima de 25 MB.", 400)
  }
  const body = new FormData()
  body.set("duration", String(input.duration))
  body.set("media", input.media, input.media.name || "video.mp4")
  const response = await fetch("/api/ai/captions", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) {
    throw new AiRequestError(await readError(response), response.status)
  }
  return (await response.json()) as { lines: CaptionLine[]; warnings: string[] }
}
```

Importar `CaptionLine` de `lib/captions.ts` e `WHISPER_MAX_BYTES` de `lib/ai-schema.ts`. Em `readError`, fallback `"Falha ao gerar legendas"` quando a URL for captions — ou manter a mensagem do JSON (`error`).

---

### Task 8: UI

**Files:**
- Create: `components/generate-captions-button.tsx`
- Modify: `components/control-panel.tsx`
- Modify: `components/insert-card.tsx`
- Modify: `components/insert-style-panel.tsx`
- Modify: `components/video-editor.tsx`

- [ ] **Step 1: Botão** — `components/generate-captions-button.tsx` no molde de `ai-generate-button.tsx`, **sem** popover:

```tsx
"use client"

import { useState } from "react"
import { Captions } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AiRequestError, requestCaptions } from "@/lib/ai-client"
import type { CaptionLine } from "@/lib/captions"

export function GenerateCaptionsButton({
  duration,
  disabled,
  loadMedia,
  onGenerate,
  onStatus,
}: {
  duration: number
  disabled: boolean
  loadMedia: () => Promise<File | null>
  onGenerate: (lines: CaptionLine[], warnings: string[]) => void
  onStatus?: (message: string) => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    onStatus?.("Transcrevendo…")
    try {
      const media = await loadMedia()
      if (!media) {
        onStatus?.("Carregue um vídeo.")
        return
      }
      const payload = await requestCaptions({ duration, media })
      onGenerate(payload.lines, payload.warnings)
      onStatus?.(
        payload.warnings.includes("words-estimated")
          ? "Legendas prontas. Timing estimado."
          : "Legendas prontas",
      )
    } catch (caught) {
      const message =
        caught instanceof AiRequestError ? caught.message : "Não foi possível transcrever o áudio."
      onStatus?.(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled || loading} onClick={() => void handleClick()}>
      {loading ? <Spinner data-icon="inline-start" /> : <Captions data-icon="inline-start" />}
      Gerar legendas
    </Button>
  )
}
```

- [ ] **Step 2: `control-panel.tsx`** — props novas: `captionPreset`, `onCaptionPresetChange`, `canGenerateCaptions`, `onGenerateCaptions`. No header de Inserts, ao lado de Gerar com IA: o botão + ToggleGroup `viral | limpo` (labels Viral / Limpo). `disabled={!canGenerateCaptions}`.

- [ ] **Step 3: `insert-card.tsx`**
  - `kind === "caption"`: textarea de texto (igual texto livre); sem Select de tipo.
  - Conteúdo já tem Início/Duração.
  - Movimento: X/Y (o `kind !== "chip"` já cobre). **Não** mostrar sliders de animação quando `kind === "caption"`.
  - Overflow de texto: tratar caption como texto no `useEffect` (`kind === "text" || kind === "caption"`).

- [ ] **Step 4: `insert-style-panel.tsx`**
  - `fontSizeMin` / default: caption usa `FONT_SIZE_MIN` e `DEFAULT_CAPTION_FONT_SIZE`.
  - Se `kind === "caption"`: esconder Predefinição, Cor, Cor de fundo, Contorno. Manter Fonte, Tamanho, Peso. Caixa alta: esconder (Viral já força no paint).

- [ ] **Step 5: `video-editor.tsx`**
  - `changeInsert`: se `insertKind(insert) === "caption"` usar `applyCaptionPatch`, senão `mergeInsertPatch`.
  - `applyCaptions(lines)`: `applyInserts((prev) => replaceCaptionInserts(prev, linesToCaptionInserts(lines, compositionRef.current.source.duration)), "discrete")`.
  - `applyAIGenerate`: depois de `assembleInserts`,  
    `const captions = compositionRef.current.inserts.filter((i) => insertKind(i) === "caption")`  
    `applyInserts(() => [...assembled, ...captions], "discrete")`.
  - `setCaptionPreset(preset)`: `setComposition((prev) => ({ ...prev, captionPreset: preset }))` — **não** entra na pilha de undo (undo só é `inserts`).
  - Passar `canGenerateCaptions={Boolean(composition.source.fileId) && !missingFile}` (usar o mesmo `missingFile` que o painel já recebe).
  - Overlay/preview já lê `composition.captionPreset`.

---

### Task 9: Docs e script de teste

**Files:**
- Modify: `package.json` — acrescentar `lib/captions.test.ts` na lista do script `test`.
- Modify: `docs/README.md` — pasta `lib/captions.ts`; kind inclui `caption`; Gerar legendas na tabela da IA; spec no índice.
- Modify: `docs/proximo.md` — item 14: no ar (fatia A); fora: split/merge, SRT, + Legenda, &gt;25 MB.
- Modify: spec status → implementado quando o smoke passar (só no fim do deploy).

- [ ] **Step 1: Registrar o teste**
- [ ] **Step 2: Rodar a suíte**

```
node --experimental-strip-types --test lib/captions.test.ts lib/composition.test.ts lib/compose/hit-test.test.ts
```

Expected: PASS. Depois a lista inteira do `package.json` se o pnpm não travar.

- [ ] **Step 3: Atualizar README / proximo**

---

### Task 10: Smoke no Mac (depois do código)

Não é teste automatizado.

1. Deploy `deploy.md` §2 (build no HD, PM2 4013).
2. Vídeo curto com fala PT, chave no `.env.local`.
3. Gerar legendas → clipes na timeline, palavra acende no playhead.
4. Viral ↔ Limpo sem retranscrever.
5. Editar texto / trim → words acompanham.
6. Export Chrome = preview.
7. Gerar legendas de novo não apaga chips. Gerar estrutura não apaga legendas.
8. Sem vídeo / arquivo grande / sem fala: status de erro; inserts intactos.

---

## Critério de pronto (spec)

Cobre os 8 itens da spec § Critério de pronto. Fora: editor de palavra, SRT, + Legenda, chunk 25 MB.
