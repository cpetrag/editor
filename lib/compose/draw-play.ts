import type { CaptionPreset, CaptionStyle, CompositionInsert } from "../composition.ts"
import { DEFAULT_CAPTION_STYLE } from "../composition.ts"
import { layoutInserts } from "../insert-layout.ts"
import { drawCaptionInserts, type PlayStyleContext } from "./draw-captions.ts"
import { drawChips } from "./draw-chips.ts"
import { drawOverlayInserts } from "./draw-overlays.ts"
import { PLAY_H, PLAY_W } from "./layout.ts"
import { extraPresetCatalog, setExtraPresets } from "../style/presets.ts"
import { drawWatermark, type WatermarkPaint } from "../watermark.ts"

export const PLAY_FRAME = { width: PLAY_W, height: PLAY_H }

export function drawPlayInserts(
  ctx: CanvasRenderingContext2D,
  inserts: CompositionInsert[],
  time: number,
  fontId: string,
  logoSrc: string,
  stickerImages: Map<string, HTMLImageElement>,
  getLogo: (src: string) => CanvasImageSource | null,
  captionPreset: CaptionPreset = "viral",
  captionStyle: CaptionStyle = DEFAULT_CAPTION_STYLE,
  styleContext?: PlayStyleContext,
  watermark?: WatermarkPaint | null,
): void {
  const previous = extraPresetCatalog()
  if (styleContext?.customPresets?.length) {
    setExtraPresets([
      ...Object.values(previous),
      ...styleContext.customPresets,
    ])
  }
  try {
    const chips = layoutInserts(inserts, time, PLAY_FRAME, fontId, logoSrc, styleContext)
    drawChips(
      ctx,
      chips,
      time,
      getLogo,
      styleContext?.fps && styleContext.fps > 0 ? styleContext.fps : 30,
    )
    drawOverlayInserts(ctx, inserts, time, PLAY_FRAME, fontId, stickerImages, styleContext)
    drawCaptionInserts(ctx, inserts, time, captionPreset, fontId, captionStyle, styleContext)
    drawWatermark(ctx, time, PLAY_FRAME, watermark)
  } finally {
    setExtraPresets(Object.values(previous))
  }
}
