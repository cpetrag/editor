import { normalizeWatermarkPrefs } from "../lib/watermark.ts"
import {
  defaultRenderProps,
  toCliRenderProps,
  type RenderProps,
} from "../remotion/types.ts"

export function parseRenderProps(raw: string | null): RenderProps {
  if (raw == null || raw.trim() === "") return defaultRenderProps

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("props.json inválido")
  }

  if (!isRenderProps(parsed)) {
    throw new Error("props.json inválido")
  }

  return sanitizeWatermark(parsed)
}

function sanitizeWatermark(value: RenderProps): RenderProps {
  if (!("watermark" in value) || value.watermark === undefined) return value
  const raw = value.watermark as unknown
  if (!raw || typeof raw !== "object") {
    const rest = { ...value }
    delete rest.watermark
    return rest
  }
  const record = raw as Record<string, unknown>
  if (typeof record.text !== "string" || typeof record.loop !== "boolean") {
    const rest = { ...value }
    delete rest.watermark
    return rest
  }
  if (!record.text.trim()) {
    const rest = { ...value }
    delete rest.watermark
    return rest
  }
  const visual = normalizeWatermarkPrefs(record)
  return {
    ...value,
    watermark: {
      text: visual.text,
      loop: visual.loop,
      opacityPct: visual.opacityPct,
      fontPx: visual.fontPx,
      speed: visual.speed,
    },
  }
}

function isRenderProps(value: unknown): value is RenderProps {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (!record.video || typeof record.video !== "object") return false
  const video = record.video as Record<string, unknown>
  if (typeof video.src !== "string") return false
  if (typeof video.durationInSeconds !== "number") return false
  if (!Array.isArray(record.inserts)) return false
  return true
}

export function mediaUrlForJob(origin: string, jobId: string): string {
  return `${origin.replace(/\/$/, "")}/media/${jobId}`
}

export function applyUploadedVideo(
  props: RenderProps,
  videoSrc: string | null,
): RenderProps {
  const safe = toCliRenderProps(props)
  if (!videoSrc) return safe
  if (!/^https?:\/\//i.test(videoSrc)) {
    throw new Error(`src do vídeo precisa ser http(s), recebeu ${videoSrc}`)
  }
  return {
    ...safe,
    video: {
      ...safe.video,
      src: videoSrc,
    },
  }
}
