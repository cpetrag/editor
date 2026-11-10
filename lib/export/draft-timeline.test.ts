import assert from "node:assert/strict"
import { test } from "node:test"

import type { AudioTrack, CompositionAudio } from "../audio/types.ts"
import { defaultCompositionAudio } from "../audio/types.ts"
import { sourceTimeAtOutput } from "../video/timeline.ts"
import { draftFrameCount, draftPlan, draftSampleAt } from "./draft-timeline.ts"

function voice(seconds: number): AudioTrack {
  return {
    id: "voice",
    kind: "voice",
    fileId: "ctanatura001",
    fileName: "ctanatura001.mp3",
    duration: seconds,
    start: 0,
    trimIn: 0,
    trimOut: seconds,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    muted: false,
  }
}

function audioWith(track: AudioTrack): CompositionAudio {
  return { ...defaultCompositionAudio(), tracks: [track] }
}

const whatsapp = {
  duration: 5.73,
  fps: 30,
  playback: { speed: 0.85, fill: "pingpong" as const, fit: "audio" as const },
}

test("rascunho do WhatsApp dura a locução, a 1 frame", () => {
  const plan = draftPlan(whatsapp, audioWith(voice(13.48)))
  assert.equal(plan.stretched, true)
  assert.equal(plan.needsReverse, true)
  const frames = draftFrameCount(plan.duration, plan.fps)
  const target = Math.round(13.48 * 30)
  assert.ok(Math.abs(frames - target) <= 1, `${frames} frames vs ${target}`)
  assert.ok(Math.abs(plan.duration - 13.48) < 1 / 30)
})

test("quadro em 7,5 s é a volta, no mesmo instante do preview", () => {
  const plan = draftPlan(whatsapp, audioWith(voice(13.48)))
  const sample = draftSampleAt(plan, 7.5)
  assert.equal(sample.useReverse, true)
  assert.equal(sample.muteOriginal, true)
  assert.equal(sample.segment.kind, "rev")
  const previewSource = sourceTimeAtOutput(plan.segments, 7.5)
  assert.ok(Math.abs(sample.sourceTime - previewSource) < 1e-6)
  assert.ok(sample.sourceTime > 0 && sample.sourceTime < 5.73)
  assert.ok(sample.mediaTime >= 0 && sample.mediaTime <= 5.73 + 1e-6)
})

test("projeto sem playback não estica o rascunho", () => {
  const plan = draftPlan({ duration: 5.73, fps: 30 }, audioWith(voice(13.48)))
  assert.equal(plan.stretched, false)
  assert.equal(plan.needsReverse, false)
  assert.ok(Math.abs(plan.duration - 5.73) < 0.02)
})
