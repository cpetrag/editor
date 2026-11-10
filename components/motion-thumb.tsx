"use client"

import { useEffect, useRef, useState } from "react"

import { motionAt } from "@/lib/motion/engine"
import { motionCss } from "@/lib/motion/css"
import type { Animation } from "@/lib/style/types"

const THUMB_FRAMES = 48

export function MotionThumb({
  animation,
  seed = 1,
}: {
  animation: Animation
  seed?: number
}) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const glyphRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [hover, setHover] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.2 },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const playing = reduced ? hover : visible

  useEffect(() => {
    const glyph = glyphRef.current
    if (!glyph) return
    if (!playing) {
      glyph.style.transform = ""
      glyph.style.opacity = "1"
      glyph.style.filter = ""
      glyph.style.clipPath = ""
      return
    }
    let frame = 0
    let raf = 0
    const spec = { animation, startFrame: 0, durationInFrames: THUMB_FRAMES }
    const draw = () => {
      const pose = motionAt(frame, 30, spec, 0, 1, seed)
      const css = motionCss(pose, { clipDir: animation.clipDir, origin: animation.origin, accent: "#FFD400" })
      glyph.style.transform = css.transform
      glyph.style.opacity = String(Math.max(0, Math.min(1, css.opacity)))
      glyph.style.filter = css.filter ?? ""
      glyph.style.clipPath = css.clipPath ?? ""
      glyph.style.transformOrigin = css.transformOrigin ?? "50% 50%"
      frame = (frame + 1) % THUMB_FRAMES
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [animation, playing, seed])

  return (
    <span
      ref={hostRef}
      className="flex h-10 w-full items-center justify-center overflow-hidden rounded bg-muted/70"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span ref={glyphRef} className="text-sm font-black leading-none text-foreground">
        Aa
      </span>
    </span>
  )
}
