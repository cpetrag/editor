import assert from "node:assert/strict"
import { test } from "node:test"

import type { AudioTrack } from "./types.ts"
import { clampTrack, fileTimeAt, trackOutputRange, trimAudioInEdge, trimAudioOutEdge } from "./range.ts"

function track(patch: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: "a",
    kind: "music",
    fileId: "f",
    fileName: "a.mp3",
    duration: 120,
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

test("start + corte descreve o intervalo de saída", () => {
  assert.deepEqual(trackOutputRange(track({ start: 1, trimIn: 2, trimOut: 6 }), 20), {
    start: 1,
    end: 5,
  })
})

test("loop cobre até o fim do vídeo e o corte sem loop é clampado", () => {
  assert.deepEqual(trackOutputRange(track({ start: 1, trimOut: 3, loop: true }), 10), {
    start: 1,
    end: 10,
  })
  assert.deepEqual(trackOutputRange(track({ start: 8, trimIn: 0, trimOut: 5 }), 10), {
    start: 8,
    end: 10,
  })
  assert.deepEqual(trackOutputRange(track({ start: 12, trimOut: 4 }), 10), {
    start: 10,
    end: 10,
  })
})

test("clampTrack limita na duração e repara corte inválido", () => {
  const clamped = clampTrack(
    track({ start: -2, trimIn: 8, trimOut: 3, volume: 4, fadeIn: -1, muted: false }),
    15,
  )
  assert.equal(clamped.start, 0)
  assert.ok(clamped.trimOut > clamped.trimIn)
  assert.ok(clamped.trimOut <= clamped.duration)
  assert.equal(clamped.volume, 1.5)
  assert.equal(clamped.fadeIn, 0)

  const past = clampTrack(track({ start: 40, trimOut: 4 }), 15)
  assert.equal(past.start, 15)
  assert.deepEqual(trackOutputRange(past, 15), { start: 15, end: 15 })
})

test("alças de corte mantêm a outra borda", () => {
  const base = track({ start: 2, trimIn: 1, trimOut: 6, duration: 20 })
  const trimmedIn = trimAudioInEdge(base, 3, 20)
  assert.equal(trimmedIn.start, 3)
  assert.equal(trimmedIn.trimIn, 2)
  assert.equal(trimmedIn.trimOut, 6)
  const trimmedOut = trimAudioOutEdge(base, 5, 20)
  assert.equal(trimmedOut.start, 2)
  assert.equal(trimmedOut.trimOut, 4)
})

test("fileTimeAt avança no arquivo e dá a volta no loop", () => {
  const once = track({ start: 2, trimIn: 1, trimOut: 4 })
  assert.equal(fileTimeAt(once, 2, 20), 1)
  assert.equal(fileTimeAt(once, 3.5, 20), 2.5)
  assert.equal(fileTimeAt(once, 6, 20), null)
  const looped = track({ start: 0, trimIn: 1, trimOut: 3, loop: true })
  assert.ok(Math.abs((fileTimeAt(looped, 2.5, 10) ?? 0) - 1.5) < 1e-9)
})
