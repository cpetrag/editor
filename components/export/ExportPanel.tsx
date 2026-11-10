"use client"

import { useMemo, useState, type RefObject } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { OutputQualityId } from "@/lib/composition"
import type { ExportWarning } from "@/lib/export-checklist"
import type { ExportMode } from "@/lib/export/final-client"
import { groupExportWarnings, type ExportWarningGroup } from "@/lib/export-warning-groups"
import { cn } from "@/lib/utils"

/** Lidas na hora do clique: o menu é memoizado e não precisa re-renderizar por causa delas. */
export interface ExportMenuActions {
  onExport: () => void
  onInterruptMacRender: () => void
  onRetryFinalExport: () => void
  onRecoverLastExport: () => void
  onSaveToCapcutChange: (value: boolean) => void
  onExportFileNameChange: (value: string) => void
  onExportModeChange: (mode: ExportMode) => void
  onOutputQualityChange: (quality: OutputQualityId) => void
  onSelectInsert: (id: string) => void
  onReplaceAudio?: (trackId: string) => void
  onFitInserts?: () => void
}

export interface ExportMenuProps {
  actionsRef: RefObject<ExportMenuActions>
  hasSource: boolean
  canExport: boolean
  exportDisabledReason: string | null
  exporting: boolean
  exportProgress: number
  exportStatus: string
  macRenderBusy: boolean
  finalExportError: string | null
  canRetryFinalExport: boolean
  canRecoverLastExport: boolean
  saveToCapcut: boolean
  exportFileName: string
  exportMode: ExportMode
  exportSpec: string | null
  emptyComposition: boolean
  outputQuality: OutputQualityId
  sourceWidth: number
  sourceHeight: number
  webmWarning: string | null
  warnings: ExportWarning[]
  pendingNote?: string | null
  audioPhrase?: string
}

function qualityLabel(value: string, sourceWidth: number, sourceHeight: number): string {
  if (value === "1080") return "1080×1920 (recomendado)"
  if (value === "720") return "720×1280"
  return `Original (${Math.max(2, sourceWidth)}×${Math.max(2, sourceHeight)})`
}

export function ExportPanel({
  actionsRef,
  hasSource,
  canExport,
  exportDisabledReason,
  exporting,
  exportProgress,
  exportStatus,
  macRenderBusy,
  finalExportError,
  canRetryFinalExport,
  canRecoverLastExport,
  saveToCapcut,
  exportFileName,
  exportMode,
  exportSpec,
  emptyComposition,
  outputQuality,
  sourceWidth,
  sourceHeight,
  webmWarning,
  warnings,
  pendingNote,
  audioPhrase = "com o áudio do vídeo",
  onAfterExport,
}: ExportMenuProps & { pendingNote?: string | null; onAfterExport?: () => void }) {
  const percent = Math.round(exportProgress * 100)
  const warningGroups = useMemo(() => groupExportWarnings(warnings), [warnings])
  const showWarnings = hasSource && !exporting && (warnings.length > 0 || Boolean(pendingNote))

  return (
    <div className="flex flex-col gap-3">
      {exporting ? (
        <div className="flex flex-col gap-1.5">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Progresso da exportação"
          >
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-center text-xs text-muted-foreground">{exportStatus}</p>
        </div>
      ) : null}

      <ToggleGroup
        value={[exportMode]}
        onValueChange={(value) => {
          const next = value[0]
          if (next === "draft" || next === "final") actionsRef.current.onExportModeChange(next)
        }}
        variant="outline"
        className="w-full"
        aria-label="Tipo de exportação"
      >
        <ToggleGroupItem value="draft" className="flex-1" disabled={exporting} title="Gera o vídeo aqui no navegador">
          Rascunho
        </ToggleGroupItem>
        <ToggleGroupItem value="final" className="flex-1" disabled={exporting} title="O Mac gera o vídeo final com áudio">
          Final
        </ToggleGroupItem>
      </ToggleGroup>

      {exportMode === "draft" ? (
        <Select
          value={outputQuality}
          onValueChange={(value) => {
            if (value === "1080" || value === "720" || value === "source") {
              actionsRef.current.onOutputQualityChange(value)
            }
          }}
        >
          <SelectTrigger className="h-9 w-full" size="sm" aria-label="Qualidade de exportação" disabled={exporting}>
            <SelectValue>{(value) => qualityLabel(String(value), sourceWidth, sourceHeight)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1080">{qualityLabel("1080", sourceWidth, sourceHeight)}</SelectItem>
            <SelectItem value="720">{qualityLabel("720", sourceWidth, sourceHeight)}</SelectItem>
            <SelectItem value="source">{qualityLabel("source", sourceWidth, sourceHeight)}</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">Final: o Mac gera 1080×1920 {audioPhrase}.</p>
      )}

      <label className="flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
        <span className="font-medium text-foreground">Nome do arquivo</span>
        <span className="flex items-center gap-1">
          <Input
            value={exportFileName}
            disabled={exporting}
            maxLength={80}
            aria-label="Nome do arquivo exportado"
            placeholder="meu-anuncio"
            className="h-8 text-xs"
            onChange={(event) => actionsRef.current.onExportFileNameChange(event.target.value)}
          />
          <span className="shrink-0 font-mono text-[0.65rem] opacity-80">.mp4</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2 text-[0.7rem] leading-snug text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 shrink-0 accent-brand"
          checked={saveToCapcut}
          disabled={exporting}
          aria-label="Salvar na pasta CapCut do HD"
          onChange={(event) => actionsRef.current.onSaveToCapcutChange(event.target.checked)}
        />
        <span>
          Salvar na pasta CapCut
          <span className="mt-0.5 block text-[0.65rem] opacity-80">
            O Final grava só no CapCut. O rascunho do navegador não entra.
          </span>
        </span>
      </label>

      {pendingNote && !exporting ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-400/5 px-2 py-1.5 text-xs text-foreground">
          {pendingNote}
        </p>
      ) : null}

      {showWarnings && warnings.length > 0 ? (
        <ExportWarningsList groups={warningGroups} total={warnings.length} actionsRef={actionsRef} />
      ) : null}

      {macRenderBusy && !exporting ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-2">
          <p className="text-center text-xs text-muted-foreground">O Mac ainda está gerando um vídeo.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => actionsRef.current.onInterruptMacRender()}>
            Interromper render
          </Button>
        </div>
      ) : null}

      {finalExportError && !exporting ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2">
          <p className="text-center text-xs text-destructive">
            {/cancelado/i.test(finalExportError) ? finalExportError : `Falha ao exportar: ${finalExportError}`}
          </p>
          {canRetryFinalExport ? (
            <Button type="button" variant="outline" size="sm" onClick={() => actionsRef.current.onRetryFinalExport()}>
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
          className="text-muted-foreground"
          onClick={() => actionsRef.current.onRecoverLastExport()}
        >
          Recuperar último export
        </Button>
      ) : null}

      <Button
        size="lg"
        onClick={() => {
          if (!exporting) onAfterExport?.()
          actionsRef.current.onExport()
        }}
        disabled={!exporting && !canExport}
        title={!exporting ? (exportDisabledReason ?? undefined) : undefined}
        className={cn(
          "h-10 w-full text-sm font-semibold",
          exporting ? "" : "bg-brand text-brand-foreground hover:bg-brand/90",
        )}
        variant={exporting ? "outline" : "default"}
      >
        {exporting ? null : <Sparkles data-icon="inline-start" />}
        {exporting ? "Cancelar exportação" : "Renderizar e exportar vídeo"}
      </Button>
      {!canExport && !exporting ? (
        <p className="text-center text-xs text-muted-foreground">
          {exportDisabledReason ?? "Carregue um vídeo para exportar."}
        </p>
      ) : null}
      {hasSource && exportSpec && !exporting ? (
        <p className="text-center font-mono text-[0.7rem] tabular-nums text-muted-foreground">
          {emptyComposition ? "1080×1920 · 30fps · sem inserts nem legendas." : exportSpec}
        </p>
      ) : null}
      {webmWarning && !exporting && exportMode === "draft" ? (
        <p className="text-center text-xs text-muted-foreground">{webmWarning}</p>
      ) : null}
    </div>
  )
}

