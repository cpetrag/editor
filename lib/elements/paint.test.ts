import assert from "node:assert/strict"
import { test } from "node:test"

import { ELEMENT_PRESETS } from "./catalog.ts"
import { drawElement, type ElementDrawModel } from "./paint.ts"

test("drawElement has a painter for every catalog shape", () => {
  const shapes = new Set(ELEMENT_PRESETS.map((item) => item.shape))
  assert.equal(shapes.size >= 10, true)
  const seen: string[] = []
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    arc() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    quadraticCurveTo() {},
    setLineDash() {},
    drawImage() {},
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "round",
    lineCap: "round",
    textAlign: "center",
    textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D
  for (const preset of ELEMENT_PRESETS) {
    const model: ElementDrawModel = {
      id: preset.id,
      type: preset.id,
      shape: preset.shape,
      x: 10,
      y: 10,
      width: 240,
      height: 80,
      text: preset.defaultText,
      primary: preset.primary,
      secondary: preset.secondary,
      fontFamily: "sans-serif",
      fontWeight: preset.fontWeight,
      uppercase: preset.uppercase,
      fontPx: 28,
      radius: 16,
      shadow: preset.shadow,
    }
    assert.doesNotThrow(() => drawElement(ctx, model))
    seen.push(preset.shape)
  }
  assert.ok(seen.includes("hand-arrow"))
  assert.ok(seen.includes("bubble"))
  assert.ok(seen.includes("divider"))
})

function recordingContext() {
  const moves: Array<{ x: number; y: number }> = []
  const texts: Array<{ text: string; x: number; y: number }> = []
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo(x: number, y: number) {
      moves.push({ x, y })
    },
    lineTo() {},
    arcTo() {},
    arc() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y })
    },
    quadraticCurveTo() {},
    setLineDash() {},
    drawImage() {},
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "round",
    lineCap: "round",
    textAlign: "center",
    textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D
  return { ctx, moves, texts }
}

function arrowModel(patch: Partial<ElementDrawModel> = {}): ElementDrawModel {
  return {
    id: "seta-1",
    type: "seta",
    shape: "arrow",
    x: 100,
    y: 200,
    width: 120,
    height: 180,
    text: "AQUI",
    primary: "#FFE500",
    secondary: "#111111",
    fontFamily: "sans-serif",
    fontWeight: 400,
    uppercase: true,
    fontPx: 28,
    radius: 8,
    shadow: "hard",
    ...patch,
  }
}

test("animated arrow points down and keeps the label above the glyph", () => {
  const { ctx, moves, texts } = recordingContext()
  drawElement(ctx, arrowModel())
  const tip = moves[0]
  assert.ok(tip, "arrow path should start at the tip")
  assert.ok(tip.y > 200 + 90, "tip sits in the lower half of the box")
  assert.ok(Math.abs(tip.x - 160) < 1, "tip is centered")
  const label = texts.find((item) => item.text === "AQUI")
  assert.ok(label, "label is painted")
  assert.ok(label.y < tip.y - 20, "label stays above the arrow, not on the glyph")
})

test("stars wrap uses the box instead of leaving a wide empty gutter", () => {
  const { ctx, texts } = recordingContext()
  drawElement(ctx, {
    id: "stars-1",
    type: "estrelas",
    shape: "stars",
    x: 40,
    y: 40,
    width: 400,
    height: 220,
    text: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    primary: "#F5C518",
    secondary: "#FFFFFF",
    fontFamily: "sans-serif",
    fontWeight: 800,
    uppercase: false,
    fontPx: 24,
    radius: 16,
    shadow: "hard",
  })
  assert.equal(texts.length, 1, "a line that almost fills the box should not wrap from oversized padding")
})

test("tiktok bubble paints wrapped body lines instead of one overflowing row", () => {
  const { ctx, texts } = recordingContext()
  drawElement(ctx, {
    id: "bubble-1",
    type: "bubble-comentario",
    shape: "bubble",
    x: 40,
    y: 40,
    width: 320,
    height: 220,
    text: "@fuladsonee\nO produto é muito bom, gostei demais dele, indico a todos que queiram comprar",
    primary: "#FFFFFF",
    secondary: "#111111",
    fontFamily: "sans-serif",
    fontWeight: 600,
    uppercase: false,
    fontPx: 22,
    radius: 18,
    shadow: "soft",
  })
  const handle = texts.find((item) => item.text.includes("fuladsonee"))
  assert.ok(handle)
  const body = texts.filter((item) => item !== handle)
  assert.ok(body.length >= 2, "long comment wraps onto extra lines")
  assert.ok(body.every((item) => item.text.length < 80))
})
