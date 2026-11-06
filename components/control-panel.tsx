"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Plus, Film, Sparkles, Layers } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppVersionBadge } from "@/components/app-version-badge"
import { BackgroundSourceCard } from "@/components/background-source-card"
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
import type { CaptionStyle, CompositionSource } from "@/lib/composition"
import type { SourceImport } from "@/lib/commit-source"
import { hasPlayableSource } from "@/lib/commit-source"
import type { RecentSource } from "@/lib/recent-sources"
import { DEFAULT_WATERMARK_PREFS, type WatermarkPrefs } from "@/lib/watermark"
import type { StyleLayer, TrackId } from "@/lib/style/types"
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
  DEFAULT_COLLAPSED_SECTIONS,
  PANEL_SECTIONS,
  loadCollapsedSections,
  saveCollapsedSections,
  type CollapsedSections,
  type PanelSectionId,
} from "@/lib/panel-sections"
import { PANEL_VIEWPORT_SELECTOR } from "@/lib/scroll-panel"
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
  onClearCaptions: () => void
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
  exporting,
  exportProgress,
  exportStatus,
  renderReplies,
  liveMessage,
  finalExportError = null,
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
  onClearCaptions,
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

  // Começa aberto no servidor e no 1º render; o salvo entra depois para não divergir na hidratação.
  const [collapsed, setCollapsed] = useState<CollapsedSections>(DEFAULT_COLLAPSED_SECTIONS)
  useEffect(() => {
    setCollapsed(loadCollapsedSections())
  }, [])
  const toggleSection = useCallback((id: PanelSectionId) => {
    setCollapsed((current) => {
      const next = { ...current, [id]: !current[id] }
      saveCollapsedSections(next)
      return next
    })
  }, [])

  const sectionRefs = useRef<Partial<Record<PanelSectionId, HTMLElement | null>>>({})
  const goToSection = useCallback((id: PanelSectionId) => {
    setCollapsed((current) => {
      if (!current[id]) return current
      const next = { ...current, [id]: false }
      saveCollapsedSections(next)
      return next
    })
    requestAnimationFrame(() => {
      const element = sectionRefs.current[id]
      const viewport = element?.closest(PANEL_VIEWPORT_SELECTOR)
      if (!element || !(viewport instanceof HTMLElement)) return
      const delta = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top
      viewport.scrollBy({ top: delta, behavior: "smooth" })
    })
  }, [])
  const sectionCounts: Partial<Record<PanelSectionId, number>> = {
    captions: captionCount,
    inserts: orderedInserts.length,
  }

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

      <nav
        aria-label="Seções do painel"
        className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5"
      >
        {PANEL_SECTIONS.map((section, index) => {
          const disabled = section.id !== "video" && !hasSource
          const count = sectionCounts[section.id]
          return (
            <span key={section.id} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="text-xs text-muted-foreground/50" aria-hidden>
                  ·
                </span>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => goToSection(section.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                {section.label}
                {count ? <span className="ml-1 tabular-nums opacity-70">{count}</span> : null}
              </button>
            </span>
          )
        })}
      </nav>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-5 pb-5">
          <PanelSection
            id="video"
            title="Vídeo"
            collapsed={collapsed.video}
            onToggle={toggleSection}
            sectionRef={(element) => {
              sectionRefs.current.video = element
            }}
          >
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
          </PanelSection>

          {hasSource ? (
            <>
              <PanelSection
                id="captions"
                title="Legendas"
                count={captionCount}
                collapsed={collapsed.captions}
                onToggle={toggleSection}
                sectionRef={(element) => {
                  sectionRefs.current.captions = element
                }}
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={!hasCaptions}
                    onClick={onClearCaptions}
                  >
                    Limpar legendas
                  </Button>
                }
              >
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
              </PanelSection>

              <PanelSection
                id="inserts"
                title="Inserts"
                icon={<Layers className="size-4 text-muted-foreground" />}
                count={orderedInserts.length}
                collapsed={collapsed.inserts}
                onToggle={toggleSection}
                sectionRef={(element) => {
                  sectionRefs.current.inserts = element
                }}
              >
                <div className="flex flex-wrap items-center gap-1.5">
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
              </PanelSection>
            </>
          ) : null}
        </div>
      </ScrollArea>

      <footer className="flex shrink-0 flex-col gap-1.5 border-t border-border px-4 py-2.5">
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
          <div className="flex items-center justify-center gap-2" role="status">
            <span className="text-xs text-muted-foreground">{undoToast}</span>
            <Button type="button" variant="outline" size="xs" onClick={onUndoToast}>
              Desfazer
            </Button>
          </div>
        ) : liveMessage && !finalExportError ? (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {liveMessage}
          </p>
        ) : (
          <p className="sr-only" aria-live="polite">
            {finalExportError || liveMessage}
          </p>
        )}
        <AppVersionBadge />
      </footer>
    </aside>
  )
}

function PanelSection({
  id,
  title,
  icon,
  count,
  actions,
  collapsed,
  onToggle,
  sectionRef,
  children,
}: {
  id: PanelSectionId
  title: string
  icon?: ReactNode
  count?: number
  actions?: ReactNode
  collapsed: boolean
  onToggle: (id: PanelSectionId) => void
  sectionRef: (element: HTMLElement | null) => void
  children: ReactNode
}) {
  const contentId = `panel-section-${id}`
  return (
    <section ref={sectionRef} data-panel-section={id} className="flex flex-col gap-3" aria-labelledby={`${contentId}-title`}>
      {/* Sticky dentro do viewport do ScrollArea: o título da seção fica visível ao rolar. */}
      <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-5 py-2 backdrop-blur-sm">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => onToggle(id)}
        >
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")}
            aria-hidden
          />
          {icon}
          <h2 id={`${contentId}-title`} className="truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          {count ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          ) : null}
        </button>
        {actions && !collapsed ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      <div id={contentId} hidden={collapsed} className="flex flex-col gap-3">
        {children}
      </div>
    </section>
  )
}
