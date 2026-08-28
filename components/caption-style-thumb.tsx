"use client"

import { useEffect, useRef } from "react"

import { drawResolvedInsertText } from "@/lib/compose/draw-insert-style"
import { ensureComposeFontsReady } from "@/lib/compose/fonts"
import { PLAY_H, PLAY_W } from "@/lib/compose/layout"
import { DEFAULT_FPS, type CompositionInsert } from "@/lib/composition"
import type { InsertStyle } from "@/lib/style/types"

const THUMB_W = 168
const THUMB_H = 88
const SAMPLE = "EXEMPLO"

function sampleInsert(): CompositionInsert {
  return {
    id: "caption-thumb",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 2,
    text: SAMPLE,
    words: [{ text: SAMPLE, start: 0, end: 2 }],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 50,
  }
}

export function CaptionStyleThumb({
  painted,
  className,
}: {
  painted: InsertStyle
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = THUMB_W
    canvas.height = THUMB_H
    let cancelled = false
    void (async () => {
      await ensureComposeFontsReady([painted.text.fontFamily, "geist"])
      if (cancelled) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, THUMB_W, THUMB_H)
      ctx.fillStyle = "#141414"
      ctx.fillRect(0, 0, THUMB_W, THUMB_H)
      ctx.save()
      const scale = THUMB_W / PLAY_W
      ctx.scale(scale, scale)
      const focusY = (painted.text.y / 100) * PLAY_H
      ctx.translate(0, THUMB_H / scale / 2 - focusY)
      drawResolvedInsertText(
        ctx,
        sampleInsert(),
        painted,
        0.45,
        { width: PLAY_W, height: PLAY_H },
        "geist",
        DEFAULT_FPS,
      )
      ctx.restore()
    })()
    return () => {
      cancelled = true
    }
  }, [painted])

  return (
    <canvas
      ref={canvasRef}
      width={THUMB_W}
      height={THUMB_H}
      className={className}
      aria-hidden
    />
  )
}
