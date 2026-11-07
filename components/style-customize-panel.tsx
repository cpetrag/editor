"use client"

import { useMemo, useState } from "react"

import { CaptionPresetRow } from "@/components/caption-style-card"
import { CollapsibleBlock } from "@/components/collapsible-block"
import { StylePresetMenu } from "@/components/style-preset-menu"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ColorField } from "@/components/insert-style-panel"
import { TextPresetChips } from "@/components/text-preset-chips"
import { FONT_MAP, FONT_OPTIONS } from "@/lib/inserts"
import { formatPanelNumber } from "@/lib/panel-number"
import { FontOptionLabel } from "@/components/font-option-label"
import { WEIGHTS_BY_FONT, clampFontWeight, type FontId, type FontWeight } from "@/lib/compose/insert-style"
import { MotionPanel } from "@/components/motion-panel"
import { insertKind, type CaptionPreset, type CaptionStyle, type CompositionInsert } from "@/lib/composition"
import type { RetentionCuts } from "@/lib/insert-ops"
import { chipsForContext, trackStyleForInsert } from "@/lib/style-preset"
import { LEGADO_PRESET_ID } from "@/lib/style/presets"
import { DEFAULT_TEXT_PRESET_ID, isTextPresetId } from "@/lib/text-presets"
import {
  activeAnimRecipe,
  legadoPaintLabel,
  resolveStyleForEditor,
} from "@/lib/style/editor-style"
import {
  canWritePresetId,
  ORIGIN_LABEL,
  PRESETS,
  SHADOW_SHORTCUTS,
  applyAnimRecipe,
  fieldOrigin,
  hasInsertOverrides,
  originTitle,
  resolveCaptionInsertStyle,
  workingStyleRef,
  type AnimRecipeName,
  type FieldOrigin,
  type ShadowShortcutId,
  type StyleLayer,
} from "@/lib/style"
import type { AnimTarget, Animation, UserPreset } from "@/lib/style/types"

export type PresetLibraryHandlers = {
  presets: UserPreset[]
  saveAs: (label: string) => void
  rename: (id: string, label: string) => void
  remove: (id: string) => void
  update: (id: string) => void
  exportAll: () => void
  importFile: (file: File) => void
}

function rangeGestureHandlers(onBegin?: () => void, onEnd?: () => void) {
  return {
    onPointerDown: (event: React.PointerEvent<HTMLInputElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      onBegin?.()
    },
    onPointerUp: () => onEnd?.(),
    onPointerCancel: () => onEnd?.(),
    onLostPointerCapture: () => onEnd?.(),
  }
}

function Accordion({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <CollapsibleBlock title={title} summary={summary} open={open} onToggle={onToggle}>
      {children}
    </CollapsibleBlock>
  )
}

function colorLabel(color: string): string {
  const hex = color.trim().toLowerCase()
  if (hex === "#000" || hex === "#000000" || hex === "black") return "preto"
  if (hex === "#fff" || hex === "#ffffff" || hex === "white") return "branco"
  return color
}

const HIGHLIGHT_SUMMARY: Record<string, string> = {
  nenhum: "nenhum",
  "palavra-ativa": "palavra ativa",
  "karaoke-fill": "karaokê",
  "palavras-chave": "palavras-chave",
}

function OriginField({
  label,
  origin,
  htmlFor,
  onReset,
  children,
}: {
  label: string
  origin: FieldOrigin
  htmlFor?: string
  onReset: () => void
  children: React.ReactNode
}) {
  const modified = origin === "insert"
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={htmlFor} title={originTitle(origin)}>
          {modified ? (
            <span className="text-brand" aria-hidden>
              •
            </span>
          ) : null}
          {label}
        </FieldLabel>
        {modified ? (
          <button
            type="button"
            className="text-[0.7rem] text-muted-foreground hover:text-foreground"
            title={`Resetar para ${ORIGIN_LABEL[origin]}`}
            onClick={onReset}
          >
            Reset
          </button>
        ) : null}
      </div>
      {children}
    </Field>
  )
}

function NumberInput({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  onBegin,
  onEnd,
}: {
  id: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (next: number) => void
  onBegin?: () => void
  onEnd?: () => void
}) {
  return (
    <input
      id={id}
      type="number"
      className="h-7 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
      value={Number.isFinite(value) ? formatPanelNumber(value) : "0"}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      onFocus={() => onBegin?.()}
      onBlur={() => onEnd?.()}
    />
  )
}

const RECIPE_LABEL: Record<AnimRecipeName, string> = {
  pop: "Pop",
  "slide-up": "Slide up",
  "zoom-out": "Zoom out",
  "blur-in": "Blur in",
  typewriter: "Typewriter",
}

const SHADOW_SHORTCUT_LABEL: Record<ShadowShortcutId, string> = {
  none: "Nenhuma",
  soft: "Suave",
  hard: "Dura",
  glow: "Glow",
}

