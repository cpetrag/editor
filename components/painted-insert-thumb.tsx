"use client"

import { useEffect, useRef, useState } from "react"

import { brandKitOf, type BrandColors } from "@/lib/brand/kits"
import { resolveStyleColors } from "@/lib/brand/resolve-style-colors"
import { ensureComposeFontsReady } from "@/lib/compose/fonts"
import { fillVars, type ProductData } from "@/lib/content/runs"
import { stillAnimation } from "@/lib/content/gallery"
import { selectPack } from "@/lib/motion/select"
import { paintInsertLayout, scalePaintStyle } from "@/lib/paint/draw"
import { layoutInsert, type MeasureFont } from "@/lib/paint/layout"
import { getPresetStyle } from "@/lib/style/presets"

const BACKDROP_TOP = "#6b5646"
const BACKDROP_BOTTOM = "#2a211b"
const backdropImages = new Map<string, HTMLImageElement>()

function backdropImage(src: string | null | undefined): HTMLImageElement | null {
  if (!src) return null
  const cached = backdropImages.get(src)
  if (cached?.complete && cached.naturalWidth > 0) return cached
  if (!cached) {
    const image = new Image()
    image.src = src
    backdropImages.set(src, image)
  }
  return null
}

export function PaintedInsertThumb({
  text,
  styleId,
  packId,
  kitId,
  colors,
  productData,
  animate = "hover",
  paintScale,
  maxTextWidth,
  aspect = "16/10",
  backdrop,
}: {
  text: string
  styleId: string
  packId?: string
  kitId: string
  colors?: BrandColors
  productData?: ProductData
  /** `hover` anima no foco. `loop` roda enquanto está na tela. */
  animate?: "hover" | "loop" | "still"
  /** `s` do protótipo. Sem isso, a miniatura mede a própria largura. */
  paintScale?: number
  maxTextWidth?: number
  aspect?: "16/10" | "4/3"
  backdrop?: string | null
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [ownWidth, setOwnWidth] = useState(0)
  const [photoTick, setPhotoTick] = useState(0)

  useEffect(() => {
    if (!backdrop) return
    const image = backdropImages.get(backdrop) ?? new Image()
    if (!backdropImages.has(backdrop)) {
      image.src = backdrop
      backdropImages.set(backdrop, image)
    }
    if (image.complete && image.naturalWidth > 0) return
    const done = () => setPhotoTick((tick) => tick + 1)
    image.addEventListener("load", done)
    return () => image.removeEventListener("load", done)
  }, [backdrop])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.15 },
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (paintScale != null) return
    const canvas = ref.current
    if (!canvas) return
    let last = 0
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0)
      if (last !== 0 && Math.abs(width - last) <= 4) return
      last = width
      setOwnWidth(width)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [paintScale])

  const width = paintScale != null ? 0 : ownWidth
  const scale = paintScale ?? (width > 0 ? (width / 1080) * 1.45 : 0)
  const textWidth = maxTextWidth ?? (width > 0 ? width * 0.9 : 0)
  const playing = visible && (reduced ? hover : animate === "loop" ? true : hover)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !(scale > 0) || !(textWidth > 0)) return
    let cancelled = false
    let raf = 0
    const base = getPresetStyle(styleId)
    const animation =
      !packId || packId === "parado" ? stillAnimation(base.animation) : selectPack(base.animation, packId)
    const fonts = [base.text.fontFamily, base.text.accentFont ?? ""].filter(Boolean)
    const started = performance.now()

    const paint = (now: number) => {
      if (cancelled || !ref.current) return
      const node = ref.current
      const cssW = node.clientWidth || 1
      const cssH = node.clientHeight || 1
      const dpr = window.devicePixelRatio || 1
      node.width = Math.max(1, Math.round(cssW * dpr))
      node.height = Math.max(1, Math.round(cssH * dpr))
      const ctx = node.getContext("2d")
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const wash = ctx.createLinearGradient(0, 0, cssW, cssH)
      wash.addColorStop(0, BACKDROP_TOP)
      wash.addColorStop(1, BACKDROP_BOTTOM)
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, cssW, cssH)
      const photo = backdropImage(backdrop)
      if (photo) ctx.drawImage(photo, 0, 0, cssW, cssH)
      const filled = fillVars(text, productData).text || " "
      const resolved = scalePaintStyle(
        resolveStyleColors({ ...base, animation, text: { ...base.text } }, colors ?? brandKitOf(kitId)),
        scale,
      )
      const measure = (sample: string, font: MeasureFont) => {
        const italic = font.italic ? "italic " : ""
        ctx.font = `${italic}${font.weight} ${font.size}px "${font.family}"`
        if ("letterSpacing" in ctx) {
          ctx.letterSpacing = font.letterSpacing ? `${font.letterSpacing * font.size}px` : "0px"
        }
        const width = ctx.measureText(sample).width
        // Fonte ainda não aplicada mede o espaço como 0 e cola "Seu texto aqui".
        if (!sample.trim()) return Math.max(width, font.size * 0.28)
        return width
      }
      const layout = layoutInsert(filled, resolved, textWidth, measure)
      const local = playing ? ((now - started) / 1000) % 2.8 : 1.2
      paintInsertLayout(ctx, layout, resolved, { cx: cssW / 2, cy: cssH / 2 }, {
        time: local,
        fps: 30,
        start: 0,
        duration: 2.8,
        seed: styleId,
        unitScale: scale,
      })
      if (playing) raf = requestAnimationFrame(paint)
    }

    void ensureComposeFontsReady(fonts).then(() => {
      if (cancelled) return
      raf = requestAnimationFrame(paint)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [animate, backdrop, colors, kitId, maxTextWidth, packId, paintScale, photoTick, playing, productData, scale, styleId, text, textWidth])

  return (
    <canvas
      ref={ref}
      className={aspect === "4/3" ? "aspect-[4/3] w-full" : "aspect-[16/10] w-full"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    />
  )
}
