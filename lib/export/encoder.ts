import { Muxer, ArrayBufferTarget } from "../../vendor/mp4-muxer/build/mp4-muxer.mjs"

import type { Composition } from "../composition"
import { slug } from "../inserts"
import { CanvasTaintError, drawFrame, preloadBrandLogo, preloadStickerImages, resolveExportSize } from "./compositor"
import type { WatermarkPaint } from "../watermark.ts"
import { ensureComposeFontsReady, fontIdsUsedInComposition } from "../compose/fonts"
import { resolveTrimWindow, trimProgress } from "../source-trim.ts"
import { createDraftAudioMix } from "./draft-audio.ts"
import { draftFrameCount, draftPlan, draftSampleAt, type DraftPlan, type DraftSample } from "./draft-timeline.ts"
import { activeVoiceEnd } from "../video/duration.ts"
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
  audioUrls?: Record<string, string>
  /** Blob invertido já pronto (`<fileId>:rev`). */
  reverseUrl?: string | null
  /** Gera a volta se o IndexedDB ainda não tiver o blob. */
  ensureReverse?: () => Promise<string>
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

function openReverseVideo(url: string, signal: AbortSignal): Promise<HTMLVideoElement> {
  const video = document.createElement("video")
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup()
      reject(new DOMException("Export cancelado", "AbortError"))
    }
    const onReady = () => {
      cleanup()
      resolve(video)
    }
    const onError = () => {
      cleanup()
      reject(new Error("não foi possível abrir a volta"))
    }
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("error", onError)
      signal.removeEventListener("abort", onAbort)
    }
    signal.addEventListener("abort", onAbort)
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("error", onError)
  })
}

function audioClockOf(composition: Composition, plan: DraftPlan): number {
  if (composition.source.playback?.fit === "audio") {
    return Math.max(plan.duration, activeVoiceEnd(composition.audio))
  }
  return plan.duration
}

