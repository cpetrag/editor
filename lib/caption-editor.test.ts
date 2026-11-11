import { test } from "node:test"
import assert from "node:assert/strict"

import { groupCaptionLines, preserveCaptionWordTimings } from "./captions.ts"
import { normalizeCaptionLines, captionsShareOneLane, separateCaptionWords } from "./caption-timing.ts"
import { visualBounds, dodgeCaptionTop } from "./caption-dodge.ts"
import { splitCaptionAtCursor, splitCaptionAtTime } from "./caption-edit.ts"
import { followVoiceCaptions } from "./caption-link.ts"
import { isSaleToken, markSaleWords } from "./caption-emphasis.ts"
import type { AudioTrack } from "./audio/types.ts"
import type { CompositionInsert } from "./composition.ts"

function w(text: string, start: number, end: number) {
  return { text, start, end }
}

function voice(patch: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: "voz",
    kind: "voice",
    fileId: "file",
    fileName: "locucao.mp3",
    duration: 6,
    start: 0,
    trimIn: 0,
    trimOut: 6,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    muted: false,
    ...patch,
  }
}

function caption(id: string, start: number, duration: number): CompositionInsert {
  return {
    id,
    type: "legenda",
    kind: "caption",
    start,
    duration,
    text: id,
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    words: [w(id, start, start + duration)],
    captionSource: { kind: "voice", trackId: "voz", offset: start },
  }
}

test("normalizador elimina sobreposição de 0,02 s e deixa uma lane só", () => {
  const lines = normalizeCaptionLines([
    { start: 0, duration: 1.02, text: "cupons e ofertas que", words: [w("cupons", 0, 0.4), w("e", 0.4, 0.5), w("ofertas", 0.5, 0.8), w("que", 0.8, 1.02)] },
    { start: 1, duration: 1.2, text: "valem a conferir E", words: [w("valem", 1, 1.3), w("a", 1.3, 1.4), w("conferir", 1.4, 1.8), w("E", 1.8, 2.2)] },
  ])
  for (let index = 0; index < lines.length - 1; index += 1) {
    const end = lines[index]!.start + lines[index]!.duration
    assert.ok(end <= lines[index + 1]!.start + 1e-6)
  }
  assert.equal(captionsShareOneLane(lines), true)
})

test("quebra não termina em a, por ou e", () => {
  const natura = groupCaptionLines(
    [w("Se", 0, 0.2), w("você", 0.2, 0.4), w("ama", 0.4, 0.6), w("a", 0.6, 0.7), w("Natura", 0.7, 1.1)],
    { maxWords: 4, maxChars: 22 },
  )
  for (const line of natura) {
    assert.ok(line.text.length <= 22)
    assert.ok(!/\b(a|por|e)$/i.test(line.text), line.text)
  }
  assert.ok(natura.some((line) => line.text.includes("Natura")))

  const por = groupCaptionLines(
    [w("boa,", 0, 0.3), w("eu", 0.3, 0.5), w("aviso", 0.5, 0.8), w("por", 0.8, 1), w("lá", 1, 1.3)],
    { maxWords: 4, maxChars: 22 },
  )
  for (const line of por) {
    assert.ok(!/\b(a|por|e)$/i.test(line.text), line.text)
    assert.ok(line.words.length <= 5)
  }
})

test("editar troca a palavra e herda o tempo; inserir divide a vizinha", () => {
  const kept = preserveCaptionWordTimings(
    [w("cupons", 1, 1.4), w("e", 1.4, 1.5), w("ofertas", 1.5, 2)],
    "cupons e promoções",
    1,
    2,
  )
  assert.equal(kept[2]?.text, "promoções")
  assert.equal(kept[2]?.start, 1.5)
  assert.equal(kept[2]?.end, 2)
  assert.equal(kept[0]?.start, 1)
  assert.equal(kept[0]?.end, 1.4)

  const inserted = preserveCaptionWordTimings(
    [w("cupons", 0, 1), w("ofertas", 1, 2)],
    "cupons e ofertas",
    0,
    2,
  )
  assert.equal(inserted[1]?.text, "e")
  assert.ok(inserted[1]!.start >= 1 - 1e-9)
  assert.ok(inserted[1]!.end <= 2 + 1e-9)
  assert.equal(inserted[0]?.end, 1)
})

