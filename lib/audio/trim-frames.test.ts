import assert from "node:assert/strict"
import { test } from "node:test"

import { clampTrack } from "./range.ts"
import type { AudioTrack } from "./types.ts"
import { audioTrimFrames } from "./trim-frames.ts"

function track(patch: Partial<AudioTrack>): AudioTrack {
  return {
    id: "a",
    kind: "music",
    fileId: "a",
    fileName: "a.mp3",
    duration: 4,
    start: 0,
    trimIn: 0,
    trimOut: 4,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    muted: false,
    ...patch,
  }
}

test("audioTrimFrames usa o frame final do arquivo, não o que foi cortado", () => {
  assert.deepEqual(audioTrimFrames({ duration: 4, trimIn: 1, trimOut: 3 }, 30), {
    trimBefore: 30,
    trimAfter: 90,
  })
  assert.deepEqual(audioTrimFrames({ duration: 4, trimIn: 0.5, trimOut: 3 }, 30), {
    trimBefore: 15,
    trimAfter: 90,
  })
  assert.deepEqual(audioTrimFrames({ duration: 20, trimIn: 0, trimOut: 14.9 }, 30), {
    trimBefore: undefined,
    trimAfter: 447,
  })
  assert.deepEqual(audioTrimFrames({ duration: 4, trimIn: 0, trimOut: 4 }, 30), {
    trimBefore: undefined,
    trimAfter: undefined,
  })
})

test("corte sem duração é inválido e o clamp abre uma janela que toca", () => {
  assert.equal(audioTrimFrames({ duration: 4, trimIn: 2, trimOut: 2 }, 30), null)
  const clamped = clampTrack(track({ trimIn: 2, trimOut: 2 }), 14.9)
  const frames = audioTrimFrames(clamped, 30)
  assert.ok(frames)
  const end = frames.trimAfter ?? Math.round(clamped.duration * 30)
  const start = frames.trimBefore ?? 0
  assert.ok(end >= start + 1)
})
