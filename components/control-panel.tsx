"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Film, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { AppVersionBadge } from "@/components/app-version-badge"
import { BackgroundSourceCard, WatermarkFields } from "@/components/background-source-card"
import { InsertCard } from "@/components/insert-card"
import { CaptionLineList } from "@/components/caption-line-list"
import { AudioPanel } from "@/components/audio-panel"
import { BlockToolbar, CollapsibleBlock, PanelSwitch } from "@/components/collapsible-block"
import { audioSummary } from "@/lib/audio/summary"
import { defaultCompositionAudio, type AudioKind, type CompositionAudio } from "@/lib/audio/types"
import { PanelOverflowMenu } from "@/components/panel-overflow-menu"
import { StyleCustomizePanel } from "@/components/style-customize-panel"
import { InsertsGallery } from "@/components/inserts-gallery"
import { InsertsEditor } from "@/components/inserts-editor"
import { usePanelBlocks, usePanelTab } from "@/components/use-panel-blocks"
import type { PresetLibraryHandlers } from "@/components/style-customize-panel"
import { GenerateCaptionsButton } from "@/components/generate-captions-button"
import { formatTimecode } from "@/lib/timecode"
import { formatTime, type Insert, type InsertType, type Template } from "@/lib/inserts"
import { insertKind } from "@/lib/composition"
import type { GeneratePipelineResult } from "@/lib/ai-generate"
import type { CaptionLine } from "@/lib/captions"
import type { CaptionStyle, CompositionSource } from "@/lib/composition"
import type { SourceImport } from "@/lib/commit-source"
import { hasPlayableSource } from "@/lib/commit-source"
import type { RecentSource } from "@/lib/recent-sources"
import { DEFAULT_WATERMARK_PREFS, type WatermarkPrefs } from "@/lib/watermark"
import { ProductDataFields } from "@/components/insert-content"
import type { ProductData } from "@/lib/content/runs"
import type { ContentNiche } from "@/lib/content/presets"
import type { ReadySpec } from "@/lib/content/gallery"
import { hasAnySegmentTransform } from "@/lib/source-segments"
import { hasInsertOverrides } from "@/lib/style"
import type { StyleLayer, TrackId } from "@/lib/style/types"
import {
  captionStyleHost,
  countCaptionInserts,
  insertsTabSummary,
  nonCaptionInserts,
} from "@/lib/caption-panel"
import { describeSelection, selectableItems, selectionKindCounts } from "@/lib/timeline-selection"
import {
  findDuplicateGroups,
  overflowingInserts,
  sortInsertsByStart,
} from "@/lib/insert-ops"
import {
  CAPTION_STYLE_BLOCK_IDS,
  INSERT_STYLE_BLOCK_IDS,
  MOTION_BLOCK_IDS,
  PANEL_SECTIONS,
  VIDEO_BLOCK_IDS,
  type PanelTabId,
} from "@/lib/panel-sections"
import { cn } from "@/lib/utils"

