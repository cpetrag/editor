import { test } from "node:test"
import assert from "node:assert/strict"
import { alignPunctuatedTokens } from "./caption-punctuate.ts"
import { restoreCaptionWords } from "./caption-restore.ts"
import { tidyCaptionSpeech } from "./caption-speech.ts"
import { CAPTION_INSERT_TYPE, insertKind, type CompositionInsert } from "./composition.ts"
import {
  DEFAULT_GROUP_OPTIONS,
  groupCaptionLines,
  activeCaptionWord,
  reflowCaptionWords,
  retargetCaptionWords,
  parseWhisperCaptionResult,
  parseMaxWords,
  WHISPER_CAPTION_REQUEST,
  runCaptionsPipeline,
  linesToCaptionInserts,
  replaceCaptionInserts,
  applyCaptionPatch,
} from "./captions.ts"

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

function w(text: string, start: number, end: number) {
  return { text, start, end }
}

function texts(lines: { words: { text: string }[] }[]) {
  return lines.flatMap((line) => line.words.map((word) => word.text))
}

test("groupCaptionLines starts a new line after a pause > 0.4s", () => {
  const lines = groupCaptionLines([w("oi", 0, 0.3), w("hoje", 1.0, 1.3)])
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "oi")
  assert.equal(lines[1]?.text, "hoje")
  assert.equal(lines[1]?.start, 1)
  assert.equal(lines[1]?.words[0]?.start, 1)
})

test("groupCaptionLines starts a new line after . ? !", () => {
  const lines = groupCaptionLines([w("fim.", 0, 0.4), w("Ok", 0.45, 0.8)])
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "fim.")
  assert.equal(lines[1]?.text, "Ok")

  const question = groupCaptionLines([w("fim?", 0, 0.4), w("Ok", 0.45, 0.8)])
  assert.equal(question.length, 2)
  assert.equal(question[0]?.text, "fim?")
  assert.equal(question[1]?.text, "Ok")

  const exclamation = groupCaptionLines([w("fim!", 0, 0.4), w("Ok", 0.45, 0.8)])
  assert.equal(exclamation.length, 2)
  assert.equal(exclamation[0]?.text, "fim!")
  assert.equal(exclamation[1]?.text, "Ok")
})

test("groupCaptionLines fecha o card no maxWords padrão (4)", () => {
  const words = ["aaaa", "bbbb", "cccc", "dddd", "eeee", "ffff", "gggg"].map((text, i) =>
    w(text, i * 0.3, i * 0.3 + 0.25),
  )
  const lines = groupCaptionLines(words)
  assert.equal(lines[0]?.words.length, 4)
  assert.equal(lines[1]?.words.length, 3)
  assert.deepEqual(texts(lines), words.map((word) => word.text))
})

