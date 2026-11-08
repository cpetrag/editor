"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { BrandKitPicker } from "@/components/insert-content"
import { MotionThumb } from "@/components/motion-thumb"
import { PaintedInsertThumb } from "@/components/painted-insert-thumb"
import { StyleCustomizePanel, type PresetLibraryHandlers } from "@/components/style-customize-panel"
import { Button } from "@/components/ui/button"
import { brandKitOf, resolveColor } from "@/lib/brand/kits"
import {
  backgroundEnabled,
  FIELD_LABEL,
  formatClockTenths,
  galleryStyles,
  insertToken,
  insertWithBackground,
  insertWithColor,
  insertWithEdge,
  insertWithPack,
  INSERT_SIZE_PERCENT_MAX,
  INSERT_SIZE_PERCENT_MIN,
  insertWithSize,
  insertWithStroke,
  insertWithStyle,
  markerAtTime,
  packLabel,
  passesVideoEnd,
  sizePercentOf,
  stillAnimation,
  stripMarks,
  wrapMarkup,
} from "@/lib/content/gallery"
import { displayRuns, PRODUCT_FIELDS, type ProductData } from "@/lib/content/runs"
import type { RetentionCuts } from "@/lib/insert-ops"
import type { Insert } from "@/lib/inserts"
import { ENTER, EXIT, PACKS } from "@/lib/motion/catalog"
import { selectPack } from "@/lib/motion/select"
import { listOfferPresets } from "@/lib/style/offer-styles"
import { isFreshOfferStyle, markStyleUsed } from "@/lib/style/fresh-styles"
import { getPresetStyle } from "@/lib/style/presets"
import type { StyleLayer, TrackId } from "@/lib/style/types"
import type { CaptionPreset, CaptionStyle } from "@/lib/composition"
import type { PanelBlockController } from "@/components/use-panel-blocks"
import { cn } from "@/lib/utils"

const POSITIONS = [
  { y: 20, label: "Topo" },
  { y: 50, label: "Meio" },
  { y: 72, label: "Baixo" },
] as const

const DURATIONS = [2, 3, 4, 5] as const

