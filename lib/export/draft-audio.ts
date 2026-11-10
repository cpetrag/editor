import { fileTimeAt } from "../audio/range.ts"
import { defaultCompositionAudio } from "../audio/types.ts"
import { tracksForRender } from "../audio/upload.ts"
import { volumeAtTime, volumeContextFor } from "../audio/volume.ts"
import type { Composition } from "../composition.ts"

export type DraftAudioMix = {
  stream: MediaStream
  start: (sourceTime: number) => Promise<void>
  /** `muteOriginal` cala o áudio do clipe nos trechos de volta e congelados. */
  tick: (sourceTime: number, muteOriginal?: boolean) => void
  close: () => void
}

type VideoGraph = {
  context: AudioContext
  gain: GainNode
}

const videoGraphs = new WeakMap<HTMLVideoElement, VideoGraph>()

function graphFor(video: HTMLVideoElement): VideoGraph | null {
  const existing = videoGraphs.get(video)
  if (existing) return existing
  if (typeof AudioContext === "undefined") return null
  try {
    const context = new AudioContext()
    const gain = context.createGain()
    const source = context.createMediaElementSource(video)
    source.connect(gain)
    const graph = { context, gain }
    videoGraphs.set(video, graph)
    return graph
  } catch (error) {
    console.error("[editor] não foi possível mixar o áudio do vídeo", error)
    return null
  }
}

export function createDraftAudioMix(input: {
  video: HTMLVideoElement
  composition: Composition
  audioUrls: Record<string, string>
  /** Relógio da composição. Sem isso, o mix corta no tamanho do arquivo. */
  outputDuration?: number
}): DraftAudioMix | null {
  const graph = graphFor(input.video)
  if (!graph) return null
  const destination = graph.context.createMediaStreamDestination()
  graph.gain.connect(destination)
  const audio = input.composition.audio ?? defaultCompositionAudio()
  const duration =
    input.outputDuration && input.outputDuration > 0
      ? input.outputDuration
      : input.composition.source.duration
  const volumeCtx = volumeContextFor(audio, duration)
  const extras: { id: string; element: HTMLAudioElement; gain: GainNode }[] = []
  for (const track of tracksForRender(audio)) {
    const url = input.audioUrls[track.fileId]
    if (!url) continue
    const element = new Audio(url)
    element.preload = "auto"
    // O loop do elemento volta ao início do arquivo e ignora o corte. O tick reposiciona. 
    element.loop = false
    try {
      const source = graph.context.createMediaElementSource(element)
      const gain = graph.context.createGain()
      source.connect(gain)
      gain.connect(destination)
      extras.push({ id: track.id, element, gain })
    } catch (error) {
      console.error("[editor] faixa de áudio fora do mix", error)
    }
  }

  const tick = (sourceTime: number, muteOriginal = false) => {
    const originalAudible = !muteOriginal && !audio.original.muted && audio.original.volume > 0
    graph.gain.gain.value = originalAudible ? audio.original.volume : 0
    for (const extra of extras) {
      const track = audio.tracks.find((item) => item.id === extra.id)
      if (!track) continue
      extra.gain.gain.value = volumeAtTime(track, sourceTime, volumeCtx)
      const expected = fileTimeAt(track, sourceTime, duration)
      if (expected === null) {
        if (!extra.element.paused) extra.element.pause()
        continue
      }
      if (extra.element.paused) {
        extra.element.currentTime = expected
        void extra.element.play().catch((error: unknown) => {
          console.error("[editor] falha ao tocar faixa no rascunho", error)
        })
      } else if (Math.abs(extra.element.currentTime - expected) > 0.18) {
        extra.element.currentTime = expected
      }
    }
  }

  return {
    stream: destination.stream,
    start: async (sourceTime: number) => {
      if (graph.context.state === "suspended") await graph.context.resume()
      input.video.muted = false
      input.video.volume = 1
      tick(sourceTime)
    },
    tick,
    close: () => {
      graph.gain.disconnect(destination)
      for (const extra of extras) {
        extra.element.pause()
        extra.gain.disconnect()
        extra.element.src = ""
      }
    },
  }
}