interface ControlPanelProps {
  source: CompositionSource
  importState: SourceImport
  draftUrl: string
  replacingSource: boolean
  elapsedSeconds: number
  recentSources: RecentSource[]
  previousSource: CompositionSource | null
  burnedInWarning: boolean
  inserts: Insert[]
  videoDuration: number
  videoUrl?: string
  missingFile: boolean
  exporting: boolean
  exportProgress: number
  exportStatus: string
  /** Quantas respostas de progresso o Mac já devolveu neste export. */
  renderReplies: number
  liveMessage: string
  finalExportError?: string | null
  undoToast?: string | null
  onUndoToast?: () => void
  onDismissUndoToast?: () => void
  selectedId: string | null
  selectedIds?: readonly string[]
  onDuplicateSelection?: () => void
  onDeleteSelection?: () => void
  onClearSelection?: () => void
  brandLogo: string
  brandFontId?: string
  onDraftUrlChange: (url: string) => void
  onSubmitUrl: (url: string) => void
  onPickFile: (file: File) => void
  onUseRecent: (canonicalUrl: string) => void
  onReplaceSource: () => void
  onRestorePrevious: () => void
  onRetryImport: () => void
  onDownloadCopy: () => void
  onNewProject: () => void
  onClearInserts: () => void
  onClearCaptions: () => void
  onRevealCaption: (id: string) => void
  panelSelectionTick?: number
  editingTextId?: string | null
  /** Texto novo, ainda não aplicado. Reedição de um insert existente fica false. */
  editingTextCreated?: boolean
  onAddText: () => void
  onAddReady: (spec: ReadySpec, selectMarked: boolean) => void
  insertFocus?: { id: string; selectMarked: boolean } | null
  onInsertFocusDone?: () => void
  onOpenHookVariations: (insertId: string) => void
  videoExport?: ReactNode
  onAddElement: (type: InsertType) => void
  onApplyTemplate: (template: Template) => void
  activeTemplateId: string | null
  onChangeInsert: (id: string, patch: Partial<Insert>) => void
  onRemoveInsert: (id: string) => void
  onSelectInsert: (id: string) => void
  onMergeDuplicates: (ids: string[]) => void
  onGenerateAI: (payload: GeneratePipelineResult) => void | Promise<void>
  loadAiMedia: () => Promise<File | null>
  onAiStatus: (message: string) => void
  captionStyle: CaptionStyle
  captionPreset?: "viral" | "limpo"
  onChangeCaptionStyle: (patch: Partial<CaptionStyle>) => void
  onApplyCaptionLook: (lookId: string) => void
  onApplyStylePreset: (presetId: string, mode?: "preserve" | "clean") => void
  tracks?: Partial<Record<TrackId, StyleLayer>>
  projectStyle?: StyleLayer
  onPatchInsertStyle: (id: string, path: string, value: unknown) => void
  onResetInsertStyleField: (id: string, path: string) => void
  onResetInsertStyleOverrides: (id: string) => void
  onResetInsertPosition: (id: string) => void
  onApplyStyleToTrack: (id: string) => void
  presetLibrary?: PresetLibraryHandlers
  canGenerateCaptions: boolean
  onGenerateCaptions: (lines: CaptionLine[], warnings: string[]) => void
  captionVoice?: { start: number; trimIn: number } | null
  loadCaptionVoice?: () => Promise<File | null>
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  sourceSelected?: boolean
  onSelectSource?: () => void
  onResetTransform?: () => void
  watermarkEnabled?: boolean
  watermarkPrefs: WatermarkPrefs
  onWatermarkEnabledChange?: (enabled: boolean) => void
  onWatermarkPrefsChange?: (prefs: WatermarkPrefs) => void
  compositionAudio?: CompositionAudio
  audioUrls?: Record<string, string>
  missingAudioIds?: readonly string[]
  selectedAudioId?: string | null
  onChangeAudio?: (audio: CompositionAudio, mode: "discrete" | "gesture") => void
  onCommitAudioFile?: (input: {
    file: File
    duration: number
    kind: AudioKind
    replaceTrackId?: string
    history?: "discrete" | "gesture"
    muteOriginal?: boolean
    peaks?: number[]
  }) => void | Promise<void>
  onAudioImportingChange?: (importing: boolean) => void
  getPlayhead?: () => number
  onPlayRange?: (start: number, end: number) => void
  retentionCuts?: { ganchoEnd: number; ctaStart: number } | null
  productData?: ProductData
  niche?: ContentNiche
  brandKitId?: string
  projectSeed?: string
  onProductData?: (data: ProductData) => void
  onNiche?: (niche: ContentNiche) => void
  onBrandKit?: (id: string) => void
}

