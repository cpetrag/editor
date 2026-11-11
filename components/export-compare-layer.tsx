"use client"

import { useEffect, useRef, useState } from "react"

import { drawPlayInserts } from "@/lib/compose/draw-play"
import { ensureComposeFontsReady, fontIdsUsedInComposition } from "@/lib/compose/fonts"
import { PLAY_H, PLAY_W } from "@/lib/compose/layout"
import { stickerMediaSrc } from "@/lib/compose/sticker-src"
import {
  DEFAULT_FPS,
  insertKind,
  type CaptionPreset,
  type CaptionStyle,
  type CompositionInsert,
  type StyleRef,
  type TrackId,
  type TrackStyle,
} from "@/lib/composition"
import type { UserPreset } from "@/lib/style/types"
import type { WatermarkPaint } from "@/lib/watermark"

export type ExportCompareMode = "off" | "half" | "diff"

export function ExportCompareLayer({
  mode,
  time,
  inserts,
  fontId,
  logoSrc,
  blobUrls,
  captionPreset,
  captionStyle,
  tracks,
  styleRef,
  productData,
  brandKitId,
  brandColors,
  videoDuration,
  customPresets,
  watermark,
  dodgeInserts = true,
}: {
  mode: ExportCompareMode
  time: number
  inserts: CompositionInsert[]
  fontId: string
  logoSrc: string
  blobUrls: Record<string, string>
  captionPreset: CaptionPreset
  captionStyle: CaptionStyle
  tracks?: Partial<Record<TrackId, TrackStyle>>
  styleRef?: StyleRef
  productData?: import("@/lib/content/runs").ProductData
  brandKitId?: string
  brandColors?: import("@/lib/brand/kits").BrandColors
  videoDuration: number
  customPresets?: UserPreset[]
  watermark?: WatermarkPaint | null
  dodgeInserts?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef(new Map<string, HTMLImageElement>())
  const logoRef = useRef<HTMLImageElement | null>(null)
  const [imageTick, setImageTick] = useState(0)
  const [diff, setDiff] = useState<PixelDiff | null>(null)

  useEffect(() => {
    for (const insert of inserts) {
      if (insertKind(insert) !== "sticker") continue
      const src = stickerMediaSrc(insert, blobUrls)
      if (!src || imagesRef.current.has(insert.id)) continue
      const image = new Image()
      image.onload = () => setImageTick((tick) => tick + 1)
      image.src = src
      imagesRef.current.set(insert.id, image)
    }
  }, [blobUrls, inserts])

  useEffect(() => {
    if (!logoSrc) {
      logoRef.current = null
      return
    }
    const image = new Image()
    image.onload = () => setImageTick((tick) => tick + 1)
    image.src = logoSrc
    logoRef.current = image
  }, [logoSrc])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || mode === "off") return
    canvas.width = PLAY_W
    canvas.height = PLAY_H
    let cancelled = false
    void (async () => {
      await ensureComposeFontsReady(
        fontIdsUsedInComposition({
          brand: { fontId },
          inserts,
          captionStyle,
          styleRef,
          tracks,
          customPresets: customPresets
            ? Object.fromEntries(customPresets.map((preset) => [preset.id, preset]))
            : undefined,
        }),
      )
      if (cancelled) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, PLAY_W, PLAY_H)
      drawPlayInserts(
        ctx,
        inserts,
        time,
        fontId,
        logoSrc,
        imagesRef.current,
        (src) => {
          if (src !== logoSrc) return null
          const logo = logoRef.current
          if (logo && logo.naturalWidth > 0) return logo
          return null
        },
        captionPreset,
        captionStyle,
        {
          fps: DEFAULT_FPS,
          videoDuration,
          project: styleRef ? { styleRef } : {},
          tracks,
          customPresets,
          productData,
          brandKitId,
          brandColors,
          dodgeInserts,
        },
        watermark ?? null,
      )
      if (cancelled) return
      const measure = () => {
        if (cancelled) return
        const preview = canvas.parentElement?.querySelector("[data-preview-stage] canvas")
        if (!(preview instanceof HTMLCanvasElement)) {
          setDiff(null)
          return
        }
        setDiff(differentPaintedPixels(preview, canvas))
      }
      measure()
      requestAnimationFrame(measure)
    })()
    return () => {
      cancelled = true
    }
  }, [
    blobUrls,
    brandColors,
    brandKitId,
    captionPreset,
    captionStyle,
    customPresets,
    dodgeInserts,
    fontId,
    imageTick,
    inserts,
    logoSrc,
    mode,
    styleRef,
    time,
    tracks,
    videoDuration,
    watermark,
  ])

  if (mode === "off") return null
  return (
    <>
    <canvas
      ref={canvasRef}
      width={PLAY_W}
      height={PLAY_H}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[13] h-full w-full"
      style={{
        opacity: mode === "half" ? 0.5 : 1,
        mixBlendMode: mode === "diff" ? "difference" : "normal",
      }}
    />
    {diff != null ? (
      <div
        className={`pointer-events-none absolute left-2 top-2 z-[14] rounded bg-black/75 px-2 py-1 font-mono text-[0.7rem] ${diff.different === 0 ? "text-green-400" : "text-white"}`}
      >
        {formatPixelDiff(diff)}
      </div>
    ) : null}
    </>
  )
}

type PixelDiff = { different: number; painted: number }

function differentPaintedPixels(preview: HTMLCanvasElement, exported: HTMLCanvasElement): PixelDiff | null {
  if (preview.width !== exported.width || preview.height !== exported.height || preview.width === 0) return null
  const previewCtx = preview.getContext("2d")
  const exportCtx = exported.getContext("2d")
  if (!previewCtx || !exportCtx) return null
  const a = previewCtx.getImageData(0, 0, preview.width, preview.height).data
  const b = exportCtx.getImageData(0, 0, exported.width, exported.height).data
  let different = 0
  let painted = 0
  for (let index = 0; index < a.length; index += 4) {
    const visible = (a[index + 3] ?? 0) > 0 || (b[index + 3] ?? 0) > 0
    if (!visible) continue
    painted += 1
    if (a[index] !== b[index] || a[index + 1] !== b[index + 1] || a[index + 2] !== b[index + 2] || a[index + 3] !== b[index + 3]) {
      different += 1
    }
  }
  return { different, painted }
}

function formatPixelDiff(diff: PixelDiff): string {
  if (diff.different === 0) return "Igual ao export"
  const percent = diff.painted === 0 ? 0 : (diff.different / diff.painted) * 100
  const percentLabel = percent.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })
  return `${diff.different.toLocaleString("pt-BR")} px diferentes (${percentLabel}%)`
}
