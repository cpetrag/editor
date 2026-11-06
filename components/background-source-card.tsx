"use client"

import { useEffect, useRef, useState } from "react"
import { FileVideo, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { IMPORT_ERROR_COPY } from "@/lib/import-errors"
import type { SourceImport } from "@/lib/commit-source"
import { hasPlayableSource } from "@/lib/commit-source"
import type { CompositionSource } from "@/lib/composition"
import type { RecentSource } from "@/lib/recent-sources"
import { hasAnySegmentTransform } from "@/lib/source-segments"
import {
  WATERMARK_FONT_PX_MAX,
  WATERMARK_FONT_PX_MIN,
  WATERMARK_OPACITY_PCT_MAX,
  WATERMARK_OPACITY_PCT_MIN,
  WATERMARK_SPEED_MAX,
  WATERMARK_SPEED_MIN,
  WATERMARK_SPEED_STEP,
  type WatermarkPrefs,
} from "@/lib/watermark"
import {
  importElapsedLabel,
  providerLabel,
  shortenCanonicalUrl,
  sourceHeadline,
  sourceKind,
  sourceTechLine,
} from "@/lib/source-url"
import { cn } from "@/lib/utils"

type BackgroundSourceCardProps = {
  source: CompositionSource
  missingFile: boolean
  importState: SourceImport
  draftUrl: string
  replacing: boolean
  elapsedSeconds: number
  recent: RecentSource[]
  previousSource: CompositionSource | null
  burnedInWarning: boolean
  onDraftUrlChange: (url: string) => void
  onSubmitUrl: (url: string) => void
  onPickFile: (file: File) => void
  onUseRecent: (canonicalUrl: string) => void
  onReplace: () => void
  onRestorePrevious: () => void
  onRetry: () => void
  onDownloadCopy: () => void
  canClearInserts: boolean
  onClearInserts: () => void
  sourceSelected?: boolean
  onSelectSource?: () => void
  onResetTransform?: () => void
  watermarkEnabled?: boolean
  watermarkPrefs: WatermarkPrefs
  onWatermarkEnabledChange?: (enabled: boolean) => void
  onWatermarkPrefsChange?: (prefs: WatermarkPrefs) => void
}

function canonicalFieldNumber(
  parsed: number,
  min: number,
  max: number,
  step: number,
): number {
  const snapped =
    step === 1 ? Math.round(parsed) : Math.round(parsed / step) * step
  return Math.min(max, Math.max(min, snapped))
}

function WatermarkNumberField({
  value,
  onCommit,
  disabled,
  ariaLabel,
  min,
  max,
  step,
  suffix,
  label,
}: {
  value: number
  onCommit: (next: number) => void
  disabled?: boolean
  ariaLabel: string
  min: number
  max: number
  step: number
  suffix?: string
  label: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  return (
    <label className="flex min-w-0 items-center gap-1 text-[0.65rem] text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-7 w-14 rounded-md border border-border bg-background px-1 text-xs tabular-nums disabled:opacity-50"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (next.trim() === "") return
          const parsed = Number(next)
          if (!Number.isFinite(parsed)) return
          if (parsed < min || parsed > max) return
          onCommit(parsed)
        }}
        onBlur={() => {
          if (draft.trim() === "") {
            setDraft(String(value))
            return
          }
          const parsed = Number(draft)
          if (!Number.isFinite(parsed)) {
            setDraft(String(value))
            return
          }
          onCommit(parsed)
          setDraft(String(canonicalFieldNumber(parsed, min, max, step)))
        }}
      />
      {suffix ? <span className="shrink-0">{suffix}</span> : null}
    </label>
  )
}