test("groupCaptionLines não funde o último card curto — a pausa já quebrou", () => {
  const lines = groupCaptionLines([w("longa", 0, 1.0), w("x", 1.5, 1.7)])
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "longa")
  assert.equal(lines[1]?.text, "x")
  assert.deepEqual(texts(lines), ["longa", "x"])
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

test("reflowCaptionWords never emits end before start", () => {
  const words = reflowCaptionWords("a aaaaaaaaaa a", 0.2)
  for (const word of words) {
    assert.ok(word.end >= word.start)
  }
  assert.equal(words.at(-1)?.end, 0.2)
})

test("reflowCaptionWords reserves minimum span for the last token", () => {
  const words = reflowCaptionWords("aa bb cc", 0.3)
  assert.equal(words.length, 3)
  for (const word of words) {
    assert.ok(word.end - word.start >= 0.05)
  }
  assert.equal(words.at(-1)?.end, 0.3)

  const weighted = reflowCaptionWords("aaa bb cc", 0.16)
  assert.equal(weighted.length, 3)
  for (const word of weighted) {
    assert.ok(word.end - word.start >= 0.05)
  }
  assert.equal(weighted.at(-1)?.end, 0.16)
})

test('reflowCaptionWords clamps non-last end when duration is below n * MIN_WORD_DURATION', () => {
  const words = reflowCaptionWords("a b c", 0.04)
  for (const word of words) {
    assert.ok(word.end >= word.start)
  }
  assert.equal(words.at(-1)?.end, 0.04)
})

test("retargetCaptionWords drops words that start outside the new window", () => {
  const prev = { start: 0, duration: 2, words: [w("a", 0, 1), w("b", 1.2, 2)] }
  const next = retargetCaptionWords(prev, { ...prev, duration: 1 })
  assert.equal(next.words.length, 1)
  assert.equal(next.words[0]?.text, "a")
  assert.equal(next.words[0]?.end, 1)
})

test("parseWhisperCaptionResult reads words from verbose_json", () => {
  const parsed = parseWhisperCaptionResult({
    words: [{ word: "oi", start: 0, end: 0.3 }],
  })
  assert.equal(parsed.estimated, false)
  assert.equal(parsed.words[0]?.text, "oi")
  assert.equal(parsed.words[0]?.start, 0)
  assert.equal(parsed.words[0]?.end, 0.3)
})

test("WHISPER_CAPTION_REQUEST exige verbose_json e granularidade de palavra", () => {
  assert.equal(WHISPER_CAPTION_REQUEST.responseFormat, "verbose_json")
  assert.equal(WHISPER_CAPTION_REQUEST.timestampGranularity, "word")
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

test("texto bruto devolve fora e pena sem sobrepor as vizinhas", () => {
  const gap = restoreCaptionWords(
    [
      { text: "ficar", start: 0, end: 0.4 },
      { text: "de", start: 0.4, end: 1 },
      { text: "desse", start: 1.2, end: 1.6 },
      { text: "grupo", start: 1.6, end: 2 },
    ],
    "ficar de fora desse grupo.",
  )
  assert.equal(gap.inserted, 1)
  assert.deepEqual(gap.words.map((word) => word.text), ["ficar", "de", "fora", "desse", "grupo"])
  const fora = gap.words[2]!
  assert.equal(fora.start, 1)
  assert.equal(fora.end, 1.2)

  const tight = restoreCaptionWords(
    [
      { text: "de", start: 0.6, end: 1 },
      { text: "desse", start: 1, end: 1.2 },
      { text: "xx", start: 1.2, end: 1.4 },
    ],
    "de fora desse",
  )
  assert.deepEqual(tight.words.map((word) => word.text), ["de", "fora", "desse", "xx"])
  for (let index = 0; index < tight.words.length; index += 1) {
    const word = tight.words[index]!
    assert.ok(word.end - word.start >= 1 / 30 - 1e-9)
    const next = tight.words[index + 1]
    if (next) assert.ok(word.end <= next.start + 1e-9)
  }
  assert.ok(tight.words[0]!.end < 1)
})

test("E só vira e no meio da frase", () => {
  const mid = tidyCaptionSpeech([
    { text: "valem" },
    { text: "a" },
    { text: "conferir" },
    { text: "E" },
    { text: "quando" },
  ])
  assert.deepEqual(mid.map((word) => word.text), ["valem", "a", "conferir", "e", "quando"])

  const nextSentence = tidyCaptionSpeech([
    { text: "conferir." },
    { text: "e" },
    { text: "quando" },
    { text: "aparece" },
  ])
  assert.deepEqual(nextSentence.map((word) => word.text), ["conferir.", "E", "quando", "aparece"])
})

test("vírgulas soltas voltam para as mesmas palavras", () => {
  const words = ["uma", "oportunidade", "boa", "eu", "aviso", "por", "lá"]
  const raw = ["uma", "oportunidade", ",", "boa", ",", "eu", "aviso", "por", "lá"]
  assert.deepEqual(alignPunctuatedTokens(words, raw), [
    "uma",
    "oportunidade,",
    "boa,",
    "eu",
    "aviso",
    "por",
    "lá",
  ])
})

test("runCaptionsPipeline pontua os tokens antes de montar as linhas", async () => {
  const result = await runCaptionsPipeline(
    { duration: 8, mediaBytes: 100, maxWords: 4 },
    {
      transcribe: async () => ({
        words: [
          { word: "uma", start: 0, end: 0.3 },
          { word: "oportunidade", start: 0.3, end: 0.9 },
          { word: "boa", start: 0.9, end: 1.2 },
          { word: "eu", start: 1.2, end: 1.4 },
          { word: "aviso", start: 1.4, end: 1.8 },
          { word: "por", start: 1.8, end: 2 },
          { word: "lá", start: 2, end: 2.4 },
        ],
      }),
      punctuate: async () => ["uma", "oportunidade", ",", "boa", ",", "eu", "aviso", "por", "lá"],
    },
  )
  const texts = result.lines.flatMap((line) => line.words.map((word) => word.text))
  assert.deepEqual(texts, ["uma", "oportunidade,", "boa,", "eu", "aviso", "por", "lá"])
  assert.equal(result.lines[0]?.words[0]?.start, 0)
  assert.equal(result.lines[0]?.words[1]?.end, 0.9)
  assert.ok(result.warnings.includes("punctuated"))
  assert.match(result.lines.map((line) => line.text).join(" | "), /oportunidade,/)
  assert.match(result.lines.map((line) => line.text).join(" | "), /boa,/)
})

test("runCaptionsPipeline repõe palavras do texto bruto antes de pontuar", async () => {
  const result = await runCaptionsPipeline(
    { duration: 8, mediaBytes: 100, maxWords: 4 },
    {
      transcribe: async () => ({
        text: "ficar de fora desse grupo. que valem a pena conferir. e quando aparece",
        words: [
          { word: "ficar", start: 0, end: 0.3 },
          { word: "de", start: 0.3, end: 0.5 },
          { word: "desse", start: 0.5, end: 0.8 },
          { word: "grupo", start: 0.8, end: 1.1 },
          { word: "que", start: 1.2, end: 1.4 },
          { word: "valem", start: 1.4, end: 1.7 },
          { word: "a", start: 1.7, end: 1.8 },
          { word: "conferir", start: 1.8, end: 2.2 },
          { word: "e", start: 2.2, end: 2.4 },
          { word: "quando", start: 2.4, end: 2.7 },
          { word: "aparece", start: 2.7, end: 3.1 },
        ],
      }),
      punctuate: async (words) =>
        words.map((word) => (word === "grupo" || word === "conferir" ? `${word}.` : word)),
    },
  )
  const spoken = result.lines.flatMap((line) => line.words.map((word) => word.text)).join(" ")
  assert.match(spoken, /ficar de fora desse grupo\./)
  assert.match(spoken, /Que valem a pena conferir\./)
  assert.match(spoken, /E quando aparece/)
  assert.ok(result.warnings.includes("words-restored:2"))
  assert.ok(result.warnings.includes("punctuated"))
  for (const line of result.lines) assert.ok(line.text.length <= 22, line.text)
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

test("linesToCaptionInserts grava words[] com start/end mesmo quando a linha chega sem timings", () => {
  const [insert] = linesToCaptionInserts(
    [{ text: "oi hoje", start: 1, duration: 2, words: [] }],
    10,
  )
  assert.equal(insert?.text, "oi hoje")
  assert.equal(insert?.words?.length, 2)
  assert.equal(insert?.words?.[0]?.text, "oi")
  assert.equal(insert?.words?.[1]?.text, "hoje")
  assert.ok((insert?.words?.[0]?.start ?? -1) >= 1)
  assert.ok((insert?.words?.[0]?.end ?? 0) > (insert?.words?.[0]?.start ?? 0))
  assert.ok((insert?.words?.[1]?.end ?? 0) <= 3 + 1e-6)
})

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

test("applyCaptionPatch from an already-trimmed insert cannot restore dropped words", () => {
  const original = linesToCaptionInserts(
    [{
      text: "a b",
      start: 0,
      duration: 2,
      words: [{ text: "a", start: 0, end: 1 }, { text: "b", start: 1.2, end: 2 }],
    }],
    10,
  )[0]!
  const shrunk = applyCaptionPatch(original, { duration: 1 })
  const restoredFromPresent = applyCaptionPatch(shrunk, { duration: 2 })
  assert.equal(restoredFromPresent.words?.length, 1)
  assert.equal(restoredFromPresent.words?.[0]?.text, "a")

  const restoredFromOriginal = applyCaptionPatch(original, { duration: 2 })
  assert.equal(restoredFromOriginal.words?.length, 2)
  assert.equal(restoredFromOriginal.words?.[1]?.text, "b")
})

test("maxWords: 1 gera um card por palavra", () => {
  const words = [w("uma", 0, 0.3), w("palavra", 0.3, 0.7), w("só", 0.7, 0.95)]
  const lines = groupCaptionLines(words, { maxWords: 1 })
  assert.equal(lines.length, 3)
  assert.equal(lines[0]?.text, "uma")
  assert.equal(lines[1]?.text, "palavra")
  assert.equal(lines[2]?.text, "só")
  assert.deepEqual(texts(lines), ["uma", "palavra", "só"])
})

test("groupCaptionLines fecha o card quando a duração passa de maxDuration", () => {
  const lines = groupCaptionLines(
    [w("a", 0, 0.8), w("b", 0.8, 1.6), w("c", 1.6, 2.4)],
    { maxWords: 6, maxDuration: 2, gapBreak: 10, breakOnPunctuation: false },
  )
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "a b")
  assert.equal(lines[1]?.text, "c")
  assert.deepEqual(texts(lines), ["a", "b", "c"])
})

test("groupCaptionLines: uma palavra maior que maxDuration fica sozinha no card", () => {
  const lines = groupCaptionLines(
    [w("alongada", 0, 2.5), w("ok", 2.5, 2.8)],
    { maxWords: 6, maxDuration: 2, gapBreak: 10, breakOnPunctuation: false },
  )
  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.text, "alongada")
  assert.equal(lines[1]?.text, "ok")
})

test("breakOnPunctuation: false não quebra em ponto", () => {
  const lines = groupCaptionLines(
    [w("fim.", 0, 0.4), w("Ok", 0.45, 0.8)],
    { maxWords: 6, breakOnPunctuation: false, gapBreak: 10 },
  )
  assert.equal(lines.length, 1)
  assert.equal(lines[0]?.text, "fim. Ok")
})

test("reagrupar não perde nem duplica palavra", () => {
  const words = [
    w("Você", 0, 0.3),
    w("não", 0.3, 0.5),
    w("vai", 0.5, 0.7),
    w("acreditar.", 0.7, 1.2),
    w("Olha", 1.8, 2.1),
    w("isso", 2.1, 2.4),
    w("aqui", 2.4, 2.7),
    w("agora", 2.7, 3.1),
    w("mesmo", 3.1, 3.5),
  ]
  for (const maxWords of [1, 2, 4, 6] as const) {
    const lines = groupCaptionLines(words, { maxWords })
    assert.deepEqual(texts(lines), words.map((word) => word.text), `maxWords ${maxWords}`)
    assert.equal(
      lines.reduce((sum, line) => sum + line.words.length, 0),
      words.length,
      `maxWords ${maxWords} count`,
    )
  }
})

test("editar o texto de um card preserva os tempos das palavras não alteradas", () => {
  const insert = linesToCaptionInserts(
    [{
      text: "alfaiataria premium flare",
      start: 6,
      duration: 2,
      words: [
        { text: "alfaiataria", start: 6, end: 6.6 },
        { text: "premium", start: 6.6, end: 7.1 },
        { text: "flare", start: 7.1, end: 7.8 },
      ],
    }],
    20,
  )[0]!
  const patched = applyCaptionPatch(insert, { text: "alfaiataria premium fit" })
  assert.equal(patched.words?.length, 3)
  assert.equal(patched.words?.[0]?.text, "alfaiataria")
  assert.equal(patched.words?.[0]?.start, 6)
  assert.equal(patched.words?.[0]?.end, 6.6)
  assert.equal(patched.words?.[1]?.text, "premium")
  assert.equal(patched.words?.[1]?.start, 6.6)
  assert.equal(patched.words?.[1]?.end, 7.1)
  assert.equal(patched.words?.[2]?.text, "fit")
  assert.ok((patched.words?.[2]?.start ?? 0) >= 7.1)
  assert.ok((patched.words?.[2]?.end ?? 0) > (patched.words?.[2]?.start ?? 0))
})

test("parseMaxWords clampa 1–6 e cai no padrão 4", () => {
  assert.equal(parseMaxWords(undefined), DEFAULT_GROUP_OPTIONS.maxWords)
  assert.equal(parseMaxWords("3"), 3)
  assert.equal(parseMaxWords(1), 1)
  assert.equal(parseMaxWords(6), 6)
  assert.equal(parseMaxWords(0), 1)
  assert.equal(parseMaxWords(99), 6)
  assert.equal(parseMaxWords("nope"), 4)
})

test("runCaptionsPipeline respeita maxWords na transcrição", async () => {
  const result = await runCaptionsPipeline(
    { duration: 10, mediaBytes: 100, maxWords: 1 },
    {
      transcribe: async () => ({
        words: [
          { word: "oi", start: 0, end: 0.3 },
          { word: "hoje", start: 0.3, end: 0.7 },
        ],
      }),
    },
  )
  assert.equal(result.lines.length, 2)
  assert.equal(result.lines[0]?.text, "oi")
  assert.equal(result.lines[1]?.text, "hoje")
  assert.equal(result.lines[1]?.words[0]?.start, 0.3)
})

test("linesToCaptionInserts retargets words when clampInsert pulls start earlier at EOF", () => {
  const [insert] = linesToCaptionInserts(
    [{ text: "fim", start: 9.7, duration: 0.5, words: [{ text: "fim", start: 9.7, end: 10.2 }] }],
    10,
  )
  assert.equal(insert?.start, 9.5)
  assert.equal(insert?.duration, 0.5)
  assert.equal(insert?.words?.[0]?.text, "fim")
  assert.ok(Math.abs((insert?.words?.[0]?.start ?? -1) - 9.7) < 1e-9)
  assert.ok(Math.abs((insert?.words?.[0]?.end ?? -1) - 10) < 1e-9)
})

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
