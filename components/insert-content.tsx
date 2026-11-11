"use client"

import { useEffect, useRef, useState } from "react"

import { BRAND_KITS, type BrandColors, type CustomBrandKit } from "@/lib/brand/kits"
import {
  CONTENT_PRESETS,
  contentPresetsFor,
  type ContentNiche,
  type ContentSlot,
} from "@/lib/content/presets"
import { applyContentRecipe } from "@/lib/content/recipes"
import { PRODUCT_FIELDS, formatPrice, priceError, readingSeconds, type ProductData } from "@/lib/content/runs"
import { paintMarkedInsert } from "@/lib/paint/draw"
import { ensureComposeFontsReady } from "@/lib/compose/fonts"
import { getPresetStyle } from "@/lib/style/presets"
import { listOfferPresets } from "@/lib/style/offer-styles"
import type { CompositionInsert } from "@/lib/composition"
import { Button } from "@/components/ui/button"

const MOMENTS: Array<{ id: ContentSlot | "todos"; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "gancho", label: "Gancho" },
  { id: "prova", label: "Prova" },
  { id: "oferta", label: "Oferta" },
  { id: "cta", label: "CTA" },
]

const NICHES: Array<{ id: ContentNiche; label: string }> = [
  { id: "shopee", label: "Geral" },
  { id: "moda", label: "Moda" },
  { id: "beleza", label: "Beleza" },
  { id: "bebe", label: "Bebê" },
]

const FIELD_LABELS: Record<string, { label: string; placeholder: string }> = {
  produto: { label: "Produto", placeholder: "calça flare" },
  preco: { label: "Preço", placeholder: "49,90" },
  preco_de: { label: "Preço de", placeholder: "89,90" },
  desconto: { label: "Desconto %", placeholder: "44" },
  cupom: { label: "Cupom", placeholder: "FLARE10" },
  nota: { label: "Nota", placeholder: "4,9" },
  vendidos: { label: "Vendidos", placeholder: "12 mil" },
  tamanhos: { label: "Tamanhos", placeholder: "36 ao 48" },
  qtd: { label: "Quantidade", placeholder: "60" },
}

export function ReadingMeter({ text, duration }: { text: string; duration: number }) {
  const needed = readingSeconds(text)
  const ratio = duration > 0 ? needed / duration : 1
  const hot = ratio > 0.9
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={hot ? "h-full bg-amber-500" : "h-full bg-emerald-500"}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <p className={`text-[0.7rem] ${hot ? "text-amber-700" : "text-muted-foreground"}`}>
        {needed.toFixed(1).replace(".", ",")} s de leitura
        {hot ? " · aumente o clipe ou corte texto" : ""}
      </p>
    </div>
  )
}

export function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRODUCT_FIELDS.map((field) => (
        <button
          key={field}
          type="button"
          className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-foreground"
          onClick={() => onInsert(`{${field}}`)}
        >
          {`{${field}}`}
        </button>
      ))}
    </div>
  )
}