function WatermarkRow({
  enabled,
  prefs,
  canEnable,
  onEnabledChange,
  onPrefsChange,
}: {
  enabled: boolean
  prefs: WatermarkPrefs
  canEnable: boolean
  onEnabledChange?: (enabled: boolean) => void
  onPrefsChange?: (prefs: WatermarkPrefs) => void
}) {
  return (
    <div
      className="mt-2 flex min-w-0 flex-col gap-1.5 border-t border-border pt-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <label className="flex shrink-0 items-center gap-1 text-[0.7rem] font-medium text-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-brand"
            checked={enabled}
            disabled={!canEnable}
            aria-label="Marca d'água neste vídeo"
            onChange={(event) => onEnabledChange?.(event.target.checked)}
          />
          Marca
        </label>
        <input
          type="text"
          maxLength={40}
          placeholder="@minhaloja"
          aria-label="Handle da marca d'água"
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 text-xs"
          value={prefs.text}
          onChange={(event) =>
            onPrefsChange?.({ ...prefs, text: event.target.value })
          }
        />
        <ToggleGroup
          value={[prefs.loop ? "loop" : "still"]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "loop") onPrefsChange?.({ ...prefs, loop: true })
            if (next === "still") onPrefsChange?.({ ...prefs, loop: false })
          }}
          variant="outline"
          className="shrink-0"
          aria-label="Movimento da marca d'água"
        >
          <ToggleGroupItem value="still" className="h-7 px-2 text-[0.65rem]">
            Parado
          </ToggleGroupItem>
          <ToggleGroupItem value="loop" className="h-7 px-2 text-[0.65rem]">
            Loop
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <WatermarkNumberField
          label="Opac."
          suffix="%"
          value={prefs.opacityPct}
          min={WATERMARK_OPACITY_PCT_MIN}
          max={WATERMARK_OPACITY_PCT_MAX}
          step={1}
          ariaLabel="Opacidade da marca d'água"
          onCommit={(opacityPct) => onPrefsChange?.({ ...prefs, opacityPct })}
        />
        <WatermarkNumberField
          label="Tam."
          value={prefs.fontPx}
          min={WATERMARK_FONT_PX_MIN}
          max={WATERMARK_FONT_PX_MAX}
          step={1}
          ariaLabel="Tamanho da marca d'água"
          onCommit={(fontPx) => onPrefsChange?.({ ...prefs, fontPx })}
        />
        <WatermarkNumberField
          label="Vel."
          suffix="×"
          value={prefs.speed}
          min={WATERMARK_SPEED_MIN}
          max={WATERMARK_SPEED_MAX}
          step={WATERMARK_SPEED_STEP}
          disabled={!prefs.loop}
          ariaLabel="Velocidade da marca d'água"
          onCommit={(speed) => onPrefsChange?.({ ...prefs, speed })}
        />
      </div>
    </div>
  )
}

