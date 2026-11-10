import assert from "node:assert/strict"
import { test } from "node:test"

import { audioExportPhrase, audioSummary } from "./summary.ts"
import { defaultCompositionAudio, type AudioTrack, type CompositionAudio } from "./types.ts"

function track(kind: AudioTrack["kind"]): AudioTrack {
  return {
    id: kind,
    kind,
    fileId: kind,
    fileName: `${kind}.mp3`,
    duration: 30,
    start: 0,
    trimIn: 0,
    trimOut: 10,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: kind === "music",
    muted: false,
  }
}

function audio(patch: Partial<CompositionAudio> = {}): CompositionAudio {
  return { ...defaultCompositionAudio(), ...patch }
}

test("resumo padrão é só o original", () => {
  assert.equal(audioSummary(defaultCompositionAudio()), "original")
  assert.equal(audioExportPhrase(defaultCompositionAudio()), "com o áudio do vídeo")
})

test("resumo mostra volume e os tipos presentes", () => {
  const mixed = audio({
    original: { volume: 0.3, muted: false },
    tracks: [track("voice"), track("music")],
  })
  assert.equal(audioSummary(mixed), "original 30% · música · locução")
})

test("frase do export cobre os quatro mixes", () => {
  assert.equal(
    audioExportPhrase(
      audio({
        original: { volume: 0.38, muted: false },
        tracks: [track("voice"), track("music")],
      }),
    ),
    "com áudio do vídeo 38% + locução + música",
  )
  assert.equal(
    audioExportPhrase(
      audio({
        original: { volume: 1, muted: true },
        tracks: [track("music"), track("voice")],
      }),
    ),
    "com locução + música (original mudo)",
  )
  assert.equal(audioExportPhrase(audio({ original: { volume: 0.38, muted: false } })), "com o áudio do vídeo")
  assert.equal(audioExportPhrase(audio({ original: { volume: 0, muted: true } })), "sem som")
  assert.equal(audioSummary(audio({ original: { volume: 1, muted: true }, tracks: [track("music"), track("voice")] })), "original mudo · música · locução")
})
