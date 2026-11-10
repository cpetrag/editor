import assert from "node:assert/strict"
import { test } from "node:test"

import { parseComposition, type Composition } from "../composition.ts"
import { migrateV6toV7 } from "./migrate.ts"
import { defaultCompositionAudio } from "./types.ts"

const v6 = {
  version: 6,
  source: {
    duration: 12.5,
    fps: 30,
    width: 1080,
    height: 1920,
    fileName: "anuncio.mp4",
    fileId: "file-1",
    cuts: [{ time: 4 }],
  },
  brand: { fontId: "geist", primary: "#EE4D2D", logo: "logo" },
  inserts: [
    {
      id: "t1",
      type: "texto-livre",
      kind: "text",
      start: 1,
      duration: 2,
      text: "OLHA",
      anchor: "center",
      animIn: "none",
      animOut: "none",
    },
  ],
  batch: { hooks: ["Corre"], fonts: ["geist"], positions: ["top"], baseName: "campanha" },
  output: { width: 1080, height: 1920, fps: 30, videoBitrate: 8_000_000 },
  captionPreset: "viral",
  watermarkEnabled: true,
  retention: { ganchoEnd: 2, ctaStart: 9 },
}

test("migrateV6toV7 preserva o projeto e cria o áudio padrão", () => {
  const next = migrateV6toV7(v6)
  assert.equal(next.version, 7)
  assert.deepEqual(next.audio, defaultCompositionAudio())
  assert.equal(next.source.fileId, "file-1")
  assert.equal(next.source.cuts?.[0]?.time, 4)
  assert.equal(next.inserts[0]?.text, "OLHA")
  assert.equal(next.batch.baseName, "campanha")
  assert.equal(next.watermarkEnabled, true)
  assert.deepEqual(next.retention, { ganchoEnd: 2, ctaStart: 9 })
  assert.equal(next.brand.logo, "logo")
})

test("parseComposition de um v6 abre com o mesmo som de antes", () => {
  const parsed = parseComposition(v6)
  assert.equal(parsed.version, 8)
  assert.equal(parsed.pricing, "off")
  assert.deepEqual(parsed.audio, defaultCompositionAudio())
  assert.equal(parsed.source.duration, 12.5)
  assert.equal(parsed.inserts[0]?.id, "t1")
  assert.equal(parsed.watermarkEnabled, true)
})

test("v6 completo vira v7 sem perder enquadramento, e migrar de novo não muda nada", () => {
  const fixture = {
    version: 6,
    source: {
      duration: 18,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "anuncio.mp4",
      fileId: "vid-1",
      transform: { scale: 1.28, x: 4, y: -2 },
      cuts: [{ time: 6.2, transform: { scale: 1.5, x: 0, y: 8 } }],
    },
    brand: { fontId: "bebas", primary: "#111111", logo: "logo" },
    inserts: [
      {
        id: "gancho",
        type: "texto-livre",
        kind: "text",
        start: 0.4,
        duration: 2,
        text: "OLHA",
        anchor: "center",
        animIn: "none",
        animOut: "none",
      },
    ],
    tracks: { cta: { styleRef: { presetId: "carrinhoLaranja", overrides: {} } } },
    retention: { ganchoEnd: 2.5, ctaStart: 14 },
    productData: { produto: "rasteira", preco: "39,90" },
    niche: "moda",
    projectSeed: "seed-42",
    watermarkEnabled: true,
    batch: { hooks: ["Corre"], fonts: ["bebas"], positions: ["bottom"], baseName: "campanha" },
  }
  const once = migrateV6toV7(fixture)
  assert.equal(once.version, 7)
  assert.deepEqual(once.audio, defaultCompositionAudio())
  const { version: _version, audio: _audio, ...migratedRest } = once
  const { version: _originalVersion, ...originalRest } = fixture
  assert.deepEqual(migratedRest, originalRest)
  assert.equal(once.source.transform?.scale, 1.28)
  assert.equal(once.source.cuts?.[0]?.transform?.scale, 1.5)
  assert.deepEqual(migrateV6toV7(once), once)
})

test("um v7 gravado sobrevive ao parse", () => {
  const audio = defaultCompositionAudio()
  audio.original = { volume: 0.2, muted: false }
  audio.tracks = [
    {
      id: "m1",
      kind: "music",
      fileId: "aud-1",
      fileName: "tema.mp3",
      duration: 30,
      start: 0,
      trimIn: 0,
      trimOut: 12.5,
      volume: 0.4,
      fadeIn: 0,
      fadeOut: 0.5,
      loop: true,
      muted: false,
    },
  ]
  const parsed = parseComposition({ ...v6, version: 7, audio })
  assert.equal(parsed.audio.original.volume, 0.2)
  assert.equal(parsed.audio.tracks[0]?.fileId, "aud-1")
  assert.equal(parsed.audio.tracks[0]?.loop, true)
  assert.equal(parsed.audio.ducking.amount, 0.65)
  const again = parseComposition(JSON.parse(JSON.stringify(parsed)) as Composition)
  assert.equal(again.audio.tracks[0]?.fadeOut, 0.5)
})
