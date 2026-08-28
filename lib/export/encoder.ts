import { Muxer, ArrayBufferTarget } from "../../vendor/mp4-muxer/build/mp4-muxer.mjs"

import type { Composition } from "../composition"
import { slug } from "../inserts"
import { CanvasTaintError, drawFrame, preloadBrandLogo, preloadStickerImages, resolveExportSize } from "./compositor"
import type { WatermarkPaint } from "../watermark.ts"
import { ensureComposeFontsReady, fontIdsUsedInComposition } from "../compose/fonts"
import {
  blobTypeFromMime,
  outputFps,
  tryPickExportFormat,
  type ExportFormat,
} from "./mime"

export interface ExportProgress {
  ratio: number
  currentTime: number
}

export interface ExportResult {
  blob: Blob
  fileName: string
  silent: boolean
  mime: string
  ext: "mp4" | "webm"
  backgrounded: boolean
}

export interface ExportOptions {
  video: HTMLVideoElement
  composition: Composition
  fontFamily: string
  signal: AbortSignal
  onProgress: (progress: ExportProgress) => void
  stickerBlobUrls?: Record<string, string>
  watermark?: WatermarkPaint | null
}

function waitForEvent(target: EventTarget, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup()
      reject(new DOMException("Export cancelado", "AbortError"))
    }
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const cleanup = () => {
      target.removeEventListener(event, onEvent)
      signal.removeEventListener("abort", onAbort)
    }
    signal.addEventListener("abort", onAbort)
    target.addEventListener(event, onEvent, { once: true })
  })
}

function downloadName(fileName: string, ext: "mp4" | "webm"): string {
  const base = slug(fileName.replace(/\.[^.]+$/, "")) || "video"
  return `${base}_export.${ext}`
}

async function seekVideo(video: HTMLVideoElement, time: number, signal: AbortSignal) {
  if (Math.abs(video.currentTime - time) < 0.04) return
  video.currentTime = time
  await waitForEvent(video, "seeked", signal)
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Export cancelado", "AbortError")
  }
}

function watchTabHidden(signal: AbortSignal): () => boolean {
  let hidden = false
  if (typeof document === "undefined") return () => hidden
  const onChange = () => {
    if (document.visibilityState === "hidden") hidden = true
  }
  document.addEventListener("visibilitychange", onChange)
  const stop = () => {
    document.removeEventListener("visibilitychange", onChange)
    return hidden
  }
  signal.addEventListener("abort", () => {
    document.removeEventListener("visibilitychange", onChange)
  })
  return stop
}

async function recordWithMediaRecorder(
  options: ExportOptions,
  canvas: HTMLCanvasElement,
  format: ExportFormat,
): Promise<ExportResult> {
  const { video, composition, fontFamily, signal, onProgress } = options
  const duration = composition.source.duration
  const fps = outputFps(composition.output.fps)
  const finishHiddenWatch = watchTabHidden(signal)
  const canvasStream = canvas.captureStream(fps)
  let audioTracks: MediaStreamTrack[] = []
  try {
    audioTracks = video.captureStream().getAudioTracks()
  } catch (error) {
    console.error("[editor] não foi possível capturar o áudio do vídeo", error)
  }
  const mixed = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ])
  const recorder = new MediaRecorder(mixed, {
    mimeType: format.mime,
    videoBitsPerSecond: composition.output.videoBitrate,
  })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => {
      reject(recorder.error ?? new Error("Falha no MediaRecorder"))
    }
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: blobTypeFromMime(format.mime) }))
    }
  })

  await seekVideo(video, 0, signal)
  const previousMuted = video.muted
  const previousVolume = video.volume
  video.muted = false
  video.volume = 0
  try {
    recorder.start(200)
    try {
      await video.play()
    } catch (error) {
      recorder.stop()
      mixed.getTracks().forEach((track) => track.stop())
      throw error
    }

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        cleanup()
        video.pause()
        if (recorder.state !== "inactive") recorder.stop()
        reject(new DOMException("Export cancelado", "AbortError"))
      }
      const draw = () => {
        if (signal.aborted) return
        try {
          const ctx = canvas.getContext("2d")
          if (!ctx) throw new Error("Canvas 2D indisponível")
          drawFrame(
            ctx,
            video,
            composition,
            video.currentTime,
            fontFamily,
            options.stickerBlobUrls,
            undefined,
            options.watermark,
          )
        } catch (error) {
          cleanup()
          video.pause()
          if (recorder.state !== "inactive") recorder.stop()
          reject(error)
          return
        }
        onProgress({
          currentTime: video.currentTime,
          ratio: Math.min(1, video.currentTime / Math.max(duration, 0.001)),
        })
        if (video.ended || video.currentTime >= duration - 0.05) {
          cleanup()
          video.pause()
          if (recorder.state !== "inactive") recorder.stop()
          resolve()
          return
        }
        raf = requestAnimationFrame(draw)
      }
      let raf = requestAnimationFrame(draw)
      const cleanup = () => {
        cancelAnimationFrame(raf)
        signal.removeEventListener("abort", onAbort)
      }
      signal.addEventListener("abort", onAbort)
    })

    const blob = await stopped
    mixed.getTracks().forEach((track) => track.stop())
    throwIfAborted(signal)
    return {
      blob,
      fileName: downloadName(composition.source.fileName, format.ext),
      silent: audioTracks.length === 0,
      mime: format.mime,
      ext: format.ext,
      backgrounded: finishHiddenWatch(),
    }
  } finally {
    video.pause()
    video.muted = previousMuted
    video.volume = previousVolume
  }
}

