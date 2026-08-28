"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Film, Sparkles, Layers } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AppVersionBadge } from "@/components/app-version-badge"
import { BackgroundSourceCard } from "@/components/background-source-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InsertCard } from "@/components/insert-card"
import { CaptionTextCard } from "@/components/caption-text-card"
import { CaptionVisualPanel } from "@/components/caption-visual-panel"
import { ElementPicker } from "@/components/element-picker"
import type { PresetLibraryHandlers } from "@/components/style-customize-panel"
import { AIGenerateButton } from "@/components/ai-generate-button"
import { GenerateCaptionsButton } from "@/components/generate-captions-button"
import { formatTimecode } from "@/lib/parse-decimal"
import { formatTime, type Insert, type InsertType, type Template } from "@/lib/inserts"
import type { GeneratePipelineResult } from "@/lib/ai-generate"
import type { CaptionLine } from "@/lib/captions"
import type { CaptionStyle, CompositionSource, OutputQualityId } from "@/lib/composition"
import type { SourceImport } from "@/lib/commit-source"
import { hasPlayableSource } from "@/lib/commit-source"
import type { RecentSource } from "@/lib/recent-sources"
import { DEFAULT_WATERMARK_PREFS, type WatermarkPrefs } from "@/lib/watermark"
import type { StyleLayer, TrackId } from "@/lib/style/types"
import type { ExportMode } from "@/lib/export/final-client"
import {
  captionStyleHost,
  countCaptionInserts,
  nonCaptionInserts,
} from "@/lib/caption-panel"
import {
  findDuplicateGroups,
  overflowingInserts,
  sortInsertsByStart,
} from "@/lib/insert-ops"
import {
  checklistItemsFromComposition,
  collectExportWarnings,
} from "@/lib/export-checklist"

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
  missingFile: boolean
  canExport: boolean
  exportDisabledReason: string | null
  exporting: boolean
  macRenderBusy?: boolean
  onInterruptMacRender?: () => void
  exportProgress: number
  exportStatus: string
  /** Quantas respostas de progresso o Mac já devolveu neste export. */
  renderReplies: number
  liveMessage: string
  finalExportError?: string | null
  canRetryFinalExport?: boolean
  onRetryFinalExport?: () => void
  canRecoverLastExport?: boolean
  onRecoverLastExport?: () => void
  undoToast?: string | null
  onUndoToast?: () => void
  selectedId: string | null
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
  onAddText: () => void
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
  onExport: () => void
  saveToCapcut: boolean
  onSaveToCapcutChange: (value: boolean) => void
  exportFileName: string
  onExportFileNameChange: (value: string) => void
  exportMode: ExportMode
  onExportModeChange: (mode: ExportMode) => void
  exportSpec: string | null
  outputQuality: OutputQualityId
  sourceWidth: number
  sourceHeight: number
  onOutputQualityChange: (quality: OutputQualityId) => void
  webmWarning: string | null
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  sourceSelected?: boolean
  onSelectSource?: () => void
  onResetTransform?: () => void
  watermarkEnabled?: boolean
  watermarkPrefs: WatermarkPrefs
  onWatermarkEnabledChange?: (enabled: boolean) => void
  onWatermarkPrefsChange?: (prefs: WatermarkPrefs) => void
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
  missingFile,
  canExport,
  exportDisabledReason,
  exporting,
  macRenderBusy = false,
  onInterruptMacRender,
  exportProgress,
  exportStatus,
  renderReplies,
  liveMessage,
  finalExportError = null,
  canRetryFinalExport = false,
  onRetryFinalExport,
  canRecoverLastExport = false,
  onRecoverLastExport,
  undoToast = null,
  onUndoToast,
  selectedId,
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
  onAddText,
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
  onExport,
  saveToCapcut,
  onSaveToCapcutChange,
  exportFileName,
  onExportFileNameChange,
  exportMode,
  onExportModeChange,
  exportSpec,
  outputQuality,
  sourceWidth,
  sourceHeight,
  onOutputQualityChange,
  webmWarning,
  onBeginInsertGesture,
  onEndInsertGesture,
  sourceSelected = false,
  onSelectSource,
  onResetTransform,
  watermarkEnabled = false,
  watermarkPrefs = DEFAULT_WATERMARK_PREFS,
  onWatermarkEnabledChange,
  onWatermarkPrefsChange,
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
  const hasCaptions = captionCount > 0
  const orderedInserts = useMemo(
    () => sortInsertsByStart(nonCaptionInserts(inserts)),
    [inserts],
  )
  const styleHost = useMemo(
    () => captionStyleHost(inserts, selectedId),
    [inserts, selectedId],
  )
  const hasSource = hasPlayableSource(source)
  const exportWarnings = useMemo(
    () =>
      collectExportWarnings(
        checklistItemsFromComposition({
          inserts,
          source: { duration: videoDuration },
          captionStyle,
          captionPreset,
          tracks,
          styleRef: projectStyle?.styleRef,
          brand: { fontId: brandFontId, logo: brandLogo },
        }),
      ),
    [
      brandFontId,
      brandLogo,
      captionPreset,
      captionStyle,
      inserts,
      projectStyle?.styleRef,
      tracks,
      videoDuration,
    ],
  )
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Film className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">
            Configuração de Inserts
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Composição vertical · 9:16
            {videoDuration > 0
              ? ` · ${formatTime(videoDuration)} (${formatTimecode(videoDuration)})`
              : ""}
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

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 px-5 py-5">
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
            canClearInserts={inserts.length > 0}
            onClearInserts={onClearInserts}
            sourceSelected={sourceSelected}
            onSelectSource={onSelectSource}
            onResetTransform={onResetTransform}
            watermarkEnabled={watermarkEnabled}
            watermarkPrefs={watermarkPrefs}
            onWatermarkEnabledChange={onWatermarkEnabledChange}
            onWatermarkPrefsChange={onWatermarkPrefsChange}
          />

          {hasSource ? (
            <>
          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Legendas</h2>
              {captionCount > 0 ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
                  {captionCount}
                </span>
              ) : null}
            </div>
            <GenerateCaptionsButton
              duration={videoDuration}
              disabled={!canGenerateCaptions}
              loadMedia={loadAiMedia}
              onGenerate={onGenerateCaptions}
              onStatus={onAiStatus}
            />
            {hasCaptions && styleHost ? (
              <>
                <CaptionVisualPanel
                  host={styleHost}
                  inserts={inserts}
                  videoDuration={videoDuration}
                  captionStyle={captionStyle}
                  captionPreset={captionPreset}
                  userPresets={presetLibrary?.presets}
                  onSelectLook={onApplyCaptionLook}
                  tracks={tracks}
                  projectStyle={projectStyle}
                  onPatchStyle={(path, value) => onPatchInsertStyle(styleHost.id, path, value)}
                  onResetField={(path) => onResetInsertStyleField(styleHost.id, path)}
                  onResetOverrides={() => onResetInsertStyleOverrides(styleHost.id)}
                  onResetPosition={() => onResetInsertPosition(styleHost.id)}
                  onApplyPreset={onApplyStylePreset}
                  onApplyToTrack={() => onApplyStyleToTrack(styleHost.id)}
                  onBeginGesture={onBeginInsertGesture}
                  onEndGesture={onEndInsertGesture}
                  presetLibrary={presetLibrary}
                />
                <CaptionTextCard
                  inserts={inserts}
                  selectedId={selectedId}
                  onChange={onChangeInsert}
                  onBeginInsertGesture={onBeginInsertGesture}
                  onEndInsertGesture={onEndInsertGesture}
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                O estilo das legendas aparece depois de gerar.
              </p>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Inserts</h2>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
                  {orderedInserts.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <AIGenerateButton
                  duration={videoDuration}
                  loadMedia={loadAiMedia}
                  onGenerate={onGenerateAI}
                  onStatus={onAiStatus}
                />
                <Button variant="outline" size="sm" onClick={onAddText}>
                  <Plus data-icon="inline-start" />
                  Texto
                </Button>
                <ElementPicker
                  activeTemplateId={activeTemplateId}
                  onAddElement={onAddElement}
                  onApplyTemplate={onApplyTemplate}
                />
              </div>
            </div>

            {overflowing.length > 0 ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {overflowing.length} insert
                {overflowing.length === 1 ? "" : "s"} passam do fim do vídeo
                {videoDuration > 0 ? ` (${formatTime(videoDuration)})` : ""}.
              </p>
            ) : null}

            {duplicateGroups.map((group) => (
              <div
                key={group.ids.join("-")}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">
                  {group.ids.length} inserts idênticos
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMergeDuplicates(group.ids)}
                >
                  Mesclar
                </Button>
              </div>
            ))}

            {orderedInserts.length === 0 ? (
              hasCaptions ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum chip, texto ou PNG ainda.
                </p>
              ) : (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <Sparkles className="mb-1 size-5 text-muted-foreground/70" />
                <p className="text-sm font-medium text-foreground">
                  Nenhum insert ainda
                </p>
                <p className="text-xs text-muted-foreground">
                  Comece pelo gancho — os 2 primeiros segundos.
                </p>
              </div>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {orderedInserts.map((insert, index) => (
                  <InsertCard
                    key={insert.id}
                    insert={insert}
                    index={index}
                    videoDuration={videoDuration}
                    expanded={selectedId === insert.id}
                    selected={selectedId === insert.id}
                    overflowing={overflowingIds.has(insert.id)}
                    missingLogo={insert.type === "logo-shopee" && !brandLogo}
                    brandFontId={brandFontId}
                    onToggle={() => onSelectInsert(insert.id)}
                    onChange={onChangeInsert}
                    onRemove={onRemoveInsert}
                    onBeginInsertGesture={onBeginInsertGesture}
                    onEndInsertGesture={onEndInsertGesture}
                    captionStyle={captionStyle}
                    captionPreset={captionPreset}
                    onChangeCaptionStyle={onChangeCaptionStyle}
                    tracks={tracks}
                    projectStyle={projectStyle}
                    onPatchStyle={(path, value) => onPatchInsertStyle(insert.id, path, value)}
                    onResetStyleField={(path) => onResetInsertStyleField(insert.id, path)}
                    onResetStyleOverrides={() => onResetInsertStyleOverrides(insert.id)}
                    onResetPosition={() => onResetInsertPosition(insert.id)}
                    onApplyStylePreset={onApplyStylePreset}
                    onApplyStyleToTrack={() => onApplyStyleToTrack(insert.id)}
                    presetLibrary={presetLibrary}
                  />
                ))}
              </div>
            )}
          </section>
            </>
          ) : null}
        </div>
      </ScrollArea>

      <footer className="border-t border-border p-4">
        {exporting ? (
          <>
            <div
              className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"
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
            <p className="mb-1 text-center text-xs text-muted-foreground" aria-live="polite">
              {exportStatus}
            </p>
            {renderReplies > 0 ? (
              <p className="mb-3 text-center text-[0.65rem] text-muted-foreground/70">
                {renderReplies} respostas do Mac
              </p>
            ) : null}
          </>
        ) : null}
        <ToggleGroup
          value={[exportMode]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "draft" || next === "final") onExportModeChange(next)
          }}
          variant="outline"
          className="mb-2 w-full"
        >
          <ToggleGroupItem value="draft" className="flex-1" disabled={exporting}>
            Rascunho
          </ToggleGroupItem>
          <ToggleGroupItem value="final" className="flex-1" disabled={exporting}>
            Final
          </ToggleGroupItem>
        </ToggleGroup>
        {exportMode === "draft" ? (
        <div className="mb-2 flex items-center gap-2">
          <Select
            value={outputQuality}
            onValueChange={(value) => {
              if (value === "1080" || value === "720" || value === "source") {
                onOutputQualityChange(value)
              }
            }}
          >
            <SelectTrigger
              className="h-9 w-full"
              size="sm"
              aria-label="Qualidade de exportação"
            >
              <SelectValue>
                {(value) =>
                  value === "1080"
                    ? "1080×1920 (recomendado)"
                    : value === "720"
                      ? "720×1280"
                      : `Original (${Math.max(2, sourceWidth)}×${Math.max(2, sourceHeight)})`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1080">1080×1920 (recomendado)</SelectItem>
              <SelectItem value="720">720×1280</SelectItem>
              <SelectItem value="source">
                Original ({Math.max(2, sourceWidth)}×{Math.max(2, sourceHeight)})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        ) : (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Final: o Mac gera 1080×1920 com o áudio do vídeo.
          </p>
        )}
        {hasSource && !exporting && exportWarnings.length > 0 ? (
          <ul
            className="mb-2 flex max-h-28 flex-col gap-1 overflow-y-auto"
            aria-label="Avisos antes de exportar"
          >
            {exportWarnings.map((warning) => (
              <li key={warning.id}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-[0.7rem] leading-snug text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    const targetId = warning.insertIds[0]
                    if (targetId && selectedId !== targetId) onSelectInsert(targetId)
                  }}
                >
                  {warning.title}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {macRenderBusy && !exporting ? (
          <div className="mb-2 rounded-md border border-border bg-muted/40 px-2 py-2">
            <p className="mb-2 text-center text-xs text-muted-foreground">
              O Mac ainda está gerando um vídeo.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onInterruptMacRender}
            >
              Interromper render
            </Button>
          </div>
        ) : null}
        {finalExportError && !exporting ? (
          <div className="mb-2 rounded-md border border-border bg-muted/40 px-2 py-2">
            <p className="text-center text-xs text-muted-foreground">
              {/cancelado/i.test(finalExportError)
                ? finalExportError
                : `Falha ao exportar: ${finalExportError}`}
            </p>
            {canRetryFinalExport && onRetryFinalExport ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={onRetryFinalExport}
              >
                Tentar de novo
              </Button>
            ) : null}
          </div>
        ) : null}
        {canRecoverLastExport && !exporting && exportMode === "final" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 w-full text-muted-foreground"
            onClick={onRecoverLastExport}
          >
            Recuperar último export
          </Button>
        ) : null}
        <label className="mb-2 flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
          <span className="font-medium text-foreground">Nome do arquivo</span>
          <span className="flex items-center gap-1">
            <Input
              value={exportFileName}
              disabled={exporting}
              maxLength={80}
              aria-label="Nome do arquivo exportado"
              placeholder="meu-anuncio"
              className="h-8 text-xs"
              onChange={(event) => onExportFileNameChange(event.target.value)}
            />
            <span className="shrink-0 font-mono text-[0.65rem] opacity-80">.mp4</span>
          </span>
        </label>
        <label className="mb-2 flex cursor-pointer items-start gap-2 text-[0.7rem] leading-snug text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-3.5 shrink-0 accent-brand"
            checked={saveToCapcut}
            disabled={exporting}
            aria-label="Salvar na pasta CapCut do HD"
            onChange={(event) => onSaveToCapcutChange(event.target.checked)}
          />
          <span>
            Salvar na pasta CapCut
            <span className="mt-0.5 block text-[0.65rem] opacity-80">
              O Final grava só no CapCut. O rascunho do navegador não entra.
            </span>
          </span>
        </label>
        <Button
          size="lg"
          onClick={onExport}
          disabled={!exporting && !canExport}
          title={!exporting ? exportDisabledReason ?? undefined : undefined}
          className="h-11 w-full bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90"
        >
          <Sparkles data-icon="inline-start" />
          {exporting ? "Cancelar" : "Renderizar e Exportar Vídeo"}
        </Button>
        {!canExport && !exporting ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {exportDisabledReason ?? "Carregue um vídeo para exportar."}
          </p>
        ) : null}
        {hasSource && exportSpec && !exporting ? (
          <p className="mt-2 text-center font-mono text-[0.7rem] tabular-nums text-muted-foreground">
            {inserts.length === 0 && !hasCaptions
              ? "1080×1920 · 30fps · sem inserts nem legendas."
              : exportSpec}
          </p>
        ) : null}
        {webmWarning && !exporting && exportMode === "draft" ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {webmWarning}
          </p>
        ) : null}
        {undoToast && !exporting ? (
          <div className="mt-2 flex items-center justify-center gap-2" role="status">
            <span className="text-xs text-muted-foreground">{undoToast}</span>
            <Button type="button" variant="outline" size="xs" onClick={onUndoToast}>
              Desfazer
            </Button>
          </div>
        ) : liveMessage && !exporting && !finalExportError ? (
          <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
            {liveMessage}
          </p>
        ) : (
          <p className="sr-only" aria-live="polite">
            {exporting ? exportStatus : finalExportError || liveMessage}
          </p>
        )}
        <AppVersionBadge />
      </footer>
    </aside>
  )
}