export function ProductDataFields({
  data,
  niche,
  onChange,
  onNiche,
  markEmpty = false,
  hideNiche = false,
  pricing = "off",
  emptyDash = false,
}: {
  data: ProductData
  niche: ContentNiche
  onChange: (data: ProductData) => void
  onNiche: (niche: ContentNiche) => void
  markEmpty?: boolean
  hideNiche?: boolean
  pricing?: "off" | "on"
  emptyDash?: boolean
}) {
  const [showPrice, setShowPrice] = useState(false)
  const priceFields = new Set(["preco", "preco_de", "desconto", "cupom"])
  return (
    <div className="flex flex-col gap-2">
      {hideNiche ? null : (
      <label className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
        Nicho
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          value={niche}
          onChange={(event) => onNiche(event.target.value as ContentNiche)}
        >
          {NICHES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      )}
      {pricing === "off" && !showPrice ? (
        <button type="button" className="text-left text-[0.7rem] text-muted-foreground underline" onClick={() => setShowPrice(true)}>
          Mostrar campos de preço
        </button>
      ) : null}
      {PRODUCT_FIELDS.filter((field) => pricing === "on" || showPrice || !priceFields.has(field)).map((field) => {
        const meta = FIELD_LABELS[field]
        const invalid = (field === "preco" || field === "preco_de") ? priceError(data[field] ?? "") : null
        const empty = markEmpty && !(data[field] ?? "").trim()
        return (
          <label key={field} className="flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
            {meta?.label ?? field}
            <input
              className={`h-8 rounded-md border bg-background px-2 text-sm text-foreground ${invalid ? "border-red-500" : empty ? "border-amber-400 bg-amber-50" : "border-border"}`}
              placeholder={emptyDash && !(data[field] ?? "").trim() ? "—" : meta?.placeholder}
              value={data[field] ?? ""}
              onChange={(event) => onChange({ ...data, [field]: event.target.value })}
              onBlur={(event) => {
                if (field !== "preco" && field !== "preco_de") return
                if (priceError(event.target.value)) return
                const formatted = formatPrice(event.target.value)
                if (formatted) onChange({ ...data, [field]: formatted })
              }}
            />
            {invalid ? <span className="text-red-600">{invalid}</span> : null}
          </label>
        )
      })}
    </div>
  )
}

export function BrandKitPicker({
  kitId,
  customKits = [],
  onChange,
}: {
  kitId: string
  customKits?: readonly CustomBrandKit[]
  onChange: (id: string) => void
}) {
  const kits = [...BRAND_KITS, ...customKits]
  return (
    <div className="flex flex-wrap gap-1">
      {kits.map((kit) => (
        <button
          key={kit.id}
          type="button"
          aria-pressed={kit.id === kitId}
          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem] ${kit.id === kitId ? "border-foreground" : "border-border"}`}
          onClick={() => onChange(kit.id)}
        >
          {[kit.primary, kit.onPrimary, kit.accent, kit.ink].map((color, index) => (
            <span key={`${kit.id}-${index}`} className="size-2.5 rounded-full border border-black/10" style={{ background: color }} />
          ))}
          {kit.label}
        </button>
      ))}
    </div>
  )
}

function MarkedLine({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g)
  return (
    <p className="text-sm text-foreground">
      {parts.map((part, index) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <span key={index} className="text-[#EE4D2D]">{part.slice(1, -1)}</span>
        ) : (
          <span key={index}>{part.replace(/~~/g, "")}</span>
        ),
      )}
    </p>
  )
}

export function ContentRecipeList({
  insert,
  niche,
  moment,
  productData,
  onMoment,
  onNiche,
  onChange,
}: {
  insert: CompositionInsert
  niche: ContentNiche
  moment: ContentSlot | "todos"
  productData?: ProductData
  onMoment: (moment: ContentSlot | "todos") => void
  onNiche: (niche: ContentNiche) => void
  onChange: (patch: Partial<CompositionInsert>) => void
}) {
  const rows = CONTENT_PRESETS.filter((preset) => {
    if (moment !== "todos" && preset.slot !== moment) return false
    if (preset.niche !== niche) return false
    return true
  })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {MOMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-full px-2 py-0.5 text-[0.65rem] ${item.id === moment ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
            onClick={() => onMoment(item.id)}
          >
            {item.label}
          </button>
        ))}
        <select
          className="h-6 rounded-full border border-border bg-background px-2 text-[0.65rem]"
          value={niche}
          onChange={(event) => onNiche(event.target.value as ContentNiche)}
        >
          {NICHES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <p className="text-[0.65rem] text-muted-foreground">*destaque* · ~~riscado~~ · \* e \~ escapam</p>
      {rows.map((preset) => (
        <article key={preset.id} className="rounded-md border border-border p-2">
          <MarkedLine text={preset.text} />
          <p className="text-[0.65rem] text-muted-foreground">{preset.style} · {preset.pack} · {preset.y}</p>
          {preset.claim ? (
            <p className="text-[0.65rem] text-amber-700">afirmação sobre o produto · confirme antes de anunciar</p>
          ) : null}
          <div className="mt-1 flex gap-1">
            <Button type="button" size="xs" variant="outline" onClick={() => onChange({ text: preset.text, contentId: preset.id })}>
              Usar texto
            </Button>
            <Button type="button" size="xs" onClick={() => onChange(applyContentRecipe(insert, preset))}>
              Aplicar receita
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

export function sampleTextForPreset(presetId: string): string {
  const style = getPresetStyle(presetId)
  if (presetId === "numero-gigante") return "*-44%*"
  if (style.text.priceLayout) return "~~R$ 89,90~~ *R$ 49,90*"
  const meta = listOfferPresets().find((preset) => preset.id === presetId)
  if (meta?.slots.includes("oferta")) return "-44% *hoje*"
  return "Achei o *melhor*"
}

function StyleThumb({ presetId, kitId, colors }: { presetId: string; kitId: string; colors?: BrandColors }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cancelled = false
    const style = getPresetStyle(presetId)
    const cssW = canvas.clientWidth || 199
    const cssH = 72
    void ensureComposeFontsReady([style.text.fontFamily, style.text.accentFont ?? ""].filter(Boolean)).then(() => {
      if (cancelled || !ref.current) return
      const dpr = window.devicePixelRatio || 1
      ref.current.width = Math.round(cssW * dpr)
      ref.current.height = Math.round(cssH * dpr)
      const ctx = ref.current.getContext("2d")
      if (!ctx) return
      const scale = (cssH / 1920) * 4
      const logicalW = Math.max(1, Math.round(cssW / scale))
      const logicalH = Math.max(1, Math.round(cssH / scale))
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
        style: { ...style, text: { ...style.text, rotation: 0 } },
        maxWidth: logicalW - 16,
        measure: (text, font) => {
          const italic = font.italic ? "italic " : ""
          offCtx.font = `${italic}${font.weight} ${font.size}px "${font.family}"`
          return offCtx.measureText(text).width
        },
        origin: { cx: logicalW / 2, cy: logicalH / 2 },
        brandKitId: kitId,
        brandColors: colors,
        editPreview: false,
        productData: { preco: "R$ 49,90", preco_de: "R$ 89,90" },
      })
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
      ctx.drawImage(off, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [colors, kitId, presetId])
  return <canvas ref={ref} className="h-[72px] w-full" />
}

export function StylePresetGallery({
  kitId,
  colors,
  moment,
  niche,
  onMoment,
  onNiche,
  onApply,
}: {
  kitId: string
  colors?: BrandColors
  moment: string
  niche: string
  onMoment: (moment: string) => void
  onNiche: (niche: string) => void
  onApply: (presetId: string) => void
}) {
  const presets = listOfferPresets({ slot: moment, niche })
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.7rem] font-medium text-foreground">Estilos novos</p>
      <div className="flex flex-wrap gap-1">
        {MOMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-full px-2 py-0.5 text-[0.65rem] ${item.id === moment ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
            onClick={() => onMoment(item.id)}
          >
            {item.label}
          </button>
        ))}
        <select
          className="h-6 rounded-full border border-border bg-background px-2 text-[0.65rem]"
          value={niche}
          onChange={(event) => onNiche(event.target.value)}
        >
          <option value="todos">Todos</option>
          {NICHES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button key={preset.id} type="button" className="overflow-hidden rounded-md border border-border text-left" onClick={() => onApply(preset.id)}>
            <StyleThumb presetId={preset.id} kitId={kitId} colors={colors} />
            <span className="flex h-6 items-center justify-between px-1.5 text-[0.65rem]">
              {preset.label} · {preset.slots.map((slot) => slot[0]?.toUpperCase() + slot.slice(1)).join(" · ")}
              <span className="rounded bg-amber-400 px-1 text-[0.6rem] font-semibold text-black">NOVO</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function textsForNiche(slot: ContentSlot, niche: ContentNiche) {
  return contentPresetsFor(slot, niche)
}
