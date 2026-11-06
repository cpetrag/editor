import { test } from "node:test"
import assert from "node:assert/strict"

import {
  canvasFontFamily,
  ensureComposeFontsReady,
  fontIdsForRender,
  fontIdsUsedInComposition,
} from "./fonts.ts"
import { factoryPresetFontIds } from "../style/presets.ts"
import { COMPOSITION_VERSION, DEFAULT_CAPTION_STYLE, type Composition } from "../composition.ts"

function composition(patch: Partial<Composition> = {}): Composition {
  return {
    version: COMPOSITION_VERSION,
    source: {
      duration: 10,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "base.mp4",
    },
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
    inserts: [],
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: { width: 1080, height: 1920, fps: 30, videoBitrate: 8_000_000 },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    ...patch,
  }
}

test("fontIdsUsedInComposition includes the brand font when inserts have no style", () => {
  assert.deepEqual(fontIdsUsedInComposition(composition()), ["geist"])
})

test("fontIdsUsedInComposition collects per-insert families without duplicates", () => {
  const ids = fontIdsUsedInComposition(
    composition({
      brand: { fontId: "poppins", primary: "#EE4D2D", logo: "" },
      inserts: [
        {
          id: "a",
          type: "alerta-desconto",
          start: 0,
          duration: 2,
          anchor: "top",
          animIn: "none",
          animOut: "none",
          style: {
            fontFamily: "bebas",
            fontWeight: 400,
            uppercase: true,
            color: "#ffffff",
            bgColor: null,
            strokeWidth: 6,
            strokeColor: "#000000",
            shadow: "none",
            opacity: 1,
            rotation: 0,
          },
        },
        {
          id: "b",
          type: "texto-livre",
          kind: "text",
          start: 0,
          duration: 2,
          text: "NOVO",
          anchor: "center",
          animIn: "none",
          animOut: "none",
          fontFamily: "archivo",
        },
      ],
    }),
  )
  assert.deepEqual(ids.sort(), ["archivo", "bebas", "geist", "poppins"])
})

test("fontIdsUsedInComposition includes captionStyle font", () => {
  const ids = fontIdsUsedInComposition(
    composition({
      captionStyle: { ...DEFAULT_CAPTION_STYLE, fontFamily: "anton" },
    }),
  )
  assert.ok(ids.includes("anton"))
  assert.ok(ids.includes("geist"))
})

test("canvasFontFamily maps oswald, montserrat, anton and inter", () => {
  assert.equal(canvasFontFamily("oswald"), '"Oswald", sans-serif')
  assert.equal(canvasFontFamily("montserrat"), "Montserrat, sans-serif")
  assert.equal(canvasFontFamily("anton"), "Anton, sans-serif")
  assert.equal(canvasFontFamily("inter"), "Inter, sans-serif")
})

test("canvasFontFamily maps the caption display families", () => {
  assert.equal(canvasFontFamily("alfa"), '"Alfa Slab One", serif')
  assert.equal(canvasFontFamily("nunito"), "Nunito, sans-serif")
  assert.equal(canvasFontFamily("lilita"), '"Lilita One", sans-serif')
  assert.equal(canvasFontFamily("luckiest"), '"Luckiest Guy", sans-serif')
  assert.equal(canvasFontFamily("baloo"), '"Baloo 2", sans-serif')
  assert.equal(canvasFontFamily("titan"), '"Titan One", sans-serif')
})

test("canvasFontFamily maps hosted text-preset families", () => {
  assert.equal(canvasFontFamily("caveat"), "Caveat, cursive")
  assert.equal(canvasFontFamily("courier"), '"Courier Prime", monospace')
})

test("fontIdsUsedInComposition collects oswald from insert style and keeps brand geist", () => {
  const ids = fontIdsUsedInComposition(
    composition({
      inserts: [
        {
          id: "a",
          type: "alerta-desconto",
          start: 0,
          duration: 2,
          anchor: "top",
          animIn: "none",
          animOut: "none",
          style: {
            fontFamily: "oswald",
            fontWeight: 600,
            uppercase: true,
            color: "#ffffff",
            bgColor: null,
            strokeWidth: 6,
            strokeColor: "#000000",
            shadow: "none",
            opacity: 1,
            rotation: 0,
          },
        },
      ],
    }),
  )
  assert.deepEqual(ids.sort(), ["geist", "oswald"])
})

test("fontIdsForRender inclui as fontes dos 16 presets mesmo sem inserts", () => {
  const ids = fontIdsForRender(composition())
  const factory = factoryPresetFontIds()
  assert.ok(factory.includes("montserrat"))
  assert.ok(factory.includes("inter"))
  for (const id of factory) {
    assert.ok(ids.includes(id), id)
  }
})

test("legendas padrão só pedem geist, não o catálogo de presets", () => {
  const ids = fontIdsUsedInComposition(
    composition({
      inserts: [
        {
          id: "cap",
          type: "legenda",
          kind: "caption",
          start: 0,
          duration: 2,
          text: "oi",
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
        },
      ],
    }),
  )
  assert.deepEqual(ids, ["geist"])
  assert.ok(!ids.includes("titan"))
  assert.ok(!ids.includes("montserrat"))
})

test("ensureComposeFontsReady não espera document.fonts.ready global", async () => {
  const loaded: string[] = []
  const previous = { document: globalThis.document }
  ;(globalThis as { document?: unknown }).document = {
    fonts: {
      load: async (spec: string) => {
        loaded.push(spec)
        return []
      },
      get ready() {
        throw new Error("document.fonts.ready não deve ser aguardado")
      },
    },
  }
  try {
    await ensureComposeFontsReady(["geist"])
    assert.ok(loaded.some((spec) => spec.includes("Geist")))
    assert.ok(!loaded.some((spec) => spec.includes("Titan")))
  } finally {
    if (previous.document) {
      ;(globalThis as { document?: unknown }).document = previous.document
    } else {
      delete (globalThis as { document?: unknown }).document
    }
  }
})

test("fontIdsUsedInComposition inclui a fonte do styleRef de factory", () => {
  const ids = fontIdsUsedInComposition(
    composition({
      inserts: [
        {
          id: "cap",
          type: "legenda",
          kind: "caption",
          start: 0,
          duration: 2,
          text: "oi",
          anchor: "bottom",
          animIn: "none",
          animOut: "none",
          styleRef: { presetId: "hormozi", overrides: {} },
        },
      ],
    }),
  )
  assert.ok(ids.includes("montserrat"))
})
