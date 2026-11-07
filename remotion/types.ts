import {
  DEFAULT_BRAND_LOGO,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_FPS,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  type CaptionPreset,
  type CaptionStyle,
  type CaptionWord,
  type Composition,
  type CompositionInsert,
} from "../lib/composition.ts"
import { resolveTrimWindow } from "../lib/source-trim.ts"
import {
  normalizeWatermarkPrefs,
  watermarkPaintInput,
  type WatermarkPaint,
  type WatermarkPrefs,
} from "../lib/watermark.ts"

export type RenderInsert = CompositionInsert & {
  text: string
  startInSeconds: number
  endInSeconds: number
  style: Record<string, unknown>
  words?: CaptionWord[]
}

export type RenderProps = {
  video: {
    src: string
    durationInSeconds: number
    /** Segundos do arquivo pulados no início; o frame 0 do render mostra este instante. */
    trimStartInSeconds?: number
    /** Duração do arquivo inteiro: as zonas de trilha (gancho/prova/CTA) usam ela, como no preview. */
    sourceDurationInSeconds?: number
    width?: number
    height?: number
    transform?: Composition["source"]["transform"]
    /** Trechos com zoom próprio, em segundos do arquivo original. */
    cuts?: Composition["source"]["cuts"]
  }
  audio?: { src: string; volume: number }
  fps: number
  width: number
  height: number
  inserts: RenderInsert[]
  brand: { fontId: string; logo: string }
  captionPreset: CaptionPreset
  captionStyle: CaptionStyle
  stickerSrcs: Record<string, string>
  styleRef?: Composition["styleRef"]
  productData?: Composition["productData"]
  brandKitId?: Composition["brandKitId"]
  tracks?: Composition["tracks"]
  customPresets?: Composition["customPresets"]
  watermark?: WatermarkPaint
}

export function secondsFromFrame(frame: number, fps: number): number {
  if (!(fps > 0)) return 0
  return frame / fps
}

export function trimStartOf(props: Pick<RenderProps, "video">): number {
  const value = props.video.trimStartInSeconds
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

/** Instante do arquivo original exibido no frame atual do render. */
export function sourceTimeFromFrame(frame: number, props: Pick<RenderProps, "video" | "fps">): number {
  return secondsFromFrame(frame, props.fps) + trimStartOf(props)
}

export function calculateShortMetadata(props: RenderProps): {
  durationInFrames: number
  fps: number
  width: number
  height: number
} {
  const fps = props.fps > 0 ? props.fps : DEFAULT_FPS
  const duration = Math.max(0, props.video.durationInSeconds)
  return {
    durationInFrames: Math.max(1, Math.ceil(duration * fps)),
    fps,
    width: props.width > 0 ? props.width : DEFAULT_WIDTH,
    height: props.height > 0 ? props.height : DEFAULT_HEIGHT,
  }
}

export function isRenderSafeVideoSrc(src: string): boolean {
  const value = src.trim()
  if (!value) return false
  if (value.startsWith("blob:") || value.startsWith("data:")) return false
  if (/^https?:\/\//i.test(value)) return true
  if (value.startsWith("file:")) return false
  if (value.startsWith("/")) return true
  if (/^[a-zA-Z]:[\\/]/.test(value)) return true
  return false
}

export function toRenderInsert(insert: CompositionInsert): RenderInsert {
  return {
    ...insert,
    text: insert.text ?? "",
    startInSeconds: insert.start,
    endInSeconds: insert.start + insert.duration,
    style: { ...(insert.style ?? {}) },
  }
}

export function toCliRenderProps(props: RenderProps): RenderProps {
  const videoSrc = isRenderSafeVideoSrc(props.video.src) && !props.video.src.startsWith("/api/")
    ? props.video.src
    : ""
  const stickerSrcs: Record<string, string> = {}
  for (const [id, src] of Object.entries(props.stickerSrcs)) {
    if (isRenderSafeVideoSrc(src) && !src.startsWith("/api/")) {
      stickerSrcs[id] = src
    }
  }
  return {
    ...props,
    video: { ...props.video, src: videoSrc },
    stickerSrcs,
  }
}

export function toRenderProps(input: {
  composition: Composition
  videoSrc: string
  stickerSrcs?: Record<string, string>
  audio?: { src: string; volume: number }
  watermarkPrefs?: WatermarkPrefs
}): RenderProps {
  const { composition, videoSrc } = input
  const paint = watermarkPaintInput(
    composition.watermarkEnabled,
    normalizeWatermarkPrefs(input.watermarkPrefs ?? {}),
  )
  const trimWindow = resolveTrimWindow(composition.source)
  return {
    video: {
      src: videoSrc,
      durationInSeconds: trimWindow.duration,
      ...(trimWindow.start > 0 ? { trimStartInSeconds: trimWindow.start } : {}),
      ...(trimWindow.duration !== composition.source.duration
        ? { sourceDurationInSeconds: composition.source.duration }
        : {}),
      width: composition.source.width,
      height: composition.source.height,
      ...(composition.source.transform
        ? { transform: composition.source.transform }
        : {}),
      ...(composition.source.cuts && composition.source.cuts.length > 0
        ? { cuts: composition.source.cuts }
        : {}),
    },
    ...(input.audio ? { audio: input.audio } : {}),
    fps: composition.output.fps || composition.source.fps || DEFAULT_FPS,
    width: composition.output.width || DEFAULT_WIDTH,
    height: composition.output.height || DEFAULT_HEIGHT,
    inserts: composition.inserts.map(toRenderInsert),
    brand: {
      fontId: composition.brand.fontId,
      logo: composition.brand.logo,
    },
    captionPreset: composition.captionPreset,
    captionStyle: composition.captionStyle,
    stickerSrcs: { ...(input.stickerSrcs ?? {}) },
    ...(composition.styleRef ? { styleRef: composition.styleRef } : {}),
    ...(composition.productData ? { productData: composition.productData } : {}),
    ...(composition.brandKitId ? { brandKitId: composition.brandKitId } : {}),
    ...(composition.tracks ? { tracks: composition.tracks } : {}),
    ...(composition.customPresets ? { customPresets: composition.customPresets } : {}),
    ...(paint ? { watermark: paint } : {}),
  }
}

const DEMO_INSERTS: CompositionInsert[] = [
  {
    id: "demo-logo",
    type: "logo-shopee",
    start: 0.5,
    duration: 3,
    anchor: "top",
    animIn: "pop",
    animOut: "none",
  },
  {
    id: "demo-off",
    type: "alerta-desconto",
    start: 2,
    duration: 4,
    text: "50% OFF",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
  },
  {
    id: "demo-cta",
    type: "tarja-frete",
    start: 8,
    duration: 5,
    text: "FRETE GRÁTIS",
    anchor: "bottom",
    animIn: "slide-up",
    animOut: "none",
  },
]

export const defaultRenderProps: RenderProps = {
  video: { src: "", durationInSeconds: 18 },
  fps: DEFAULT_FPS,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  inserts: DEMO_INSERTS.map(toRenderInsert),
  brand: { fontId: "bebas", logo: DEFAULT_BRAND_LOGO },
  captionPreset: "viral",
  captionStyle: DEFAULT_CAPTION_STYLE,
  stickerSrcs: {},
}
