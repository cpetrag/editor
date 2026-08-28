import { test } from "node:test"
import assert from "node:assert/strict"

import {
  assembleInserts,
  buildImagePrompt,
  defaultStickerHint,
  parseDuration,
  runGeneratePipeline,
} from "./ai-generate.ts"
import { IMAGE_ALPHA_SUFFIX, WHISPER_MAX_BYTES } from "./ai-schema.ts"

test("parseDuration falls back to 15 when missing or invalid", () => {
  assert.equal(parseDuration(0), 15)
  assert.equal(parseDuration("abc"), 15)
  assert.equal(parseDuration(20), 20)
})

test("defaultStickerHint uses prova timing on a 15s video", () => {
  assert.deepEqual(defaultStickerHint(15), {
    start: 3,
    duration: 4,
    position: "bottom",
  })
})

test("buildImagePrompt always appends the transparent PNG suffix", () => {
  const prompt = buildImagePrompt("Fraldas com 70% off", [
    { type: "alerta-desconto", start: 1, duration: 3, text: "70% OFF" },
  ])
  assert.ok(prompt.includes("70% OFF"))
  assert.ok(prompt.includes(IMAGE_ALPHA_SUFFIX))
})

test("runGeneratePipeline skips Whisper when there is no media", async () => {
  let transcribed = false
  const result = await runGeneratePipeline(
    { prompt: "fraldas", duration: 15 },
    {
      transcribe: async () => {
        transcribed = true
        return "fala"
      },
      complete: async () => ({
        inserts: [{ type: "logo-shopee", start: 0, duration: 3 }],
      }),
      generatePng: async () => "aaa",
    },
  )
  assert.equal(transcribed, false)
  assert.ok(result.warnings.includes("transcript-skipped"))
  assert.equal(result.pngBase64, "aaa")
  assert.equal(result.inserts.length, 1)
})

test("runGeneratePipeline marks transcript-failed when the file is too large", async () => {
  let transcribed = false
  let completed = false
  const result = await runGeneratePipeline(
    { prompt: "fraldas", duration: 15, mediaBytes: WHISPER_MAX_BYTES + 1 },
    {
      transcribe: async () => {
        transcribed = true
        return "fala"
      },
      complete: async () => {
        completed = true
        return { inserts: [{ type: "cupom", start: 2, duration: 3, text: "CUPOM10" }] }
      },
      generatePng: async () => "png",
    },
  )
  assert.equal(transcribed, false)
  assert.equal(completed, true)
  assert.ok(result.warnings.includes("transcript-failed"))
})

test("runGeneratePipeline keeps chips when PNG generation fails", async () => {
  const result = await runGeneratePipeline(
    { prompt: "fraldas", duration: 15 },
    {
      transcribe: async () => "x",
      complete: async () => ({
        inserts: [{ type: "alerta-desconto", start: 1, duration: 3, text: "OFF" }],
      }),
      generatePng: async () => {
        throw new Error("org")
      },
    },
  )
  assert.ok(result.warnings.includes("image-failed"))
  assert.equal(result.pngBase64, undefined)
  assert.equal(result.inserts[0]?.type, "alerta-desconto")
})

test("assembleInserts without sticker returns only chips", () => {
  const inserts = assembleInserts({
    inserts: [{ type: "logo-shopee", start: 0, duration: 3 }],
    duration: 15,
  })
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0]?.type, "logo-shopee")
})

test("assembleInserts appends an upload sticker when fileId is provided", () => {
  const inserts = assembleInserts({
    inserts: [{ type: "logo-shopee", start: 0, duration: 3 }],
    duration: 15,
    sticker: { fileId: "png-1", label: "IA" },
  })
  const sticker = inserts[inserts.length - 1]
  assert.equal(sticker?.type, "sticker-png")
  assert.equal(sticker?.sourceKind, "upload")
  assert.equal(sticker?.fileId, "png-1")
})
