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
      const dpr = window.devicePixelRatio || 1
      ref.current.width = Math.round(cssW * dpr)
      ref.current.height = Math.round(cssH * dpr)
      const ctx = ref.current.getContext("2d")
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const backdrop = ctx.createLinearGradient(0, 0, cssW, cssH)
      backdrop.addColorStop(0, "#6b5646")
      backdrop.addColorStop(1, "#2a211b")
      ctx.fillStyle = backdrop
      ctx.fillRect(0, 0, cssW, cssH)
      const scale = 0.22
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
      paintMarkedInsert(ctx, {
        text: sampleTextForPreset(presetId),
        style,
        maxWidth: (cssW / scale) * 0.9,
        measure: (text, font) => {
          const italic = font.italic ? "italic " : ""
          ctx.font = `${italic}${font.weight} ${font.size}px "${font.family}"`
          return ctx.measureText(text).width
        },
        origin: { cx: cssW / 2 / scale, cy: cssH / 2 / scale },
        brandKitId: kitId,
        editPreview: false,
        productData: { preco: "R$ 49,90", preco_de: "R$ 89,90" },
      })
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
              <div key={`${kit.id}-${id}`} className="grid grid-cols-2 gap-2">
                <iframe
                  title={`${id} ${kit.id}`}
                  className="h-40 w-[280px] border-0"
                  src={`/prototipo-inserts-2.html?preset=${id}&kit=${kit.id}`}
                />
                <CanvasCell presetId={id} kitId={kit.id} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
