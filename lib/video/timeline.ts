import { resolveTrimWindow } from "../source-trim.ts"
import { segmentIndexAt, type SourceCut } from "../source-segments.ts"
import {
  clampPlaybackSpeed,
  type SourcePlayback,
} from "./playback.ts"

export interface TimelineSource {
  duration: number
  fps: number
  trim?: { start: number; end: number }
  cuts?: SourceCut[]
}

export interface VideoSegment {
  kind: "fwd" | "rev" | "freeze"
  /** Segundos no arquivo, sempre com srcStart < srcEnd. A direção está em `kind`. */
  srcStart: number
  srcEnd: number
  speed: number
  outStart: number
  outEnd: number
  cutIndex: number
}

interface Piece {
  cutIndex: number
  from: number
  to: number
  speed: number
}

function fpsOf(source: TimelineSource): number {
  return source.fps > 0 ? source.fps : 30
}

function pieceSpeed(source: TimelineSource, cutIndex: number, playback: SourcePlayback): number {
  if (cutIndex > 0) {
    const cut = source.cuts?.[cutIndex - 1] as (SourceCut & { speed?: number }) | undefined
    if (cut && typeof cut.speed === "number" && cut.speed > 0) return clampPlaybackSpeed(cut.speed)
  }
  return clampPlaybackSpeed(playback.speed)
}

function piecesOf(source: TimelineSource, playback: SourcePlayback): Piece[] {
  const fps = fpsOf(source)
  const window = resolveTrimWindow(source)
  const start = Math.round(window.start * fps)
  const end = Math.round(window.end * fps)
  if (!(end > start)) return []
  const cuts = (source.cuts ?? [])
    .map((cut) => Math.round(cut.time * fps))
    .filter((frame) => frame > start && frame < end)
    .sort((a, b) => a - b)
  const bounds = [start, ...cuts, end]
  const pieces: Piece[] = []
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const from = bounds[index]!
    const to = bounds[index + 1]!
    if (!(to > from)) continue
    const at = (from + 0.5) / fps
    const cutIndex = segmentIndexAt(source.cuts, at)
    pieces.push({ cutIndex, from, to, speed: pieceSpeed(source, cutIndex, playback) })
  }
  return pieces
}

function outputFrames(srcFrames: number, speed: number): number {
  if (!(srcFrames > 0)) return 0
  return Math.max(1, Math.round(srcFrames / speed))
}

function takePiece(piece: Piece, remaining: number): { src: number; out: number } {
  const available = piece.to - piece.from
  const full = outputFrames(available, piece.speed)
  if (full <= remaining) return { src: available, out: full }
  let src = Math.min(available, Math.max(1, Math.round(remaining * piece.speed)))
  let out = outputFrames(src, piece.speed)
  while (out > remaining && src > 1) {
    src -= 1
    out = outputFrames(src, piece.speed)
  }
  return { src, out: Math.min(out, remaining) }
}

function pushPiece(
  segments: VideoSegment[],
  piece: Piece,
  kind: VideoSegment["kind"],
  src: number,
  out: number,
  cursor: number,
  fps: number,
): number {
  const from = piece.from
  const to = piece.from + src
  segments.push({
    kind,
    srcStart: from / fps,
    srcEnd: to / fps,
    speed: piece.speed,
    outStart: cursor / fps,
    outEnd: (cursor + out) / fps,
    cutIndex: piece.cutIndex,
  })
  return cursor + out
}

/**
 * Linha do tempo de saída. Os tempos caem em frames inteiros (`frame / fps`),
 * sem buraco: o fim de um segmento é o início do próximo.
 *
 * `trimBefore` do Remotion 4.0.514 é em frames do arquivo (âncora). Depois
 * dela, cada frame da composição avança `playbackRate` frames do arquivo.
 * Por isso `srcStart` vira `trimBefore` e a duração do `<Sequence>` é a saída.
 */