async function encodeWithWebCodecs(
  options: ExportOptions,
  canvas: HTMLCanvasElement,
): Promise<ExportResult> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("Não foi possível gerar MP4 neste navegador. Use Chrome recente.")
  }

  const { video, composition, fontFamily, signal, onProgress } = options
  const duration = composition.source.duration
  const fps = outputFps(composition.output.fps)
  const finishHiddenWatch = watchTabHidden(signal)
  const frameDuration = 1 / fps
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: canvas.width,
      height: canvas.height,
      frameRate: fps,
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  })

  let encoderError: unknown
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error
    },
  })
  encoder.configure({
    codec: "avc1.4d0032",
    width: canvas.width,
    height: canvas.height,
    bitrate: composition.output.videoBitrate,
    framerate: fps,
  })

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D indisponível")

  let frameIndex = 0
  for (let time = 0; time < duration; time += frameDuration) {
    throwIfAborted(signal)
    if (encoderError) throw encoderError
    await seekVideo(video, time, signal)
    drawFrame(ctx, video, composition, time, fontFamily, options.stickerBlobUrls, undefined, options.watermark)
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(time * 1_000_000),
      duration: Math.round(frameDuration * 1_000_000),
    })
    encoder.encode(frame, { keyFrame: frameIndex % Math.round(fps) === 0 })
    frame.close()
    frameIndex += 1
    onProgress({ currentTime: time, ratio: Math.min(1, time / duration) })
    while (encoder.encodeQueueSize > 4) {
      await new Promise((resolve) => setTimeout(resolve, 8))
    }
  }

  await encoder.flush()
  encoder.close()
  muxer.finalize()
  throwIfAborted(signal)

  return {
    blob: new Blob([target.buffer], { type: "video/mp4" }),
    fileName: downloadName(composition.source.fileName, "mp4"),
    silent: true,
    mime: "video/mp4",
    ext: "mp4",
    backgrounded: finishHiddenWatch(),
  }
}

export async function exportComposition(options: ExportOptions): Promise<ExportResult> {
  const { video, composition } = options
  if (!video.videoWidth || !composition.source.duration) {
    throw new Error("Aguarde o vídeo carregar")
  }

  const size = resolveExportSize(composition)
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height

  await preloadBrandLogo(composition.brand.logo)
  await ensureComposeFontsReady([
    ...fontIdsUsedInComposition(composition),
    ...(options.watermark?.text ? ["geist"] : []),
  ])
  await preloadStickerImages(composition, options.stickerBlobUrls)

  const format = tryPickExportFormat()
  try {
    if (format) {
      return await recordWithMediaRecorder(options, canvas, format)
    }
    const result = await encodeWithWebCodecs(options, canvas)
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    if (error instanceof CanvasTaintError) throw error
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new CanvasTaintError()
    }
    if (!format) throw error
    console.error("[editor] MediaRecorder falhou, tentando WebCodecs", error)
    return encodeWithWebCodecs(options, canvas)
  }
}

export { fallbackDownload as triggerDownload } from "./save.ts"
