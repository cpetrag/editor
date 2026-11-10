import assert from "node:assert/strict"
import { test } from "node:test"

import { defaultCompositionAudio, type AudioTrack } from "../audio/types.ts"
import { CAPCUT_AUDIO_OMISSION, capcutAudioPlan } from "./capcut-audio.ts"

function track(patch: Partial<AudioTrack> & Pick<AudioTrack, "id" | "kind">): AudioTrack {
  return {
    fileId: patch.id,
    fileName: `${patch.id}.mp3`,
    duration: 30,
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

test("capcutAudioPlan lista só faixas audíveis, com corte e volume", () => {
  const audio = defaultCompositionAudio()
  audio.tracks = [
    track({ id: "music", kind: "music", fileName: "trilha.mp3", volume: 0.35, loop: true, fadeOut: 0.5 }),
    track({ id: "quiet", kind: "sfx", muted: true }),
  ]
  const plan = capcutAudioPlan(audio)
  assert.deepEqual(plan.tracks, [
    {
      id: "music",
      fileName: "trilha.mp3",
      kind: "music",
      start: 0,
      trimIn: 0,
      trimOut: 10,
      volume: 0.35,
      loop: true,
    },
  ])
  assert.deepEqual(plan.omissions, [CAPCUT_AUDIO_OMISSION])
})

test("capcutAudioPlan sem fade nem ducking não avisa", () => {
  const audio = defaultCompositionAudio()
  audio.ducking = { ...audio.ducking, enabled: false }
  audio.tracks = [track({ id: "voice", kind: "voice" })]
  assert.deepEqual(capcutAudioPlan(audio).omissions, [])
})