export function buildVideoTimeline(
  source: TimelineSource,
  playback: SourcePlayback,
  targetDuration: number,
): { segments: VideoSegment[]; duration: number } {
  const fps = fpsOf(source)
  const forward = piecesOf(source, playback)
  if (forward.length === 0) return { segments: [], duration: 0 }
  const natural = forward.reduce((sum, piece) => sum + outputFrames(piece.to - piece.from, piece.speed), 0)
  const requested = Number.isFinite(targetDuration) ? Math.max(0, Math.round(targetDuration * fps)) : natural
  const fill = playback.fill
  const target = fill === "none" ? Math.min(natural, requested > 0 ? requested : natural) : Math.max(requested, 0)
  if (!(target > 0)) return { segments: [], duration: 0 }

  const segments: VideoSegment[] = []
  let cursor = 0
  let pass = 0
  while (cursor < target) {
    const reverse = fill === "pingpong" && pass % 2 === 1
    const pieces = reverse ? [...forward].reverse() : forward
    const kind: VideoSegment["kind"] = reverse ? "rev" : "fwd"
    for (const piece of pieces) {
      if (cursor >= target) break
      const taken = takePiece(piece, target - cursor)
      if (!(taken.out > 0) || !(taken.src > 0)) break
      const played = reverse
        ? { ...piece, from: piece.to - taken.src, to: piece.to }
        : piece
      const src = reverse ? taken.src : taken.src
      cursor = pushPiece(segments, played, kind, src, taken.out, cursor, fps)
    }
    pass += 1
    if (fill === "none" || fill === "freeze") break
    if (pass > 64) break
  }

  if (fill === "freeze" && cursor < target && forward.length > 0) {
    const last = forward[forward.length - 1]!
    const hold = Math.max(last.from, last.to - 1)
    segments.push({
      kind: "freeze",
      srcStart: hold / fps,
      srcEnd: last.to / fps,
      speed: 1,
      outStart: cursor / fps,
      outEnd: target / fps,
      cutIndex: last.cutIndex,
    })
    cursor = target
  }

  return { segments, duration: cursor / fps }
}

/**
 * Intervalo [a, b] no arquivo original vira [D - b, D - a] na cópia invertida
 * da faixa útil. `usefulStart` é a Entrada: a cópia começa nesse instante.
 */
export function reverseRange(
  start: number,
  end: number,
  usefulDuration: number,
  usefulStart = 0,
): { start: number; end: number } {
  const a = Math.min(start, end) - usefulStart
  const b = Math.max(start, end) - usefulStart
  const round = (value: number) => Math.round(Math.max(0, value) * 1000) / 1000
  return {
    start: round(usefulDuration - b),
    end: round(usefulDuration - a),
  }
}

export function sourceTimeAtOutput(segments: readonly VideoSegment[], outputTime: number): number {
  if (segments.length === 0) return 0
  const segment =
    segments.find((item, index) => {
      const last = index === segments.length - 1
      return outputTime >= item.outStart - 1e-6 && (outputTime < item.outEnd || last)
    }) ?? segments[0]!
  if (segment.kind === "freeze") return segment.srcEnd
  const span = segment.outEnd - segment.outStart
  const along = span > 0 ? Math.min(1, Math.max(0, (outputTime - segment.outStart) / span)) : 0
  const src = segment.srcEnd - segment.srcStart
  if (segment.kind === "rev") return segment.srcEnd - along * src
  return segment.srcStart + along * src
}

/** Onde um instante do arquivo cai na primeira ida. */
export function outputTimeForSource(segments: readonly VideoSegment[], sourceTime: number): number | null {
  const forward = segments.find(
    (segment) =>
      segment.kind === "fwd" &&
      sourceTime >= segment.srcStart - 1e-3 &&
      sourceTime <= segment.srcEnd + 1e-3,
  )
  if (!forward) return null
  const src = forward.srcEnd - forward.srcStart
  const along = src > 0 ? (sourceTime - forward.srcStart) / src : 0
  return forward.outStart + along * (forward.outEnd - forward.outStart)
}
