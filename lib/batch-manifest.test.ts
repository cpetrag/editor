import assert from "node:assert/strict"
import { test } from "node:test"

import { audioExportPhrase } from "./audio/summary.ts"
import { defaultCompositionAudio, type AudioTrack } from "./audio/types.ts"
import { buildManifest } from "./batch-manifest.ts"
import { createDefaultComposition } from "./composition.ts"
import { toRenderProps } from "../remotion/types.ts"

function track(patch: Partial<AudioTrack> & Pick<AudioTrack, "id" | "kind" | "muted">): AudioTrack {
  return {
    fileId: patch.id,
    fileName: `${patch.id}.mp3`,
    duration: 12,
    start: 0,
    trimIn: 0,
    trimOut: 8,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0.4,
    loop: patch.kind === "music",
    ...patch,
  }
}

test("buildManifest inclui só a faixa audível e a frase do export Final", () => {
  const composition = createDefaultComposition()
  composition.audio = {
    ...defaultCompositionAudio(),
    tracks: [
      track({ id: "music", kind: "music", fileName: "trilha.mp3", muted: false, volume: 0.4 }),
      track({ id: "voice", kind: "voice", fileName: "voz.mp3", muted: true }),
    ],
  }
  const manifest = buildManifest(composition)
  assert.equal(manifest.audio.tracks.length, 1)
  assert.equal(manifest.audio.tracks[0]?.fileName, "trilha.mp3")
  assert.equal(manifest.audio.summary, audioExportPhrase(composition.audio))
  assert.equal(manifest.audio.original.muted, false)
  assert.equal(manifest.audio.ducking.enabled, true)
})

test("cada variação do lote recebe o mesmo áudio nas props", () => {
  const composition = createDefaultComposition()
  composition.source = { ...composition.source, duration: 15 }
  composition.audio = {
    ...defaultCompositionAudio(),
    tracks: [
      track({ id: "music", kind: "music", fileName: "trilha.mp3", muted: false }),
      track({ id: "voice", kind: "voice", fileName: "voz.mp3", muted: true }),
    ],
  }
  const first = toRenderProps({
    composition: {
      ...composition,
      inserts: composition.inserts.map((insert) => ({ ...insert, text: "Gancho A" })),
      brand: { ...composition.brand, fontId: "geist" },
    },
    videoSrc: "",
    audioSrcs: { music: "blob:music", voice: "blob:voice" },
  })
  const second = toRenderProps({
    composition: {
      ...composition,
      inserts: composition.inserts.map((insert) => ({ ...insert, text: "Gancho B" })),
      brand: { ...composition.brand, fontId: "anton" },
    },
    videoSrc: "",
    audioSrcs: { music: "blob:music", voice: "blob:voice" },
  })
  assert.deepEqual(second.audio, first.audio)
  assert.equal(first.audio?.tracks.filter((item) => !item.muted && item.volume > 0).length, 1)
  assert.equal(first.audio?.tracks.find((item) => item.fileName === "trilha.mp3")?.src, "blob:music")
})
