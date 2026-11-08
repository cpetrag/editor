"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"

import { AIGenerateButton } from "@/components/ai-generate-button"
import { ElementPicker } from "@/components/element-picker"
import { BrandKitPicker, ProductDataFields } from "@/components/insert-content"
import { PaintedInsertThumb } from "@/components/painted-insert-thumb"
import { Button } from "@/components/ui/button"
import type { GeneratePipelineResult } from "@/lib/ai-generate"
import type { ContentNiche, ContentSlot } from "@/lib/content/presets"
import {
  FIELD_LABEL,
  galleryRecipes,
  galleryStyles,
  markerAtTime,
  missingFieldLabels,
  MOMENT_PACK,
  momentY,
  packLabel,
  stripMarks,
  styleOnlyPreview,
  styleOnlyText,
  thumbGridMetrics,
  type ReadySpec,
} from "@/lib/content/gallery"
import { fillVars, PRODUCT_FIELDS, type ProductData } from "@/lib/content/runs"
import type { RetentionCuts } from "@/lib/insert-ops"
import type { InsertType, Template } from "@/lib/inserts"
import { listOfferPresets } from "@/lib/style/offer-styles"
import { isFreshOfferStyle, markStyleUsed, readUsedStyles } from "@/lib/style/fresh-styles"
import { cn } from "@/lib/utils"

const MOMENTS: Array<{ id: ContentSlot | "todos"; label: string; color?: string }> = [
  { id: "todos", label: "Todos" },
  { id: "gancho", label: "Gancho", color: "var(--track-desconto)" },
  { id: "prova", label: "Prova", color: "var(--track-frete)" },
  { id: "oferta", label: "Oferta", color: "var(--track-preco)" },
  { id: "cta", label: "CTA", color: "var(--brand)" },
]

const NICHES: Array<{ id: ContentNiche; label: string }> = [
  { id: "shopee", label: "Geral" },
  { id: "moda", label: "Moda" },
  { id: "beleza", label: "Beleza" },
  { id: "bebe", label: "Bebê" },
]

const SLOT_LABEL: Record<ContentSlot, string> = {
  gancho: "Gancho",
  prova: "Prova",
  oferta: "Oferta",
  cta: "CTA",
}

const SHOWING: Record<ContentSlot, string> = {
  gancho: "ganchos",
  prova: "provas",
  oferta: "ofertas",
  cta: "CTAs",
}

