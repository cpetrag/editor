"use client"

import { useEffect, useRef, useState } from "react"
import { Trash2, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import {
  clampInsert,
  CHIP_INSERT_TYPES,
  DEFAULT_CAPTION_STYLE,
  insertKind,
  MIN_DURATION,
  OVERLAY_X_MAX,
  OVERLAY_X_MIN,
  OVERLAY_Y_MAX,
  OVERLAY_Y_MIN,
  SCALE_MAX,
  SCALE_MIN,
  DEFAULT_CHIP_SCALE,
  scaleRangeLabel,
  type CaptionPreset,
  type CaptionStyle,
} from "@/lib/composition"
import { formatSeconds, formatTimecode as formatFieldTimecode, parseDecimal } from "@/lib/parse-decimal"
import { formatTimecode } from "@/lib/timecode"
import {
  INSERT_TYPES,
  INSERT_TYPE_MAP,
  ANIM_PRESETS,
  ANIM_MAP,
  POSITION_LABELS,
  type Insert,
  type InsertType,
  type InsertPosition,
} from "@/lib/inserts"
import { insertLabel } from "@/lib/insert-ops"
import { applyTextPreset } from "@/lib/text-presets"
import type { StyleLayer, TrackId } from "@/lib/style/types"
import { InsertStyleFields } from "@/components/insert-style-panel"
import { StyleCustomizePanel, type PresetLibraryHandlers } from "@/components/style-customize-panel"
import { BlockToolbar } from "@/components/collapsible-block"
import type { PanelBlockController } from "@/components/use-panel-blocks"
import { PLAY_H, PLAY_W } from "@/lib/compose/layout"
import { NUDGE_HINT } from "@/lib/compose/keyboard-scope"
import { layoutCaptionInsertForPlay } from "@/lib/compose/caption-layout"
import { trackStyleForInsert } from "@/lib/style-preset"
import { TEXT_OVERFLOW_TOOLTIP, canvasTextMeasure, layoutInsertText } from "@/lib/compose/layout-text"
import { resolveLayerStyle } from "@/lib/compose/resolve-style"
import { scrollIntoPanelViewport } from "@/lib/scroll-panel"

interface InsertCardProps {
  insert: Insert
  index: number
  videoDuration: number
  expanded: boolean
  selected: boolean
  overflowing: boolean
  missingLogo?: boolean
  brandFontId?: string
  onToggle: () => void
  onChange: (id: string, patch: Partial<Insert>) => void
  onRemove: (id: string) => void
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  captionStyle?: CaptionStyle
  captionPreset?: CaptionPreset
  onChangeCaptionStyle?: (patch: Partial<CaptionStyle>) => void
  tracks?: Partial<Record<TrackId, StyleLayer>>
  projectStyle?: StyleLayer
  onPatchStyle?: (path: string, value: unknown) => void
  onResetStyleField?: (path: string) => void
  onResetStyleOverrides?: () => void
  onResetPosition?: () => void
  onApplyStylePreset?: (presetId: string, mode: "preserve" | "clean") => void
  onApplyStyleToTrack?: () => void
  presetLibrary?: PresetLibraryHandlers
  styleBlocks: PanelBlockController
  motionBlocks: PanelBlockController
  onHookVariations?: () => void
}

type CardTab = "content" | "style" | "motion"

const CARD_TABS: Array<{ id: CardTab; label: string }> = [
  { id: "content", label: "Conteúdo" },
  { id: "style", label: "Estilo" },
  { id: "motion", label: "Movimento" },
]

const POSITIONS: InsertPosition[] = ["top", "center", "bottom"]

function formatDraft(value: number): string {
  return formatSeconds(value)
}

function TimeField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string
  label: string
  value: number
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState(formatDraft(value))

  useEffect(() => {
    setDraft(formatDraft(value))
  }, [value])

  function commit() {
    const parsed = parseDecimal(draft)
    if (parsed === null) {
      setDraft(formatDraft(value))
      return
    }
    onCommit(parsed)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          }
        }}
      />
      <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
        {formatFieldTimecode(value)}
      </p>
    </Field>
  )
}