async function recordWithMediaRecorder(
  options: ExportOptions,
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  plan: DraftPlan,
  reverseVideo: HTMLVideoElement | null,
): Promise<ExportResult> {
  if (plan.stretched) return recordStretched(options, canvas, format, plan, reverseVideo)
  const { video, composition, fontFamily, signal, onProgress } = options
  const trimWindow = resolveTrimWindow(composition.source)
  const fps = outputFps(composition.output.fps)
  const finishHiddenWatch = watchTabHidden(signal)
  const canvasStream = canvas.captureStream(fps)
  const mix = createDraftAudioMix({
    video,
    composition,
    audioUrls: options.audioUrls ?? {},
  })
  let audioTracks: MediaStreamTrack[] = []
  if (mix) {
    audioTracks = mix.stream.getAudioTracks()
  } else {
    try {
      audioTracks = video.captureStream().getAudioTracks()
    } catch (error) {
      console.error("[editor] não foi possível capturar o áudio do vídeo", error)
    }
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

  await seekVideo(video, trimWindow.start, signal)
  const previousMuted = video.muted
  const previousVolume = video.volume
  video.muted = false
  if (!mix) video.volume = 0
  try {
    if (mix) await mix.start(trimWindow.start)
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
        mix?.tick(video.currentTime)
        onProgress({
          currentTime: video.currentTime,
          ratio: trimProgress(video.currentTime, trimWindow),
        })
        if (video.ended || video.currentTime >= trimWindow.end - 0.05) {
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
    mix?.close()
    video.pause()
    video.muted = previousMuted
    video.volume = previousVolume
  }
}

async function recordStretched(
  options: ExportOptions,
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  plan: DraftPlan,
  reverseVideo: HTMLVideoElement | null,
): Promise<ExportResult> {
  const { video, composition, fontFamily, signal, onProgress } = options
  const fps = outputFps(composition.output.fps)
  const finishHiddenWatch = watchTabHidden(signal)
  const canvasStream = canvas.captureStream(fps)
  const mix = createDraftAudioMix({
    video,
    composition,
    audioUrls: options.audioUrls ?? {},
    outputDuration: audioClockOf(composition, plan),
  })
  let audioTracks: MediaStreamTrack[] = []
  if (mix) audioTracks = mix.stream.getAudioTracks()
  const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
  const recorder = new MediaRecorder(mixed, {
    mimeType: format.mime,
    videoBitsPerSecond: composition.output.videoBitrate,
  })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(recorder.error ?? new Error("Falha no MediaRecorder"))
    recorder.onstop = () => resolve(new Blob(chunks, { type: blobTypeFromMime(format.mime) }))
  })

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D indisponível")
  const previousRate = video.playbackRate
  const previousMuted = video.muted
  const previousVolume = video.volume
  video.muted = false
  video.preservesPitch = true
  if (!mix) video.volume = 0
  if (reverseVideo) {
    reverseVideo.muted = true
    reverseVideo.preservesPitch = true
  }

  let shownKey = ""
  const align = (sample: DraftSample): HTMLVideoElement => {
    const el = sample.useReverse ? reverseVideo : video
    if (!el) throw new Error("A volta do ping-pong ainda não está pronta")
    const other = sample.useReverse ? video : reverseVideo
    if (other && other !== el && !other.paused) other.pause()
    if (sample.segment.kind !== "freeze") el.playbackRate = sample.segment.speed || 1
    el.preservesPitch = true
    const key = `${sample.segment.kind}:${sample.segment.outStart}`
    const drift = Math.abs(el.currentTime - sample.mediaTime)
    if (key !== shownKey || drift > 1.5 / fps) {
      if (key !== shownKey || drift > 0.02) el.currentTime = sample.mediaTime
    }
    shownKey = key
    if (sample.segment.kind === "freeze") {
      if (!el.paused) el.pause()
    } else if (el.paused) {
      void el.play().catch((error: unknown) => {
        console.error("[editor] falha ao tocar o trecho do rascunho", error)
      })
    }
    return el
  }

  const first = draftSampleAt(plan, 0)
  const firstEl = align(first)
  if (Math.abs(firstEl.currentTime - first.mediaTime) > 0.02) {
    firstEl.currentTime = first.mediaTime
    await waitForEvent(firstEl, "seeked", signal)
  }

  try {
    if (mix) await mix.start(0)
    if (first.segment.kind !== "freeze") await firstEl.play()
    recorder.start(100)
    const started = performance.now()
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        cleanup()
        video.pause()
        reverseVideo?.pause()
        if (recorder.state !== "inactive") recorder.stop()
        reject(new DOMException("Export cancelado", "AbortError"))
      }
      const draw = () => {
        if (signal.aborted) return
        const outputTime = (performance.now() - started) / 1000
        if (outputTime >= plan.duration) {
          cleanup()
          video.pause()
          reverseVideo?.pause()
          if (recorder.state !== "inactive") recorder.stop()
          resolve()
          return
        }
        try {
          const sample = draftSampleAt(plan, outputTime)
          const el = align(sample)
          drawFrame(
            ctx,
            el,
            composition,
            outputTime,
            fontFamily,
            options.stickerBlobUrls,
            undefined,
            options.watermark,
            sample.sourceTime,
            plan.duration,
          )
          mix?.tick(outputTime, sample.muteOriginal)
          onProgress({
            currentTime: outputTime,
            ratio: plan.duration > 0 ? Math.min(1, outputTime / plan.duration) : 1,
          })
        } catch (error) {
          cleanup()
          video.pause()
          reverseVideo?.pause()
          if (recorder.state !== "inactive") recorder.stop()
          reject(error)
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
    mix?.close()
    video.pause()
    reverseVideo?.pause()
    video.playbackRate = previousRate
    video.muted = previousMuted
    video.volume = previousVolume
  }
}

async function encodeWithWebCodecs(
  options: ExportOptions,
  canvas: HTMLCanvasElement,
  plan: DraftPlan,
  reverseVideo: HTMLVideoElement | null,
): Promise<ExportResult> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("Não foi possível gerar MP4 neste navegador. Use Chrome recente.")
  }

  const { video, composition, fontFamily, signal, onProgress } = options
  const trimWindow = resolveTrimWindow(composition.source)
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

  const frameTotal = plan.stretched ? draftFrameCount(plan.duration, fps) : 0
  let frameIndex = 0
  const steps = plan.stretched ? frameTotal : Math.ceil(trimWindow.duration / frameDuration)
  for (let index = 0; index < steps; index += 1) {
    throwIfAborted(signal)
    if (encoderError) throw encoderError
    const outputTime = plan.stretched ? index / fps : trimWindow.start + index * frameDuration
    const sample = plan.stretched ? draftSampleAt(plan, outputTime) : null
    const media = sample?.useReverse ? reverseVideo : video
    if (!media) throw new Error("A volta do ping-pong ainda não está pronta")
    const fileTime = sample ? sample.mediaTime : outputTime
    await seekVideo(media, fileTime, signal)
    const stamp = plan.stretched ? outputTime : index * frameDuration
    drawFrame(
      ctx,
      media,
      composition,
      plan.stretched ? outputTime : fileTime,
      fontFamily,
      options.stickerBlobUrls,
      undefined,
      options.watermark,
      sample?.sourceTime,
      plan.stretched ? plan.duration : undefined,
    )
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(stamp * 1_000_000),
      duration: Math.round(frameDuration * 1_000_000),
    })
    encoder.encode(frame, { keyFrame: frameIndex % Math.round(fps) === 0 })
    frame.close()
    frameIndex += 1
    onProgress({
      currentTime: plan.stretched ? outputTime : fileTime,
      ratio: plan.stretched
        ? (plan.duration > 0 ? Math.min(1, outputTime / plan.duration) : 1)
        : trimProgress(fileTime, trimWindow),
    })
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

  const plan = draftPlan(composition.source, composition.audio)
  let reverseVideo: HTMLVideoElement | null = null
  if (plan.needsReverse) {
    const url = options.reverseUrl || (options.ensureReverse ? await options.ensureReverse() : "")
    if (!url) throw new Error("A volta do ping-pong ainda não está pronta")
    reverseVideo = await openReverseVideo(url, options.signal)
  }

  const format = tryPickExportFormat()
  try {
    if (format) {
      return await recordWithMediaRecorder(options, canvas, format, plan, reverseVideo)
    }
    return await encodeWithWebCodecs(options, canvas, plan, reverseVideo)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    if (error instanceof CanvasTaintError) throw error
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new CanvasTaintError()
    }
    if (!format) throw error
    console.error("[editor] MediaRecorder falhou, tentando WebCodecs", error)
    return encodeWithWebCodecs(options, canvas, plan, reverseVideo)
  } finally {
    reverseVideo?.pause()
    if (reverseVideo) reverseVideo.src = ""
  }
}

export { fallbackDownload as triggerDownload } from "./save.ts"
