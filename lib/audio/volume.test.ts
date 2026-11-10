import assert from "node:assert/strict"
import { test } from "node:test"

import type { AudioTrack, CompositionAudio } from "./types.ts"
import { defaultCompositionAudio } from "./types.ts"
import { duckAmountAt, volumeAtTime, type VolumeContext } from "./volume.ts"

function track(patch: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: "a",
    kind: "music",
    fileId: "f",
    fileName: "a.mp3",
    duration: 10,
    start: 0,
    trimIn: 0,
    trimOut: 10,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    muted: false,
    ...patch,
  }
}

function ctx(patch: Partial<VolumeContext> = {}): VolumeContext {
  return {
    videoDuration: 10,
    ducking: { enabled: false, amount: 0.65, fade: 0.5 },
    voiceRanges: [],
    ...patch,
  }
}

test("fades nas bordas vão de 0 ao volume e de volta a 0", () => {
  const music = track({ fadeIn: 1, fadeOut: 1 })
  const space = ctx()
  assert.equal(volumeAtTime(music, 0, space), 0)
  assert.ok(Math.abs(volumeAtTime(music, 0.5, space) - 0.5) < 1e-9)
  assert.equal(volumeAtTime(music, 1, space), 1)
  assert.equal(volumeAtTime(music, 5, space), 1)
  assert.ok(Math.abs(volumeAtTime(music, 9.5, space) - 0.5) < 1e-9)
  assert.equal(volumeAtTime(music, 10, space), 0)
  assert.equal(volumeAtTime(music, -0.1, space), 0)
})

test("mudo zera e volume acima de 1 passa como ganho", () => {
  const space = ctx()
  assert.equal(volumeAtTime(track({ muted: true, volume: 1.5 }), 3, space), 0)
  assert.equal(volumeAtTime(track({ volume: 0 }), 3, space), 0)
  assert.equal(volumeAtTime(track({ volume: 1.5 }), 3, space), 1.5)
})

test("loop continua depois do primeiro ciclo e cala no fim do vídeo", () => {
  const music = track({ duration: 4, trimOut: 2, loop: true, fadeIn: 0, fadeOut: 0 })
  const space = ctx({ videoDuration: 10 })
  assert.equal(volumeAtTime(music, 0.5, space), 1)
  assert.equal(volumeAtTime(music, 3.5, space), 1)
  assert.equal(volumeAtTime(music, 9.9, space), 1)
  assert.equal(volumeAtTime(music, 10, space), 0)
})

test("ducking abaixa a música na fala e rampa nas bordas", () => {
  const music = track()
  const ducking = { enabled: true, amount: 0.65, fade: 0.5 }
  const space = ctx({
    ducking,
    voiceRanges: [{ start: 2, end: 4 }],
  })
  assert.equal(volumeAtTime(music, 1, space), 1)
  assert.equal(volumeAtTime(music, 2, space), 1)
  assert.ok(Math.abs(volumeAtTime(music, 2.25, space) - (1 - 0.5 * 0.65)) < 1e-9)
  assert.ok(Math.abs(volumeAtTime(music, 3, space) - 0.35) < 1e-9)
  assert.ok(Math.abs(volumeAtTime(music, 3.75, space) - (1 - 0.5 * 0.65)) < 1e-9)
  assert.equal(volumeAtTime(music, 4, space), 1)
  assert.equal(duckAmountAt(3, space.voiceRanges, 0.5), 1)
  assert.equal(duckAmountAt(2.25, space.voiceRanges, 0), 1)
})

test("ducking não mexe em locução nem efeito", () => {
  const space = ctx({
    ducking: { enabled: true, amount: 0.65, fade: 0.25 },
    voiceRanges: [{ start: 0, end: 5 }],
  })
  assert.equal(volumeAtTime(track({ kind: "voice" }), 2, space), 1)
  assert.equal(volumeAtTime(track({ kind: "sfx" }), 2, space), 1)
})

test("ducking desligado deixa a música no volume dela", () => {
  const audio: CompositionAudio = defaultCompositionAudio()
  audio.ducking = { enabled: false, amount: 0.65, fade: 0.25 }
  const space = ctx({ ducking: audio.ducking, voiceRanges: [{ start: 0, end: 5 }] })
  assert.equal(volumeAtTime(track(), 2, space), 1)
})
