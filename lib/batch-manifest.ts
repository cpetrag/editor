import { audioExportPhrase } from "./audio/summary.ts"
import { defaultCompositionAudio, type AudioTrack, type CompositionAudio } from "./audio/types.ts"
import { tracksForRender } from "./audio/upload.ts"
import type { Composition } from "./composition.ts"
import { buildVariations, type BatchAxes, type Variation } from "./inserts.ts"

export type ManifestAudioTrack = {
  fileName: string
  kind: AudioTrack["kind"]
  start: number
  trimIn: number
  trimOut: number
  volume: number
  fadeIn: number
  fadeOut: number
  loop: boolean
  muted: boolean
}

/** A frase é a mesma do export Final. As faixas são só as que tocam. */
export function manifestAudio(audio: CompositionAudio | null | undefined) {
  const mix = audio ?? defaultCompositionAudio()
  return {
    summary: audioExportPhrase(mix),
    original: { volume: mix.original.volume, muted: mix.original.muted },
    ducking: {
      enabled: mix.ducking.enabled,
      amount: mix.ducking.amount,
      fade: mix.ducking.fade,
    },
    tracks: tracksForRender(mix).map(manifestTrack),
  }
}

function manifestTrack(track: AudioTrack): ManifestAudioTrack {
  return {
    fileName: track.fileName,
    kind: track.kind,
    start: track.start,
    trimIn: track.trimIn,
    trimOut: track.trimOut,
    volume: track.volume,
    fadeIn: track.fadeIn,
    fadeOut: track.fadeOut,
    loop: track.loop,
    muted: track.muted,
  }
}

export type BatchManifestOptions = {
  backgroundUrl?: string
  ext?: string
  variations?: readonly Variation[]
  customPresets?: unknown
  axes?: BatchAxes
}

export type BatchManifestSource = {
  batch: Composition["batch"]
  inserts: Composition["inserts"]
  audio?: CompositionAudio | null
}

export function buildManifest(composition: BatchManifestSource, options: BatchManifestOptions = {}) {
  const ext = options.ext ?? "mp4"
  const axes: BatchAxes = options.axes ?? {
    hooks: composition.batch.hooks,
    fonts: composition.batch.fonts,
    positions: composition.batch.positions,
  }
  const variations =
    options.variations ??
    buildVariations(composition.batch.baseName || "video", axes, ext)
  return {
    baseName: composition.batch.baseName,
    backgroundUrl: options.backgroundUrl ?? "",
    inserts: composition.inserts,
    axes,
    ext,
    total: variations.length,
    customPresets: options.customPresets ?? [],
    audio: manifestAudio(composition.audio),
    variations: variations.map((variation) => ({
      fileName: variation.fileName,
      hook: variation.hook,
      fontId: variation.fontId,
      position: variation.position,
    })),
  }
}