export function InsertsEditor({
  insert,
  videoDuration,
  productData,
  brandKitId,
  retentionCuts,
  getPlayhead,
  focus,
  onFocusDone,
  onBack,
  onChange,
  onDuplicate,
  onRemove,
  onHookVariations,
  onBrandKit,
  onBeginGesture,
  onEndGesture,
  tracks,
  projectStyle,
  captionStyle,
  captionPreset,
  onPatchStyle,
  onResetStyleField,
  onResetStyleOverrides,
  onResetPosition,
  onApplyStylePreset,
  onApplyStyleToTrack,
  presetLibrary,
  styleBlocks,
  motionBlocks,
}: {
  insert: Insert
  videoDuration: number
  productData?: ProductData
  brandKitId: string
  retentionCuts?: RetentionCuts | null
  getPlayhead?: () => number
  focus?: { id: string; selectMarked: boolean } | null
  onFocusDone?: () => void
  onBack: () => void
  onChange: (patch: Partial<Insert>) => void
  onDuplicate: () => void
  onRemove: () => void
  onHookVariations?: () => void
  onBrandKit?: (id: string) => void
  onBeginGesture?: () => void
  onEndGesture?: () => void
  tracks?: Partial<Record<TrackId, StyleLayer>>
  projectStyle?: StyleLayer
  captionStyle?: CaptionStyle
  captionPreset?: CaptionPreset
  onPatchStyle: (path: string, value: unknown) => void
  onResetStyleField: (path: string) => void
  onResetStyleOverrides: () => void
  onResetPosition: () => void
  onApplyStylePreset: (presetId: string, mode?: "preserve" | "clean") => void
  onApplyStyleToTrack: () => void
  presetLibrary?: PresetLibraryHandlers
  styleBlocks: PanelBlockController
  motionBlocks: PanelBlockController
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [visualMode, setVisualMode] = useState<"sug" | "todos">("sug")
  const [advanced, setAdvanced] = useState(false)
  const marker = markerAtTime(insert.start, videoDuration, retentionCuts)
  const styleId = insert.styleRef?.presetId || "legado"
  const packId = insert.styleRef?.overrides.animation?.packId
  const title = stripMarks(displayRuns(insert.text ?? "", productData).plain) || "Texto vazio"
  const styles = visualMode === "sug" ? galleryStyles(marker.slot) : galleryStyles("todos")
  const visibleStyles = styles.some((item) => item.id === styleId) ? styles : galleryStyles("todos")
  const kit = brandKitOf(brandKitId)
  const baseColor = getPresetStyle(styleId).text.color
  const over = passesVideoEnd(insert.start, insert.duration, videoDuration)

  useEffect(() => {
    if (!focus || focus.id !== insert.id) return
    const node = textRef.current
    if (!node) return
    node.focus()
    if (focus.selectMarked) {
      const match = node.value.match(/\*([^*]+)\*/)
      if (match && match.index != null) node.setSelectionRange(match.index, match.index + match[0].length)
      else node.select()
    } else {
      const end = node.value.length
      node.setSelectionRange(end, end)
    }
    onFocusDone?.()
  }, [focus, insert.id, onFocusDone])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target
      if (target instanceof HTMLElement && target.dataset.insertText !== "true" && target !== document.body) {
        if (target.closest("[data-insert-editor]") == null) return
        if (target.tagName === "INPUT" || target.tagName === "SELECT") return
      }
      if (target instanceof HTMLElement && target.dataset.insertText === "true") {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onBack])

  function applyText(next: string, start: number, end: number) {
    onChange({ text: next })
    requestAnimationFrame(() => {
      const node = textRef.current
      if (!node) return
      node.focus()
      node.setSelectionRange(start, end)
    })
  }

  function mark(token: "*" | "~~") {
    const node = textRef.current
    const value = insert.text ?? ""
    const wrapped = wrapMarkup(value, node?.selectionStart ?? value.length, node?.selectionEnd ?? value.length, token)
    if (!wrapped) {
      node?.focus()
      return
    }
    applyText(wrapped.text, wrapped.start, wrapped.end)
  }

  const runs = displayRuns(insert.text ?? "", productData)
  const words = stripMarks(runs.plain).split(/\s+/).filter(Boolean).length
  const seconds = words === 0 ? 0 : 0.6 + 0.25 * words
  const readable = !(insert.duration > 0) || seconds <= insert.duration * 0.9
  const sample = sampleText(insert.text ?? "", productData)

  return (
    <div data-insert-editor className="flex flex-col gap-4" onKeyDown={(event) => {
      if (event.key === "Escape" && event.target === event.currentTarget) onBack()
    }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Prontos
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="text-[0.7rem] text-muted-foreground">
            {formatClockTenths(insert.start)}–{formatClockTenths(insert.start + insert.duration)}
          </p>
        </div>
        {onHookVariations ? (
          <Button type="button" variant="ghost" size="sm" onClick={onHookVariations}>
            Variações
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
          Duplicar
        </Button>
        <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={onRemove}>
          Apagar
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-foreground">Texto</h3>
        <textarea
          ref={textRef}
          data-insert-text="true"
          aria-label="Texto do insert"
          value={insert.text ?? ""}
          rows={4}
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          onChange={(event) => onChange({ text: event.target.value })}
        />
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="xs" onClick={() => mark("*")}>
            Destacar
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => mark("~~")}>
            Riscar
          </Button>
          <select
            aria-label="Inserir variável"
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            value=""
            onChange={(event) => {
              const field = event.target.value
              if (!field) return
              const node = textRef.current
              const placed = insertToken(insert.text ?? "", node?.selectionStart ?? (insert.text ?? "").length, `{${field}}`)
              applyText(placed.text, placed.cursor, placed.cursor)
            }}
          >
            <option value="">+ Dado do produto</option>
            {PRODUCT_FIELDS.map((field) => (
              <option key={field} value={field}>{FIELD_LABEL[field]}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-foreground" aria-label="Como vai sair">
          <span className="mr-1 text-[0.65rem] text-muted-foreground">como vai sair</span>
          {runs.plain.length === 0 ? " " : renderRuns(insert.text ?? "", productData)}
        </p>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={readable ? "h-full bg-emerald-500" : "h-full bg-amber-500"}
              style={{ width: `${Math.min(100, insert.duration > 0 ? (seconds / insert.duration) * 100 : 100)}%` }}
            />
          </div>
          <p className={cn("text-[0.7rem]", readable ? "text-muted-foreground" : "text-amber-700")}>
            {words} palavras · {seconds.toFixed(1).replace(".", ",")} s de leitura em {String(insert.duration).replace(".", ",")} s
            {readable ? "" : " · aumente o tempo ou corte texto"}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-foreground">
          Visual <span className="font-normal text-muted-foreground">{listOfferPresets().find((item) => item.id === styleId)?.label ?? styleId}</span>
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              aria-pressed={visualMode === "sug"}
              className={cn("rounded px-2 py-1 text-xs", visualMode === "sug" ? "bg-foreground text-background" : "text-muted-foreground")}
              onClick={() => setVisualMode("sug")}
            >
              {`Para ${marker.slot}`}
            </button>
            <button
              type="button"
              aria-pressed={visualMode === "todos"}
              className={cn("rounded px-2 py-1 text-xs", visualMode === "todos" ? "bg-foreground text-background" : "text-muted-foreground")}
              onClick={() => setVisualMode("todos")}
            >
              Todos
            </button>
          </div>
          <BrandKitPicker kitId={brandKitId} onChange={(id) => onBrandKit?.(id)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleStyles.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={preset.id === styleId}
              className={cn(
                "w-28 shrink-0 overflow-hidden rounded-md border text-left",
                preset.id === styleId ? "border-blue-500 ring-2 ring-blue-500" : "border-border",
              )}
              onClick={() => {
                if (isFreshOfferStyle(preset.id)) markStyleUsed(preset.id)
                onChange(insertWithStyle(insert, preset.id))
              }}
            >
              <PaintedInsertThumb text={sample} styleId={preset.id} kitId={brandKitId} productData={productData} animate="still" />
              <span className="block truncate px-1 py-0.5 text-[0.65rem]">{preset.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-foreground">
          Movimento <span className="font-normal text-muted-foreground">{packLabel(packId)}</span>
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: "parado", label: "Parado" }, ...PACKS.map((pack) => ({ id: pack.id, label: pack.label }))].map((pack) => {
            const animation = pack.id === "parado" ? stillAnimation(getPresetStyle(styleId).animation) : undefined
            return (
              <button
                key={pack.id}
                type="button"
                aria-pressed={(packId ?? "parado") === pack.id || (pack.id !== "parado" && packId === pack.id)}
                className={cn(
                  "w-20 shrink-0 overflow-hidden rounded-md border text-left",
                  packId === pack.id || (!packId && pack.id === "parado")
                    ? "border-blue-500 ring-2 ring-blue-500"
                    : "border-border",
                )}
                onClick={() => onChange(insertWithPack(insert, pack.id))}
              >
                {animation ? (
                  <MotionThumb animation={animation} />
                ) : (
                  <MotionThumb animation={packMotion(pack.id)} />
                )}
                <span className="block truncate px-1 py-0.5 text-[0.65rem]">{pack.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-foreground">Posição e tempo</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {POSITIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={Math.abs((insert.y ?? 50) - item.y) < 5}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  Math.abs((insert.y ?? 50) - item.y) < 5 ? "bg-foreground text-background" : "text-muted-foreground",
                )}
                onClick={() => onChange({ y: item.y })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={6}
            max={94}
            aria-label="Altura"
            value={Math.round(insert.y ?? 50)}
            onPointerDown={() => onBeginGesture?.()}
            onPointerUp={() => onEndGesture?.()}
            onChange={(event) => onChange({ y: Number(event.target.value) })}
          />
          <span className="text-xs text-muted-foreground">{Math.round(insert.y ?? 50)}%</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Dura</span>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {DURATIONS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={Math.abs(insert.duration - item) < 0.05}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  Math.abs(insert.duration - item) < 0.05 ? "bg-foreground text-background" : "text-muted-foreground",
                )}
                onClick={() => onChange({ duration: item })}
              >
                {item} s
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              const at = getPlayhead?.() ?? insert.start
              onChange({ start: Math.max(0, Math.floor(at * 10) / 10) })
            }}
          >
            Começar no playhead
          </Button>
        </div>
        {over ? (
          <p className="text-xs text-amber-700">
            Passa {(insert.start + insert.duration - videoDuration).toFixed(1).replace(".", ",")} s do fim do vídeo ({formatClockTenths(videoDuration)}).
          </p>
        ) : null}
      </section>

      <details open className="rounded-md border border-border px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground">Ajustes finos</summary>
        <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
          <span>Tamanho</span>
          <span className="flex items-center gap-2">
            <input
              type="range"
              min={INSERT_SIZE_PERCENT_MIN}
              max={INSERT_SIZE_PERCENT_MAX}
              step={5}
              aria-label="Tamanho"
              value={sizePercentOf(insert)}
              onPointerDown={() => onBeginGesture?.()}
              onPointerUp={() => onEndGesture?.()}
              onChange={(event) => onChange(insertWithSize(insert, Number(event.target.value)))}
            />
            <span className="text-muted-foreground">{sizePercentOf(insert)}%</span>
          </span>
          <span>Cor do texto</span>
          <span className="flex flex-wrap gap-1">
            {colorChoices(baseColor, kit).map((choice) => (
              <button
                key={choice.label}
                type="button"
                title={choice.label}
                aria-label={choice.label}
                aria-pressed={(insert.styleRef?.overrides.text?.color ?? null) === choice.value}
                className={cn(
                  "size-5 rounded-full border",
                  (insert.styleRef?.overrides.text?.color ?? null) === choice.value ? "border-blue-500 ring-2 ring-blue-500" : "border-black/20",
                )}
                style={{ background: choice.swatch }}
                onClick={() => onChange(insertWithColor(insert, choice.value))}
              />
            ))}
          </span>
          <span>Contorno</span>
          <YesNo on={strokeOnSafe(insert)} onChange={(next) => onChange(insertWithStroke(insert, next))} />
          <span>Fundo</span>
          <YesNo on={backgroundEnabled(insert)} onChange={(next) => onChange(insertWithBackground(insert, next))} />
          <span>Entrada</span>
          <select
            aria-label="Entrada"
            className="h-8 rounded-md border border-border bg-background px-2"
            value={insert.styleRef?.overrides.animation?.enter?.recipeId ?? ""}
            onChange={(event) => onChange(insertWithEdge(insert, "enter", event.target.value || null))}
          >
            <option value="">Do movimento</option>
            {ENTER.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <span>Saída</span>
          <select
            aria-label="Saída"
            className="h-8 rounded-md border border-border bg-background px-2"
            value={insert.styleRef?.overrides.animation?.exit?.recipeId ?? ""}
            onChange={(event) => onChange(insertWithEdge(insert, "exit", event.target.value || null))}
          >
            <option value="">Do movimento</option>
            {EXIT.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="mt-3 text-xs text-blue-700 underline" onClick={() => setAdvanced((open) => !open)}>
          Todos os ajustes
        </button>
        {advanced && onApplyStylePreset ? (
          <div className="mt-3 flex flex-col gap-3">
            <StyleCustomizePanel
              insert={insert}
              videoDuration={videoDuration}
              tracks={tracks}
              project={projectStyle}
              captionStyle={captionStyle}
              captionPreset={captionPreset}
              tab="style"
              context="insert"
              onPatchStyle={onPatchStyle}
              onResetField={onResetStyleField}
              onResetOverrides={onResetStyleOverrides}
              onResetPosition={onResetPosition}
              onApplyPreset={onApplyStylePreset}
              onApplyToTrack={onApplyStyleToTrack}
              onBeginGesture={onBeginGesture}
              onEndGesture={onEndGesture}
              presetLibrary={presetLibrary}
              isBlockOpen={styleBlocks.isOpen}
              onToggleBlock={styleBlocks.toggle}
            />
            <StyleCustomizePanel
              insert={insert}
              videoDuration={videoDuration}
              tracks={tracks}
              project={projectStyle}
              captionStyle={captionStyle}
              captionPreset={captionPreset}
              tab="motion"
              context="insert"
              onPatchStyle={onPatchStyle}
              onResetField={onResetStyleField}
              onResetOverrides={onResetStyleOverrides}
              onResetPosition={onResetPosition}
              onApplyPreset={onApplyStylePreset}
              onApplyToTrack={onApplyStyleToTrack}
              onBeginGesture={onBeginGesture}
              onEndGesture={onEndGesture}
              presetLibrary={presetLibrary}
              isBlockOpen={motionBlocks.isOpen}
              onToggleBlock={motionBlocks.toggle}
            />
          </div>
        ) : null}
      </details>
    </div>
  )
}

function strokeOnSafe(insert: Insert): boolean {
  const override = insert.styleRef?.overrides.text?.stroke?.enabled
  if (typeof override === "boolean") return override
  return getPresetStyle(insert.styleRef?.presetId || "legado").text.stroke.enabled
}

function YesNo({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <span className="inline-flex w-fit rounded-md border border-border p-0.5">
      {[true, false].map((value) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={on === value}
          className={cn("rounded px-2 py-0.5", on === value ? "bg-foreground text-background" : "text-muted-foreground")}
          onClick={() => onChange(value)}
        >
          {value ? "Sim" : "Não"}
        </button>
      ))}
    </span>
  )
}

function colorChoices(base: string, kit: ReturnType<typeof brandKitOf>) {
  const resolved = resolveColor(base, kit)
  return [
    { value: null, label: "Do estilo", swatch: resolved === "transparent" ? "#dddddd" : resolved },
    { value: "slot:primary", label: "Principal do kit", swatch: kit.primary },
    { value: "slot:accent", label: "Destaque do kit", swatch: kit.accent },
    { value: "slot:ink", label: "Tinta do kit", swatch: kit.ink },
    { value: "#FFFFFF", label: "Branco", swatch: "#FFFFFF" },
    { value: "#111111", label: "Preto", swatch: "#111111" },
  ]
}

function renderRuns(text: string, data: ProductData | undefined): ReactNode {
  const filled = displayRuns(text, data)
  if (filled.spans.length === 0) return filled.plain
  const pieces: React.ReactNode[] = []
  let cursor = 0
  filled.spans.forEach((span, index) => {
    if (span.start > cursor) pieces.push(filled.plain.slice(cursor, span.start))
    const slice = filled.plain.slice(span.start, span.end)
    pieces.push(
      <span
        key={index}
        className={cn(span.accent && "text-[#EE4D2D]", span.missing && "rounded bg-amber-200 px-0.5 text-amber-950")}
        style={span.strike ? { textDecoration: "line-through" } : undefined}
      >
        {slice}
      </span>,
    )
    cursor = span.end
  })
  if (cursor < filled.plain.length) pieces.push(filled.plain.slice(cursor))
  return pieces
}

function sampleText(text: string, data: ProductData | undefined): string {
  const plain = stripMarks(displayRuns(text, data).plain)
  if (plain.length <= 28) return text
  const cut = plain.slice(0, 28)
  const space = cut.lastIndexOf(" ")
  return `${space > 10 ? cut.slice(0, space) : cut}…`
}

function packMotion(packId: string) {
  const painted = getPresetStyle("duplo")
  return packId === "parado" ? stillAnimation(painted.animation) : selectPack(painted.animation, packId)
}
