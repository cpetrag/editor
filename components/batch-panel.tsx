"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, Download, Plus, X, FileVideo, Layers, Sparkles } from "lucide-react"

import { FontPreviewCard } from "@/components/library-font-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { requestHooks } from "@/lib/ai-client"
import { mergeHooks } from "@/lib/ai-hooks"
import { FONT_OPTIONS, FONT_PREVIEW_SAMPLE, withProjectFont } from "@/lib/fonts"
import {
  POSITION_LABELS,
  buildVariations,
  type BatchAxes,
  type InsertPosition,
  type Insert,
  type Variation,
} from "@/lib/inserts"
import type { Composition, CompositionBatch, StyleRef, TrackId, TrackStyle } from "@/lib/composition"
import { presetsUsedInComposition } from "@/lib/style/user-presets"
import { estimateBatch } from "@/lib/insert-ops"
import { tryPickExportFormat } from "@/lib/export/mime"

interface BatchPanelProps {
  backgroundUrl: string
  fileName: string
  inserts: Insert[]
  fontId: string
  batch: CompositionBatch
  selectedVariationIndex: number | null
  onSelectVariation: (variation: Variation | null) => void
  onChangeBatch: (patch: Partial<CompositionBatch>) => void
  customPresets?: Composition["customPresets"]
  tracks?: Partial<Record<TrackId, TrackStyle>>
  styleRef?: StyleRef
}

const POSITIONS: InsertPosition[] = ["top", "center", "bottom"]

