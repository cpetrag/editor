import type { CompositionAudio } from "../audio/types.ts"
import { resolveTrimWindow } from "../source-trim.ts"
import { isIdentityPlayback, type SourcePlayback } from "../video/playback.ts"
import { resolveOutputDuration } from "../video/duration.ts"
import {
  buildVideoTimeline,
  reverseRange,
  sourceTimeAtOutput,
  type TimelineSource,
  type VideoSegment,
} from "../video/timeline.ts"

export interface DraftPlan {
  /** Projeto sem velocidade nem preenchimento: o rascunho continua no corte de hoje. */
  stretched: boolean
  duration: number
  fps: number
  segments: VideoSegment[]
  usefulStart: number
  usefulDuration: number
  needsReverse: boolean
}

export interface DraftSample {
  outputTime: number
  segment: VideoSegment
  /** Tempo no arquivo original, o mesmo que o preview usa para o zoom. */
  sourceTime: number
  /** Tempo no elemento que está na tela (original ou invertido). */
  mediaTime: number
  useReverse: boolean
  muteOriginal: boolean
}

export function draftFrameCount(duration: number, fps: number): number {
  const rate = fps > 0 ? fps : 30
  return Math.max(1, Math.round(duration * rate))
}

export function draftPlan(
  source: TimelineSource & { playback?: SourcePlayback },
  audio: CompositionAudio | undefined,
): DraftPlan {
  const fps = source.fps > 0 ? source.fps : 30
  const useful = resolveTrimWindow(source)
  const playback = source.playback
  if (isIdentityPlayback(playback) || !(useful.duration > 0)) {
    return {
      stretched: false,
      duration: useful.duration,
      fps,
      segments: [],
      usefulStart: useful.start,
      usefulDuration: useful.duration,
      needsReverse: false,
    }
  }
  const target = resolveOutputDuration(source, audio)
  const timeline = buildVideoTimeline(source, playback ?? { speed: 1, fill: "none", fit: "video" }, target)
  return {
    stretched: true,
    duration: timeline.duration,
    fps,
    segments: timeline.segments,
    usefulStart: useful.start,
    usefulDuration: useful.duration,
    needsReverse: timeline.segments.some((segment) => segment.kind === "rev"),
  }
}

/** O quadro que o rascunho deve gravar neste instante da composição. Igual ao preview. */
export function draftSampleAt(plan: DraftPlan, outputTime: number): DraftSample {
  const time = Math.min(Math.max(0, outputTime), Math.max(0, plan.duration))
  const sourceTime = sourceTimeAtOutput(plan.segments, time)
  const segment =
    plan.segments.find((item, index) => {
      const last = index === plan.segments.length - 1
      return time >= item.outStart - 1e-6 && (time < item.outEnd || last)
    }) ?? plan.segments[0]
  if (!segment) {
    return {
      outputTime: time,
      segment: {
        kind: "fwd",
        srcStart: 0,
        srcEnd: 0,
        speed: 1,
        outStart: 0,
        outEnd: 0,
        cutIndex: 0,
      },
      sourceTime,
      mediaTime: sourceTime,
      useReverse: false,
      muteOriginal: false,
    }
  }
  if (segment.kind === "freeze") {
    return {
      outputTime: time,
      segment,
      sourceTime: segment.srcStart,
      mediaTime: segment.srcStart,
      useReverse: false,
      muteOriginal: true,
    }
  }
  if (segment.kind === "rev") {
    const mapped = reverseRange(sourceTime, sourceTime, plan.usefulDuration, plan.usefulStart)
    return {
      outputTime: time,
      segment,
      sourceTime,
      mediaTime: mapped.start,
      useReverse: true,
      muteOriginal: true,
    }
  }
  return {
    outputTime: time,
    segment,
    sourceTime,
    mediaTime: sourceTime,
    useReverse: false,
    muteOriginal: false,
  }
}
