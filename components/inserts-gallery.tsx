"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"

import { AIGenerateButton } from "@/components/ai-generate-button"
import { ElementPicker } from "@/components/element-picker"
import { BrandKitPicker, ProductDataFields } from "@/components/insert-content"
import { ShopeeProductPanel } from "@/components/shopee-panel"
import { PaintedInsertThumb } from "@/components/painted-insert-thumb"
import { Button } from "@/components/ui/button"
import type { GeneratePipelineResult } from "@/lib/ai-generate"
import type { ContentNiche, ContentSlot } from "@/lib/content/presets"
import {
  FIELD_LABEL,
  galleryRecipes,
  galleryStyles,
  priceGapCount,
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
import { fillVars, type ProductData } from "@/lib/content/runs"
import { buildProofInserts, quoteText } from "@/lib/shopee/proof"
import type { ShopeeProduct, ShopeeReview } from "@/lib/shopee/types"
import type { RetentionCuts } from "@/lib/insert-ops"
import type { InsertType, Template } from "@/lib/inserts"
import { brandKitOf } from "@/lib/brand/kits"
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

const CONTEXT_KEY = "editor.inserts-context.v1"
const frameCache = new Map<string, string>()

function readContextOpen(): boolean {
  try {
    return localStorage.getItem(CONTEXT_KEY) === "1"
  } catch {
    return false
  }
}

function usePlayheadFrame(url: string | undefined, time: number): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    const key = `${url}|${time.toFixed(1)}`
    const cached = frameCache.get(key)
    if (cached) {
      setSrc(cached)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      const video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.muted = true
      video.preload = "auto"
      video.src = url
      const finish = () => {
        if (cancelled) return
        const canvas = document.createElement("canvas")
        canvas.width = 180
        canvas.height = 320
        const ctx = canvas.getContext("2d")
        if (!ctx || !(video.videoWidth > 0)) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        try {
          const data = canvas.toDataURL("image/jpeg", 0.72)
          frameCache.set(key, data)
          setSrc(data)
        } catch (error) {
          console.error("[editor] não foi possível copiar o frame do vídeo", error)
        }
      }
      video.onloadeddata = () => {
        const next = Number.isFinite(video.duration) ? Math.min(time, Math.max(0, video.duration - 0.05)) : time
        if (Math.abs(video.currentTime - next) < 0.05) finish()
        else video.currentTime = next
      }
      video.onseeked = finish
      video.onerror = () => console.error("[editor] falha ao ler o frame da miniatura")
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [time, url])
  return src
}

