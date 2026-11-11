import type { Composition } from "../composition"
import { DEFAULT_CAPTION_STYLE, insertKind } from "../composition"
import { drawPlayInserts } from "../compose/draw-play"
import { PLAY_H } from "../compose/layout"
import { stickerMediaSrc } from "../compose/sticker-src"
import { coverDrawRect, overlayDrawScale } from "./cover"
import { sourceTransformAt } from "../source-segments.ts"
import type { WatermarkPaint } from "../watermark.ts"

export class CanvasTaintError extends Error {
  constructor() {
    super("O vídeo remoto bloqueou o canvas (CORS). Use um arquivo local.")
    this.name = "CanvasTaintError"
  }
}

const logoImages = new Map<string, HTMLImageElement>()

function getLogoImage(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined" || !src) return null
  let image = logoImages.get(src)
  if (!image) {
    image = new Image()
    image.src = src
    logoImages.set(src, image)
  }
  if (!image.complete || image.naturalWidth === 0) return null
  return image
}

export function preloadBrandLogo(src: string): Promise<void> {
  if (!src || typeof Image === "undefined") return Promise.resolve()
  const cached = logoImages.get(src)
  if (cached?.complete) return Promise.resolve()
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = src
    logoImages.set(src, image)
  })
}

const stickerImages = new Map<string, HTMLImageElement>()

function loadImage(src: string, cache: Map<string, HTMLImageElement>): HTMLImageElement | null {
  if (typeof Image === "undefined" || !src) return null
  let image = cache.get(src)
  if (!image) {
    image = new Image()
    image.src = src
    cache.set(src, image)
  }
  if (!image.complete || image.naturalWidth === 0) return null
  return image
}

export async function preloadStickerImages(
  composition: Composition,
  blobUrls: Record<string, string> = {},
): Promise<void> {
  if (typeof Image === "undefined") return
  const pending: Promise<void>[] = []
  for (const insert of composition.inserts) {
    if (insertKind(insert) !== "sticker") continue
    const src = stickerMediaSrc(insert, blobUrls)
    if (!src) continue
    if (stickerImages.get(src)?.complete) continue
    pending.push(
      new Promise((resolve) => {
        const image = new Image()
        image.onload = () => resolve()
        image.onerror = () => resolve()
        image.src = src
        stickerImages.set(src, image)
      }),
    )
  }
  await Promise.all(pending)
}

function stickerImageMap(
  composition: Composition,
  blobUrls: Record<string, string> = {},
): Map<string, HTMLImageElement> {
  const map = new Map<string, HTMLImageElement>()
  for (const insert of composition.inserts) {
    const src = stickerMediaSrc(insert, blobUrls)
    if (!src) continue
    const image = loadImage(src, stickerImages)
    if (image) map.set(insert.id, image)
  }
  return map
}

export function capExportSize(width: number, height: number): { width: number; height: number } {
  const maxW = 1080
  const maxH = 1920
  if (width <= maxW && height <= maxH) {
    return { width: Math.max(2, Math.round(width)), height: Math.max(2, Math.round(height)) }
  }
  const scale = Math.min(maxW / width, maxH / height)
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  }
}

export function resolveExportSize(composition: Composition): { width: number; height: number } {
  const output = composition.output
  return capExportSize(output.width, output.height)
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  transform?: Composition["source"]["transform"],
): void {
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, width, height)
  const rect = coverDrawRect(
    video.videoWidth || video.width,
    video.videoHeight || video.height,
    width,
    height,
    transform,
  )
  ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  composition: Composition,
  time: number,
  _fontFamily: string,
  blobUrls: Record<string, string> = {},
  scale?: number,
  watermark?: WatermarkPaint | null,
  /** Tempo do arquivo para o zoom, quando `time` já é o relógio da composição. */
  framingTime?: number,
  outputDuration?: number,
): void {
  const { width, height } = ctx.canvas
  try {
    drawVideoCover(ctx, video, width, height, sourceTransformAt(composition.source, framingTime ?? time))
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new CanvasTaintError()
    }
    throw error
  }

  const overlayScale = scale ?? overlayDrawScale(height, PLAY_H)
  ctx.save()
  ctx.scale(overlayScale, overlayScale)
  drawPlayInserts(
    ctx,
    composition.inserts,
    time,
    composition.brand.fontId,
    composition.brand.logo,
    stickerImageMap(composition, blobUrls),
    getLogoImage,
    composition.captionPreset ?? "viral",
    composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
    {
      fps: composition.output.fps || composition.source.fps,
      videoDuration: outputDuration && outputDuration > 0 ? outputDuration : composition.source.duration,
      project: composition.styleRef ? { styleRef: composition.styleRef } : {},
      tracks: composition.tracks,
      customPresets: composition.customPresets
        ? Object.values(composition.customPresets)
        : undefined,
      brandKitId: composition.brandKitId,
      brandColors: composition.brandColors,
    },
    watermark ?? null,
  )
  ctx.restore()
}
