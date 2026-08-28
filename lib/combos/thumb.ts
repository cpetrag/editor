import { PLAY_H, PLAY_W } from "../compose/layout.ts"
import { drawPlayInserts } from "../compose/draw-play.ts"
import type { CompositionInsert } from "../composition.ts"
import { comboThumbTime } from "./resolve.ts"
import type { ComboTrack } from "./schema.ts"

export const COMBO_THUMB_W = 180
export const COMBO_THUMB_H = 320
export const COMBO_THUMB_CYCLE_MS = 900
export const COMBO_THUMB_TRACKS: ComboTrack[] = ["gancho", "prova", "cta"]

export function comboThumbCacheKey(
  comboId: string,
  videoId: string | undefined,
  track: ComboTrack,
): string {
  return `${comboId}:${videoId ?? "none"}:${track}`
}

export function fillNeutralStill(
  ctx: CanvasRenderingContext2D,
  width = COMBO_THUMB_W,
  height = COMBO_THUMB_H,
): void {
  ctx.fillStyle = "#18181b"
  ctx.fillRect(0, 0, width, height)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, "rgba(255,255,255,0.05)")
  gradient.addColorStop(1, "rgba(0,0,0,0.45)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

export function drawCoverFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; width?: number; height?: number },
  width = COMBO_THUMB_W,
  height = COMBO_THUMB_H,
): void {
  const sourceW = source.videoWidth || source.width || 0
  const sourceH = source.videoHeight || source.height || 0
  if (!(sourceW > 0 && sourceH > 0)) return
  const scale = Math.max(width / sourceW, height / sourceH)
  const drawW = sourceW * scale
  const drawH = sourceH * scale
  ctx.drawImage(source, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH)
}

export function drawComboOverlays(
  ctx: CanvasRenderingContext2D,
  inserts: CompositionInsert[],
  time: number,
  fontId: string,
): void {
  ctx.save()
  ctx.scale(COMBO_THUMB_W / PLAY_W, COMBO_THUMB_H / PLAY_H)
  drawPlayInserts(ctx, inserts, time, fontId, "", new Map(), () => null)
  ctx.restore()
}

export function comboTrackTime(track: ComboTrack, videoDuration: number): number {
  return comboThumbTime(track, videoDuration)
}
