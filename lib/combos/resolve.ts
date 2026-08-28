import { MIN_DURATION } from "../composition.ts"
import { retentionZones } from "../insert-ops.ts"
import type { ComboBeat, ComboTrack } from "./schema.ts"

export const COMBO_PREVIEW_DURATION = 15

export function comboVideoDuration(total: number): number {
  return total > 0 ? total : COMBO_PREVIEW_DURATION
}

export function resolveBeatTime(
  beat: ComboBeat,
  videoDuration: number,
): { start: number; duration: number } {
  const total = comboVideoDuration(videoDuration)
  const zone = retentionZones(total).find((item) => item.id === beat.track)
  if (!zone) throw new Error(`faixa de retenção desconhecida: ${beat.track}`)
  const span = Math.max(0, zone.to - zone.from)
  if (!(span > 0)) {
    return { start: zone.from, duration: MIN_DURATION }
  }
  const start = zone.from + beat.atPct * span
  const rawDuration = beat.durPct * span
  const maxDuration = Math.max(0, zone.to - start)
  const duration = Math.min(maxDuration, Math.max(Math.min(MIN_DURATION, span), rawDuration))
  return { start, duration }
}

export function comboThumbTime(track: ComboTrack, videoDuration: number): number {
  const total = comboVideoDuration(videoDuration)
  const zone = retentionZones(total).find((item) => item.id === track)
  if (!zone) return 0
  return zone.from + (zone.to - zone.from) * 0.2
}
