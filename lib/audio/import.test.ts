import assert from "node:assert/strict"
import { test } from "node:test"

import { audioAfterFileChoice } from "./place.ts"
import { defaultCompositionAudio } from "./types.ts"

const picked = {
  id: "track-1",
  fileId: "file-1",
  fileName: "fala.mp3",
  videoDuration: 15,
  voiceTaken: false,
  muteOriginal: false,
}

test("escolher arquivo cria a faixa com o tipo sugerido, sem um segundo passo", () => {
  const music = audioAfterFileChoice(defaultCompositionAudio(), {
    ...picked,
    fileName: "tema.mp3",
    duration: 40,
  })
  assert.equal(music.tracks.length, 1)
  assert.equal(music.tracks[0]?.kind, "music")
  assert.equal(music.tracks[0]?.loop, true)
  assert.equal(music.original.muted, false)

  const voice = audioAfterFileChoice(defaultCompositionAudio(), { ...picked, duration: 8 })
  assert.equal(voice.tracks.length, 1)
  assert.equal(voice.tracks[0]?.kind, "voice")
  assert.equal(voice.original.muted, false)
})

test("substituir áudio muta o original só junto com a faixa criada", () => {
  const next = audioAfterFileChoice(defaultCompositionAudio(), {
    ...picked,
    duration: 12,
    muteOriginal: true,
  })
  assert.equal(next.original.muted, true)
  assert.equal(next.tracks.length, 1)
  assert.equal(next.tracks[0]?.kind, "voice")
})

test("cancelar o seletor em Substituir áudio deixa o original audível", () => {
  const audio = defaultCompositionAudio()
  assert.equal(audio.original.muted, false)
  assert.deepEqual(audioAfterFileChoice(audio, null), audio)
  assert.equal(audioAfterFileChoice(audio, null).original.muted, false)
  assert.equal(audioAfterFileChoice(audio, null).tracks.length, 0)
})