export function InsertsGallery({
  videoDuration,
  niche,
  productData,
  brandKitId,
  retentionCuts,
  getPlayhead,
  activeTemplateId,
  loadAiMedia,
  onAddText,
  onAddReady,
  onAddElement,
  onApplyTemplate,
  onGenerate,
  onAiStatus,
  onNiche,
  onBrandKit,
  onProductData,
}: {
  videoDuration: number
  niche: ContentNiche
  productData?: ProductData
  brandKitId: string
  retentionCuts?: RetentionCuts | null
  getPlayhead?: () => number
  activeTemplateId: string | null
  loadAiMedia: () => Promise<File | null>
  onAddText: () => void
  onAddReady: (spec: ReadySpec, selectMarked: boolean) => void
  onAddElement: (type: InsertType) => void
  onApplyTemplate: (template: Template) => void
  onGenerate: (payload: GeneratePipelineResult) => void | Promise<void>
  onAiStatus: (message: string) => void
  onNiche?: (niche: ContentNiche) => void
  onBrandKit?: (id: string) => void
  onProductData?: (data: ProductData) => void
}) {
  const [query, setQuery] = useState("")
  const [slotPick, setSlotPick] = useState<ContentSlot | "todos" | null>(null)
  const [mode, setMode] = useState<"prontos" | "estilos">("prontos")
  const [productOpen, setProductOpen] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [gridWidth, setGridWidth] = useState(0)
  const [usedStyles, setUsedStyles] = useState<string[] | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUsedStyles(readUsedStyles())
  }, [])

  useEffect(() => {
    const node = gridRef.current
    if (!node) return
    let last = 0
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0)
      if (last !== 0 && Math.abs(width - last) <= 4) return
      last = width
      setGridWidth(width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [mode])

  useEffect(() => {
    if (!getPlayhead) return
    const tick = () => {
      const next = getPlayhead()
      setPlayhead((current) => (Math.abs(current - next) < 0.05 ? current : next))
    }
    tick()
    const timer = window.setInterval(tick, 200)
    return () => window.clearInterval(timer)
  }, [getPlayhead])

  const marker = markerAtTime(playhead, videoDuration, retentionCuts)
  const slot = slotPick ?? marker.slot
  const recipes = galleryRecipes({ niche, slot, query, productData })
  const styles = galleryStyles(slot)
  const styleNames = new Map(listOfferPresets().map((preset) => [preset.id, preset.label]))
  const missing = PRODUCT_FIELDS.filter((field) => !(productData?.[field] ?? "").trim())
  const summaryName = productData?.produto?.trim() || "Produto sem nome"
  const summaryPrice = productData?.preco?.trim() || "sem preço"
  const summaryNote = productData?.nota?.trim()

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="preço, frete, mamãe…"
        aria-label="Buscar prontos"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={onAddText}>
          + Texto em branco
        </Button>
        <ElementPicker
          activeTemplateId={activeTemplateId}
          onAddElement={onAddElement}
          onApplyTemplate={onApplyTemplate}
        />
        <AIGenerateButton
          duration={videoDuration}
          loadMedia={loadAiMedia}
          onGenerate={onGenerate}
          onStatus={onAiStatus}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
        {slotPick == null ? (
          <span>
            Playhead na <b className="text-foreground">{SLOT_LABEL[marker.slot].toUpperCase()}</b>
            {` (${formatRange(marker.from)}–${formatRange(marker.to)}) · mostrando ${SHOWING[marker.slot]}`}
          </span>
        ) : (
          <>
            <span>{slotPick === "todos" ? "Mostrando todos os momentos" : `Filtro escolhido: ${SLOT_LABEL[slotPick]}`}</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => setSlotPick(null)}>
              Seguir o playhead
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Momento">
        {MOMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={slot === item.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
              slot === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
            onClick={() => setSlotPick(item.id)}
          >
            {item.color ? <span className="size-2 rounded-full" style={{ background: item.color }} /> : null}
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Nicho
          <select
            aria-label="Nicho"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={niche}
            onChange={(event) => onNiche?.(event.target.value as ContentNiche)}
          >
            {NICHES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Cores</span>
          <BrandKitPicker kitId={brandKitId} onChange={(id) => onBrandKit?.(id)} />
        </div>
      </div>

      <div className="rounded-md border border-border px-2 py-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <p className="min-w-0 truncate text-foreground">
            <b>{summaryName}</b>
            {` · ${summaryPrice}`}
            {summaryNote ? ` · ⭐ ${summaryNote}` : ""}
            {missing.length > 0 ? ` · falta: ${missing.map((field) => FIELD_LABEL[field].toLowerCase()).join(", ")}` : ""}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-expanded={productOpen}
            onClick={() => setProductOpen((open) => !open)}
          >
            {productOpen ? "Fechar" : "Editar dados"}
          </Button>
        </div>
        {productOpen ? (
          <div className="mt-2">
            <ProductDataFields
              data={productData ?? {}}
              niche={niche}
              markEmpty
              hideNiche
              onChange={(data) => onProductData?.(data)}
              onNiche={(next) => onNiche?.(next)}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Tipo da grade">
          {([
            ["prontos", "Textos prontos"],
            ["estilos", "Só estilos"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              className={cn(
                "rounded px-2 py-1 text-xs",
                mode === id ? "bg-foreground text-background" : "text-muted-foreground",
              )}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {mode === "prontos" ? `${recipes.length} prontos` : `${styles.length} estilos`}
        </span>
      </div>

      {mode === "prontos" && recipes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada com esse filtro. Tente “Todos” ou outra palavra.</p>
      ) : (
        <GalleryGrid mode={mode} width={gridWidth} gridRef={gridRef}>
            {mode === "estilos"
              ? styles.map((preset) => {
                  const moment = preset.slots[0] ?? "prova"
                  const text = styleOnlyText(preset.id)
                  const preview = styleOnlyPreview(preset.id, productData)
                  const moments = preset.slots.map((item) => SLOT_LABEL[item]).join(" · ")
                  const showNew = usedStyles !== null && isFreshOfferStyle(preset.id) && !usedStyles.includes(preset.id)
                  const metrics = thumbGridMetrics(gridWidth, "estilos")
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={`${preset.label} · ${moments}`}
                      className="group overflow-hidden rounded-md border border-border text-left"
                      aria-label={`Adicionar texto no estilo ${preset.label}`}
                      onClick={() => {
                        if (isFreshOfferStyle(preset.id)) setUsedStyles(markStyleUsed(preset.id))
                        onAddReady(
                          {
                            text,
                            styleId: preset.id,
                            packId: MOMENT_PACK[moment],
                            y: momentY(moment),
                          },
                          true,
                        )
                      }}
                    >
                      <span className="relative block">
                        <PaintedInsertThumb
                          text={preview}
                          styleId={preset.id}
                          packId={MOMENT_PACK[moment]}
                          kitId={brandKitId}
                          productData={productData}
                          paintScale={metrics.scale}
                          maxTextWidth={metrics.maxTextWidth}
                          aspect="4/3"
                        />
                        {showNew ? (
                          <span className="pointer-events-none absolute left-[5px] top-[5px] z-[1] rounded bg-foreground px-1 text-[9px] font-bold tracking-wide text-background">
                            NOVO
                          </span>
                        ) : null}
                        <span className="pointer-events-none absolute bottom-1.5 left-1.5 z-[1] flex gap-[3px]" title={moments}>
                          {preset.slots.map((item) => (
                            <i
                              key={item}
                              className="size-[7px] rounded-full"
                              style={{ background: colorOf(item), boxShadow: "0 0 0 1.5px rgba(255,255,255,.85)" }}
                            />
                          ))}
                        </span>
                        <span className="pointer-events-none absolute right-[5px] top-[5px] rounded-full bg-foreground px-1.5 py-px text-[10px] font-bold text-background opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                          + Adicionar
                        </span>
                      </span>
                      <span className="block truncate px-1.5 pb-[5px] pt-1 text-[11px] text-muted-foreground">{preset.label}</span>
                    </button>
                  )
                })
              : recipes.map((preset) => {
                  const missingLabels = missingFieldLabels(preset.text, productData)
                  const painted = fillVars(preset.text, productData).text
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className="group overflow-hidden rounded-md border border-border text-left"
                      aria-label={`Adicionar: ${stripMarks(painted)}`}
                      onClick={() =>
                        onAddReady(
                          {
                            text: preset.text,
                            styleId: preset.style,
                            packId: preset.pack,
                            y: preset.y,
                            contentId: preset.id,
                          },
                          false,
                        )
                      }
                    >
                      <span className="relative block">
                        <PaintedInsertThumb
                          text={preset.text}
                          styleId={preset.style}
                          packId={preset.pack}
                          kitId={brandKitId}
                          productData={productData}
                          paintScale={thumbGridMetrics(gridWidth, "prontos").scale}
                          maxTextWidth={thumbGridMetrics(gridWidth, "prontos").maxTextWidth}
                        />
                        <span className="pointer-events-none absolute right-[7px] top-[7px] rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold text-background opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                          + Adicionar
                        </span>
                      </span>
                      <span className="flex flex-col gap-0.5 px-1.5 py-1 text-[0.65rem]">
                        <span className="flex items-center justify-between gap-1 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span className="size-1.5 rounded-full" style={{ background: colorOf(preset.slot) }} />
                            {SLOT_LABEL[preset.slot]}
                          </span>
                          <span className="truncate">
                            {styleNames.get(preset.style) ?? preset.style} · {packLabel(preset.pack)}
                          </span>
                        </span>
                        {missingLabels.length > 0 ? (
                          <span className="w-fit rounded bg-amber-200 px-1 text-amber-950">falta {missingLabels.join(", ")}</span>
                        ) : null}
                        {preset.claim ? (
                          <span className="w-fit rounded bg-amber-100 px-1 text-amber-900">confira antes de anunciar</span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
        </GalleryGrid>
      )}
    </div>
  )
}

function GalleryGrid({
  mode,
  width,
  gridRef,
  children,
}: {
  mode: "prontos" | "estilos"
  width: number
  gridRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const metrics = thumbGridMetrics(width, mode)
  return (
    <div
      ref={gridRef}
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${metrics.columns}, minmax(0, 1fr))`,
        gap: metrics.gap,
      }}
    >
      {children}
    </div>
  )
}

function colorOf(slot: ContentSlot): string {
  if (slot === "gancho") return "var(--track-desconto)"
  if (slot === "prova") return "var(--track-frete)"
  if (slot === "oferta") return "var(--track-preco)"
  return "var(--brand)"
}

function formatRange(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const whole = Math.floor(safe % 60)
  return `${minutes}:${String(whole).padStart(2, "0")}`
}