function OverlayNumberField({
  id,
  label,
  value,
  onCommit,
  min,
  max,
  decimals = 1,
}: {
  id: string
  label: string
  value: number
  onCommit: (next: number) => void
  min: number
  max: number
  decimals?: number
}) {
  const [draft, setDraft] = useState(formatDraft(value))

  useEffect(() => {
    setDraft(formatDraft(value))
  }, [value])

  function commit() {
    const parsed = parseDecimal(draft)
    if (parsed === null) {
      setDraft(formatDraft(value))
      return
    }
    const factor = 10 ** decimals
    const next = Math.min(max, Math.max(min, Math.round(parsed * factor) / factor))
    onCommit(next)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
      />
    </Field>
  )
}

export function InsertCard({
  insert,
  index: _index,
  videoDuration,
  expanded,
  selected,
  overflowing,
  missingLogo = false,
  brandFontId = "geist",
  onToggle,
  onChange,
  onRemove,
  onBeginInsertGesture,
  onEndInsertGesture,
  captionStyle = DEFAULT_CAPTION_STYLE,
  captionPreset = "viral",
  onChangeCaptionStyle,
  tracks,
  projectStyle,
  onPatchStyle,
  onResetStyleField,
  onResetStyleOverrides,
  onResetPosition,
  onApplyStylePreset,
  onApplyStyleToTrack,
  presetLibrary,
  styleBlocks,
  motionBlocks,
  onHookVariations,
}: InsertCardProps) {
  const meta = INSERT_TYPE_MAP[insert.type]
  const kind = insertKind(insert)
  const rootRef = useRef<HTMLDivElement>(null)
  const [durationNote, setDurationNote] = useState(false)
  const [tab, setTab] = useState<CardTab>("content")
  const [textOverflow, setTextOverflow] = useState(false)
  const label = insertLabel(insert)
  const range = `${formatTimecode(insert.start)}–${formatTimecode(insert.start + insert.duration)}`

  useEffect(() => {
    if (selected) scrollIntoPanelViewport(rootRef.current)
  }, [selected])

  useEffect(() => {
    if (kind !== "text" && kind !== "caption") {
      setTextOverflow(false)
      return
    }
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const layoutInsert =
      kind === "caption"
        ? layoutCaptionInsertForPlay(
            insert,
            captionStyle,
            captionPreset,
            trackStyleForInsert(insert, tracks, videoDuration),
            projectStyle ?? {},
          )
        : insert
    const style = resolveLayerStyle(layoutInsert, brandFontId)
    const layout = layoutInsertText(
      layoutInsert,
      brandFontId,
      { width: PLAY_W, height: PLAY_H },
      ctx ? canvasTextMeasure(ctx, style.fontWeight, style.fontFamily) : undefined,
    )
    setTextOverflow(Boolean(layout?.overflow))
  }, [brandFontId, captionPreset, captionStyle, insert, kind, projectStyle, tracks, videoDuration])

  function changeType(value: InsertType) {
    const nextMeta = INSERT_TYPE_MAP[value]
    onChange(insert.id, {
      type: value,
      text: nextMeta.hasText ? insert.text || nextMeta.defaultText : undefined,
    })
  }

  function commitTiming(field: "start" | "duration", value: number) {
    const next = clampInsert(
      { ...insert, [field]: value },
      videoDuration > 0 ? videoDuration : insert.start + Math.max(insert.duration, MIN_DURATION),
      field,
    )
    if (next.duration + 1e-6 < insert.duration) {
      setDurationNote(true)
    } else {
      setDurationNote(false)
    }
    onChange(insert.id, { start: next.start, duration: next.duration })
  }

  return (
    <div
      ref={rootRef}
      data-insert-card
      data-insert-id={insert.id}
      tabIndex={selected ? 0 : -1}
      className={cn(
        "group/insert rounded-lg border bg-card outline-none",
        selected ? "border-brand ring-1 ring-brand/40" : "border-border",
        overflowing && "border-destructive/60",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Recolher" : "Expandir"} ${label}`}
          onClick={onToggle}
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: meta.dotVar }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {label}
            <span className="text-muted-foreground">
              {" "}
              · {range}
              {kind === "chip"
                ? ` · ${POSITION_LABELS[insert.anchor ?? "top"]}`
                : ""}
            </span>
          </span>
          {textOverflow ? (
            <span
              className="shrink-0 text-amber-500"
              title={TEXT_OVERFLOW_TOOLTIP}
              aria-label={TEXT_OVERFLOW_TOOLTIP}
            >
              <AlertTriangle className="size-3.5" />
            </span>
          ) : null}
        </button>
        {insert.role === "gancho" && onHookVariations ? (
          <button
            type="button"
            className="shrink-0 rounded-md px-1.5 py-1 text-[0.65rem] font-medium text-brand hover:bg-muted"
            onClick={onHookVariations}
          >
            Variações
          </button>
        ) : null}
        <Button
          variant="destructive"
          size="icon-sm"
          onClick={() => onRemove(insert.id)}
          aria-label={`Remover ${label}`}
        >
          <Trash2 />
        </Button>
      </div>

      {overflowing ? (
        <p className="px-3 pb-1 text-[0.7rem] text-destructive">
          Este insert passa do fim do vídeo.
        </p>
      ) : null}

      {kind === "text" && !insert.text?.trim() ? (
        <div className="flex items-center justify-between gap-2 px-3 pb-2" role="status">
          <p className="flex items-center gap-1.5 text-[0.7rem] text-amber-500">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            Texto vazio — não aparece no vídeo.
          </p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onRemove(insert.id)}
          >
            Remover
          </Button>
        </div>
      ) : null}

      {missingLogo ? (
        <p className="px-3 pb-1 text-[0.7rem] text-muted-foreground">
          Sem logo configurada — este insert não entra no vídeo.
        </p>
      ) : null}

      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <div className="flex items-center gap-1">
          <div
            role="tablist"
            aria-label="Campos do insert"
            className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {CARD_TABS.map((item) => {
              const selectedTab = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    selectedTab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <BlockToolbar
            hidden={tab === "content" || kind === "sticker"}
            allOpen={tab === "motion" ? motionBlocks.allOpen : styleBlocks.allOpen}
            onExpandAll={tab === "motion" ? motionBlocks.expandAll : styleBlocks.expandAll}
            onCollapseAll={tab === "motion" ? motionBlocks.collapseAll : styleBlocks.collapseAll}
          />
          </div>

          {tab === "content" ? (
            <div className="flex flex-col gap-3" role="tabpanel">
              {kind === "chip" ? (
                <Field>
                  <FieldLabel htmlFor={`type-${insert.id}`}>Tipo</FieldLabel>
                  <Select
                    value={insert.type}
                    onValueChange={(value) => changeType(value as InsertType)}
                  >
                    <SelectTrigger id={`type-${insert.id}`} className="w-full">
                      <SelectValue>
                        {(value) => (
                          <>
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: INSERT_TYPE_MAP[value as InsertType]?.dotVar }}
                              aria-hidden
                            />
                            {INSERT_TYPE_MAP[value as InsertType]?.label}
                          </>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {INSERT_TYPES.filter((item) =>
                          CHIP_INSERT_TYPES.includes(item.value),
                        ).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: t.dotVar }}
                              aria-hidden
                            />
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              {kind === "text" || kind === "caption" ? (
                <Field>
                  <FieldLabel htmlFor={`text-${insert.id}`}>Texto</FieldLabel>
                  <Textarea
                    id={`text-${insert.id}`}
                    value={insert.text ?? ""}
                    placeholder={kind === "caption" ? "Texto da linha" : "NOVO"}
                    rows={3}
                    onChange={(e) => onChange(insert.id, { text: e.target.value })}
                    onFocus={() => onBeginInsertGesture?.()}
                    onBlur={() => onEndInsertGesture?.()}
                  />
                </Field>
              ) : null}

              {kind === "chip" && meta.hasText ? (
                <Field>
                  <FieldLabel htmlFor={`text-${insert.id}`}>Texto</FieldLabel>
                  <Input
                    id={`text-${insert.id}`}
                    value={insert.text ?? ""}
                    placeholder={meta.defaultText}
                    onChange={(e) => onChange(insert.id, { text: e.target.value })}
                    onFocus={() => onBeginInsertGesture?.()}
                    onBlur={() => onEndInsertGesture?.()}
                  />
                </Field>
              ) : null}

              {kind === "text" ? (
                <p className="text-[0.7rem] text-muted-foreground">
                  Tempo: arraste o clipe na timeline. Números ficam em Movimento → Avançado.
                </p>
              ) : (
              <div className="grid grid-cols-2 gap-3">
                <TimeField
                  id={`start-${insert.id}`}
                  label="Início (s)"
                  value={insert.start}
                  onCommit={(start) => commitTiming("start", start)}
                />
                <TimeField
                  id={`duration-${insert.id}`}
                  label="Duração (s)"
                  value={insert.duration}
                  onCommit={(duration) => commitTiming("duration", duration)}
                />
              </div>
              )}
              {durationNote ? (
                <p className="text-[0.7rem] text-muted-foreground">
                  A duração foi limitada ao fim do vídeo.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "style" ? (
            <div className="flex flex-col gap-2" role="tabpanel">
              {kind !== "sticker" && onPatchStyle && onResetStyleField && onResetStyleOverrides && onResetPosition && onApplyStylePreset && onApplyStyleToTrack ? (
                <StyleCustomizePanel
                  insert={insert}
                  videoDuration={videoDuration}
                  tracks={tracks}
                  project={projectStyle}
                  captionStyle={captionStyle}
                  captionPreset={captionPreset}
                  tab="style"
                  isBlockOpen={styleBlocks.isOpen}
                  onToggleBlock={styleBlocks.toggle}
                  onPatchStyle={onPatchStyle}
                  onResetField={onResetStyleField}
                  onResetOverrides={onResetStyleOverrides}
                  onResetPosition={onResetPosition}
                  onApplyPreset={onApplyStylePreset}
                  onApplyToTrack={onApplyStyleToTrack}
                  onBeginGesture={onBeginInsertGesture}
                  onEndGesture={onEndInsertGesture}
                  presetLibrary={presetLibrary}
                  onApplyTextPreset={(id) => onChange(insert.id, applyTextPreset(insert, id))}
                />
              ) : (
                <InsertStyleFields
                  insert={insert}
                  brandFontId={brandFontId}
                  onChange={onChange}
                  onBeginInsertGesture={onBeginInsertGesture}
                  onEndInsertGesture={onEndInsertGesture}
                  captionStyle={captionStyle}
                  onChangeCaptionStyle={onChangeCaptionStyle}
                />
              )}
            </div>
          ) : null}

          {tab === "motion" ? (
            <div className="flex flex-col gap-3" role="tabpanel">
              {kind === "text" || kind === "caption" ? (
                onPatchStyle && onResetStyleField && onResetStyleOverrides && onResetPosition && onApplyStylePreset && onApplyStyleToTrack ? (
                  <>
                  <StyleCustomizePanel
                    insert={insert}
                    videoDuration={videoDuration}
                    tracks={tracks}
                    project={projectStyle}
                    captionStyle={captionStyle}
                    captionPreset={captionPreset}
                    tab="motion"
                    isBlockOpen={motionBlocks.isOpen}
                    onToggleBlock={motionBlocks.toggle}
                    onPatchStyle={onPatchStyle}
                    onResetField={onResetStyleField}
                    onResetOverrides={onResetStyleOverrides}
                    onResetPosition={onResetPosition}
                    onApplyPreset={onApplyStylePreset}
                    onApplyToTrack={onApplyStyleToTrack}
                    onBeginGesture={onBeginInsertGesture}
                    onEndGesture={onEndInsertGesture}
                    presetLibrary={presetLibrary}
                  />
                  </>
                ) : null
              ) : null}
              {kind === "text" ? (
                <details className="rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium">Avançado — tempo</summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <TimeField
                      id={`start-adv-${insert.id}`}
                      label="Início (s)"
                      value={insert.start}
                      onCommit={(start) => commitTiming("start", start)}
                    />
                    <TimeField
                      id={`duration-adv-${insert.id}`}
                      label="Duração (s)"
                      value={insert.duration}
                      onCommit={(duration) => commitTiming("duration", duration)}
                    />
                  </div>
                </details>
              ) : null}
              {kind === "text" || kind === "caption" ? null : (
                <>
              {kind === "chip" ? (
                <Field>
                  <FieldLabel>Posição</FieldLabel>
                  <ToggleGroup
                    value={[insert.anchor ?? "top"]}
                    onValueChange={(value) => {
                      const next = value[0] as InsertPosition | undefined
                      if (next) onChange(insert.id, { anchor: next, x: undefined, y: undefined })
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    {POSITIONS.map((pos) => (
                      <ToggleGroupItem key={pos} value={pos} className="flex-1 text-xs">
                        {POSITION_LABELS[pos]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              ) : null}

              {kind !== "chip" || typeof insert.x === "number" || typeof insert.y === "number" ? (
                <div className="grid grid-cols-2 gap-3">
                  <OverlayNumberField
                    id={`x-${insert.id}`}
                    label="X (%)"
                    value={insert.x ?? 50}
                    min={OVERLAY_X_MIN}
                    max={OVERLAY_X_MAX}
                    decimals={1}
                    onCommit={(x) => onChange(insert.id, { x })}
                  />
                  <OverlayNumberField
                    id={`y-${insert.id}`}
                    label="Y (%)"
                    value={insert.y ?? 50}
                    min={OVERLAY_Y_MIN}
                    max={OVERLAY_Y_MAX}
                    decimals={1}
                    onCommit={(y) => onChange(insert.id, { y })}
                  />
                  <p className="col-span-2 text-[0.7rem] text-muted-foreground" title={NUDGE_HINT}>
                    {NUDGE_HINT}
                  </p>
                  {kind === "chip" || kind === "sticker" ? (
                    <OverlayNumberField
                      id={`scale-${insert.id}`}
                      label={scaleRangeLabel()}
                      value={insert.scale ?? (kind === "chip" ? DEFAULT_CHIP_SCALE : 0.7)}
                      min={SCALE_MIN}
                      max={SCALE_MAX}
                      decimals={3}
                      onCommit={(scale) => onChange(insert.id, { scale })}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <OverlayNumberField
                    id={`scale-${insert.id}`}
                    label={scaleRangeLabel()}
                    value={insert.scale ?? DEFAULT_CHIP_SCALE}
                    min={SCALE_MIN}
                    max={SCALE_MAX}
                    decimals={3}
                    onCommit={(scale) => onChange(insert.id, { scale })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor={`anim-in-${insert.id}`}>Entrada</FieldLabel>
                  <Select
                    value={insert.animIn ?? "none"}
                    onValueChange={(value) =>
                      onChange(insert.id, { animIn: value as Insert["animIn"] })
                    }
                  >
                    <SelectTrigger id={`anim-in-${insert.id}`} className="w-full">
                      <SelectValue>
                        {(value) => ANIM_MAP[value as string]?.label ?? "Nenhuma"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ANIM_PRESETS.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`anim-out-${insert.id}`}>Saída</FieldLabel>
                  <Select
                    value={insert.animOut ?? "none"}
                    onValueChange={(value) =>
                      onChange(insert.id, { animOut: value as Insert["animOut"] })
                    }
                  >
                    <SelectTrigger id={`anim-out-${insert.id}`} className="w-full">
                      <SelectValue>
                        {(value) => ANIM_MAP[value as string]?.label ?? "Nenhuma"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ANIM_PRESETS.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
