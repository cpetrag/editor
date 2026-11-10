import type { CompositionInsert } from "../composition.ts"
import {
  DEFAULT_FPS,
  DEFAULT_STICKER_SCALE,
  DEFAULT_STICKER_X,
  DEFAULT_STICKER_Y,
  insertKind,
} from "../composition.ts"
import { LEGADO_PRESET_ID } from "../style/presets.ts"
import { resolveInsertStyle } from "../style/resolve-insert-style.ts"
import { resolveStyle } from "../style/resolve-style.ts"
import { trackStyleForInsert } from "../style-preset.ts"
import { isTextPresetId } from "../text-presets/catalog.ts"
import { animAt, applyAnimPose } from "./anim.ts"
import { drawStyledText } from "./draw-text.ts"
import { drawResolvedInsertText } from "./draw-insert-style.ts"
import type { PlayStyleContext } from "./draw-captions.ts"

function isActive(insert: CompositionInsert, time: number): boolean {
  return time >= insert.start && time < insert.start + insert.duration
}

type Paintable = CanvasImageSource & {
  naturalWidth?: number
  naturalHeight?: number
  videoWidth?: number
  videoHeight?: number
  width?: number
  height?: number
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  frame: { width: number; height: number },
  image: Paintable,
  time: number,
): void {
  const naturalW = image.naturalWidth || image.videoWidth || image.width || 0
  const naturalH = image.naturalHeight || image.videoHeight || image.height || 0
  if (!(naturalW > 0 && naturalH > 0)) return
  const scale = insert.scale ?? DEFAULT_STICKER_SCALE
  const width = frame.width * scale
  const height = width * (naturalH / naturalW)
  const cx = ((insert.x ?? DEFAULT_STICKER_X) / 100) * frame.width
  const cy = ((insert.y ?? DEFAULT_STICKER_Y) / 100) * frame.height
  const left = cx - width / 2
  const top = cy - height / 2
  ctx.save()
  applyAnimPose(ctx, animAt(insert, time), { cx, cy, w: width, h: height })
  const rotation = insert.rotation ?? 0
  if (rotation) {
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  if (insert.type === "review-media") {
    const radius = Math.min(width, height) * 0.08
    traceRoundRect(ctx, left, top, width, height, radius)
    ctx.save()
    ctx.clip()
    ctx.drawImage(image, left, top, width, height)
    ctx.restore()
    ctx.lineWidth = Math.max(4, width * 0.035)
    ctx.strokeStyle = "#ffffff"
    traceRoundRect(ctx, left, top, width, height, radius)
    ctx.stroke()
    if (insert.label?.trim()) {
      ctx.font = `${Math.max(18, Math.round(frame.width * 0.028))}px sans-serif`
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.fillText(insert.label.trim(), cx, top + height + Math.max(22, frame.width * 0.03))
    }
  } else {
    ctx.drawImage(image, left, top, width, height)
  }
  ctx.restore()
}

export function drawOverlayInserts(
  ctx: CanvasRenderingContext2D,
  inserts: CompositionInsert[],
  time: number,
  frame: { width: number; height: number },
  brandFontId: string,
  stickerImages: Map<string, HTMLImageElement> = new Map(),
  styleContext?: PlayStyleContext,
): void {
  for (const insert of inserts) {
    if (!isActive(insert, time)) continue
    if (insertKind(insert) !== "sticker") continue
    const image = stickerImages.get(insert.id)
    if (!image) continue
    drawSticker(ctx, insert, frame, image, time)
  }
  for (const insert of inserts) {
    if (!isActive(insert, time)) continue
    if (insertKind(insert) !== "text") continue
    // Texto entra igual ao export. editPreview continua valendo só para a legenda.
    const duration = styleContext?.videoDuration ?? 0
    const track = trackStyleForInsert(insert, styleContext?.tracks, duration)
    const project = styleContext?.project ?? {}
    const ref = insert.styleRef ?? track?.styleRef ?? project.styleRef
    if (isTextPresetId(insert.preset) || insert.styleRef) {
      const painted = resolveInsertStyle(insert, {
        project,
        track,
        frameWidth: frame.width,
      })
      drawResolvedInsertText(
        ctx,
        insert,
        painted,
        time,
        frame,
        brandFontId,
        styleContext?.fps && styleContext.fps > 0 ? styleContext.fps : DEFAULT_FPS,
        false,
        styleContext,
      )
      continue
    }
    if (ref && ref.presetId !== LEGADO_PRESET_ID) {
      const painted = resolveStyle(insert, track, project)
      drawResolvedInsertText(
        ctx,
        insert,
        painted,
        time,
        frame,
        brandFontId,
        styleContext?.fps && styleContext.fps > 0 ? styleContext.fps : DEFAULT_FPS,
        false,
        styleContext,
      )
      continue
    }
    drawStyledText(ctx, insert, frame, brandFontId, time)
  }
}
