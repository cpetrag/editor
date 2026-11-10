"use client"

import { useEffect, useRef } from "react"

export function AudioWaveform({
  peaks,
  color,
  dim = false,
}: {
  peaks: readonly number[]
  color: string
  dim?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!(width > 0) || !(height > 0) || peaks.length === 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = color
      ctx.globalAlpha = dim ? 0.45 : 0.9
      const mid = canvas.height / 2
      for (let x = 0; x < canvas.width; x += 1) {
        const index = Math.min(peaks.length - 1, Math.floor((x / canvas.width) * peaks.length))
        const amp = (peaks[index] ?? 0) * mid
        ctx.fillRect(x, mid - amp, 1, Math.max(1, amp * 2))
      }
    }
    draw()
    const observer = new ResizeObserver(() => draw())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [color, dim, peaks])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
}
