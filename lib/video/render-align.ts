import type { CompositionAudio } from "../audio/types.ts"
import { isIdentityPlayback } from "./playback.ts"
import { resolveOutputDuration } from "./duration.ts"
import { buildVideoTimeline, type VideoSegment } from "./timeline.ts"
import type { RenderProps } from "../../remotion/types.ts"

export type AlignedRender = {
  props: RenderProps
  /** Texto de uma linha para o log do job. */
  log: string
  needsReverse: boolean
}

function audioOf(props: RenderProps): CompositionAudio | undefined {
  if (!props.audio) return undefined
  return {
    original: props.audio.original,
    tracks: props.audio.tracks,
    ducking: props.audio.ducking,
  }
}

/**
 * A duração do MP4 é o fim da linha do tempo (a mesma do preview), não um
 * número solto que tenha chegado inchado no props.json.
 */
export function alignRenderTimeline(props: RenderProps): AlignedRender {
  const playback = props.video.playback
  const incoming = props.video.durationInSeconds
  if (!playback || isIdentityPlayback(playback)) {
    return {
      props,
      needsReverse: false,
      log: `duração ${incoming.toFixed(3)}s (vídeo original)`,
    }
  }
  const useful = props.video.usefulDuration
  const start = props.video.usefulStart ?? 0
  if (!(useful > 0)) {
    throw new Error("não foi possível gerar a volta")
  }
  const fps =
    props.video.sourceFps && props.video.sourceFps > 0
      ? props.video.sourceFps
      : props.fps > 0
        ? props.fps
        : 30
  const fileDuration =
    props.video.sourceDurationInSeconds && props.video.sourceDurationInSeconds > start + useful - 0.001
      ? props.video.sourceDurationInSeconds
      : start + useful
  const source = {
    duration: fileDuration,
    fps,
    ...(start > 0.001 ? { trim: { start, end: start + useful } } : {}),
    cuts: props.video.cuts,
    playback,
  }
  const duration = resolveOutputDuration(source, audioOf(props))
  const timeline = buildVideoTimeline(source, playback, duration)
  const segments: VideoSegment[] = timeline.segments
  const next: RenderProps = {
    ...props,
    video: {
      ...props.video,
      durationInSeconds: timeline.duration,
      segments,
    },
  }
  const summary = segments
    .map(
      (segment) =>
        `${segment.kind} ${segment.srcStart.toFixed(2)}-${segment.srcEnd.toFixed(2)} @${segment.speed} → ${segment.outStart.toFixed(2)}-${segment.outEnd.toFixed(2)}`,
    )
    .join(" | ")
  return {
    props: next,
    needsReverse: segments.some((segment) => segment.kind === "rev"),
    log: `duração recebida ${incoming.toFixed(3)}s calculada ${timeline.duration.toFixed(3)}s | ${summary}`,
  }
}
