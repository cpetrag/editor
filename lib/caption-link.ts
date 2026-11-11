import type { AudioTrack } from "./audio/types.ts"
import type { CaptionLine } from "./captions.ts"
import { insertKind, type CompositionInsert } from "./composition.ts"

export type CaptionVoiceLink = {
  kind: "voice"
  trackId: string
  /** caption.start - track.start depois do último ajuste. */
  offset: number
}

function audibleEnd(track: Pick<AudioTrack, "start" | "trimIn" | "trimOut">): number {
  return track.start + Math.max(0, track.trimOut - track.trimIn)
}

function overlaps(start: number, end: number, windowStart: number, windowEnd: number): boolean {
  return start < windowEnd - 1e-3 && windowStart < end - 1e-3
}

export function linkCaptionsToVoice(
  inserts: CompositionInsert[],
  track: Pick<AudioTrack, "id" | "start">,
): CompositionInsert[] {
  return inserts.map((insert) => {
    if (insertKind(insert) !== "caption") return insert
    return {
      ...insert,
      captionSource: {
        kind: "voice",
        trackId: track.id,
        offset: insert.start - track.start,
      },
    }
  })
}

/**
 * Move e corte da locução deslocam as legendas vinculadas pelo mesmo delta.
 * O offset de cada linha guarda o deslocamento individual.
 * Linhas que saem do áudio são removidas.
 */
export function followVoiceCaptions(
  inserts: readonly CompositionInsert[],
  previous: readonly AudioTrack[],
  next: readonly AudioTrack[],
  outputDuration: number,
): { inserts: CompositionInsert[]; removed: number } {
  const before = new Map(previous.filter((track) => track.kind === "voice").map((track) => [track.id, track]))
  const after = new Map(next.filter((track) => track.kind === "voice").map((track) => [track.id, track]))
  let removed = 0
  const kept: CompositionInsert[] = []
  for (const insert of inserts) {
    const link = insert.captionSource
    if (insertKind(insert) !== "caption" || !link || link.kind !== "voice") {
      kept.push(insert)
      continue
    }
    const prev = before.get(link.trackId)
    const track = after.get(link.trackId)
    if (!prev || !track) {
      removed += 1
      continue
    }
    const delta = track.start - prev.start - (track.trimIn - prev.trimIn)
    const start = insert.start + delta
    const duration = insert.duration
    const end = start + duration
    if (outputDuration > 0 && (end <= 0.02 || start >= outputDuration - 0.02)) {
      removed += 1
      continue
    }
    if (!overlaps(start, end, track.start, audibleEnd(track))) {
      removed += 1
      continue
    }
    const words = (insert.words ?? []).map((word) => ({
      ...word,
      start: word.start + delta,
      end: word.end + delta,
    }))
    kept.push({
      ...insert,
      start,
      duration,
      text: words.length > 0 ? words.map((word) => word.text).join(" ") : insert.text,
      words,
      captionSource: {
        kind: "voice",
        trackId: track.id,
        offset: start - track.start,
      },
    })
  }
  return { inserts: kept, removed }
}

export function shiftCaptions(
  inserts: readonly CompositionInsert[],
  delta: number,
  outputDuration: number,
): CompositionInsert[] {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6) return [...inserts]
  return inserts.map((insert) => {
    if (insertKind(insert) !== "caption") return insert
    let start = insert.start + delta
    let duration = insert.duration
    if (outputDuration > 0) {
      if (start < 0) {
        duration += start
        start = 0
      }
      if (start + duration > outputDuration) duration = Math.max(0.05, outputDuration - start)
      start = Math.min(start, Math.max(0, outputDuration - 0.05))
    } else if (start < 0) {
      start = 0
    }
    const shift = start - insert.start
    return {
      ...insert,
      start,
      duration,
      words: (insert.words ?? []).map((word) => ({
        ...word,
        start: word.start + shift,
        end: word.end + shift,
      })),
      ...(insert.captionSource
        ? { captionSource: { ...insert.captionSource, offset: insert.captionSource.offset + shift } }
        : {}),
    }
  })
}

export function voiceLinkFromLines(
  lines: CaptionLine[],
  track: Pick<AudioTrack, "id" | "start">,
): Array<CaptionLine & { captionSource: CaptionVoiceLink }> {
  return lines.map((line) => ({
    ...line,
    captionSource: {
      kind: "voice" as const,
      trackId: track.id,
      offset: line.start - track.start,
    },
  }))
}