export function ControlPanel({
  source,
  importState,
  draftUrl,
  replacingSource,
  elapsedSeconds,
  recentSources,
  previousSource,
  burnedInWarning,
  inserts,
  videoDuration,
  videoUrl,
  missingFile,
  exporting,
  exportProgress,
  exportStatus,
  renderReplies,
  liveMessage,
  finalExportError = null,
  undoToast = null,
  onUndoToast,
  onDismissUndoToast,
  selectedId,
  selectedIds = [],
  onDuplicateSelection,
  onDeleteSelection,
  onClearSelection,
  brandLogo,
  brandFontId = "geist",
  onDraftUrlChange,
  onSubmitUrl,
  onPickFile,
  onUseRecent,
  onReplaceSource,
  onRestorePrevious,
  onRetryImport,
  onDownloadCopy,
  onNewProject,
  onClearInserts,
  onClearCaptions,
  onRevealCaption,
  panelSelectionTick = 0,
  editingTextId = null,
  editingTextCreated = false,
  onAddText,
  onAddReady,
  insertFocus = null,
  onInsertFocusDone,
  onOpenHookVariations,
  videoExport,
  onAddElement,
  onApplyTemplate,
  activeTemplateId,
  onChangeInsert,
  onRemoveInsert,
  onSelectInsert,
  onMergeDuplicates,
  onGenerateAI,
  loadAiMedia,
  onAiStatus,
  captionStyle,
  captionPreset = "viral",
  onChangeCaptionStyle,
  onApplyCaptionLook,
  onApplyStylePreset,
  tracks,
  projectStyle,
  onPatchInsertStyle,
  onResetInsertStyleField,
  onResetInsertStyleOverrides,
  onResetInsertPosition,
  onApplyStyleToTrack,
  presetLibrary,
  canGenerateCaptions,
  onGenerateCaptions,
  captionVoice = null,
  loadCaptionVoice,
  onBeginInsertGesture,
  onEndInsertGesture,
  sourceSelected = false,
  onSelectSource,
  onResetTransform,
  watermarkEnabled = false,
  watermarkPrefs = DEFAULT_WATERMARK_PREFS,
  onWatermarkEnabledChange,
  onWatermarkPrefsChange,
  compositionAudio,
  audioUrls = {},
  missingAudioIds = [],
  selectedAudioId = null,
  onChangeAudio,
  onCommitAudioFile,
  onAudioImportingChange,
  getPlayhead,
  onPlayRange,
  retentionCuts,
  productData,
  niche = "shopee",
  brandKitId = "shopee",
  onProductData,
  onNiche,
  onBrandKit,
}: ControlPanelProps) {
  const [newProjectArmed, setNewProjectArmed] = useState(false)

  useEffect(() => {
    if (!newProjectArmed) return
    const timer = window.setTimeout(() => setNewProjectArmed(false), 6_000)
    return () => window.clearTimeout(timer)
  }, [newProjectArmed])

  useEffect(() => {
    if (exporting) setNewProjectArmed(false)
  }, [exporting])

  const overflowing = useMemo(
    () => overflowingInserts(inserts, videoDuration),
    [inserts, videoDuration],
  )
  const overflowingIds = useMemo(
    () => new Set(overflowing.map((insert) => insert.id)),
    [overflowing],
  )
  const duplicateGroups = useMemo(
    () => findDuplicateGroups(inserts),
    [inserts],
  )
  const captionCount = useMemo(() => countCaptionInserts(inserts), [inserts])
  const insertSummary = useMemo(
    () =>
      insertsTabSummary(
        inserts,
        editingTextId ? { id: editingTextId, created: editingTextCreated } : null,
      ),
    [editingTextCreated, editingTextId, inserts],
  )
  const hasCaptions = captionCount > 0
  const orderedInserts = useMemo(
    () => sortInsertsByStart(nonCaptionInserts(inserts)),
    [inserts],
  )
  const selectedInsert =
    selectedIds.length < 2 ? orderedInserts.find((item) => item.id === selectedId) ?? null : null
  const styleHost = useMemo(
    () => captionStyleHost(inserts, selectedId),
    [inserts, selectedId],
  )
  const hasSource = hasPlayableSource(source)
  const insertsRef = useRef(inserts)
  insertsRef.current = inserts
  const [tab, setTab] = usePanelTab()
  const [captionSub, setCaptionSub] = useState<"text" | "style" | "motion">("text")
  const videoBlocks = usePanelBlocks("video", VIDEO_BLOCK_IDS)
  const mix = compositionAudio ?? defaultCompositionAudio()

  useEffect(() => {
    if (!selectedAudioId) return
    setTab("video")
  }, [selectedAudioId, setTab])
  const captionStyleBlocks = usePanelBlocks("captions-style", CAPTION_STYLE_BLOCK_IDS)
  const captionMotionBlocks = usePanelBlocks("captions-motion", MOTION_BLOCK_IDS)
  const insertStyleBlocks = usePanelBlocks("inserts-style", INSERT_STYLE_BLOCK_IDS)
  const insertMotionBlocks = usePanelBlocks("inserts-motion", MOTION_BLOCK_IDS)

  useEffect(() => {
    if (!selectedId) return
    const insert = insertsRef.current.find((item) => item.id === selectedId)
    if (!insert) return
    setTab(insertKind(insert) === "caption" ? "captions" : "inserts")
  }, [panelSelectionTick, selectedId, setTab])

  const visibleTab: PanelTabId = hasSource ? tab : "video"
  const [audioImporting, setAudioImporting] = useState(false)
  const audioLeaveTold = useRef(false)
  const audioCardOpen = (videoBlocks.isOpen("audio") || Boolean(selectedAudioId)) && visibleTab === "video"
  useEffect(() => {
    if (audioImporting && !audioCardOpen && !audioLeaveTold.current) {
      audioLeaveTold.current = true
      onAiStatus("Áudio não adicionado")
    }
    if (!audioImporting) audioLeaveTold.current = false
  }, [audioCardOpen, audioImporting, onAiStatus])
  const selectedCaption =
    inserts.find((insert) => insert.id === selectedId && insertKind(insert) === "caption") ?? null
  const showSourceBlocks = hasSource && !replacingSource && importState.status === "idle"

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Film className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">
            Configuração de Inserts
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Composição vertical · 9:16
            {videoDuration > 0 ? (
              <>
                {" · "}
                <span title={formatTimecode(videoDuration, source.fps, "frame")}>
                  {formatTimecode(videoDuration, source.fps)}
                </span>
              </>
            ) : (
              ""
            )}
          </p>
        </div>
        {newProjectArmed ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="destructive"
              size="xs"
              disabled={exporting}
              onClick={() => {
                setNewProjectArmed(false)
                onNewProject()
              }}
            >
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => setNewProjectArmed(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto shrink-0"
            disabled={exporting}
            onClick={() => setNewProjectArmed(true)}
          >
            Novo projeto
          </Button>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Seções do painel"
        className="flex shrink-0 border-b border-border"
      >
        {PANEL_SECTIONS.map((section) => {
          const disabled = section.id !== "video" && !hasSource
          const selected = visibleTab === section.id
          const count =
            section.id === "captions"
              ? captionCount
              : section.id === "inserts"
                ? insertSummary.applied
                : null
          const pending = section.id === "inserts" ? insertSummary.badge : null
          const label = count == null ? section.label : `${section.label} (${count})`
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              className={cn(
                "min-w-0 flex-1 border-b-2 px-2 py-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
                selected
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(section.id)}
            >
              <span className="inline-flex items-center justify-center gap-1">
                <span>{label}</span>
                {pending === "pending" ? (
                  <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-800 dark:text-amber-200">
                    1 pendente
                  </span>
                ) : null}
                {pending === "editing" ? (
                  <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-800 dark:text-amber-200">
                    editando
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      {visibleTab === "captions" && selectedCaption ? (
        <SelectedCaptionBar
          insert={selectedCaption}
          onChange={onChangeInsert}
          onBegin={onBeginInsertGesture}
          onEnd={onEndInsertGesture}
          onUseSharedStyle={() => {
            onResetInsertStyleOverrides(selectedCaption.id)
            if (selectedCaption.transform?.touchedByUser) onResetInsertPosition(selectedCaption.id)
          }}
        />
      ) : null}

      {visibleTab === "video" ? (
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border px-2 py-1">
          {showSourceBlocks ? (
            <BlockToolbar
              allOpen={videoBlocks.allOpen}
              onExpandAll={videoBlocks.expandAll}
              onCollapseAll={videoBlocks.collapseAll}
            />
          ) : null}
          <PanelOverflowMenu
            label="Ações do vídeo"
            items={[
              {
                id: "clear-inserts",
                label: "Limpar inserts",
                disabled: inserts.length === 0,
                destructive: true,
                confirmTitle: "Limpar inserts?",
                confirmBody: "Isso apaga os inserts e as legendas deste projeto.",
                confirmLabel: "Limpar",
                onSelect: onClearInserts,
              },
            ]}
          />
        </div>
      ) : null}

      {visibleTab === "captions" ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
          <div role="tablist" aria-label="Partes da legenda" className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                ["text", "Texto"],
                ["style", "Estilo"],
                ["motion", "Movimento"],
              ] as const
            ).map(([id, label]) => {
              const selected = captionSub === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setCaptionSub(id)}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex w-[10.25rem] shrink-0 items-center justify-end gap-1">
            <BlockToolbar
              hidden={captionSub === "text"}
              allOpen={
                captionSub === "motion" ? captionMotionBlocks.allOpen : captionStyleBlocks.allOpen
              }
              onExpandAll={
                captionSub === "motion" ? captionMotionBlocks.expandAll : captionStyleBlocks.expandAll
              }
              onCollapseAll={
                captionSub === "motion"
                  ? captionMotionBlocks.collapseAll
                  : captionStyleBlocks.collapseAll
              }
            />
            <span className={cn("inline-flex w-6 justify-center", captionSub === "text" && "invisible")}>
              <PanelOverflowMenu
                label="Ações das legendas"
                items={[
                  {
                    id: "clear-captions",
                    label: "Limpar legendas",
                    disabled: !hasCaptions,
                    destructive: true,
                    confirmTitle: "Limpar legendas?",
                    confirmBody: "As linhas de legenda saem do projeto. Os outros inserts ficam.",
                    confirmLabel: "Limpar",
                    onSelect: onClearCaptions,
                  },
                ]}
              />
            </span>
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn("flex flex-col gap-3 px-4 py-3", visibleTab === "video" && "pb-6")}>
          {selectedIds.length >= 2 ? (
            <SelectionSummaryCard
              inserts={inserts}
              selectedIds={selectedIds}
              onDuplicate={onDuplicateSelection}
              onDelete={onDeleteSelection}
              onClear={onClearSelection}
            />
          ) : null}
          {visibleTab === "video" ? (
            <>
              <BackgroundSourceCard
                source={source}
                missingFile={missingFile}
                importState={importState}
                draftUrl={draftUrl}
                replacing={replacingSource}
                elapsedSeconds={elapsedSeconds}
                recent={recentSources}
                previousSource={previousSource}
                burnedInWarning={burnedInWarning}
                onDraftUrlChange={onDraftUrlChange}
                onSubmitUrl={onSubmitUrl}
                onPickFile={onPickFile}
                onUseRecent={onUseRecent}
                onReplace={onReplaceSource}
                onRestorePrevious={onRestorePrevious}
                onRetry={onRetryImport}
                onDownloadCopy={onDownloadCopy}
                sourceSelected={sourceSelected}
                onSelectSource={onSelectSource}
              />
              {showSourceBlocks ? (
                <>
                  <CollapsibleBlock
                    title="Enquadramento e trechos"
                    summary={framingSummary(source)}
                    open={videoBlocks.isOpen("framing")}
                    onToggle={() => videoBlocks.toggle("framing")}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="self-start"
                      disabled={!hasAnySegmentTransform(source)}
                      onClick={onResetTransform}
                    >
                      Resetar enquadramento
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Arraste o vídeo no preview. Divida ou junte trechos na timeline.
                    </p>
                  </CollapsibleBlock>
                  <CollapsibleBlock
                    title="Marca d'água"
                    summary={watermarkSummary(watermarkEnabled, watermarkPrefs)}
                    open={videoBlocks.isOpen("watermark")}
                    onToggle={() => videoBlocks.toggle("watermark")}
                    headerAside={
                      <PanelSwitch
                        checked={watermarkEnabled}
                        label="Marca d'água neste vídeo"
                        onChange={(next) => onWatermarkEnabledChange?.(next)}
                      />
                    }
                  >
                    <WatermarkFields prefs={watermarkPrefs} onPrefsChange={onWatermarkPrefsChange} />
                  </CollapsibleBlock>
                  <CollapsibleBlock
                    title="Áudio"
                    summary={audioSummary(mix)}
                    open={videoBlocks.isOpen("audio") || Boolean(selectedAudioId)}
                    onToggle={() => videoBlocks.toggle("audio")}
                  >
                    <AudioPanel
                      audio={mix}
                      videoDuration={videoDuration}
                      audioUrls={audioUrls}
                      missingTrackIds={missingAudioIds}
                      selectedTrackId={selectedAudioId}
                      onChange={(next, mode) => onChangeAudio?.(next, mode)}
                      onBeginGesture={onBeginInsertGesture}
                      onEndGesture={onEndInsertGesture}
                      onCommitFile={(input) => onCommitAudioFile?.(input)}
                      onImportingChange={(importing) => {
                        setAudioImporting(importing)
                        onAudioImportingChange?.(importing)
                      }}
                      onStatus={onAiStatus}
                    />
                  </CollapsibleBlock>
                  <details className="rounded-md border border-border px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-foreground">Dados do produto</summary>
                    <div className="mt-2">
                      <ProductDataFields
                        data={productData ?? {}}
                        niche={niche}
                        onChange={(data) => onProductData?.(data)}
                        onNiche={(next) => onNiche?.(next)}
                      />
                    </div>
                  </details>
                </>
              ) : null}
            </>
          ) : null}

          {visibleTab === "captions" && captionSub === "text" ? (
            <>
              <GenerateCaptionsButton
                duration={videoDuration}
                disabled={!canGenerateCaptions}
                loadMedia={loadAiMedia}
                onGenerate={onGenerateCaptions}
                onStatus={onAiStatus}
                voiceTrack={captionVoice}
                loadVoice={loadCaptionVoice}
              />
              <CaptionLineList inserts={inserts} selectedId={selectedId} onReveal={onRevealCaption} />
            </>
          ) : null}

          {visibleTab === "captions" && captionSub === "style" ? (
            styleHost ? (
              <StyleCustomizePanel
                insert={styleHost}
                videoDuration={videoDuration}
                tracks={tracks}
                project={projectStyle}
                captionStyle={captionStyle}
                captionPreset={captionPreset}
                tab="style"
                context="caption"
                captionInserts={inserts}
                onSelectLook={onApplyCaptionLook}
                onPatchStyle={(path, value) => onPatchInsertStyle(styleHost.id, path, value)}
                onResetField={(path) => onResetInsertStyleField(styleHost.id, path)}
                onResetOverrides={() => onResetInsertStyleOverrides(styleHost.id)}
                onResetPosition={() => onResetInsertPosition(styleHost.id)}
                onApplyPreset={onApplyStylePreset}
                onApplyToTrack={() => onApplyStyleToTrack(styleHost.id)}
                onBeginGesture={onBeginInsertGesture}
                onEndGesture={onEndInsertGesture}
                presetLibrary={presetLibrary}
                isBlockOpen={captionStyleBlocks.isOpen}
                onToggleBlock={captionStyleBlocks.toggle}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                O estilo das legendas aparece depois de gerar.
              </p>
            )
          ) : null}

          {visibleTab === "captions" && captionSub === "motion" ? (
            styleHost ? (
              <StyleCustomizePanel
                insert={styleHost}
                videoDuration={videoDuration}
                tracks={tracks}
                project={projectStyle}
                captionStyle={captionStyle}
                captionPreset={captionPreset}
                tab="motion"
                context="caption"
                onPatchStyle={(path, value) => onPatchInsertStyle(styleHost.id, path, value)}
                onResetField={(path) => onResetInsertStyleField(styleHost.id, path)}
                onResetOverrides={() => onResetInsertStyleOverrides(styleHost.id)}
                onResetPosition={() => onResetInsertPosition(styleHost.id)}
                onApplyPreset={onApplyStylePreset}
                onApplyToTrack={() => onApplyStyleToTrack(styleHost.id)}
                onBeginGesture={onBeginInsertGesture}
                onEndGesture={onEndInsertGesture}
                presetLibrary={presetLibrary}
                isBlockOpen={captionMotionBlocks.isOpen}
                onToggleBlock={captionMotionBlocks.toggle}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                O movimento das legendas aparece depois de gerar.
              </p>
            )
          ) : null}

          {visibleTab === "inserts" ? (
            <>
              {duplicateGroups.map((group) => (
                <div
                  key={group.ids.join("-")}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground">
                    {group.ids.length} inserts idênticos
                  </p>
                  <Button variant="outline" size="sm" onClick={() => onMergeDuplicates(group.ids)}>
                    Mesclar
                  </Button>
                </div>
              ))}
              {selectedInsert && insertKind(selectedInsert) === "text" ? (
                <InsertsEditor
                  insert={selectedInsert}
                  videoDuration={videoDuration}
                  productData={productData}
                  brandKitId={brandKitId}
                  retentionCuts={retentionCuts}
                  getPlayhead={getPlayhead}
                  focus={insertFocus}
                  onFocusDone={onInsertFocusDone}
                  onBack={() => onClearSelection?.()}
                  onChange={(patch) => onChangeInsert(selectedInsert.id, patch)}
                  onDuplicate={() => onDuplicateSelection?.()}
                  onRemove={() => onRemoveInsert(selectedInsert.id)}
                  onHookVariations={
                    selectedInsert.role === "gancho" ? () => onOpenHookVariations(selectedInsert.id) : undefined
                  }
                  onBrandKit={onBrandKit}
                  onBeginGesture={onBeginInsertGesture}
                  onEndGesture={onEndInsertGesture}
                  tracks={tracks}
                  projectStyle={projectStyle}
                  captionStyle={captionStyle}
                  captionPreset={captionPreset}
                  onPatchStyle={(path, value) => onPatchInsertStyle(selectedInsert.id, path, value)}
                  onResetStyleField={(path) => onResetInsertStyleField(selectedInsert.id, path)}
                  onResetStyleOverrides={() => onResetInsertStyleOverrides(selectedInsert.id)}
                  onResetPosition={() => onResetInsertPosition(selectedInsert.id)}
                  onApplyStylePreset={onApplyStylePreset}
                  onApplyStyleToTrack={() => onApplyStyleToTrack(selectedInsert.id)}
                  presetLibrary={presetLibrary}
                  styleBlocks={insertStyleBlocks}
                  motionBlocks={insertMotionBlocks}
                />
              ) : selectedInsert ? (
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onClearSelection?.()}>
                    ← Prontos
                  </Button>
                  <InsertCard
                    insert={selectedInsert}
                    index={orderedInserts.findIndex((item) => item.id === selectedInsert.id)}
                    videoDuration={videoDuration}
                    expanded
                    selected
                    overflowing={overflowingIds.has(selectedInsert.id)}
                    missingLogo={selectedInsert.type === "logo-shopee" && !brandLogo}
                    brandFontId={brandFontId}
                    onToggle={() => undefined}
                    onChange={onChangeInsert}
                    onRemove={onRemoveInsert}
                    onBeginInsertGesture={onBeginInsertGesture}
                    onEndInsertGesture={onEndInsertGesture}
                    captionStyle={captionStyle}
                    captionPreset={captionPreset}
                    onChangeCaptionStyle={onChangeCaptionStyle}
                    tracks={tracks}
                    projectStyle={projectStyle}
                    onPatchStyle={(path, value) => onPatchInsertStyle(selectedInsert.id, path, value)}
                    onResetStyleField={(path) => onResetInsertStyleField(selectedInsert.id, path)}
                    onResetStyleOverrides={() => onResetInsertStyleOverrides(selectedInsert.id)}
                    onResetPosition={() => onResetInsertPosition(selectedInsert.id)}
                    onApplyStylePreset={onApplyStylePreset}
                    onApplyStyleToTrack={() => onApplyStyleToTrack(selectedInsert.id)}
                    presetLibrary={presetLibrary}
                    styleBlocks={insertStyleBlocks}
                    motionBlocks={insertMotionBlocks}
                    getPlayhead={getPlayhead}
                    onPlayRange={onPlayRange}
                    retentionCuts={retentionCuts}
                    niche={niche}
                    productData={productData}
                    brandKitId={brandKitId}
                    onNiche={onNiche}
                    onBrandKit={onBrandKit}
                  />
                </div>
              ) : (
                <InsertsGallery
                  videoDuration={videoDuration}
                  videoUrl={videoUrl}
                  niche={niche}
                  productData={productData}
                  brandKitId={brandKitId}
                  retentionCuts={retentionCuts}
                  getPlayhead={getPlayhead}
                  activeTemplateId={activeTemplateId}
                  loadAiMedia={loadAiMedia}
                  onAddText={onAddText}
                  onAddReady={onAddReady}
                  onAddElement={onAddElement}
                  onApplyTemplate={onApplyTemplate}
                  onGenerate={onGenerateAI}
                  onAiStatus={onAiStatus}
                  onNiche={onNiche}
                  onBrandKit={onBrandKit}
                  onProductData={onProductData}
                />
              )}
            </>
          ) : null}
        </div>
      </ScrollArea>

      <footer className="flex shrink-0 flex-col border-t border-border bg-background">
        <div className="flex flex-col gap-1.5 px-4 py-2.5">
        {exporting ? (
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(exportProgress * 100)}
              aria-label="Progresso da exportação"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${Math.round(exportProgress * 100)}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              {Math.round(exportProgress * 100)}%
            </span>
          </div>
        ) : null}
        {exporting ? (
          <p className="truncate text-center text-xs text-muted-foreground" aria-live="polite" title={exportStatus}>
            {exportStatus}
            {renderReplies > 0 ? ` · ${renderReplies} respostas do Mac` : ""}
          </p>
        ) : undoToast ? (
          <UndoToast message={undoToast} onUndo={onUndoToast} onDismiss={onDismissUndoToast} />
        ) : liveMessage && !finalExportError ? (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {liveMessage}
          </p>
        ) : (
          <p className="sr-only" aria-live="polite">
            {finalExportError || liveMessage}
          </p>
        )}
        {visibleTab === "video" && videoExport ? (
          <div className="pt-1">{videoExport}</div>
        ) : null}
        <AppVersionBadge />
        </div>
      </footer>
    </aside>
  )
}

function SelectionSummaryCard({
  inserts,
  selectedIds,
  onDuplicate,
  onDelete,
  onClear,
}: {
  inserts: Insert[]
  selectedIds: readonly string[]
  onDuplicate?: () => void
  onDelete?: () => void
  onClear?: () => void
}) {
  const summary = describeSelection(selectionKindCounts(selectableItems(inserts), selectedIds))
  return (
    <div className="rounded-lg border border-brand bg-card px-3 py-2 ring-1 ring-brand/40">
      <p className="text-sm font-medium text-foreground">{summary}</p>
      <div className="mt-2 flex items-center gap-1">
        <Button type="button" variant="outline" size="xs" onClick={onDuplicate}>
          Duplicar
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={onDelete}>
          Apagar
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Limpar seleção" onClick={onClear}>
          <X />
        </Button>
      </div>
    </div>
  )
}

function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string
  onUndo?: () => void
  onDismiss?: () => void
}) {
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(8_000)
  const dismiss = useCallback(() => onDismiss?.(), [onDismiss])

  useEffect(() => {
    remainingRef.current = 8_000
    setPaused(false)
  }, [message])

  useEffect(() => {
    if (paused || !onDismiss) return
    const started = Date.now()
    const timer = window.setTimeout(dismiss, remainingRef.current)
    return () => {
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - started))
      window.clearTimeout(timer)
    }
  }, [dismiss, message, onDismiss, paused])

  useEffect(() => {
    if (!onDismiss) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest("[data-undo-toast]")) return
      dismiss()
    }
    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [dismiss, onDismiss])

  return (
    <div
      data-undo-toast
      className="flex items-center justify-center gap-2"
      role="status"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <span className="text-xs text-muted-foreground">{message}</span>
      <Button type="button" variant="outline" size="xs" onClick={onUndo}>
        Desfazer
      </Button>
    </div>
  )
}

