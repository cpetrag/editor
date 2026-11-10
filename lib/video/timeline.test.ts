import assert from "node:assert/strict"
import { test } from "node:test"

import { createDefaultComposition, parseComposition, serializeComposition } from "../composition.ts"
import { trackOutputRange } from "../audio/range.ts"
import type { AudioTrack } from "../audio/types.ts"
import type { CompositionInsert, CompositionSource } from "../composition.ts"
import { buildVideoTimeline, reverseRange, sourceTimeAtOutput } from "./timeline.ts"
import { suggestFit } from "./suggest.ts"
import { shiftLayoutForDuration } from "./duration.ts"

const FPS = 30

function source(patch: Partial<CompositionSource> = {}): CompositionSource {
  return {
    duration: 5.73,
    fps: FPS,
    width: 576,
    height: 1024,
    fileName: "clip.mp4",
    ...patch,
  }
}

function frames(seconds: number): number {
  return Math.round(seconds * FPS)
}

function assertNoGaps(segments: { outStart: number; outEnd: number }[], duration: number) {
  assert.ok(segments.length > 0)
  assert.equal(frames(segments[0]!.outStart), 0)
  for (let index = 0; index < segments.length - 1; index += 1) {
    assert.equal(frames(segments[index]!.outEnd), frames(segments[index + 1]!.outStart))
  }
  assert.equal(frames(segments[segments.length - 1]!.outEnd), frames(duration))
}

test("ping-pong 0,85× cobre 13,48 s sem buraco", () => {
  const timeline = buildVideoTimeline(
    source(),
    { speed: 0.85, fill: "pingpong", fit: "audio" },
    13.48,
  )
  assert.equal(timeline.segments.length, 2)
  const [forward, back] = timeline.segments
  assert.equal(forward?.kind, "fwd")
  assert.equal(back?.kind, "rev")
  assert.equal(forward?.speed, 0.85)
  assert.equal(back?.speed, 0.85)
  assert.ok(Math.abs((forward?.srcStart ?? 0) - 0) < 0.02)
  assert.ok(Math.abs((forward?.srcEnd ?? 0) - 5.73) < 0.02)
  assert.ok((back?.srcStart ?? 1) < (back?.srcEnd ?? 0) || Math.abs((back?.srcEnd ?? 0) - 5.73) < 0.02)
  assert.ok(Math.abs((back?.srcStart ?? 0) - 0) < 0.02)
  assert.ok(Math.abs((back?.srcEnd ?? 0) - 5.73) < 0.02)
  assert.ok(Math.abs((forward?.outEnd ?? 0) - 6.74) < 0.02)
  assert.equal(frames(timeline.duration), frames(13.48))
  assertNoGaps(timeline.segments, timeline.duration)
})

test("ping-pong com corte em 3,77 inverte a ordem dos trechos", () => {
  const timeline = buildVideoTimeline(
    source({ cuts: [{ time: 3.77 }] }),
    { speed: 0.85, fill: "pingpong", fit: "audio" },
    13.48,
  )
  const indexes = timeline.segments.map((segment) => segment.cutIndex)
  assert.deepEqual(indexes, [0, 1, 1, 0])
  assert.deepEqual(
    timeline.segments.map((segment) => segment.kind),
    ["fwd", "fwd", "rev", "rev"],
  )
  assertNoGaps(timeline.segments, timeline.duration)
})

test("loop a 1× repete e corta o último trecho", () => {
  const timeline = buildVideoTimeline(source(), { speed: 1, fill: "loop", fit: "manual" }, 13.48)
  assert.equal(timeline.segments.length, 3)
  assert.ok(timeline.segments.every((segment) => segment.kind === "fwd"))
  const last = timeline.segments[2]!
  assert.ok(Math.abs(last.outEnd - last.outStart - 2.02) < 0.05)
  assert.equal(frames(timeline.duration), frames(13.48))
  assertNoGaps(timeline.segments, timeline.duration)
})

test("freeze segura o último quadro até o alvo", () => {
  const timeline = buildVideoTimeline(source(), { speed: 1, fill: "freeze", fit: "manual" }, 13.48)
  assert.equal(timeline.segments.length, 2)
  assert.equal(timeline.segments[0]?.kind, "fwd")
  assert.equal(timeline.segments[1]?.kind, "freeze")
  assert.ok(Math.abs((timeline.segments[0]?.outEnd ?? 0) - 5.73) < 0.02)
  assert.equal(frames(timeline.duration), frames(13.48))
  assertNoGaps(timeline.segments, timeline.duration)
})

test("none com alvo menor corta um único trecho para a frente", () => {
  const timeline = buildVideoTimeline(source(), { speed: 1, fill: "none", fit: "manual" }, 3)
  assert.equal(timeline.segments.length, 1)
  assert.equal(timeline.segments[0]?.kind, "fwd")
  assert.equal(frames(timeline.duration), frames(3))
  assert.ok((timeline.segments[0]?.srcEnd ?? 0) < 5.73)
  assertNoGaps(timeline.segments, timeline.duration)
})

test("entrada e saída limitam a faixa útil", () => {
  const timeline = buildVideoTimeline(
    source({ duration: 8, trim: { start: 1, end: 4 } }),
    { speed: 1, fill: "none", fit: "video" },
    8,
  )
  assert.equal(timeline.segments.length, 1)
  assert.ok(Math.abs((timeline.segments[0]?.srcStart ?? 0) - 1) < 0.02)
  assert.ok(Math.abs((timeline.segments[0]?.srcEnd ?? 0) - 4) < 0.02)
  assert.equal(frames(timeline.duration), frames(3))
})

