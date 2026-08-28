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

function drawSticker(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  frame: { width: number; height: number },
  image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
  time: number,
): void {
  const naturalW = image.naturalWidth || image.width || 0
  const naturalH = image.naturalHeight || image.height || 0
  if (!(naturalW > 0 && naturalH > 0)) return
  const scale = insert.scale ?? DEFAULT_STICKER_SCALE
  const width = frame.width * scale
  const height = width * (naturalH / naturalW)
  const cx = ((insert.x ?? DEFAULT_STICKER_X) / 100) * frame.width
  const cy = ((insert.y ?? DEFAULT_STICKER_Y) / 100) * frame.height
  ctx.save()
  applyAnimPose(ctx, animAt(insert, time), { cx, cy, w: width, h: height })
  const rotation = insert.rotation ?? 0
  if (rotation) {
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height)
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
        styleContext?.editPreview === true,
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
        styleContext?.editPreview === true,
      )
      continue
    }
    drawStyledText(ctx, insert, frame, brandFontId, time)
  }
}
