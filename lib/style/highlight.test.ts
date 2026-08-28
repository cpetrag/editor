import { test } from "node:test"
import assert from "node:assert/strict"

import { LEGADO_STYLE } from "./presets.ts"
import {
  AUTO_KEYWORD_RE,
  isKeywordToken,
  karaokeClipPath,
  karaokeProgress,
  wordHighlight,
} from "./highlight.ts"
import type { TextStyle } from "./types.ts"

const base: TextStyle["highlight"] = {
  ...LEGADO_STYLE.text.highlight,
}

const word = { text: "oferta", start: 1, end: 2 }

test("karaokeProgress: 0 antes, 0.5 no meio, 1 no fim — tempos absolutos da palavra", () => {
  assert.equal(karaokeProgress(word, 0.5), 0)
  assert.equal(karaokeProgress(word, 1), 0)
  assert.equal(karaokeProgress(word, 1.5), 0.5)
  assert.equal(karaokeProgress(word, 2), 1)
  assert.equal(karaokeProgress(word, 2.4), 1)
})

test("karaokeClipPath usa inset da direita, nao background-clip", () => {
  assert.equal(karaokeClipPath(0), "inset(0 100% 0 0)")
  assert.equal(karaokeClipPath(0.25), "inset(0 75% 0 0)")
  assert.equal(karaokeClipPath(1), "inset(0 0% 0 0)")
})

test("palavra-ativa pinta so a palavra corrente e aplica scale", () => {
  const highlight = { ...base, mode: "palavra-ativa" as const, color: "#FFE600", scale: 1.08 }
  const active = wordHighlight({
    token: "oferta",
    word,
    time: 1.2,
    isActive: true,
    highlight,
    baseColor: "#FFFFFF",
  })
  const idle = wordHighlight({
    token: "oferta",
    word,
    time: 0.2,
    isActive: false,
    highlight,
    baseColor: "#FFFFFF",
  })
  assert.equal(active.fill, "#FFE600")
  assert.equal(active.scale, 1.08)
  assert.equal(active.karaoke, null)
  assert.equal(idle.fill, "#FFFFFF")
  assert.equal(idle.scale, 1)
})

test("karaoke-fill devolve progresso independente de isActive (unit nao interfere)", () => {
  const highlight = { ...base, mode: "karaoke-fill" as const, color: "#00E676" }
  const mid = wordHighlight({
    token: "oferta",
    word,
    time: 1.5,
    isActive: true,
    highlight,
    baseColor: "#FFFFFF",
  })
  assert.equal(mid.fill, "#FFFFFF")
  assert.equal(mid.karaoke, 0.5)
  assert.equal(karaokeClipPath(mid.karaoke ?? 0), "inset(0 50% 0 0)")
})

test("palavras-chave com lista vazia destaca numeros, % e R$", () => {
  const highlight = { ...base, mode: "palavras-chave" as const, color: "#FF0", keywords: [] }
  const hits = ["50%", "49,90", "R$", "R$19,90", "100"]
  const misses = ["oferta", "frete"]
  for (const token of hits) {
    const paint = wordHighlight({
      token,
      time: 0,
      isActive: false,
      highlight,
      baseColor: "#FFF",
    })
    assert.equal(paint.fill, "#FF0", token)
  }
  for (const token of misses) {
    const paint = wordHighlight({
      token,
      time: 0,
      isActive: false,
      highlight,
      baseColor: "#FFF",
    })
    assert.equal(paint.fill, "#FFF", token)
  }
  assert.equal(isKeywordToken("50%", []), true)
  assert.equal(isKeywordToken("oferta", []), false)
  assert.equal(AUTO_KEYWORD_RE.test("50%"), true)
})

test("palavras-chave com lista so destaca as palavras pedidas", () => {
  const highlight = {
    ...base,
    mode: "palavras-chave" as const,
    color: "#FF0",
    keywords: ["frete"],
  }
  const hit = wordHighlight({
    token: "Frete",
    time: 0,
    isActive: false,
    highlight,
    baseColor: "#FFF",
  })
  const number = wordHighlight({
    token: "50%",
    time: 0,
    isActive: false,
    highlight,
    baseColor: "#FFF",
  })
  assert.equal(hit.fill, "#FF0")
  assert.equal(number.fill, "#FFF")
})

test("modo nenhum ignora palavra ativa", () => {
  const paint = wordHighlight({
    token: "oferta",
    word,
    time: 1.2,
    isActive: true,
    highlight: { ...base, mode: "nenhum" },
    baseColor: "#ABC",
  })
  assert.equal(paint.fill, "#ABC")
  assert.equal(paint.scale, 1)
  assert.equal(paint.karaoke, null)
})