test("dividir no cursor herda o estilo global", () => {
  const insert: CompositionInsert = {
    id: "c1",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 2,
    text: "cupons e ofertas",
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    words: [w("cupons", 0, 0.6), w("e", 0.6, 0.8), w("ofertas", 0.8, 1.4)],
    styleRef: { presetId: "hormozi", overrides: { text: { color: "#fff" } } },
    captionOwnStyle: true,
  }
  const parts = splitCaptionAtCursor(insert, "cupons ".length, { presetId: "viral", overrides: {} })
  assert.ok(parts)
  assert.equal(parts!.left.captionOwnStyle, undefined)
  assert.equal(parts!.right.captionOwnStyle, undefined)
  assert.equal(parts!.left.styleRef?.presetId, "viral")
  assert.equal(parts!.right.text.includes("ofertas"), true)
  const atTime = splitCaptionAtTime(insert, 0.7, { presetId: "viral", overrides: {} })
  assert.ok(atTime)
  assert.equal(atTime!.left.captionOwnStyle, undefined)
  assert.equal(atTime!.right.captionOwnStyle, undefined)
})

test("mover e cortar a locução desloca as legendas e remove as que saem", () => {
  const before = [voice({ start: 1, trimIn: 0 })]
  const moved = followVoiceCaptions(
    [caption("a", 1.2, 0.8), caption("b", 3, 0.8)],
    before,
    [voice({ start: 2, trimIn: 0 })],
    10,
  )
  assert.equal(moved.removed, 0)
  assert.equal(moved.inserts[0]?.start, 2.2)
  assert.ok(Math.abs((moved.inserts[0]?.captionSource?.offset ?? 0) - 0.2) < 1e-9)

  const trimmed = followVoiceCaptions(
    [caption("a", 1, 0.5), caption("b", 4, 0.8)],
    [voice({ start: 1, trimIn: 0, trimOut: 6 })],
    [voice({ start: 1, trimIn: 3.5, trimOut: 6 })],
    10,
  )
  assert.equal(trimmed.removed, 1)
  assert.equal(trimmed.inserts.length, 1)
  assert.ok(Math.abs((trimmed.inserts[0]?.start ?? 0) - 0.5) < 1e-6)
})

test("palavras de venda e frases do dicionário recebem ênfase", () => {
  assert.equal(isSaleToken("cupons", ["cupom", "cupons"]), true)
  assert.equal(isSaleToken("R$ 20", ["cupom"]), true)
  assert.equal(isSaleToken("20%", ["cupom"]), true)
  const marked = markSaleWords(
    [w("veja", 0, 0.2), w("os", 0.2, 0.3), w("cupons", 0.3, 0.6), w("Saiba", 0.6, 0.9), w("Mais", 0.9, 1.2)],
    ["cupons", "Saiba Mais"],
    true,
  )
  assert.equal(marked[2]?.emphasis, true)
  assert.equal(marked[3]?.emphasis, true)
  assert.equal(marked[4]?.emphasis, true)
  assert.equal(marked[0]?.emphasis, undefined)
})

test("maxChars é teto duro e maxWords passa no máximo uma palavra", () => {
  const long = groupCaptionLines(
    ["cupons", "e", "ofertas", "que", "valem"].map((text, index) => w(text, index * 0.3, index * 0.3 + 0.25)),
    { maxWords: 4, maxChars: 22 },
  )
  for (const line of long) {
    assert.ok(line.text.length <= 22, line.text)
    assert.ok(line.words.length <= 5, line.text)
  }
  assert.ok(long.every((line) => line.text !== "cupons e ofertas que valem"))

  const chance = groupCaptionLines(
    ["aparece", "uma", "oportunidade"].map((text, index) => w(text, index * 0.4, index * 0.4 + 0.3)),
    { maxWords: 4, maxChars: 22 },
  )
  for (const line of chance) assert.ok(line.text.length <= 22, line.text)

  const tight = groupCaptionLines(
    ["um", "dois", "tres", "quatro", "cinco"].map((text, index) => w(text, index * 0.2, index * 0.2 + 0.15)),
    { maxWords: 2, maxChars: 40 },
  )
  for (const line of tight) assert.ok(line.words.length <= 3, line.text)
})