export function InsertsGallery({
  videoDuration,
  niche,
  productData,
  brandKitId,
  retentionCuts,
  videoUrl,
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
  pricing = "off",
  shopee,
  nicheManual,
  autoShopeeUrl,
  onShopeeProduct,
  onMountProof,
  onUseReviewMedia,
  onReviews,
  onAttachPhoto,
}: {
  videoDuration: number
  niche: ContentNiche
  productData?: ProductData
  brandKitId: string
  retentionCuts?: RetentionCuts | null
  videoUrl?: string
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
  pricing?: "off" | "on"
  shopee?: ShopeeProduct
  nicheManual?: boolean
  autoShopeeUrl?: string | null
  onShopeeProduct?: (product: ShopeeProduct) => void
  onMountProof?: () => void
  onUseReviewMedia?: (review: ShopeeReview, media: ShopeeReview["media"][number]) => void
  onReviews?: (reviews: ShopeeReview[]) => void
  onAttachPhoto?: (review: ShopeeReview, file: File) => void
}) {
  const [shopeeBusy, setShopeeBusy] = useState(false)
  const [shopeeError, setShopeeError] = useState("")
  const [query, setQuery] = useState("")
  const [slotPick, setSlotPick] = useState<ContentSlot | "todos" | null>(null)
  const [mode, setMode] = useState<"prontos" | "estilos">("prontos")
  const [productOpen, setProductOpen] = useState(readContextOpen)
  const [playhead, setPlayhead] = useState(0)
  const [gridWidth, setGridWidth] = useState(0)
  const [usedStyles, setUsedStyles] = useState<string[] | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUsedStyles(readUsedStyles())
  }, [])

  const autoImported = useRef(false)
  useEffect(() => {
    if (!autoShopeeUrl || autoImported.current || shopee) return
    autoImported.current = true
    void importShopee(autoShopeeUrl, false)
  }, [autoShopeeUrl, shopee])

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
  const recipes = galleryRecipes({ niche, slot, query, productData, pricing })
  const styles = galleryStyles(slot)
  const styleNames = new Map(listOfferPresets().map((preset) => [preset.id, preset.label]))
  const summaryName = productData?.produto?.trim() || "Produto sem nome"
  const nicheLabel = NICHES.find((item) => item.id === niche)?.label ?? "Geral"
  const kitLabel = brandKitOf(brandKitId).label
  const frame = usePlayheadFrame(videoUrl, playhead)
  const priceGaps = priceGapCount(recipes, productData, pricing)
  const proofCards = shopee ? buildProofInserts(shopee) : []
  async function importShopee(url: string, refresh: boolean) {
    setShopeeBusy(true)
    setShopeeError("")
    try {
      const response = await fetch("/api/shopee/product", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, refresh }),
      })
      const body = (await response.json()) as ShopeeProduct & { error?: string }
      if (!response.ok) throw new Error(body.error || "Não foi possível importar.")
      onShopeeProduct?.(body)
    } catch (error) {
      console.error("[editor] importar Shopee", error)
      setShopeeError(error instanceof Error ? error.message : "Não foi possível importar.")
    } finally {
      setShopeeBusy(false)
    }
  }
  function setContextOpen(open: boolean) {
    setProductOpen(open)
    try {
      localStorage.setItem(CONTEXT_KEY, open ? "1" : "0")
    } catch (error) {
      console.error("[editor] não foi possível gravar o painel de contexto", error)
    }
  }

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

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Momento">
        <button
          type="button"
          aria-pressed={slotPick == null}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            slotPick == null ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
          )}
          onClick={() => setSlotPick(null)}
        >
          <span aria-hidden>{slotPick == null ? "●" : "○"}</span>
          Seguir playhead
        </button>
        {MOMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={slotPick === item.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
              slotPick === item.id ? "bg-foreground text-background" : "text-muted-foreground",
            )}
            onClick={() => setSlotPick(item.id)}
          >
            {item.color ? <span className="size-2 rounded-full" style={{ background: item.color }} /> : null}
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-foreground"
          aria-expanded={productOpen}
          onClick={() => setContextOpen(!productOpen)}
        >
          <span className="min-w-0 flex-1 truncate">
            {nicheLabel} · {kitLabel} · {summaryName}
          </span>
          <span aria-hidden>{productOpen ? "▴" : "▾"}</span>
        </button>
        {productOpen ? (
          <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
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
            <ShopeeProductPanel
              product={shopee}
              nicheManual={nicheManual}
              busy={shopeeBusy}
              error={shopeeError}
              onImport={(url, refresh) => void importShopee(url, refresh)}
              onMountProof={() => onMountProof?.()}
              onUsePhrase={(review) => {
                const text = quoteText({ ...review, phrase: review.phrase || review.text })
                onAddReady({
                  text,
                  styleId: "balao",
                  packId: MOMENT_PACK.prova,
                  y: 58,
                  role: "prova",
                  source: {
                    kind: "shopee",
                    field: "quote",
                    reviewId: review.id,
                    fetchedAt: shopee?.fetchedAt || review.source?.pastedAt || "",
                    snapshot: text,
                    ...(review.source?.kind === "manual" ? { pasted: true } : {}),
                  },
                }, false)
              }}
              onUseMedia={(review, media) => onUseReviewMedia?.(review, media)}
              onReviews={onReviews}
              onAttachPhoto={onAttachPhoto}
            />
            <ProductDataFields
              data={productData ?? {}}
              niche={niche}
              markEmpty
              hideNiche
              pricing={pricing}
              emptyDash={Boolean(shopee)}
              onChange={(data) => onProductData?.(data)}
              onNiche={(next) => onNiche?.(next)}
            />
          </div>
        ) : null}
      </div>

      <div className="sticky top-0 z-10 flex flex-col gap-1 bg-background py-1">
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
        {priceGaps > 0 ? (
          <button type="button" className="text-left text-xs text-amber-800 dark:text-amber-200" onClick={() => setContextOpen(true)}>
            {priceGaps} prontos precisam de preço — Editar dados
          </button>
        ) : null}
      </div>

      {mode === "prontos" && proofCards.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-foreground">Prova real</h3>
          <div className="grid grid-cols-1 gap-2">
            {proofCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="rounded-md border border-border px-2 py-2 text-left"
                onClick={() =>
                  onAddReady(
                    {
                      text: card.text,
                      styleId: card.styleId,
                      packId: MOMENT_PACK.prova,
                      y: card.y,
                      role: "prova",
                      source: {
                        kind: "shopee",
                        field: card.field,
                        fetchedAt: shopee?.fetchedAt || "",
                        snapshot: card.snapshot,
                        ...(card.reviewId ? { reviewId: card.reviewId } : {}),
                        ...(card.pasted ? { pasted: true } : {}),
                      },
                    },
                    false,
                  )
                }
              >
                {card.pasted ? <p className="text-[0.65rem] text-muted-foreground">colada</p> : null}
                <p className="whitespace-pre-line text-sm text-foreground">{card.text}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

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
                          backdrop={frame}
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
                          backdrop={frame}
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