function CurrentStrip({
  source,
  faded,
  caption,
}: {
  source: CompositionSource
  faded?: boolean
  caption?: string
}) {
  const kind = sourceKind(source)
  const provider = kind === "url" ? providerLabel(source.provider) : null
  const original = source.canonicalUrl || source.remoteUrl
  return (
    <div className={cn("rounded-lg border border-border bg-muted/40 p-3", faded && "opacity-70")}>
      <p className="truncate text-sm font-medium text-foreground">{sourceHeadline(source)}</p>
      <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
        {sourceTechLine(source)}
      </p>
      {provider || original ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {provider ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {provider}
            </span>
          ) : null}
          {kind === "url" && original ? (
            <a
              href={original}
              target="_blank"
              rel="noreferrer"
              className="text-[0.7rem] text-brand underline-offset-2 hover:underline"
            >
              Abrir original
            </a>
          ) : null}
        </div>
      ) : null}
      {caption ? <p className="mt-1 text-[0.7rem] text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

function PreviousNote({
  source,
  onRestore,
}: {
  source: CompositionSource
  onRestore: () => void
}) {
  if (sourceKind(source) === "url") {
    return (
      <Button type="button" variant="ghost" size="xs" className="self-start" onClick={onRestore}>
        Voltar para {sourceHeadline(source)}
      </Button>
    )
  }
  return (
    <p className="text-[0.7rem] text-muted-foreground">
      O anterior era {source.fileName || "arquivo local"} ({sourceTechLine(source)})
    </p>
  )
}

export function BackgroundSourceCard({
  source,
  missingFile,
  importState,
  draftUrl,
  replacing,
  elapsedSeconds,
  recent,
  previousSource,
  burnedInWarning,
  onDraftUrlChange,
  onSubmitUrl,
  onPickFile,
  onUseRecent,
  onReplace,
  onRestorePrevious,
  onRetry,
  onDownloadCopy,
  canClearInserts,
  onClearInserts,
  sourceSelected = false,
  onSelectSource,
  onResetTransform,
  watermarkEnabled,
  watermarkPrefs,
  onWatermarkEnabledChange,
  onWatermarkPrefsChange,
}: BackgroundSourceCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const playable = hasPlayableSource(source)
  const busy = importState.status === "downloading" || importState.status === "probing"
  const showEditor = !playable || replacing || importState.status !== "idle"
  const fieldValue =
    importState.status === "downloading" || importState.status === "probing"
      ? shortenCanonicalUrl(
          importState.status === "probing" ? importState.canonicalUrl : importState.rawUrl,
        ) || importState.rawUrl
      : draftUrl
  const errorCopy = importState.status === "error" ? IMPORT_ERROR_COPY[importState.code] : null

  function submitUrl(raw: string) {
    const value = raw.trim()
    if (!value || busy) return
    onSubmitUrl(value)
  }

  function takeFile(file: File | undefined | null) {
    if (!file || busy) return
    const looksVideo =
      file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name)
    if (!looksVideo) return
    onPickFile(file)
  }

  if (playable && !showEditor) {
    const kind = sourceKind(source)
    const provider = kind === "url" ? providerLabel(source.provider) : null
    const original = source.canonicalUrl || source.remoteUrl
    return (
      <Field>
        <FieldLabel>
          <FileVideo className="size-3.5 text-muted-foreground" />
          Vídeo de fundo
        </FieldLabel>
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-card p-3",
            sourceSelected ? "border-brand ring-1 ring-brand/40" : "border-border",
          )}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest?.("button, a, input, label, textarea")) return
            onSelectSource?.()
          }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileVideo className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{sourceHeadline(source)}</p>
            <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              {sourceTechLine(source)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {provider ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {provider}
                </span>
              ) : null}
              {kind === "url" && original ? (
                <a
                  href={original}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.7rem] text-brand underline-offset-2 hover:underline"
                >
                  Abrir original
                </a>
              ) : null}
              {kind === "url" && !missingFile ? (
                <button
                  type="button"
                  className="text-[0.7rem] text-brand underline-offset-2 hover:underline"
                  onClick={onDownloadCopy}
                >
                  Baixar cópia
                </button>
              ) : null}
            </div>
            {missingFile ? (
              <p className="mt-1 text-[0.7rem] text-destructive">
                O vídeo não está neste navegador. Use Trocar para baixar de novo.
              </p>
            ) : null}
            {burnedInWarning && kind === "url" ? (
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                Esse vídeo tem legenda embutida — as legendas que você gerar vão se sobrepor.
              </p>
            ) : null}
            <WatermarkRow
              enabled={watermarkEnabled === true}
              prefs={watermarkPrefs}
              canEnable={playable}
              onEnabledChange={onWatermarkEnabledChange}
              onPrefsChange={onWatermarkPrefsChange}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button type="button" variant="outline" size="xs" onClick={onReplace}>
              Trocar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!canClearInserts}
              onClick={onClearInserts}
            >
              Limpar inserts
            </Button>
            {!missingFile ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-auto whitespace-normal text-left leading-tight"
                disabled={!hasAnySegmentTransform(source)}
                onClick={onResetTransform}
              >
                Resetar enquadramento
              </Button>
            ) : null}
          </div>
        </div>
        {previousSource ? <PreviousNote source={previousSource} onRestore={onRestorePrevious} /> : null}
      </Field>
    )
  }

  return (
    <Field>
      <FieldLabel>
        <FileVideo className="size-3.5 text-muted-foreground" />
        Vídeo de fundo
      </FieldLabel>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-dashed border-border p-3 transition-colors",
          dragging && "border-brand bg-brand/5",
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          takeFile(event.dataTransfer.files?.[0])
        }}
      >
        <div className="flex gap-2">
          <Input
            id="background-url"
            name="background-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            autoFocus={!playable}
            className="flex-1"
            placeholder="Cole o link do TikTok, Reels, Shorts ou do catálogo…"
            value={busy ? fieldValue : draftUrl}
            disabled={busy}
            aria-invalid={importState.status === "error" || undefined}
            onChange={(event) => onDraftUrlChange(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text").trim()
              if (!text) return
              event.preventDefault()
              onDraftUrlChange(text)
              submitUrl(text)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submitUrl(draftUrl)
              }
            }}
          />
          {busy ? <Spinner className="mt-1.5 size-4 shrink-0" /> : null}
        </div>

        {importState.status === "downloading" ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {importElapsedLabel(importState.jobStatus, elapsedSeconds)}
          </p>
        ) : null}
        {importState.status === "probing" ? (
          <p className="text-xs text-muted-foreground">Abrindo no editor…</p>
        ) : null}

        {errorCopy && importState.status === "error" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <p className="text-sm font-medium text-destructive">{errorCopy.title}</p>
            <p className="mt-0.5 text-xs text-destructive">{errorCopy.message}</p>
            {errorCopy.retry ? (
              <Button type="button" variant="outline" size="xs" className="mt-2" onClick={onRetry}>
                Tentar de novo
              </Button>
            ) : null}
            {importState.detail ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[0.7rem] text-muted-foreground">
                  Ver detalhes
                </summary>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.65rem] text-muted-foreground">
                  {importState.detail}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {!busy ? (
          <>
            <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(event) => {
                  takeFile(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload data-icon="inline-start" />
                Escolher arquivo
              </Button>
              <p className="self-center text-xs text-muted-foreground">Arraste aqui</p>
            </div>
          </>
        ) : null}

        {playable ? (
          <CurrentStrip
            source={source}
            faded={busy || importState.status === "error"}
            caption={
              busy
                ? "continua na timeline até o novo carregar"
                : importState.status === "error"
                  ? "segue como vídeo de fundo"
                  : undefined
            }
          />
        ) : null}

        {!playable && !busy && recent.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[0.7rem] font-medium text-muted-foreground">Links recentes</p>
            {recent.map((item) => (
              <div
                key={item.canonicalUrl}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <span className="rounded bg-muted px-1 py-0.5 text-[0.6rem] font-semibold uppercase text-muted-foreground">
                  {providerLabel(item.provider) ?? "Link"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {[item.author, item.title].filter(Boolean).join(" · ") || item.canonicalUrl}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onUseRecent(item.canonicalUrl)}
                >
                  Usar
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <WatermarkRow
          enabled={watermarkEnabled === true}
          prefs={watermarkPrefs}
          canEnable={playable}
          onEnabledChange={onWatermarkEnabledChange}
          onPrefsChange={onWatermarkPrefsChange}
        />
      </div>
      {missingFile && playable ? (
        <FieldDescription>
          O vídeo não está neste navegador. Cole o link de novo ou escolha o arquivo.
        </FieldDescription>
      ) : null}
      {previousSource ? <PreviousNote source={previousSource} onRestore={onRestorePrevious} /> : null}
      {burnedInWarning && sourceKind(source) === "url" && playable ? (
        <p className="text-[0.7rem] text-muted-foreground">
          Esse vídeo tem legenda embutida — as legendas que você gerar vão se sobrepor.
        </p>
      ) : null}
    </Field>
  )
}
