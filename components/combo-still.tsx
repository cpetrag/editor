"use client"

import { useEffect, useRef, useState } from "react"

import { ensureComposeFontsReady, fontIdsForRender } from "@/lib/compose/fonts"
import { instantiateTemplate, type Template } from "@/lib/inserts"
import {
  COMBO_THUMB_CYCLE_MS,
  COMBO_THUMB_H,
  COMBO_THUMB_TRACKS,
  COMBO_THUMB_W,
  comboThumbCacheKey,
  comboTrackTime,
  drawComboOverlays,
  drawCoverFrame,
  fillNeutralStill,
} from "@/lib/combos/thumb"

const frameCache = new Map<string, string>()

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
    video.addEventListener("seeked", onSeeked)
    try {
      video.currentTime = Math.max(0, time)
    } catch {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
  })
}

async function videoFrameDataUrl(
  videoUrl: string,
  videoId: string,
  time: number,
): Promise<string | null> {
  const key = `video:${videoId}:${time.toFixed(2)}`
  const cached = frameCache.get(key)
  if (cached) return cached
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = videoUrl
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("video"))
    })
    await seekVideo(video, time)
    const canvas = document.createElement("canvas")
    canvas.width = COMBO_THUMB_W
    canvas.height = COMBO_THUMB_H
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    fillNeutralStill(ctx)
    drawCoverFrame(ctx, video)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72)
    frameCache.set(key, dataUrl)
    return dataUrl
  } catch {
    return null
  } finally {
    video.src = ""
  }
}

export function ComboStillPreview({
  template,
  fontId,
  videoUrl,
  videoId,
  videoDuration,
}: {
  template: Template
  fontId: string
  videoUrl?: string
  videoId?: string
  videoDuration: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const track = COMBO_THUMB_TRACKS[hover ? trackIndex : 0] ?? "gancho"

  useEffect(() => {
    if (!hover) {
      setTrackIndex(0)
      return
    }
    const timer = window.setInterval(() => {
      setTrackIndex((current) => (current + 1) % COMBO_THUMB_TRACKS.length)
    }, COMBO_THUMB_CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [hover])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let cancelled = false
    const time = comboTrackTime(track, videoDuration)
    const inserts = instantiateTemplate(template, videoDuration)
    const cacheKey = comboThumbCacheKey(template.id, videoId, track)

    void (async () => {
      await ensureComposeFontsReady(
        fontIdsForRender({
          brand: { fontId },
          inserts,
        }),
      )
      if (cancelled) return
      fillNeutralStill(ctx)
      if (videoUrl && videoId) {
        const frame = await videoFrameDataUrl(videoUrl, videoId, time)
        if (cancelled) return
        if (frame) {
          const image = new Image()
          await new Promise<void>((resolve) => {
            image.onload = () => resolve()
            image.onerror = () => resolve()
            image.src = frame
          })
          if (!cancelled) ctx.drawImage(image, 0, 0, COMBO_THUMB_W, COMBO_THUMB_H)
        }
      }
      if (cancelled) return
      drawComboOverlays(ctx, inserts, time, fontId)
      try {
        frameCache.set(cacheKey, canvas.toDataURL("image/jpeg", 0.72))
      } catch {
        // canvas tainted
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fontId, template, track, videoDuration, videoId, videoUrl])

  return (
    <canvas
      ref={canvasRef}
      width={COMBO_THUMB_W}
      height={COMBO_THUMB_H}
      aria-hidden
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="relative shrink-0 overflow-hidden rounded-sm bg-zinc-900 ring-1 ring-border"
      style={{ width: 90, height: 160 }}
    />
  )
}