test("não quebra Saiba Mais nem outros termos de várias palavras", () => {
  const lines = groupCaptionLines(
    ["Clique", "em", "Saiba", "Mais", "e", "entra", "agora"].map((text, index) =>
      w(text, index * 0.25, index * 0.25 + 0.2),
    ),
    { maxWords: 4, maxChars: 22 },
    undefined,
    ["Saiba Mais", "frete grátis", "link na bio", "Mercado Livre"],
  )
  assert.ok(lines.every((line) => !line.text.endsWith("Saiba")))
  assert.ok(lines.some((line) => line.text.includes("Saiba Mais")))
})

test("palavras encaixadas não se sobrepõem e duram um frame", () => {
  const words = separateCaptionWords([w("não", 2.07, 2.1), w("pode", 2.07, 2.2)])
  assert.ok(words[0]!.end <= words[1]!.start + 1e-9)
  assert.ok(words[0]!.end - words[0]!.start >= 1 / 30 - 1e-9)
  assert.ok(words[1]!.end - words[1]!.start >= 1 / 30 - 1e-9)
})

test("deslocar a locução não apaga palavras da legenda que continua", () => {
  const line = caption("fim", 13.4, 1.2)
  line.text = "Mais e entra agora"
  line.words = [w("Mais", 13.4, 13.7), w("e", 13.7, 13.9), w("entra", 13.9, 14.3), w("agora", 14.3, 14.6)]
  const moved = followVoiceCaptions([line], [voice({ start: 0, trimOut: 14.6, duration: 14.6 })], [voice({ start: 1, trimOut: 14.6, duration: 14.6 })], 15.6)
  assert.equal(moved.removed, 0)
  assert.equal(moved.inserts[0]?.words?.length, 4)
  assert.equal(moved.inserts[0]?.words?.map((word) => word.text).join(" "), "Mais e entra agora")
  const back = followVoiceCaptions(
    moved.inserts,
    [voice({ start: 1, trimOut: 14.6, duration: 14.6 })],
    [voice({ start: 0, trimOut: 14.6, duration: 14.6 })],
    14.6,
  )
  assert.equal(back.inserts[0]?.words?.map((word) => word.text).join(" "), "Mais e entra agora")
  assert.equal(back.inserts[0]?.words?.[3]?.start, 14.3)
})

test("faixa preta em 62–66% empurra a legenda para fora dela", () => {
  const frame = 1920
  const bar = visualBounds({
    cx: 540,
    cy: 0.64 * frame,
    width: 900,
    height: 0.04 * frame,
    rotation: 0,
  })
  const captionTop = 0.63 * frame - 40
  const moved = dodgeCaptionTop({
    caption: { left: 200, top: captionTop, width: 680, height: 80 },
    obstacles: [bar],
    safeTop: frame * 0.06,
    safeBottom: frame * 0.94,
    step: 16,
  })
  const caption = { left: 200, top: moved, width: 680, height: 80 }
  const hits =
    caption.left < bar.left + bar.width &&
    bar.left < caption.left + caption.width &&
    caption.top < bar.top + bar.height &&
    bar.top < caption.top + caption.height
  assert.equal(hits, false)
})

test("desvio escolhe a posição livre mais próxima sem sair da área segura", () => {
  const stayed = dodgeCaptionTop({
    caption: { left: 100, top: 1400, width: 400, height: 80 },
    obstacles: [{ left: 100, top: 200, width: 400, height: 80 }],
    safeTop: 80,
    safeBottom: 1800,
  })
  assert.equal(stayed, 1400)
  const moved = dodgeCaptionTop({
    caption: { left: 100, top: 800, width: 400, height: 100 },
    obstacles: [{ left: 80, top: 780, width: 440, height: 160 }],
    safeTop: 40,
    safeBottom: 1880,
    step: 20,
  })
  assert.notEqual(moved, 800)
  assert.ok(moved + 100 <= 1880)
  assert.ok(moved >= 40)
  const box = { left: 100, top: moved, width: 400, height: 100 }
  const obstacle = { left: 80, top: 780, width: 440, height: 160 }
  const hits =
    box.left < obstacle.left + obstacle.width &&
    obstacle.left < box.left + box.width &&
    box.top < obstacle.top + obstacle.height &&
    obstacle.top < box.top + box.height
  assert.equal(hits, false)
})