function framingSummary(source: CompositionSource): string {
  const cuts = source.cuts?.length ?? 0
  const adjusted = hasAnySegmentTransform(source)
  if (cuts > 0 && adjusted) return `${cuts + 1} trechos · ajustado`
  if (cuts > 0) return `${cuts + 1} trechos`
  return adjusted ? "ajustado" : "original"
}

function watermarkSummary(enabled: boolean, prefs: WatermarkPrefs): string {
  if (!enabled) return "desligada"
  const name = prefs.text.trim() || "sem texto"
  return `${name} · ${prefs.opacityPct}% · ${prefs.loop ? "loop" : "parado"}`
}

function SelectedCaptionBar({
  insert,
  onChange,
  onBegin,
  onEnd,
  onUseSharedStyle,
}: {
  insert: Insert
  onChange: (id: string, patch: Partial<Insert>) => void
  onBegin?: () => void
  onEnd?: () => void
  onUseSharedStyle: () => void
}) {
  const preview = insert.text?.trim() || "Legenda"
  const own = hasInsertOverrides(insert.styleRef) || insert.transform?.touchedByUser === true
  const range = `${formatTime(insert.start)}–${formatTime(insert.start + insert.duration)}`
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-2">
      <p className="truncate text-xs font-medium text-foreground">
        Linha selecionada: &apos;{preview}&apos; · {range}
      </p>
      <Textarea
        aria-label="Texto da linha selecionada"
        value={insert.text ?? ""}
        placeholder="Texto da linha"
        rows={2}
        onChange={(event) => onChange(insert.id, { text: event.target.value })}
        onFocus={() => onBegin?.()}
        onBlur={() => onEnd?.()}
      />
      {own ? (
        <Button type="button" variant="outline" size="xs" className="self-start" onClick={onUseSharedStyle}>
          Voltar ao estilo geral
        </Button>
      ) : null}
    </div>
  )
}

