"use client"

import { useEffect, useRef } from "react"

import { BRAND_KITS } from "@/lib/brand/kits"
import { ensureComposeFontsReady } from "@/lib/compose/fonts"
import { paintMarkedInsert } from "@/lib/paint/draw"
import { sampleTextForPreset } from "@/components/insert-content"
import { OFFER_PRESET_IDS } from "@/lib/style/offer-styles"
import { getPresetStyle } from "@/lib/style/presets"

function CanvasCell({ presetId, kitId }: { presetId: string; kitId: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const style = getPresetStyle(presetId)
    const cssW = 280
    const cssH = 160
    void ensureComposeFontsReady([style.text.fontFamily, style.text.accentFont ?? ""].filter(Boolean)).then(() => {
      if (!ref.current) return
      ref.current.width = cssW
      ref.current.height = cssH
      const ctx = ref.current.getContext("2d")
      if (!ctx) return
      const scale = 0.22
      const logicalW = Math.round(cssW / scale)
      const logicalH = Math.round(cssH / scale)
      const off = document.createElement("canvas")
      off.width = logicalW
      off.height = logicalH
      const offCtx = off.getContext("2d")
      if (!offCtx) return
      const backdrop = offCtx.createLinearGradient(0, 0, logicalW, logicalH)
      backdrop.addColorStop(0, "#6b5646")
      backdrop.addColorStop(1, "#2a211b")
      offCtx.fillStyle = backdrop
      offCtx.fillRect(0, 0, logicalW, logicalH)
      paintMarkedInsert(offCtx, {
        text: sampleTextForPreset(presetId),
        style,
        maxWidth: logicalW * 0.9,
        measure: (text, font) => {
          const italic = font.italic ? "italic " : ""
          offCtx.font = `${italic}${font.weight} ${font.size}px "${font.family}"`
          return offCtx.measureText(text).width
        },
        origin: { cx: logicalW / 2, cy: logicalH / 2 },
        brandKitId: kitId,
        editPreview: false,
        productData: { preco: "R$ 49,90", preco_de: "R$ 89,90" },
      })
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.drawImage(off, 0, 0)
    })
  }, [kitId, presetId])
  return <canvas ref={ref} className="h-40 w-[280px]" />
}

export default function EstilosDevPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100">
      <h1 className="mb-4 text-lg font-semibold">Conferência dos 22 estilos</h1>
      {BRAND_KITS.map((kit) => (
        <section key={kit.id} className="mb-8">
          <h2 className="mb-2 text-sm">{kit.label}</h2>
          <div className="grid gap-3">
            {OFFER_PRESET_IDS.map((id) => (
              <div key={`${kit.id}-${id}`} data-style-row={id} data-kit={kit.id} className="flex flex-col gap-1">
                <p className="text-xs text-zinc-300">{id} · {kit.label}</p>
                <div className="flex gap-0">
                  <iframe
                    title={`${id} ${kit.id}`}
                    data-proto={id}
                    className="h-40 w-[280px] border-0"
                    src={`/prototipo-inserts-2.html?preset=${id}&kit=${kit.id}&text=${encodeURIComponent(sampleTextForPreset(id))}`}
                  />
                  <CanvasCell presetId={id} kitId={kit.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
