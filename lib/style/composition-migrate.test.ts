import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_VIDEO_BITRATE,
  parseComposition,
  serializeComposition,
  type CompositionInsert,
} from "../composition.ts"
import { resolveLayerStyle } from "../compose/resolve-style.ts"
import { fieldOrigin, resolveStyle } from "./resolve-style.ts"

function sampleComposition(patch: Record<string, unknown> = {}) {
  return {
    version: 3,
    source: {
      duration: 20,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
      fileId: "file-1",
    },
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
    inserts: [
      {
        id: "chip",
        type: "alerta-desconto",
        start: 1,
        duration: 3,
        text: "50% OFF",
        anchor: "top",
        animIn: "pop",
        animOut: "none",
        style: {
          fontFamily: "bebas",
          fontWeight: 400,
          uppercase: true,
          color: "#FFFFFF",
          bgColor: null,
          strokeWidth: 6,
          strokeColor: "#000000",
          shadow: "soft",
          opacity: 0.8,
          rotation: 4,
        },
      },
    ],
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: DEFAULT_VIDEO_BITRATE,
    },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    ...patch,
  }
}

test("projeto v3 abre com os campos achatados intactos e styleRef migrado", () => {
  const parsed = parseComposition(sampleComposition())
  const insert = parsed.inserts[0]
  assert.ok(insert)
  assert.equal(parsed.version, COMPOSITION_VERSION)
  assert.equal(insert.style?.fontFamily, "bebas")
  assert.equal(insert.style?.fontWeight, 400)
  assert.equal(insert.style?.shadow, "soft")
  assert.equal(insert.style?.opacity, 0.8)
  assert.equal(insert.style?.rotation, 4)
  assert.equal(insert.styleRef?.presetId, "legado")
  assert.equal(insert.styleRef?.overrides.text?.fontFamily, "bebas")
  assert.equal(insert.styleRef?.overrides.text?.opacity, 80)
  assert.deepEqual(insert.styleRef?.overrides.text?.shadows, [
    { x: 0, y: 6, blur: 14, color: "rgba(0,0,0,0.55)" },
  ])

  const painted = resolveLayerStyle(insert, "geist")
  assert.equal(painted.fontWeight, 400)
  assert.equal(painted.color, "#FFFFFF")
  assert.equal(painted.shadow, "soft")
  assert.equal(painted.opacity, 0.8)
  assert.equal(painted.rotation, 4)
  assert.equal(painted.stroke?.width, 6)
  assert.equal(parsed.tracks, undefined)
})

test("insert sem estilo achatado não ganha styleRef vazio", () => {
  const parsed = parseComposition(
    sampleComposition({
      inserts: [
        {
          id: "i1",
          type: "logo-shopee",
          start: 0.5,
          duration: 3,
          anchor: "top",
          animIn: "pop",
          animOut: "none",
        },
      ],
    }),
  )
  assert.equal(parsed.inserts[0]?.style, undefined)
  assert.equal(parsed.inserts[0]?.styleRef, undefined)
})

test("styleRef explícito vence a migração e round-tripa com tracks do projeto", () => {
  const insert: CompositionInsert = {
    id: "txt",
    type: "texto-livre",
    kind: "text",
    start: 0,
    duration: 3,
    text: "NOVO",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 40,
    fontSize: 64,
    styleRef: {
      presetId: "legado",
      overrides: { text: { color: "#FF00AA" } },
    },
  }
  const parsed = parseComposition(
    sampleComposition({
      version: COMPOSITION_VERSION,
      styleRef: { presetId: "legado", overrides: { text: { opacity: 90 } } },
      tracks: {
        cta: { styleRef: { presetId: "legado", overrides: { text: { fontSize: 72 } } } },
      },
      inserts: [insert],
    }),
  )
  assert.equal(parsed.styleRef?.overrides.text?.opacity, 90)
  assert.equal(parsed.tracks?.cta?.styleRef?.overrides.text?.fontSize, 72)
  assert.equal(parsed.inserts[0]?.styleRef?.overrides.text?.color, "#FF00AA")
  assert.equal(parsed.inserts[0]?.y, 40)
  assert.equal(parsed.inserts[0]?.fontSize, 64)

  const resolved = resolveStyle(
    parsed.inserts[0]!,
    parsed.tracks?.cta ?? null,
    parsed,
  )
  assert.equal(resolved.text.color, "#FF00AA")
  assert.equal(resolved.text.fontSize, 72)
  assert.equal(resolved.text.opacity, 90)
  assert.equal(fieldOrigin("text.color", parsed.inserts[0]!, parsed.tracks?.cta ?? null, parsed), "insert")
  assert.equal(fieldOrigin("text.fontSize", parsed.inserts[0]!, parsed.tracks?.cta ?? null, parsed), "faixa")
  assert.equal(fieldOrigin("text.opacity", parsed.inserts[0]!, parsed.tracks?.cta ?? null, parsed), "projeto")

  const again = parseComposition(JSON.parse(serializeComposition(parsed)))
  assert.equal(again.styleRef?.overrides.text?.opacity, 90)
  assert.equal(again.tracks?.cta?.styleRef?.overrides.text?.fontSize, 72)
  assert.equal(again.inserts[0]?.styleRef?.overrides.text?.color, "#FF00AA")
})

test("v4 insert with diverging styleRef.overrides wins over stale style", () => {
  const parsed = parseComposition(
    sampleComposition({
      version: 4,
      inserts: [
        {
          id: "txt",
          type: "texto-livre",
          kind: "text",
          start: 0,
          duration: 3,
          text: "NOVO",
          anchor: "center",
          animIn: "pop",
          animOut: "none",
          x: 50,
          y: 35,
          fontSize: 96,
          preset: "impacto",
          style: {
            fontFamily: "inter",
            fontWeight: 800,
            uppercase: false,
            color: "#111111",
            bgColor: null,
            strokeWidth: 12,
            strokeColor: "#FF0000",
            shadow: "none",
            opacity: 1,
            rotation: 0,
          },
          styleRef: {
            presetId: "legado",
            overrides: { text: { fontFamily: "playfair", color: "#00FF00" } },
          },
        },
      ],
    }),
  )
  const insert = parsed.inserts[0]
  assert.ok(insert)
  assert.equal(parsed.version, COMPOSITION_VERSION)
  assert.equal(insert.styleRef?.overrides.text?.fontFamily, "playfair")
  assert.equal(insert.style?.fontFamily, "playfair")
  assert.equal(insert.style?.color, "#00FF00")
  const painted = resolveLayerStyle(insert, "geist")
  assert.equal(painted.fontFamily.includes("Playfair"), true)
  assert.equal(painted.color, "#00FF00")
})