function ExportWarningsList({
  groups,
  total,
  actionsRef,
}: {
  groups: ExportWarningGroup[]
  total: number
  actionsRef: RefObject<ExportMenuActions>
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-md border border-amber-400/30 bg-amber-400/5">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-foreground"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <AlertTriangle className="size-3.5 text-amber-400" />
        Avisos ({total})
      </button>
      {expanded ? (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto px-2 pb-2" aria-label="Avisos antes de exportar">
          {groups.map((group) => (
            <ExportWarningGroupItem key={group.code} group={group} actionsRef={actionsRef} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ExportWarningGroupItem({
  group,
  actionsRef,
}: {
  group: ExportWarningGroup
  actionsRef: RefObject<ExportMenuActions>
}) {
  const [open, setOpen] = useState(false)
  const selectFirstOf = (insertIds: string[]) => {
    const targetId = insertIds[0]
    if (targetId) actionsRef.current.onSelectInsert(targetId)
  }
  const itemClass =
    "w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-[0.7rem] leading-snug text-muted-foreground hover:bg-muted"
  const single = group.warnings.length === 1 ? group.warnings[0] : null
  if (single) {
    return (
      <li>
        <button type="button" className={itemClass} onClick={() => selectFirstOf(single.insertIds)}>
          {single.title}
        </button>
        {single.code === "insert-past-end" ? (
          <button
            type="button"
            className="mt-1 text-[0.65rem] font-medium text-foreground underline"
            onClick={() => actionsRef.current.onFitInserts?.()}
          >
            Ajustar
          </button>
        ) : null}
        {single.code === "audio-missing" && single.insertIds[0] ? (
          <button
            type="button"
            className="mt-1 text-[0.65rem] font-medium text-foreground underline"
            onClick={() => actionsRef.current.onReplaceAudio?.(single.insertIds[0] ?? "")}
          >
            Reenviar arquivo
          </button>
        ) : null}
      </li>
    )
  }
  return (
    <li className="flex flex-col gap-1">
      <button
        type="button"
        className={cn(itemClass, "flex items-center gap-1.5")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <span className="flex-1">{group.label}</span>
        <span className="rounded-full bg-muted px-1.5 font-mono tabular-nums">{group.warnings.length}</span>
      </button>
      {open ? (
        <ul className="flex flex-col gap-1 pl-4">
          {group.warnings.map((warning) => (
            <li key={warning.id}>
              <button type="button" className={itemClass} onClick={() => selectFirstOf(warning.insertIds)}>
                {warning.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