export function BatchPanel({
  backgroundUrl,
  fileName,
  inserts,
  fontId,
  batch,
  selectedVariationIndex,
  onSelectVariation,
  onChangeBatch,
  customPresets,
  tracks,
  styleRef,
}: BatchPanelProps) {
  const { hooks, fonts, positions, baseName } = batch
  const [hookDraft, setHookDraft] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")

  useEffect(() => {
    const next = withProjectFont(fonts, fontId)
    if (next !== fonts) onChangeBatch({ fonts: next })
  }, [fontId])

  async function suggestVariations() {
    setAiLoading(true)
    setAiError("")
    try {
      const suggested = await requestHooks(aiPrompt)
      onChangeBatch({ hooks: mergeHooks(hooks, suggested) })
      setAiPrompt("")
    } catch (error) {
      console.error("[editor] falha ao sugerir ganchos", error)
      setAiError(error instanceof Error ? error.message : "Falha ao sugerir ganchos")
    } finally {
      setAiLoading(false)
    }
  }

  const axes: BatchAxes = useMemo(
    () => ({ hooks, fonts, positions }),
    [hooks, fonts, positions],
  )

  const exportFormat = useMemo(() => tryPickExportFormat(), [])
  const exportExt = exportFormat?.ext ?? "mp4"

  const variations = useMemo(
    () => buildVariations(baseName, axes, exportExt),
    [baseName, axes, exportExt],
  )
  const batchEstimate = useMemo(
    () => estimateBatch(variations.length),
    [variations.length],
  )

  function addHook() {
    const value = hookDraft.trim()
    if (!value) return
    onChangeBatch({ hooks: [...hooks, value] })
    setHookDraft("")
  }

  function removeHook(i: number) {
    onChangeBatch({ hooks: hooks.filter((_, idx) => idx !== i) })
  }

  function toggleFont(id: string) {
    const next = fonts.includes(id)
      ? fonts.filter((item) => item !== id)
      : [...fonts, id]
    onChangeBatch({ fonts: next.length ? next : [fontId] })
  }

  function setBaseName(value: string) {
    onChangeBatch({ baseName: value })
  }

  function setPositions(next: InsertPosition[]) {
    onChangeBatch({ positions: next.length ? next : ["top"] })
  }

  function downloadManifest() {
    const usedPresets = presetsUsedInComposition({
      inserts,
      tracks,
      styleRef,
      customPresets,
    })
    const manifest = {
      baseName,
      backgroundUrl,
      inserts,
      axes,
      ext: exportExt,
      total: variations.length,
      customPresets: usedPresets,
      variations: variations.map((v) => ({
        fileName: v.fileName,
        hook: v.hook,
        fontId: v.fontId,
        position: v.position,
      })),
    }
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${baseName || "lote"}_manifest.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyNames() {
    const text = variations.map((v) => v.fileName).join("\n")
    navigator.clipboard?.writeText(text)
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Layers className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">
            Variações em lote
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            base: {fileName || "sem vídeo"} · {inserts.length} insert
            {inserts.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-5 py-5">
          {exportExt !== "mp4" ? (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Seu navegador exporta em WebM. Para MP4, use Chrome ou Edge.
            </p>
          ) : null}
          {variations.length > 20 ? (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {variations.length} variações: cerca de{" "}
              {Math.max(1, Math.round(batchEstimate.seconds / 60))} min e{" "}
              {batchEstimate.megabytes} MB. O lote será processado em fila no
              servidor — não nesta aba.
            </p>
          ) : null}
          {/* AI suggestions */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-brand/30 bg-brand/5 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand/15 text-brand">
                <Sparkles className="size-4" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                Sugerir variações com IA
              </p>
            </div>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Promoção de fraldas, frete grátis, focar na urgência..."
              rows={3}
              disabled={aiLoading}
              className="resize-none bg-background text-sm"
            />
            <Button
              onClick={() => {
                void suggestVariations()
              }}
              disabled={aiLoading || !aiPrompt.trim()}
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {aiLoading ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles data-icon="inline-start" />
                  {aiError ? "Tentar de novo" : "Sugerir Variações com IA"}
                </>
              )}
            </Button>
            {aiError ? <p className="text-xs text-destructive">{aiError}</p> : null}
          </div>

          {/* Base name */}
          <Field>
            <FieldLabel htmlFor="base-name">Nome base do arquivo</FieldLabel>
            <Input
              id="base-name"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="campanha-shopee"
            />
            <FieldDescription>
              Usado como prefixo dos nomes de arquivo exportados.
            </FieldDescription>
          </Field>

          {/* Hooks */}
          <Field>
            <FieldLabel>Ganchos (texto de abertura)</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={hookDraft}
                onChange={(e) => setHookDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    addHook()
                  }
                }}
                placeholder="Digite um gancho e Enter"
              />
              <Button variant="secondary" size="icon" onClick={addHook} aria-label="Adicionar gancho">
                <Plus />
              </Button>
            </div>
            <div className="mt-1 flex flex-col gap-1.5">
              {hooks.map((hook, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {hook}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeHook(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover gancho ${i + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {hooks.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sem ganchos — as variações não terão texto de abertura.
                </p>
              )}
            </div>
          </Field>

          {/* Fonts */}
          <Field>
            <FieldLabel>Fontes a testar</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {FONT_OPTIONS.map((font) => {
                const active = fonts.includes(font.id)
                return (
                  <FontPreviewCard
                    key={font.id}
                    font={font}
                    sample={FONT_PREVIEW_SAMPLE}
                    selected={active}
                    onSelect={() => toggleFont(font.id)}
                    ariaLabel={`${active ? "Remover" : "Incluir"} ${font.label} no lote`}
                  />
                )
              })}
            </div>
          </Field>

          {/* Positions */}
          <Field>
            <FieldLabel>Posições a testar</FieldLabel>
            <ToggleGroup
              value={positions}
              onValueChange={(value) => {
                if (value.length) setPositions(value as InsertPosition[])
              }}
              toggleMultiple
              variant="outline"
              className="w-full"
            >
              {POSITIONS.map((pos) => (
                <ToggleGroupItem key={pos} value={pos} className="flex-1 text-xs">
                  {POSITION_LABELS[pos]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>Selecione ao menos uma posição.</FieldDescription>
          </Field>
        </div>
      </ScrollArea>

      {/* Results footer */}
      <div className="border-t border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileVideo className="size-4 text-brand" />
            {variations.length} variações
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={copyNames}>
              <Copy data-icon="inline-start" />
              Copiar nomes
            </Button>
            <Button size="sm" onClick={downloadManifest}>
              <Download data-icon="inline-start" />
              Manifest
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-40">
          <ul className="px-5 pb-4">
            {variations.map((v) => {
              const selected = selectedVariationIndex === v.index
              return (
              <li key={v.index} className="last:border-0">
                <button
                  type="button"
                  onClick={() =>
                    onSelectVariation(selected ? null : v)
                  }
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-border/60 py-1.5 text-left",
                    selected && "bg-brand/10",
                  )}
                  aria-pressed={selected}
                >
                  <span className="w-6 shrink-0 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                    {String(v.index).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[0.7rem] text-foreground">
                    {v.fileName}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                    {POSITION_LABELS[v.position]}
                  </span>
                </button>
              </li>
              )
            })}
          </ul>
        </ScrollArea>
      </div>
    </aside>
  )
}