export function StyleCustomizePanel({
  insert,
  videoDuration,
  tracks,
  project,
  captionStyle,
  captionPreset = "viral",
  tab,
  onPatchStyle,
  onResetField,
  onResetOverrides,
  onResetPosition,
  onApplyPreset,
  onApplyToTrack,
  onBeginGesture,
  onEndGesture,
  presetLibrary,
  context = "insert",
  onApplyTextPreset,
  onSelectLook,
  captionInserts,
  isBlockOpen,
  onToggleBlock,
  getPlayhead,
  onPlayRange,
  retentionCuts,
}: {
  insert: CompositionInsert
  videoDuration: number
  tracks?: Partial<Record<"gancho" | "prova" | "cta", StyleLayer>>
  project?: StyleLayer
  captionStyle?: CaptionStyle
  captionPreset?: CaptionPreset
  tab: "style" | "motion"
  onPatchStyle: (path: string, value: unknown) => void
  onResetField: (path: string) => void
  onResetOverrides: () => void
  onResetPosition: () => void
  onApplyPreset: (presetId: string, mode: "preserve" | "clean") => void
  onApplyToTrack: () => void
  onBeginGesture?: () => void
  onEndGesture?: () => void
  presetLibrary?: PresetLibraryHandlers
  context?: "insert" | "caption"
  onApplyTextPreset?: (presetId: string) => void
  onSelectLook?: (lookId: string) => void
  captionInserts?: CompositionInsert[]
  isBlockOpen: (id: string) => boolean
  onToggleBlock: (id: string) => void
  getPlayhead?: () => number
  onPlayRange?: (start: number, end: number) => void
  retentionCuts?: RetentionCuts | null
}) {
  const kind = insertKind(insert)
  const [savingAs, setSavingAs] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const userPresets = presetLibrary?.presets ?? []
  const track = useMemo(
    () => trackStyleForInsert(insert, tracks, videoDuration),
    [insert, tracks, videoDuration],
  )
  const projectLayer = project ?? {}
  const resolved = useMemo(() => {
    if (kind === "caption" && captionStyle) {
      return resolveCaptionInsertStyle(insert, captionStyle, captionPreset, track, projectLayer)
    }
    return resolveStyleForEditor(insert, track, projectLayer)
  }, [captionPreset, captionStyle, insert, kind, projectLayer, track])
  const originOf = (path: string): FieldOrigin => fieldOrigin(path, insert, track, projectLayer)
  const chips = useMemo(
    () => chipsForContext(insert, videoDuration, userPresets),
    [insert, userPresets, videoDuration],
  )
  const activeRef = workingStyleRef(insert, track, projectLayer)
  const ownPreset = userPresets.find((preset) => preset.id === activeRef.presetId)
  const factoryLabel = PRESETS[activeRef.presetId]?.label ?? ownPreset?.label ?? activeRef.presetId
  const paintLabel =
    activeRef.presetId === LEGADO_PRESET_ID
      ? legadoPaintLabel(insert.preset ?? "bold-outline")
      : undefined
  const presetLabel = paintLabel ? `${factoryLabel} · ${paintLabel}` : factoryLabel
  const isMine = canWritePresetId(activeRef.presetId)
  const modified = hasInsertOverrides(insert.styleRef)
  const activeRecipe = activeAnimRecipe(insert, resolved, track, projectLayer)
  const weightOptions = WEIGHTS_BY_FONT[resolved.text.fontFamily as FontId] ?? [400]
  const weightValue = clampFontWeight(
    (resolved.text.fontFamily as FontId) ?? "geist",
    resolved.text.fontWeight as FontWeight,
  )
  const shadows = resolved.text.shadows
  const activeShadow = (Object.keys(SHADOW_SHORTCUTS) as ShadowShortcutId[]).find(
    (id) => JSON.stringify(SHADOW_SHORTCUTS[id]) === JSON.stringify(shadows),
  )
  const gesture = rangeGestureHandlers(onBeginGesture, onEndGesture)
  const fontLabel = FONT_MAP[resolved.text.fontFamily]?.label ?? resolved.text.fontFamily
  const typeSummary = `${fontLabel} · ${formatPanelNumber(resolved.text.fontSize)}px · ${resolved.text.textTransform === "uppercase" ? "AA" : "Aa"}`
  const alignLabel =
    resolved.text.textAlign === "left" ? "esquerda" : resolved.text.textAlign === "right" ? "direita" : "centro"
  const layoutSummary = `${alignLabel} · ${formatPanelNumber(resolved.text.maxWidth)}%`
  const fillSummary = resolved.text.gradient.enabled ? "gradiente" : resolved.text.color
  const strokeSummary = resolved.text.stroke.enabled
    ? `${formatPanelNumber(resolved.text.stroke.width)}px ${colorLabel(resolved.text.stroke.color)}`
    : "desligado"
  const bgSummary = resolved.text.background.enabled ? "ligado" : "desligado"
  const highlightSummary = HIGHLIGHT_SUMMARY[resolved.text.highlight.mode] ?? resolved.text.highlight.mode
  const enterSummary = activeRecipe ? RECIPE_LABEL[activeRecipe] : "personalizada"
  const exitSummary = `${formatPanelNumber(resolved.animation.exit.durationInFrames)} frames`
  const presetMenu = (
    <StylePresetMenu
      presetLibrary={presetLibrary}
      modified={modified}
      positionTouched={Boolean(insert.transform?.touchedByUser)}
      isMine={isMine}
      showApplyToTrack={context === "insert"}
      onSaveAs={beginSaveAs}
      onApplyClean={() => onApplyPreset(activeRef.presetId, "clean")}
      onResetStyle={onResetOverrides}
      onResetPosition={onResetPosition}
      onApplyToTrack={onApplyToTrack}
      onUpdate={isMine ? () => presetLibrary?.update(activeRef.presetId) : undefined}
      onRename={isMine ? beginRename : undefined}
      onRemove={isMine ? () => presetLibrary?.remove(activeRef.presetId) : undefined}
    />
  )

  function beginSaveAs() {
    setSaveName(`Cópia de ${presetLabel}`)
    setSavingAs(true)
    setRenaming(false)
  }

  function confirmSaveAs() {
    const label = saveName.trim()
    if (!label || !presetLibrary) return
    presetLibrary.saveAs(label)
    setSavingAs(false)
  }

  function beginRename() {
    setRenameValue(presetLabel)
    setRenaming(true)
    setSavingAs(false)
  }

  function confirmRename() {
    const label = renameValue.trim()
    if (!label || !presetLibrary || !isMine) return
    presetLibrary.rename(activeRef.presetId, label)
    setRenaming(false)
  }

  function patchAnimTarget(basePath: string, current: AnimTarget, key: keyof AnimTarget, value: number) {
    onPatchStyle(basePath, { ...current, [key]: value })
  }

  if (kind === "sticker") return null

  return (
    <div className="flex flex-col gap-3">
      {context === "caption" && tab === "style" && onSelectLook ? (
        <CaptionPresetRow
          inserts={captionInserts ?? [insert]}
          captionStyle={captionStyle}
          captionPreset={captionPreset}
          userPresets={userPresets}
          onSelectLook={onSelectLook}
          menu={presetMenu}
        />
      ) : tab === "style" ? (
        <TextPresetChips
          selectedId={insert.preset}
          modified={modified}
          showTextPresets={kind === "text" && Boolean(onApplyTextPreset)}
          onSelect={(id) => onApplyTextPreset?.(id)}
          onReset={
            onApplyTextPreset
              ? () =>
                  onApplyTextPreset(
                    isTextPresetId(insert.preset) ? insert.preset : DEFAULT_TEXT_PRESET_ID,
                  )
              : undefined
          }
          menu={presetMenu}
          stylePresets={chips}
          activeStyleId={activeRef.presetId}
          userPresets={userPresets}
          resolvedStyle={resolved}
          onSelectStyle={(id) => onApplyPreset(id, "preserve")}
        />
      ) : null}
      {tab === "style" ? (
      <div className="flex flex-col gap-2">
        {savingAs ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              aria-label="Nome do novo preset"
              className="h-7 min-w-[8rem] flex-1 text-xs"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmSaveAs()
                if (event.key === "Escape") setSavingAs(false)
              }}
            />
            <Button type="button" size="xs" onClick={confirmSaveAs} disabled={!saveName.trim()}>
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => setSavingAs(false)}>
              Cancelar
            </Button>
          </div>
        ) : renaming ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              aria-label="Novo nome do preset"
              className="h-7 min-w-[8rem] flex-1 text-xs"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmRename()
                if (event.key === "Escape") setRenaming(false)
              }}
            />
            <Button type="button" size="xs" onClick={confirmRename} disabled={!renameValue.trim()}>
              Renomear
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => setRenaming(false)}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </div>
      ) : null}

      {tab === "style" ? (
        <>
          <Accordion title="Tipografia" summary={typeSummary} open={isBlockOpen("type")} onToggle={() => onToggleBlock("type")}>
            <OriginField
              label="Fonte"
              origin={originOf("text.fontFamily")}
              htmlFor={`font-${insert.id}`}
              onReset={() => onResetField("text.fontFamily")}
            >
              <Select
                value={resolved.text.fontFamily}
                onValueChange={(value) => onPatchStyle("text.fontFamily", value)}
              >
                <SelectTrigger id={`font-${insert.id}`} className="h-auto min-h-9 w-full py-1.5 *:data-[slot=select-value]:line-clamp-none">
                  <SelectValue>
                    {(value) => (
                      <FontOptionLabel
                        font={FONT_OPTIONS.find((item) => item.id === value)}
                        fallback={value}
                      />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FONT_OPTIONS.map((font) => (
                      <SelectItem key={font.id} value={font.id} className="h-auto items-start py-1.5">
                        <FontOptionLabel font={font} fallback={font.id} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </OriginField>
            <OriginField
              label={`Tamanho ${formatPanelNumber(resolved.text.fontSize)}px · quadro 1080`}
              origin={originOf("text.fontSize")}
              htmlFor={`size-${insert.id}`}
              onReset={() => onResetField("text.fontSize")}
            >
              <input
                id={`size-${insert.id}`}
                type="range"
                min={40}
                max={360}
                step={1}
                value={resolved.text.fontSize}
                onChange={(event) => onPatchStyle("text.fontSize", Number(event.target.value))}
                {...gesture}
                className="h-7 w-full accent-brand"
              />
            </OriginField>
            <OriginField
              label="Peso"
              origin={originOf("text.fontWeight")}
              htmlFor={`weight-${insert.id}`}
              onReset={() => onResetField("text.fontWeight")}
            >
              <Select
                value={String(weightValue)}
                onValueChange={(value) => onPatchStyle("text.fontWeight", Number(value))}
              >
                <SelectTrigger id={`weight-${insert.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {weightOptions.map((weight) => (
                      <SelectItem key={weight} value={String(weight)}>
                        {weight}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </OriginField>
            <OriginField
              label="Caixa"
              origin={originOf("text.textTransform")}
              onReset={() => onResetField("text.textTransform")}
            >
              <ToggleGroup
                value={[resolved.text.textTransform]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next === "none" || next === "uppercase") onPatchStyle("text.textTransform", next)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="none" className="flex-1 text-xs">
                  Aa
                </ToggleGroupItem>
                <ToggleGroupItem value="uppercase" className="flex-1 text-xs">
                  AA
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
          </Accordion>

          <Accordion title="Layout" summary={layoutSummary} open={isBlockOpen("layout")} onToggle={() => onToggleBlock("layout")}>
            <OriginField
              label="Alinhamento"
              origin={originOf("text.textAlign")}
              onReset={() => onResetField("text.textAlign")}
            >
              <ToggleGroup
                value={[resolved.text.textAlign]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next === "left" || next === "center" || next === "right") {
                    onPatchStyle("text.textAlign", next)
                  }
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="left" className="flex-1 text-xs">
                  Esq
                </ToggleGroupItem>
                <ToggleGroupItem value="center" className="flex-1 text-xs">
                  Centro
                </ToggleGroupItem>
                <ToggleGroupItem value="right" className="flex-1 text-xs">
                  Dir
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
            <OriginField
              label={`Largura máx. ${formatPanelNumber(resolved.text.maxWidth)}%`}
              origin={originOf("text.maxWidth")}
              htmlFor={`mw-${insert.id}`}
              onReset={() => onResetField("text.maxWidth")}
            >
              <input
                id={`mw-${insert.id}`}
                type="range"
                min={20}
                max={100}
                step={1}
                value={resolved.text.maxWidth}
                onChange={(event) => onPatchStyle("text.maxWidth", Number(event.target.value))}
                {...gesture}
                className="h-7 w-full accent-brand"
              />
            </OriginField>
            <div className="grid grid-cols-2 gap-3">
              <OriginField
                label="Espaçamento"
                origin={originOf("text.letterSpacing")}
                htmlFor={`ls-${insert.id}`}
                onReset={() => onResetField("text.letterSpacing")}
              >
                <NumberInput
                  id={`ls-${insert.id}`}
                  value={resolved.text.letterSpacing}
                  step={0.01}
                  onChange={(value) => onPatchStyle("text.letterSpacing", value)}
                  onBegin={onBeginGesture}
                  onEnd={onEndGesture}
                />
              </OriginField>
              <OriginField
                label="Altura da linha"
                origin={originOf("text.lineHeight")}
                htmlFor={`lh-${insert.id}`}
                onReset={() => onResetField("text.lineHeight")}
              >
                <NumberInput
                  id={`lh-${insert.id}`}
                  value={resolved.text.lineHeight}
                  step={0.05}
                  min={0.8}
                  max={2}
                  onChange={(value) => onPatchStyle("text.lineHeight", value)}
                  onBegin={onBeginGesture}
                  onEnd={onEndGesture}
                />
              </OriginField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <OriginField
                label="X (%)"
                origin={originOf("text.x")}
                htmlFor={`sx-${insert.id}`}
                onReset={() => onResetField("text.x")}
              >
                <NumberInput
                  id={`sx-${insert.id}`}
                  value={resolved.text.x}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(value) => onPatchStyle("text.x", value)}
                  onBegin={onBeginGesture}
                  onEnd={onEndGesture}
                />
              </OriginField>
              <OriginField
                label="Y (%)"
                origin={originOf("text.y")}
                htmlFor={`sy-${insert.id}`}
                onReset={() => onResetField("text.y")}
              >
                <NumberInput
                  id={`sy-${insert.id}`}
                  value={resolved.text.y}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(value) => onPatchStyle("text.y", value)}
                  onBegin={onBeginGesture}
                  onEnd={onEndGesture}
                />
              </OriginField>
              <OriginField
                label="Rotação"
                origin={originOf("text.rotation")}
                htmlFor={`rot-${insert.id}`}
                onReset={() => onResetField("text.rotation")}
              >
                <NumberInput
                  id={`rot-${insert.id}`}
                  value={resolved.text.rotation}
                  onChange={(value) => onPatchStyle("text.rotation", value)}
                  onBegin={onBeginGesture}
                  onEnd={onEndGesture}
                />
              </OriginField>
            </div>
          </Accordion>

          <Accordion title="Preenchimento" summary={fillSummary} open={isBlockOpen("fill")} onToggle={() => onToggleBlock("fill")}>
            <OriginField
              label="Cor"
              origin={originOf("text.color")}
              htmlFor={`color-${insert.id}`}
              onReset={() => onResetField("text.color")}
            >
              <ColorField
                id={`color-${insert.id}`}
                label="Hex"
                value={resolved.text.color}
                onChange={(color) => {
                  if (color) onPatchStyle("text.color", color)
                }}
              />
            </OriginField>
            <OriginField
              label="Gradiente"
              origin={originOf("text.gradient.enabled")}
              onReset={() => onResetField("text.gradient.enabled")}
            >
              <ToggleGroup
                value={[resolved.text.gradient.enabled ? "on" : "off"]}
                onValueChange={(value) => onPatchStyle("text.gradient.enabled", value[0] === "on")}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="off" className="flex-1 text-xs">
                  Off
                </ToggleGroupItem>
                <ToggleGroupItem value="on" className="flex-1 text-xs">
                  On
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
            {resolved.text.gradient.enabled ? (
              <>
                <ColorField
                  id={`grad-from-${insert.id}`}
                  label="De"
                  value={resolved.text.gradient.from}
                  onChange={(color) => {
                    if (color) onPatchStyle("text.gradient.from", color)
                  }}
                />
                <ColorField
                  id={`grad-to-${insert.id}`}
                  label="Até"
                  value={resolved.text.gradient.to}
                  onChange={(color) => {
                    if (color) onPatchStyle("text.gradient.to", color)
                  }}
                />
                <OriginField
                  label={`Ângulo ${formatPanelNumber(resolved.text.gradient.angle)}°`}
                  origin={originOf("text.gradient.angle")}
                  htmlFor={`grad-ang-${insert.id}`}
                  onReset={() => onResetField("text.gradient.angle")}
                >
                  <input
                    id={`grad-ang-${insert.id}`}
                    type="range"
                    min={0}
                    max={360}
                    value={resolved.text.gradient.angle}
                    onChange={(event) => onPatchStyle("text.gradient.angle", Number(event.target.value))}
                    {...gesture}
                    className="h-7 w-full accent-brand"
                  />
                </OriginField>
              </>
            ) : null}
          </Accordion>

          <Accordion title="Contorno & Sombra" summary={strokeSummary} open={isBlockOpen("stroke")} onToggle={() => onToggleBlock("stroke")}>
            <OriginField
              label="Contorno"
              origin={originOf("text.stroke.enabled")}
              onReset={() => onResetField("text.stroke.enabled")}
            >
              <ToggleGroup
                value={[resolved.text.stroke.enabled ? "on" : "off"]}
                onValueChange={(value) => onPatchStyle("text.stroke.enabled", value[0] === "on")}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="off" className="flex-1 text-xs">
                  Off
                </ToggleGroupItem>
                <ToggleGroupItem value="on" className="flex-1 text-xs">
                  On
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
            <OriginField
              label={`Espessura ${formatPanelNumber(resolved.text.stroke.width)}px`}
              origin={originOf("text.stroke.width")}
              htmlFor={`sw-${insert.id}`}
              onReset={() => onResetField("text.stroke.width")}
            >
              <input
                id={`sw-${insert.id}`}
                type="range"
                min={0}
                max={16}
                value={resolved.text.stroke.width}
                onChange={(event) => onPatchStyle("text.stroke.width", Number(event.target.value))}
                {...gesture}
                className="h-7 w-full accent-brand"
              />
            </OriginField>
            <ColorField
              id={`sc-${insert.id}`}
              label="Cor do contorno"
              value={resolved.text.stroke.color}
              onChange={(color) => {
                if (color) onPatchStyle("text.stroke.color", color)
              }}
            />
            <Field>
              <FieldLabel>Atalhos de sombra</FieldLabel>
              <ToggleGroup
                value={activeShadow ? [activeShadow] : []}
                onValueChange={(value) => {
                  const next = value[0] as ShadowShortcutId | undefined
                  if (next && next in SHADOW_SHORTCUTS) onPatchStyle("text.shadows", SHADOW_SHORTCUTS[next])
                }}
                variant="outline"
                className="w-full flex-wrap"
              >
                {(Object.keys(SHADOW_SHORTCUT_LABEL) as ShadowShortcutId[]).map((id) => (
                  <ToggleGroupItem key={id} value={id} className="flex-1 text-xs">
                    {SHADOW_SHORTCUT_LABEL[id]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            {shadows.map((layer, index) => (
              <div key={`${layer.x}-${index}`} className="grid grid-cols-4 gap-2">
                <NumberInput
                  id={`shx-${insert.id}-${index}`}
                  value={layer.x}
                  onChange={(x) => {
                    const next = shadows.map((item, i) => (i === index ? { ...item, x } : item))
                    onPatchStyle("text.shadows", next)
                  }}
                />
                <NumberInput
                  id={`shy-${insert.id}-${index}`}
                  value={layer.y}
                  onChange={(y) => {
                    const next = shadows.map((item, i) => (i === index ? { ...item, y } : item))
                    onPatchStyle("text.shadows", next)
                  }}
                />
                <NumberInput
                  id={`shb-${insert.id}-${index}`}
                  value={layer.blur}
                  min={0}
                  onChange={(blur) => {
                    const next = shadows.map((item, i) => (i === index ? { ...item, blur } : item))
                    onPatchStyle("text.shadows", next)
                  }}
                />
                <button
                  type="button"
                  className="h-7 rounded-md border border-border text-xs text-muted-foreground"
                  onClick={() => onPatchStyle("text.shadows", shadows.filter((_, i) => i !== index))}
                >
                  −
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() =>
                onPatchStyle("text.shadows", [...shadows, { x: 0, y: 4, blur: 8, color: "#000000" }])
              }
            >
              + Sombra
            </Button>
          </Accordion>

          <Accordion title="Fundo" summary={bgSummary} open={isBlockOpen("bg")} onToggle={() => onToggleBlock("bg")}>
            <OriginField
              label="Ativo"
              origin={originOf("text.background.enabled")}
              onReset={() => onResetField("text.background.enabled")}
            >
              <ToggleGroup
                value={[resolved.text.background.enabled ? "on" : "off"]}
                onValueChange={(value) => onPatchStyle("text.background.enabled", value[0] === "on")}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="off" className="flex-1 text-xs">
                  Off
                </ToggleGroupItem>
                <ToggleGroupItem value="on" className="flex-1 text-xs">
                  On
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
            <OriginField
              label="Modo"
              origin={originOf("text.background.mode")}
              onReset={() => onResetField("text.background.mode")}
            >
              <ToggleGroup
                value={[resolved.text.background.mode]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next === "bloco" || next === "por-linha" || next === "por-palavra") {
                    onPatchStyle("text.background.mode", next)
                  }
                }}
                variant="outline"
                className="w-full flex-wrap"
              >
                <ToggleGroupItem value="bloco" className="flex-1 text-xs">
                  Bloco
                </ToggleGroupItem>
                <ToggleGroupItem value="por-linha" className="flex-1 text-xs">
                  Linha
                </ToggleGroupItem>
                <ToggleGroupItem value="por-palavra" className="flex-1 text-xs">
                  Palavra
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
            <ColorField
              id={`bgc-${insert.id}`}
              label="Cor de fundo"
              value={resolved.text.background.color}
              onChange={(color) => {
                if (color) onPatchStyle("text.background.color", color)
              }}
            />
            <OriginField
              label={`Opacidade ${formatPanelNumber(resolved.text.background.opacity)}%`}
              origin={originOf("text.background.opacity")}
              htmlFor={`bgo-${insert.id}`}
              onReset={() => onResetField("text.background.opacity")}
            >
              <input
                id={`bgo-${insert.id}`}
                type="range"
                min={0}
                max={100}
                value={resolved.text.background.opacity}
                onChange={(event) => onPatchStyle("text.background.opacity", Number(event.target.value))}
                {...gesture}
                className="h-7 w-full accent-brand"
              />
            </OriginField>
            <div className="grid grid-cols-2 gap-3">
              <OriginField
                label="Pad X"
                origin={originOf("text.background.paddingX")}
                htmlFor={`bpx-${insert.id}`}
                onReset={() => onResetField("text.background.paddingX")}
              >
                <NumberInput
                  id={`bpx-${insert.id}`}
                  value={resolved.text.background.paddingX}
                  min={0}
                  onChange={(value) => onPatchStyle("text.background.paddingX", value)}
                />
              </OriginField>
              <OriginField
                label="Pad Y"
                origin={originOf("text.background.paddingY")}
                htmlFor={`bpy-${insert.id}`}
                onReset={() => onResetField("text.background.paddingY")}
              >
                <NumberInput
                  id={`bpy-${insert.id}`}
                  value={resolved.text.background.paddingY}
                  min={0}
                  onChange={(value) => onPatchStyle("text.background.paddingY", value)}
                />
              </OriginField>
            </div>
            <OriginField
              label="Raio"
              origin={originOf("text.background.radius")}
              htmlFor={`br-${insert.id}`}
              onReset={() => onResetField("text.background.radius")}
            >
              <NumberInput
                id={`br-${insert.id}`}
                value={resolved.text.background.radius}
                min={0}
                onChange={(value) => onPatchStyle("text.background.radius", value)}
              />
            </OriginField>
            <OriginField
              label="Vidro (sem desfoque)"
              origin={originOf("text.background.backdropBlur")}
              htmlFor={`bb-${insert.id}`}
              onReset={() => onResetField("text.background.backdropBlur")}
            >
              <NumberInput
                id={`bb-${insert.id}`}
                value={resolved.text.background.backdropBlur}
                min={0}
                onChange={(value) => onPatchStyle("text.background.backdropBlur", value)}
              />
            </OriginField>
          </Accordion>

          {kind === "caption" ? (
          <Accordion title="Destaque" summary={highlightSummary} open={isBlockOpen("highlight")} onToggle={() => onToggleBlock("highlight")}>
            <OriginField
              label="Modo"
              origin={originOf("text.highlight.mode")}
              onReset={() => onResetField("text.highlight.mode")}
            >
              <Select
                value={resolved.text.highlight.mode}
                onValueChange={(value) => onPatchStyle("text.highlight.mode", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    <SelectItem value="palavra-ativa">Palavra ativa</SelectItem>
                    <SelectItem value="karaoke-fill">Karaokê</SelectItem>
                    <SelectItem value="palavras-chave">Palavras-chave</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </OriginField>
            <ColorField
              id={`hl-${insert.id}`}
              label="Cor do destaque"
              value={resolved.text.highlight.color}
              onChange={(color) => {
                if (color) onPatchStyle("text.highlight.color", color)
              }}
            />
            <OriginField
              label="Escala"
              origin={originOf("text.highlight.scale")}
              htmlFor={`hls-${insert.id}`}
              onReset={() => onResetField("text.highlight.scale")}
            >
              <NumberInput
                id={`hls-${insert.id}`}
                value={resolved.text.highlight.scale}
                min={1}
                max={1.4}
                step={0.01}
                onChange={(value) => onPatchStyle("text.highlight.scale", value)}
              />
            </OriginField>
            <OriginField
              label="Palavras-chave"
              origin={originOf("text.highlight.keywords")}
              htmlFor={`hlk-${insert.id}`}
              onReset={() => onResetField("text.highlight.keywords")}
            >
              <Input
                id={`hlk-${insert.id}`}
                className="h-7 text-xs"
                value={resolved.text.highlight.keywords.join(", ")}
                placeholder="grátis, off"
                onChange={(event) =>
                  onPatchStyle(
                    "text.highlight.keywords",
                    event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
              />
            </OriginField>
          </Accordion>
          ) : null}
        </>
      ) : null}

      {tab === "motion" && context !== "caption" ? (
        <MotionPanel
          insert={insert}
          animation={resolved.animation}
          videoDuration={videoDuration}
          retentionCuts={retentionCuts}
          onChange={(next) => onPatchStyle("animation", next)}
          getPlayhead={getPlayhead}
          onPlayRange={onPlayRange}
        />
      ) : null}

      {tab === "motion" && context === "caption" ? (
        <>
          <Accordion
            title="Entrada"
            summary={enterSummary}
            open={isBlockOpen("enter")}
            onToggle={() => onToggleBlock("enter")}
          >
            <Field>
              <FieldLabel>Recipe</FieldLabel>
              <ToggleGroup
                value={activeRecipe ? [activeRecipe] : []}
                onValueChange={(value) => {
                  const name = value[0] as AnimRecipeName | undefined
                  if (!name || !(name in RECIPE_LABEL)) return
                  onPatchStyle("animation", applyAnimRecipe(resolved.animation, name))
                }}
                variant="outline"
                className="w-full flex-wrap"
              >
                {(Object.keys(RECIPE_LABEL) as AnimRecipeName[]).map((id) => (
                  <ToggleGroupItem key={id} value={id} className="flex-1 text-xs">
                    {RECIPE_LABEL[id]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <AnimTargetFields
              idPrefix={`from-${insert.id}`}
              current={resolved.animation.enter.from}
              originOf={originOf}
              basePath="animation.enter.from"
              onPatch={patchAnimTarget}
              onReset={onResetField}
            />
            <OriginField
              label="Duração (frames)"
              origin={originOf("animation.enter.durationInFrames")}
              htmlFor={`ed-${insert.id}`}
              onReset={() => onResetField("animation.enter.durationInFrames")}
            >
              <NumberInput
                id={`ed-${insert.id}`}
                value={resolved.animation.enter.durationInFrames}
                min={0}
                onChange={(value) => onPatchStyle("animation.enter.durationInFrames", value)}
              />
            </OriginField>
            <OriginField
              label="Delay"
              origin={originOf("animation.enter.delayInFrames")}
              htmlFor={`edel-${insert.id}`}
              onReset={() => onResetField("animation.enter.delayInFrames")}
            >
              <NumberInput
                id={`edel-${insert.id}`}
                value={resolved.animation.enter.delayInFrames}
                min={0}
                onChange={(value) => onPatchStyle("animation.enter.delayInFrames", value)}
              />
            </OriginField>
            <OriginField
              label="Easing"
              origin={originOf("animation.enter.easing")}
              onReset={() => onResetField("animation.enter.easing")}
            >
              <EasingSelect
                value={resolved.animation.enter.easing}
                onChange={(value) => onPatchStyle("animation.enter.easing", value)}
              />
            </OriginField>
            <OriginField
              label="Overshoot"
              origin={originOf("animation.enter.overshoot")}
              htmlFor={`eo-${insert.id}`}
              onReset={() => onResetField("animation.enter.overshoot")}
            >
              <NumberInput
                id={`eo-${insert.id}`}
                value={resolved.animation.enter.overshoot}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => onPatchStyle("animation.enter.overshoot", value)}
              />
            </OriginField>
            <OriginField
              label="Stagger"
              origin={originOf("animation.enter.staggerInFrames")}
              htmlFor={`es-${insert.id}`}
              onReset={() => onResetField("animation.enter.staggerInFrames")}
            >
              <NumberInput
                id={`es-${insert.id}`}
                value={resolved.animation.enter.staggerInFrames}
                min={0}
                onChange={(value) => onPatchStyle("animation.enter.staggerInFrames", value)}
              />
            </OriginField>
          </Accordion>

          <Accordion title="Saída" summary={exitSummary} open={isBlockOpen("exit")} onToggle={() => onToggleBlock("exit")}>
            <AnimTargetFields
              idPrefix={`to-${insert.id}`}
              current={resolved.animation.exit.to}
              originOf={originOf}
              basePath="animation.exit.to"
              onPatch={patchAnimTarget}
              onReset={onResetField}
            />
            <OriginField
              label="Duração (frames)"
              origin={originOf("animation.exit.durationInFrames")}
              htmlFor={`xd-${insert.id}`}
              onReset={() => onResetField("animation.exit.durationInFrames")}
            >
              <NumberInput
                id={`xd-${insert.id}`}
                value={resolved.animation.exit.durationInFrames}
                min={0}
                onChange={(value) => onPatchStyle("animation.exit.durationInFrames", value)}
              />
            </OriginField>
            <OriginField
              label="Easing"
              origin={originOf("animation.exit.easing")}
              onReset={() => onResetField("animation.exit.easing")}
            >
              <EasingSelect
                value={resolved.animation.exit.easing}
                onChange={(value) => onPatchStyle("animation.exit.easing", value)}
              />
            </OriginField>
          </Accordion>

          <Accordion title="Loop" summary={resolved.animation.loop.type} open={isBlockOpen("loop")} onToggle={() => onToggleBlock("loop")}>
            <OriginField
              label="Tipo"
              origin={originOf("animation.loop.type")}
              onReset={() => onResetField("animation.loop.type")}
            >
              <ToggleGroup
                value={[resolved.animation.loop.type]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next === "nenhum" || next === "pulse" || next === "shake" || next === "float") {
                    onPatchStyle("animation.loop.type", next)
                  }
                }}
                variant="outline"
                className="w-full flex-wrap"
              >
                <ToggleGroupItem value="nenhum" className="flex-1 text-xs">
                  Nenhum
                </ToggleGroupItem>
                <ToggleGroupItem value="pulse" className="flex-1 text-xs">
                  Pulse
                </ToggleGroupItem>
                <ToggleGroupItem value="shake" className="flex-1 text-xs">
                  Shake
                </ToggleGroupItem>
                <ToggleGroupItem value="float" className="flex-1 text-xs">
                  Float
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
            <OriginField
              label="Amplitude"
              origin={originOf("animation.loop.amplitude")}
              htmlFor={`la-${insert.id}`}
              onReset={() => onResetField("animation.loop.amplitude")}
            >
              <NumberInput
                id={`la-${insert.id}`}
                value={resolved.animation.loop.amplitude}
                min={0}
                step={0.01}
                onChange={(value) => onPatchStyle("animation.loop.amplitude", value)}
              />
            </OriginField>
            <OriginField
              label="Velocidade"
              origin={originOf("animation.loop.speed")}
              htmlFor={`lspeed-${insert.id}`}
              onReset={() => onResetField("animation.loop.speed")}
            >
              <NumberInput
                id={`lspeed-${insert.id}`}
                value={resolved.animation.loop.speed}
                min={0}
                step={0.1}
                onChange={(value) => onPatchStyle("animation.loop.speed", value)}
              />
            </OriginField>
          </Accordion>

          <Accordion title="Unidade" summary={resolved.animation.unit} open={isBlockOpen("unit")} onToggle={() => onToggleBlock("unit")}>
            <OriginField
              label="Anima por"
              origin={originOf("animation.unit")}
              onReset={() => onResetField("animation.unit")}
            >
              <ToggleGroup
                value={[resolved.animation.unit]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next === "bloco" || next === "palavra" || next === "letra") {
                    onPatchStyle("animation.unit", next)
                  }
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="bloco" className="flex-1 text-xs">
                  Bloco
                </ToggleGroupItem>
                <ToggleGroupItem value="palavra" className="flex-1 text-xs">
                  Palavra
                </ToggleGroupItem>
                <ToggleGroupItem value="letra" className="flex-1 text-xs">
                  Letra
                </ToggleGroupItem>
              </ToggleGroup>
            </OriginField>
          </Accordion>
        </>
      ) : null}
    </div>
  )
}

function EasingSelect({
  value,
  onChange,
}: {
  value: Animation["enter"]["easing"]
  onChange: (value: Animation["enter"]["easing"]) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Animation["enter"]["easing"])}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="linear">Linear</SelectItem>
          <SelectItem value="ease-out">Ease out</SelectItem>
          <SelectItem value="spring">Spring</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function AnimTargetFields({
  idPrefix,
  current,
  originOf,
  basePath,
  onPatch,
  onReset,
}: {
  idPrefix: string
  current: AnimTarget
  originOf: (path: string) => FieldOrigin
  basePath: string
  onPatch: (basePath: string, current: AnimTarget, key: keyof AnimTarget, value: number) => void
  onReset: (path: string) => void
}) {
  const keys: Array<{ key: keyof AnimTarget; label: string; step: number }> = [
    { key: "scale", label: "Scale", step: 0.05 },
    { key: "x", label: "X", step: 1 },
    { key: "y", label: "Y", step: 1 },
    { key: "rotate", label: "Rotate", step: 1 },
    { key: "opacity", label: "Opacity", step: 0.05 },
    { key: "blur", label: "Blur", step: 1 },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {keys.map((item) => (
        <OriginField
          key={item.key}
          label={item.label}
          origin={originOf(`${basePath}.${item.key}`)}
          htmlFor={`${idPrefix}-${item.key}`}
          onReset={() => onReset(`${basePath}.${item.key}`)}
        >
          <NumberInput
            id={`${idPrefix}-${item.key}`}
            value={current[item.key] ?? 0}
            step={item.step}
            onChange={(value) => onPatch(basePath, current, item.key, value)}
          />
        </OriginField>
      ))}
    </div>
  )
}