test("suggestFit escolhe ping-pong, velocidade, freeze ou corte", () => {
  const stretched = suggestFit(5.73, 13.48)
  assert.equal(stretched?.fill, "pingpong")
  assert.equal(stretched?.speed, 0.85)
  assert.equal(stretched?.fit, "audio")
  assert.match(stretched?.label ?? "", /0,85/)

  const slower = suggestFit(10, 11)
  assert.equal(slower?.fill, "none")
  assert.equal(slower?.speed, 0.91)
  assert.equal(slower?.fit, "audio")

  const hold = suggestFit(10, 10.6)
  assert.equal(hold?.fill, "freeze")
  assert.equal(hold?.speed, 1)

  const cut = suggestFit(2, 15)
  assert.equal(cut?.fill, "pingpong")
  assert.equal(cut?.speed, 1)

  assert.equal(suggestFit(10, 10), null)
  assert.equal(suggestFit(10, 9), null)
})

test("faixa invertida espelha o intervalo na duração útil", () => {
  assert.deepEqual(reverseRange(1, 4, 5.73), { start: 1.73, end: 4.73 })
  assert.deepEqual(reverseRange(0, 5.73, 5.73), { start: 0, end: 5.73 })
})

test("locução com fit áudio não é cortada e a música para na duração", () => {
  const voice: AudioTrack = {
    id: "voice",
    kind: "voice",
    fileId: "v",
    fileName: "ctanatura001.mp3",
    duration: 13.48,
    start: 0,
    trimIn: 0,
    trimOut: 13.48,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    muted: false,
  }
  const music: AudioTrack = {
    ...voice,
    id: "music",
    kind: "music",
    fileName: "bed.mp3",
    duration: 30,
    trimOut: 30,
    loop: false,
  }
  assert.equal(trackOutputRange(voice, 5.73, { fit: "audio" }).end, 13.48)
  assert.equal(trackOutputRange(music, 13.48, { fit: "audio" }).end, 13.48)
})

test("CTA acompanha o fim quando a duração cresce", () => {
  const insert: CompositionInsert = {
    id: "cta",
    type: "texto-livre",
    role: "cta",
    start: 4.5,
    duration: 1.2,
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
  }
  const shifted = shiftLayoutForDuration({
    previousDuration: 5.73,
    nextDuration: 13.48,
    retention: { ganchoEnd: 1.2, ctaStart: 4.5 },
    inserts: [insert, { ...insert, id: "hook", role: "gancho", start: 0.2, duration: 1 }],
  })
  assert.equal(shifted.retention?.ganchoEnd, 1.2)
  assert.ok(Math.abs((shifted.retention?.ctaStart ?? 0) - 12.25) < 0.001)
  const cta = shifted.inserts.find((item) => item.id === "cta")
  assert.ok(Math.abs((cta?.start ?? 0) - 12.25) < 0.001)
  assert.ok(Math.abs((cta?.start ?? 0) + (cta?.duration ?? 0) - 13.45) < 0.001)
  const hook = shifted.inserts.find((item) => item.id === "hook")
  assert.equal(hook?.start, 0.2)
})

test("migração v8 para v9 preserva transform, cortes, áudio e abre igual", () => {
  const current = createDefaultComposition()
  current.source.duration = 5.73
  current.source.transform = { scale: 1.03, x: 0, y: 0, space: "offset" }
  current.source.cuts = [{ time: 3.77, transform: { scale: 1.2, x: 1, y: 0, space: "offset" } }]
  current.source.trim = { start: 0.4, end: 5.2 }
  current.audio = {
    ...current.audio,
    tracks: [
      {
        id: "voice",
        kind: "voice",
        fileId: "voice-file",
        fileName: "ctanatura001.mp3",
        duration: 13.48,
        start: 0,
        trimIn: 0,
        trimOut: 13.48,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        muted: false,
      },
    ],
  }
  const stored = JSON.parse(serializeComposition(current)) as { version: number; source: { playback?: unknown } }
  stored.version = 8
  delete stored.source.playback
  const parsed = parseComposition(stored)
  assert.equal(parsed.version, 9)
  assert.equal(parsed.source.transform?.scale, 1.03)
  assert.equal(parsed.source.cuts?.[0]?.transform?.scale, 1.2)
  assert.equal(parsed.source.trim?.start, 0.4)
  assert.equal(parsed.source.trim?.end, 5.2)
  assert.equal(parsed.audio.tracks[0]?.trimOut, 13.48)
  assert.deepEqual(parsed.source.playback, { speed: 1, fill: "none", fit: "video" })
})

test("velocidade do trecho entra na ida", () => {
  const timeline = buildVideoTimeline(
    source({ cuts: [{ time: 3.77, speed: 1.5 }] }),
    { speed: 1, fill: "none", fit: "video" },
    10,
  )
  assert.equal(timeline.segments[0]?.speed, 1)
  assert.equal(timeline.segments[1]?.speed, 1.5)
})

test("tempo de saída no meio da volta cai no arquivo invertido", () => {
  const timeline = buildVideoTimeline(
    source(),
    { speed: 0.85, fill: "pingpong", fit: "audio" },
    13.48,
  )
  const back = timeline.segments[1]!
  const at = sourceTimeAtOutput(timeline.segments, (back.outStart + back.outEnd) / 2)
  assert.ok(at > 0 && at < 5.73)
})
