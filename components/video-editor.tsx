"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ControlPanel } from "@/components/control-panel"
import { PreviewPanel, type PreviewHandle } from "@/components/preview-panel"
import { EditorNav, type EditorTab } from "@/components/editor-nav"
import { LibraryPanel } from "@/components/library-panel"
import { projectHasArtInserts } from "@/lib/library-combo"
import { BatchPanel } from "@/components/batch-panel"
import { EditorHeaderActions, type SaveStatus } from "@/components/editor-header-actions"
import { ExportMenu, type ExportMenuActions } from "@/components/export-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  clampComposition,
  clampInsert,
  createDefaultComposition,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_FPS,
  insertKind,
  mergeCaptionStylePatch,
  mergeInsertPatch,
  outputFromQuality,
  qualityFromOutput,
  MAX_STICKERS,
  type CaptionStyle,
  type Composition,
  type CompositionSource,
} from "@/lib/composition"
import { toCliRenderProps, toRenderProps } from "@/remotion/types"
import {
  beginInsertGesture,
  canRedo,
  canUndo,
  commitDiscrete,
  emptyGesture,
  emptyHistory,
  endInsertGesture,
  historyShortcut,
  redo,
  undo,
  type HistorySnapshot,
} from "@/lib/composition-history"
import {
  createInsert,
  createStickerInsert,
  duplicateInsert,
  applyTemplateToInserts,
  appendTemplateToInserts,
  instantiateTemplate,
  FONT_MAP,
  type Insert,
  type InsertType,
  type Template,
  type Variation,
} from "@/lib/inserts"
import { applyVariationPreview, mergeDuplicateGroup, nextInsertStart, seekTimeForInsert, zoneForInsert } from "@/lib/insert-ops"
import {
  createIndexedDbFileStore,
  loadCompositionJson,
  saveCompositionJson,
} from "@/lib/project-store"
import {
  clearCaptionInsertsArt,
  clearInsertsArt,
  newProjectComposition,
  projectFileIds,
} from "@/lib/project-reset"
import { loadWatermarkPrefs, saveWatermarkPrefs } from "@/lib/watermark-store"
import { normalizeWatermarkPrefs, watermarkPaintInput } from "@/lib/watermark"
import { resolveExportSize } from "@/lib/export/compositor"
import { exportComposition } from "@/lib/export/encoder"
import { saveExportBlob, BLOB_REVOKE_DELAY_MS } from "@/lib/export/save"
import { resolveExportVideoBlob } from "@/lib/export/source-blob"
import { cancelFinalRender, readRenderHealth, type ExportMode, type ExportPhase } from "@/lib/export/final-client"
import { finalExportTask } from "@/lib/export/final-task"
import { loadLastExportJob } from "@/lib/export/last-job"
import { useFinalExportTask } from "@/hooks/use-final-export-task"
import {
  applyCapcutCopy,
  shouldCopyBrowserExportToCapcut,
} from "@/lib/export/capcut-client"
import { loadExportPrefs, saveExportPrefs } from "@/lib/export/capcut-store"
import {
  exportDiskFileName,
  sanitizeCapcutFileName,
  sanitizeExportStem,
} from "@/lib/export/capcut-path"
import {
  draftEncodeProgress,
  formatCapcutOnlySavedMessage,
  formatExportSavedMessage,
  formatExportStatus,
} from "@/lib/export/export-status"
import { formatExportSpec, tryPickExportFormat } from "@/lib/export/mime"
import {
  fetchImportedFile,
  startImportDownload,
  waitForImportJob,
} from "@/lib/import/client"
import { importFileName } from "@/lib/import/filename"
import { parseAllowedImportUrl } from "@/lib/import/allowlist"
import {
  commitReadySource,
  hasPlayableSource,
  isImportTooLarge,
  type SourceImport,
} from "@/lib/commit-source"
import { mapImportError } from "@/lib/import-errors"
import { probeVideoBlob } from "@/lib/probe-video"
import { pushRecentSource, readRecentSources, type RecentSource } from "@/lib/recent-sources"
import {
  authorFromImportUrl,
  canonicalizeImportUrl,
  classifyImportUrl,
  sourceKind,
} from "@/lib/source-url"
import { isEditableTarget } from "@/lib/is-editable-target"
import { checklistItemsFromComposition, collectExportWarnings } from "@/lib/export-checklist"
import { committedInlineText, DEFAULT_INLINE_TEXT } from "@/lib/compose/inline-editor-style"
import { assembleInserts, type GeneratePipelineResult } from "@/lib/ai-generate"
import { pngFileFromBase64 } from "@/lib/ai-client"
import {
  applyCaptionPatch,
  finalizeCaptionInsert,
  linesToCaptionInserts,
  replaceCaptionInserts,
  type CaptionLine,
} from "@/lib/captions"
import {
  applySharedCaptionVisual,
  captionStyleHost,
  captionStylePatchFromTransform,
  stampCaptionVisual,
} from "@/lib/caption-panel"
import {
  applyUserTransformPatch,
  defaultTransformForInsert,
  resetInsertTransform,
  transformPatchFromInsertPatch,
  transformPatchFromStylePath,
} from "@/lib/insert-transform"
import { applyCaptionLook, applyFactoryPreset, applyLookToTextInserts, carryCaptionStyleRef, isNativeCaptionLook, trackStyleForInsert } from "@/lib/style-preset"
import { patchStyleRef, resetStyleField, resetStyleOverrides, workingStyleRef } from "@/lib/style/edit-style"
import { legacyInsertPatchFromStylePath } from "@/lib/style/editor-style"
import { withSyncedComposeStyle } from "@/lib/style/resolve-insert-style"
import { canWritePresetId, resolveCaptionInsertStyle, resolveStyle, setExtraPresets } from "@/lib/style"
import {
  createUserPreset,
  mergePresetCatalog,
  parseUserPresetFile,
  removeCustomPreset,
  serializeUserPresetFile,
  upsertCustomPreset,
} from "@/lib/style/user-presets"
import { createIndexedDbPresetStore } from "@/lib/style/preset-store"
import type { UserPreset } from "@/lib/style/types"
import type { PresetLibraryHandlers } from "@/components/style-customize-panel"
import {
  insertIdOf,
  insertSelection,
  isSourceSelected,
  pruneInsertSelection,
  type PreviewSelection,
} from "@/lib/preview-selection"
import {
  DELETE_CONFIRM_ABOVE,
  duplicateGroupDelta,
  moveTimelineGroup,
  selectableItems,
} from "@/lib/timeline-selection"
import {
  clampSourceTransform,
  DEFAULT_SOURCE_TRANSFORM,
  type SourceTransform,
} from "@/lib/source-transform"
import {
  applySegmentedFraming,
  clearSegmentTransforms,
  removeSourceCut,
  setSegmentTransformAt,
  splitSourceAt,
  type SegmentedFraming,
} from "@/lib/source-segments"
import { clampSourceTrim, type SourceTrim } from "@/lib/source-trim"

function presetCatalogOf(library: UserPreset[], composition: Composition) {
  return mergePresetCatalog(library, composition.customPresets)
}

function resolvedInsertLook(
  composition: Composition,
  insert: Insert,
  catalog: ReturnType<typeof presetCatalogOf>,
) {
  const track = trackStyleForInsert(insert, composition.tracks, composition.source.duration, catalog)
  const project = { styleRef: composition.styleRef }
  if (insertKind(insert) === "caption") {
    return resolveCaptionInsertStyle(
      insert,
      composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
      composition.captionPreset,
      track,
      project,
    )
  }
  return resolveStyle(insert, track, project)
}

function downloadTextFile(fileName: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, BLOB_REVOKE_DELAY_MS)
}

const SEED_INSERTS: Insert[] = [
  {
    id: "insert-seed-1",
    type: "logo-shopee",
    start: 1,
    duration: 4,
    anchor: "top",
    animIn: "pop",
    animOut: "none",
  },
  {
    id: "insert-seed-2",
    type: "alerta-desconto",
    start: 6,
    duration: 3,
    text: "50% OFF",
    anchor: "center",
    animIn: "shake",
    animOut: "none",
  },
]

function seedComposition(): Composition {
  return { ...createDefaultComposition(), inserts: SEED_INSERTS }
}

function historyPresent(composition: Composition): HistorySnapshot {
  return {
    inserts: composition.inserts,
    captionStyle: composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
    tracks: composition.tracks,
    styleRef: composition.styleRef,
    sourceTransform: composition.source.transform,
    ...(composition.source.cuts ? { sourceCuts: composition.source.cuts } : {}),
    ...(composition.source.trim ? { sourceTrim: composition.source.trim } : {}),
    ...(composition.watermarkEnabled === true ? { watermarkEnabled: true } : {}),
  }
}

function captionLookFromStylePath(path: string, value: unknown): Partial<CaptionStyle> | null {
  if (path === "text.fontSize" && typeof value === "number") return { fontSize: value }
  if (path === "text.fontFamily" && typeof value === "string") return { fontFamily: value as CaptionStyle["fontFamily"] }
  if (path === "text.fontWeight" && typeof value === "number") {
    return { fontWeight: value as CaptionStyle["fontWeight"] }
  }
  if (path === "text.color" && typeof value === "string") return { color: value }
  if (path === "text.highlight.color" && typeof value === "string") return { highlightColor: value }
  if (path === "text.background.color" && typeof value === "string") return { bgColor: value }
  if (path === "text.stroke.color" && typeof value === "string") return { strokeColor: value }
  if (path === "text.stroke.width" && typeof value === "number") return { strokeWidth: value }
  return null
}

function captionLookFromPatch(patch: Partial<Insert>): Partial<CaptionStyle> | null {
  const look: Partial<CaptionStyle> = {
    ...captionStylePatchFromTransform(transformPatchFromInsertPatch(patch) ?? {}),
  }
  if (typeof patch.fontSize === "number") look.fontSize = patch.fontSize
  const style = patch.style
  if (style) {
    look.fontFamily = style.fontFamily
    look.fontWeight = style.fontWeight
    look.color = style.color
    if (style.bgColor) look.bgColor = style.bgColor
    look.strokeColor = style.strokeColor
    look.strokeWidth = style.strokeWidth
  }
  return Object.keys(look).length > 0 ? look : null
}

function captionContentFromPatch(patch: Partial<Insert>): Partial<Insert> | null {
  const content: Partial<Insert> = {}
  if (typeof patch.text === "string") content.text = patch.text
  if (typeof patch.start === "number") content.start = patch.start
  if (typeof patch.duration === "number") content.duration = patch.duration
  if (patch.words) content.words = patch.words
  return Object.keys(content).length > 0 ? content : null
}

function applyTimingPatches(
  inserts: Insert[],
  patches: readonly { id: string; start: number; duration: number }[],
  videoDuration: number,
  baseline: HistorySnapshot | null,
): Insert[] {
  const byId = new Map(patches.map((patch) => [patch.id, patch]))
  return inserts.map((insert) => {
    const patch = byId.get(insert.id)
    if (!patch) return insert
    if (insertKind(insert) === "caption") {
      const source =
        baseline?.inserts.find((item) => item.id === insert.id && insertKind(item) === "caption") ??
        insert
      return finalizeCaptionInsert(
        applyCaptionPatch(source, { start: patch.start, duration: patch.duration }),
        videoDuration,
      )
    }
    return mergeInsertPatch(insert, { start: patch.start, duration: patch.duration })
  })
}

function isPlayableUrl(url: string): boolean {
  const value = url.trim()
  return value.startsWith("blob:") || value.startsWith("data:")
}

export function VideoEditor() {
  const [composition, setComposition] = useState<Composition>(seedComposition)
  const [backgroundUrl, setBackgroundUrl] = useState("")
  const [draftUrl, setDraftUrl] = useState("")
  const [importState, setImportState] = useState<SourceImport>({ status: "idle" })
  const [replacingSource, setReplacingSource] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recentSources, setRecentSources] = useState<RecentSource[]>([])
  const [previousSource, setPreviousSource] = useState<CompositionSource | null>(null)
  const [burnedInWarning, setBurnedInWarning] = useState(false)
  const [pasteCandidate, setPasteCandidate] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [missingFile, setMissingFile] = useState(false)
  const [quotaWarning, setQuotaWarning] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const [watermarkPrefs, setWatermarkPrefs] = useState(() => loadWatermarkPrefs())
  const [saveToCapcut, setSaveToCapcut] = useState(() => loadExportPrefs().saveToCapcut)
  const [exportFileName, setExportFileName] = useState("")
  const [finalNamePrompt, setFinalNamePrompt] = useState<string | null>(null)
  const lastSourceNameRef = useRef("")
  const [activeTab, setActiveTab] = useState<EditorTab>("editor")
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const finalExport = useFinalExportTask()
  const [draftExporting, setDraftExporting] = useState(false)
  const [macRenderBusy, setMacRenderBusy] = useState(false)
  const [draftProgress, setDraftProgress] = useState(0)
  const [draftPhase, setDraftPhase] = useState<ExportPhase | null>(null)
  const [draftElapsedSeconds, setDraftElapsedSeconds] = useState(0)
  const [hasLastExportJob, setHasLastExportJob] = useState(false)
  const exporting = draftExporting || finalExport.running
  const exportProgress = finalExport.running ? finalExport.progress : draftProgress
  const exportPhase = finalExport.running ? finalExport.phase : draftPhase
  const exportElapsedSeconds = finalExport.running
    ? finalExport.elapsedSeconds
    : draftElapsedSeconds
  const renderReplies = finalExport.replies
  const [exportMode, setExportMode] = useState<ExportMode>("final")
  const [liveMessage, setLiveMessage] = useState("")
  const [undoToast, setUndoToast] = useState<string | null>(null)
  const dismissUndoToast = useCallback(() => setUndoToast(null), [])
  const [comboPreview, setComboPreview] = useState<Template | null>(null)
  const [comboChoice, setComboChoice] = useState(false)
  const [selection, setSelection] = useState<PreviewSelection>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const selectedInsertId = insertIdOf(selection)
  const [stickerBlobUrls, setStickerBlobUrls] = useState<Record<string, string>>({})
  const [batchPreview, setBatchPreview] = useState<Variation | null>(null)
  const historyRef = useRef(emptyHistory())
  const gestureRef = useRef(emptyGesture())
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const syncHistoryFlags = useCallback(() => {
    const next = { canUndo: canUndo(historyRef.current), canRedo: canRedo(historyRef.current) }
    setHistoryFlags((current) =>
      current.canUndo === next.canUndo && current.canRedo === next.canRedo ? current : next,
    )
  }, [])
  /**
   * Edição inline aberta: o gesture começou ao abrir e só fecha ao confirmar/cancelar.
   * `created` = o insert nasceu nesta edição (o baseline do gesture ainda não o tem).
   */
  const textEditRef = useRef<{ id: string; created: boolean } | null>(null)
  const finishTextEditRef = useRef<(outcome: "commit" | "cancel") => void>(() => {})
  const compositionRef = useRef(composition)
  compositionRef.current = composition
  const objectUrlRef = useRef<string | null>(null)
  const sourceBlobRef = useRef<Blob | null>(null)
  const previewRef = useRef<PreviewHandle>(null)
  const playheadRef = useRef(0)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const abortRef = useRef<AbortController | null>(null)
  const exportStartedRef = useRef(false)
  const importAbortRef = useRef<AbortController | null>(null)
  const fileStoreRef = useRef(createIndexedDbFileStore())
  const presetStoreRef = useRef(createIndexedDbPresetStore())
  const [userPresets, setUserPresets] = useState<UserPreset[]>([])
  const stickerBlobUrlsRef = useRef(stickerBlobUrls)
  stickerBlobUrlsRef.current = stickerBlobUrls

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => revokeObjectUrl, [revokeObjectUrl])
  useEffect(() => () => importAbortRef.current?.abort(), [])
  useEffect(() => {
    const fromSource = composition.source.fileName || fileName
    if (!fromSource || fromSource === lastSourceNameRef.current) return
    lastSourceNameRef.current = fromSource
    setExportFileName(sanitizeExportStem(fromSource))
  }, [composition.source.fileName, fileName])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const health = await readRenderHealth()
        if (!cancelled) setMacRenderBusy(health.busy)
      } catch {
        if (!cancelled) setMacRenderBusy(false)
      }
    }
    void poll()
    const timer = window.setInterval(() => {
      void poll()
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!draftExporting) {
      setDraftElapsedSeconds(0)
      return
    }
    const startedAt = Date.now()
    setDraftElapsedSeconds(0)
    const timer = window.setInterval(() => {
      setDraftElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [draftExporting])

  useEffect(() => {
    if (!finalExport.running || finalExport.phase !== "rendering") return
    if (macRenderBusy) return
    finalExportTask.nudgeMacIdle()
  }, [macRenderBusy, finalExport.running, finalExport.phase])

  useEffect(() => {
    finalExportTask.setSaveHandler(async (payload) => {
      if (payload.capcutSaved) {
        setLiveMessage(
          formatCapcutOnlySavedMessage(payload.capcutFileName || payload.fileName),
        )
        return
      }
      const disk = await saveExportBlob(payload.blob, payload.fileName)
      const capcut = await applyCapcutCopy({
        wanted: saveToCapcut,
        alreadySaved: payload.capcutSaved,
        skipClientUpload: true,
        blob: payload.blob,
        fileName: payload.fileName,
      })
      if (disk === "cancelled") {
        setLiveMessage(formatExportSavedMessage({ disk, capcut }))
        return
      }
      setLiveMessage(
        capcut === "skipped"
          ? "Export final concluído"
          : formatExportSavedMessage({ disk, capcut }),
      )
    })
  }, [saveToCapcut])

  useEffect(() => {
    setHasLastExportJob(Boolean(loadLastExportJob()))
  }, [finalExport.jobId, finalExport.running, finalExport.error])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const stored = loadCompositionJson()
      if (cancelled) return
      if (stored) {
        setComposition(stored)
        setFileName(stored.source.fileName)
        if (stored.source.remoteUrl) {
          setDraftUrl(stored.source.remoteUrl)
        }
        if (stored.source.fileId) {
          try {
            const file = await fileStoreRef.current.load(stored.source.fileId)
            if (cancelled) return
            if (!file) {
              setMissingFile(true)
              setBackgroundUrl("")
              sourceBlobRef.current = null
            } else {
              sourceBlobRef.current = file.blob
              const url = URL.createObjectURL(file.blob)
              objectUrlRef.current = url
              setBackgroundUrl(url)
              setFileName(file.fileName)
            }
          } catch (error) {
            console.error("[editor] falha ao reabrir o vídeo salvo", error)
            setMissingFile(true)
            sourceBlobRef.current = null
          }
        }
        const nextUrls: Record<string, string> = {}
        for (const insert of stored.inserts) {
          if (insertKind(insert) !== "sticker" || !insert.fileId) continue
          try {
            const file = await fileStoreRef.current.load(insert.fileId)
            if (cancelled) return
            if (file) nextUrls[insert.fileId] = URL.createObjectURL(file.blob)
          } catch (error) {
            console.error("[editor] falha ao reabrir insert PNG", error)
          }
        }
        if (!cancelled) setStickerBlobUrls(nextUrls)
      }
      if (!cancelled) setRecentSources(readRecentSources())
      setHydrated(true)
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function hydratePresets() {
      try {
        const listed = await presetStoreRef.current.list()
        if (!cancelled) setUserPresets(listed)
      } catch (error) {
        console.error("[editor] falha ao reabrir presets", error)
      }
    }
    void hydratePresets()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setExtraPresets(Object.values(presetCatalogOf(userPresets, composition)))
  }, [composition.customPresets, userPresets])

  useEffect(() => {
    if (!hydrated) return
    setSaveStatus("saving")
    const timer = window.setTimeout(() => {
      try {
        saveCompositionJson(composition)
        setSaveStatus("saved")
      } catch (error) {
        console.error("[editor] não foi possível salvar o projeto no navegador", error)
        setSaveStatus("error")
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [composition, hydrated])

  // Quase toda mudança de histórico vem com um render (nova composição); fechar um gesto não.
  useEffect(() => {
    syncHistoryFlags()
  })

  useEffect(() => {
    if (importState.status !== "downloading") {
      setElapsedSeconds(0)
      return
    }
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - importState.startedAt) / 1000))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [importState])

  useEffect(() => {
    if (!previousSource) return
    const timer = window.setTimeout(() => setPreviousSource(null), 30_000)
    return () => window.clearTimeout(timer)
  }, [previousSource])

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) return
      const text = event.clipboardData?.getData("text")?.trim() ?? ""
      if (!text) return
      const classified = classifyImportUrl(text)
      if (!classified.ok) return
      event.preventDefault()
      setPasteCandidate(text)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [])

  const rememberPrevious = useCallback((current: CompositionSource) => {
    if (hasPlayableSource(current)) setPreviousSource(current)
  }, [])

  const persistReadyFile = useCallback(
    async (
      file: File,
      extra: Partial<
        Pick<
          CompositionSource,
          "remoteUrl" | "canonicalUrl" | "provider" | "author" | "title" | "watermarked"
        >
      > = {},
    ) => {
      if (isImportTooLarge(file.size)) {
        throw Object.assign(new Error("TOO_LARGE"), { importCode: "TOO_LARGE" as const })
      }
      setQuotaWarning("")
      const probe = await probeVideoBlob(file)
      const fileId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      try {
        await fileStoreRef.current.save(fileId, file, {
          fileName: file.name,
          mimeType: file.type || "video/mp4",
        })
      } catch (error) {
        console.error("[editor] falha ao persistir o vídeo", error)
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          setQuotaWarning(
            "Sem espaço para guardar o vídeo neste navegador. A composição foi salva; o arquivo precisará ser reanexado após F5.",
          )
        } else {
          throw error
        }
      }
      const previousId = compositionRef.current.source.fileId
      const previous = compositionRef.current.source
      const nextSource: CompositionSource = {
        duration: probe.duration,
        fps: compositionRef.current.source.fps || DEFAULT_FPS,
        width: probe.width,
        height: probe.height,
        fileName: file.name,
        fileId,
        ...extra,
      }
      setComposition((prev) => {
        const committed = commitReadySource(prev, nextSource)
        return clampComposition({
          ...committed,
          inserts: committed.inserts.map((insert) =>
            insertKind(insert) === "caption"
              ? finalizeCaptionInsert(insert, probe.duration)
              : clampInsert(insert, probe.duration),
          ),
        })
      })
      rememberPrevious(previous)
      sourceBlobRef.current = file
      const objectUrl = URL.createObjectURL(file)
      const previousUrl = objectUrlRef.current
      objectUrlRef.current = objectUrl
      setFileName(file.name)
      setBackgroundUrl(objectUrl)
      setMissingFile(false)
      setReplacingSource(false)
      if (previousUrl && previousUrl !== objectUrl) URL.revokeObjectURL(previousUrl)
      if (previousId && previousId !== fileId) {
        try {
          await fileStoreRef.current.delete(previousId)
        } catch (error) {
          console.error("[editor] falha ao apagar vídeo anterior", error)
        }
      }
    },
    [rememberPrevious],
  )

  const importFromUrl = useCallback(
    async (raw: string) => {
      const url = raw.trim()
      if (!url) return
      const classified = classifyImportUrl(url)
      if (!classified.ok) {
        setImportState({ status: "error", code: classified.code, rawUrl: url, detail: "" })
        return
      }
      importAbortRef.current?.abort()
      const startedAt = Date.now()
      setDraftUrl(url)
      setImportState({
        status: "downloading",
        rawUrl: url,
        jobId: "",
        jobStatus: "queued",
        startedAt,
      })
      const controller = new AbortController()
      importAbortRef.current = controller
      try {
        const started = await startImportDownload(url)
        setImportState({
          status: "downloading",
          rawUrl: url,
          jobId: started.jobId,
          jobStatus: "running",
          startedAt,
        })
        const job = await waitForImportJob(started.jobId, {
          signal: controller.signal,
          onStatus: (next) => {
            if (next.status === "queued" || next.status === "running") {
              setImportState({
                status: "downloading",
                rawUrl: url,
                jobId: next.id,
                jobStatus: next.status,
                startedAt,
              })
            }
          },
        })
        if (job.status === "error") {
          const mapped = mapImportError(job.error || "falha no download")
          setImportState({
            status: "error",
            code: mapped.code,
            rawUrl: url,
            detail: mapped.detail,
          })
          return
        }
        const canonicalUrl = canonicalizeImportUrl(job.sourceUrl || url)
        setImportState({ status: "probing", rawUrl: url, canonicalUrl })
        const file = await fetchImportedFile(
          job.id,
          importFileName(job.title ?? "", job.platform ?? "video"),
        )
        const author = authorFromImportUrl(canonicalUrl) ?? authorFromImportUrl(url)
        await persistReadyFile(file, {
          remoteUrl: url,
          canonicalUrl,
          provider: job.platform ?? undefined,
          author,
          title: job.title ?? undefined,
        })
        setRecentSources(
          pushRecentSource({
            canonicalUrl,
            provider: job.platform ?? undefined,
            author,
            title: job.title ?? undefined,
          }),
        )
        setBurnedInWarning(true)
        setImportState({ status: "idle" })
        setDraftUrl("")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        const code =
          error && typeof error === "object" && "importCode" in error
            ? (error as { importCode: "TOO_LARGE" }).importCode
            : undefined
        const mapped = mapImportError(
          error instanceof Error ? error.message : "falha no download",
        )
        console.error("[editor] falha ao importar por URL", error)
        setImportState({
          status: "error",
          code: code ?? mapped.code,
          rawUrl: url,
          detail: mapped.detail,
        })
      } finally {
        if (importAbortRef.current === controller) importAbortRef.current = null
      }
    },
    [persistReadyFile],
  )

  const handlePickFile = useCallback(
    (file: File) => {
      setBurnedInWarning(false)
      void persistReadyFile(file, {}).catch((error: unknown) => {
        const code =
          error && typeof error === "object" && "importCode" in error
            ? (error as { importCode: "TOO_LARGE" }).importCode
            : undefined
        const mapped = mapImportError(error instanceof Error ? error.message : "falha no arquivo")
        setImportState({
          status: "error",
          code: code ?? mapped.code,
          rawUrl: draftUrl,
          detail: mapped.detail,
        })
      })
    },
    [draftUrl, persistReadyFile],
  )

  const restorePrevious = useCallback(() => {
    const previous = previousSource
    if (!previous || sourceKind(previous) !== "url") return
    const url = previous.canonicalUrl || previous.remoteUrl
    if (!url) return
    setPreviousSource(null)
    void importFromUrl(url)
  }, [importFromUrl, previousSource])

  const closeOpenGesture = useCallback(() => {
    const closed = endInsertGesture(
      historyRef.current,
      gestureRef.current,
      historyPresent(compositionRef.current),
    )
    historyRef.current = closed.history
    gestureRef.current = closed.gesture
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const beginInsertHistory = useCallback(() => {
    // Um arraste/slider novo fecha a edição inline antes; senão os dois virariam um só desfazer.
    if (textEditRef.current) finishTextEditRef.current("commit")
    gestureRef.current = beginInsertGesture(
      historyPresent(compositionRef.current),
      gestureRef.current,
    )
  }, [])

  const endInsertHistory = useCallback(() => {
    if (textEditRef.current) return
    closeOpenGesture()
  }, [closeOpenGesture])

  const applyHistoryPresent = useCallback((snapshot: HistorySnapshot) => {
    const {
      transform: _ignored,
      trim: _ignoredTrim,
      cuts: _ignoredCuts,
      ...sourceRest
    } = compositionRef.current.source
    const next = clampComposition({
      ...compositionRef.current,
      inserts: snapshot.inserts,
      captionStyle: snapshot.captionStyle,
      tracks: snapshot.tracks,
      styleRef: snapshot.styleRef,
      source: {
        ...sourceRest,
        ...(snapshot.sourceTransform ? { transform: snapshot.sourceTransform } : {}),
        ...(snapshot.sourceCuts ? { cuts: snapshot.sourceCuts } : {}),
        ...(snapshot.sourceTrim ? { trim: snapshot.sourceTrim } : {}),
      },
      watermarkEnabled: snapshot.watermarkEnabled === true ? true : undefined,
    })
    compositionRef.current = next
    setComposition(next)
    setUndoToast(null)
    setSelection((current) => {
      if (current?.kind === "source") return current
      return pruneInsertSelection(
        current,
        new Set(snapshot.inserts.map((item) => item.id)),
      )
    })
  }, [])

  const applyInserts = useCallback(
    (updater: (inserts: Insert[]) => Insert[], mode: "discrete" | "gesture") => {
      const prev = compositionRef.current
      const nextInserts = updater(prev.inserts)
      if (mode === "discrete") {
        const committed = commitDiscrete(
          historyRef.current,
          gestureRef.current,
          historyPresent({ ...prev, inserts: prev.inserts }),
          historyPresent({ ...prev, inserts: nextInserts }),
        )
        historyRef.current = committed.history
        gestureRef.current = committed.gesture
      }
      const next = { ...prev, inserts: nextInserts }
      compositionRef.current = next
      setComposition(clampComposition(next))
      setActiveTemplateId(null)
    },
    [],
  )

  const applyComposition = useCallback(
    (updater: (composition: Composition) => Composition, mode: "discrete" | "gesture") => {
      const prev = compositionRef.current
      const nextRaw = updater(prev)
      if (mode === "discrete") {
        const committed = commitDiscrete(
          historyRef.current,
          gestureRef.current,
          historyPresent(prev),
          historyPresent(nextRaw),
        )
        historyRef.current = committed.history
        gestureRef.current = committed.gesture
      }
      compositionRef.current = nextRaw
      setComposition(clampComposition(nextRaw))
      setActiveTemplateId(null)
    },
    [],
  )

  const handleWatermarkEnabled = useCallback((enabled: boolean) => {
    applyComposition((current) => ({
      ...current,
      watermarkEnabled: enabled ? true : undefined,
    }), "discrete")
  }, [applyComposition])

  const handleWatermarkPrefs = useCallback((prefs: typeof watermarkPrefs) => {
    const next = normalizeWatermarkPrefs(prefs)
    setWatermarkPrefs(next)
    saveWatermarkPrefs(next)
  }, [])

  const applySourceFraming = useCallback(
    (
      reframe: (source: Composition["source"]) => SegmentedFraming,
      mode: "discrete" | "gesture",
    ) => {
      applyComposition(
        (prev) => ({ ...prev, source: applySegmentedFraming(prev.source, reframe(prev.source)) }),
        mode,
      )
    },
    [applyComposition],
  )

  /** `time` escolhe o trecho editado; sem divisões, vale para o vídeo inteiro. */
  const patchSourceTransform = useCallback(
    (transform: SourceTransform, mode: "discrete" | "gesture", time = playheadRef.current) => {
      applySourceFraming((source) => {
        const next = clampSourceTransform(transform, source.width, source.height)
        return setSegmentTransformAt(source, time, next)
      }, mode)
    },
    [applySourceFraming],
  )

  const handlePatchSourceTransform = useCallback(
    (transform: SourceTransform, time?: number) => {
      patchSourceTransform(
        transform,
        gestureRef.current.active ? "gesture" : "discrete",
        time,
      )
    },
    [patchSourceTransform],
  )

  const handleResetSourceTransform = useCallback(
    (time?: number) => {
      patchSourceTransform(DEFAULT_SOURCE_TRANSFORM, "discrete", time)
    },
    [patchSourceTransform],
  )

  const handleResetAllSourceTransforms = useCallback(() => {
    applySourceFraming(clearSegmentTransforms, "discrete")
  }, [applySourceFraming])

  const handleSplitSource = useCallback(
    (time: number) => {
      const source = compositionRef.current.source
      // Sem checar antes, uma divisão recusada viraria um passo vazio no desfazer.
      const cuts = splitSourceAt(source, time, source.duration)
      if (!cuts) return
      applySourceFraming((current) => ({ transform: current.transform, cuts }), "discrete")
    },
    [applySourceFraming],
  )

  const handleRemoveSourceCut = useCallback(
    (index: number) => {
      applySourceFraming(
        (source) => ({ transform: source.transform, cuts: removeSourceCut(source.cuts, index) }),
        "discrete",
      )
    },
    [applySourceFraming],
  )

  const handleChangeTrim = useCallback(
    (trim: SourceTrim | null, mode: "discrete" | "gesture") => {
      applyComposition((prev) => {
        const next = clampSourceTrim(trim, prev.source.duration)
        const { trim: _drop, ...rest } = prev.source
        return { ...prev, source: next ? { ...rest, trim: next } : rest }
      }, mode)
    },
    [applyComposition],
  )

  const handlePlayheadChange = useCallback((time: number) => {
    playheadRef.current = time
  }, [])

  const applyCaptionStyle = useCallback((
    patch: Partial<CaptionStyle>,
    mode: "discrete" | "gesture",
    hostId: string | null = null,
  ) => {
    const prev = compositionRef.current
    const shared = applySharedCaptionVisual(
      prev.inserts,
      prev.captionStyle ?? DEFAULT_CAPTION_STYLE,
      patch,
      hostId,
    )
    if (mode === "discrete") {
      const committed = commitDiscrete(
        historyRef.current,
        gestureRef.current,
        historyPresent(prev),
        historyPresent({ ...prev, captionStyle: shared.captionStyle, inserts: shared.inserts }),
      )
      historyRef.current = committed.history
      gestureRef.current = committed.gesture
    }
    const next = { ...prev, captionStyle: shared.captionStyle, inserts: shared.inserts }
    compositionRef.current = next
    setComposition(clampComposition(next))
  }, [])

  const handlePreviewCaptionStyle = useCallback(
    (patch: Partial<CaptionStyle>) => {
      applyCaptionStyle(
        patch,
        gestureRef.current.active ? "gesture" : "discrete",
        selectedInsertId,
      )
    },
    [applyCaptionStyle, selectedInsertId],
  )

  const patchInserts = useCallback(
    (updater: (inserts: Insert[]) => Insert[]) => {
      applyInserts(
        updater,
        gestureRef.current.active ? "gesture" : "discrete",
      )
    },
    [applyInserts],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      if (event.defaultPrevented) return
      if (gestureRef.current.active) return
      const action = historyShortcut(event)
      if (!action) return
      if (action === "undo" && !canUndo(historyRef.current)) return
      if (action === "redo" && !canRedo(historyRef.current)) return
      event.preventDefault()
      const present = historyPresent(compositionRef.current)
      const result =
        action === "undo"
          ? undo(historyRef.current, present)
          : redo(historyRef.current, present)
      historyRef.current = result.history
      applyHistoryPresent(result.present)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [applyHistoryPresent])

  useEffect(() => {
    if (activeTab !== "batch") setBatchPreview(null)
  }, [activeTab])

  const addTextInsert = useCallback(() => {
    finishTextEditRef.current("commit")
    const created = createInsert("texto-livre")
    created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
    applyInserts((inserts) => [...inserts, created], "discrete")
    setSelection({ kind: "insert", id: created.id })
  }, [applyInserts])

  const duplicateSelectedInsert = useCallback((id: string) => {
    finishTextEditRef.current("commit")
    const current = compositionRef.current.inserts.find((insert) => insert.id === id)
    if (!current || insertKind(current) === "caption") return
    const copy = duplicateInsert(current)
    applyInserts((inserts) => [...inserts, copy], "discrete")
    setSelection({ kind: "insert", id: copy.id })
  }, [applyInserts])

  const canAddSticker = useCallback(
    (inserts: Insert[]) => inserts.filter((insert) => insertKind(insert) === "sticker").length < MAX_STICKERS,
    [],
  )

  const addLibrarySticker = useCallback(
    (item: { id: string; name: string }) => {
      const prev = compositionRef.current.inserts
      if (!canAddSticker(prev)) {
        setLiveMessage("Limite de 20 inserts PNG.")
        return
      }
      const created = createStickerInsert({
        sourceKind: "library",
        label: item.name,
        libraryId: item.id,
      })
      created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
      applyInserts((inserts) => [...inserts, created], "discrete")
      setSelection({ kind: "insert", id: created.id })
    },
    [applyInserts, canAddSticker],
  )

  const persistStickerFile = useCallback(
    async (file: File, sourceKind: "upload" | "paste") => {
      if (!isPlayableUrl(backgroundUrl) && sourceKind === "paste") {
        setLiveMessage("Carregue um vídeo primeiro.")
        return
      }
      if (!canAddSticker(compositionRef.current.inserts)) {
        setLiveMessage("Limite de 20 inserts PNG.")
        return
      }
      const fileId = crypto.randomUUID()
      try {
        await fileStoreRef.current.save(fileId, file, {
          fileName: file.name || "sticker.png",
          mimeType: file.type || "image/png",
        })
      } catch (error) {
        console.error("[editor] falha ao gravar insert PNG", error)
        setLiveMessage("Não foi possível salvar a imagem.")
        return
      }
      const url = URL.createObjectURL(file)
      setStickerBlobUrls((prev) => ({ ...prev, [fileId]: url }))
      const created = createStickerInsert({
        sourceKind,
        label: file.name || "colar",
        fileId,
      })
      created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
      applyInserts((inserts) => [...inserts, created], "discrete")
      setSelection({ kind: "insert", id: created.id })
      setActiveTab("editor")
    },
    [applyInserts, backgroundUrl, canAddSticker],
  )

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items
      if (!items) return
      const imageItem = [...items].find((item) => item.type.startsWith("image/"))
      const file = imageItem?.getAsFile()
      if (!file) return
      event.preventDefault()
      void persistStickerFile(file, "paste")
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [persistStickerFile])

  const addElement = useCallback(
    (type: InsertType) => {
      const created = createInsert(type)
      created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
      applyInserts((inserts) => [...inserts, created], "discrete")
      setSelection({ kind: "insert", id: created.id })
      setActiveTab("editor")
    },
    [applyInserts],
  )

  const changeInsert = useCallback(
    (id: string, patch: Partial<Insert>) => {
      const current = compositionRef.current.inserts.find((insert) => insert.id === id)
      const transformPatch = transformPatchFromInsertPatch(patch)
      if (current && insertKind(current) === "caption") {
        const look = captionLookFromPatch(patch)
        const content = captionContentFromPatch(patch)
        const mode = gestureRef.current.active ? "gesture" : "discrete"
        if (look) applyCaptionStyle(look, mode, id)
        if (!content) return
        patchInserts((prev) =>
          prev.map((insert) => {
            if (insert.id !== id) return insert
            const gesture = gestureRef.current
            const baselineInsert =
              gesture.active && gesture.baseline
                ? gesture.baseline.inserts.find((item) => item.id === id)
                : undefined
            const source =
              baselineInsert && insertKind(baselineInsert) === "caption" ? baselineInsert : insert
            return finalizeCaptionInsert(
              applyCaptionPatch(source, content),
              compositionRef.current.source.duration,
            )
          }),
        )
        return
      }
      patchInserts((prev) =>
        prev.map((insert) => {
          if (insert.id !== id) return insert
          const withTransform = transformPatch
            ? applyUserTransformPatch(
                insert,
                transformPatch,
                defaultTransformForInsert(insert),
              )
            : insert
          return mergeInsertPatch(withTransform, patch)
        }),
      )
    },
    [applyCaptionStyle, patchInserts],
  )

  const removeInsert = useCallback(
    (id: string) => {
      if (textEditRef.current?.id === id) textEditRef.current = null
      applyInserts((prev) => prev.filter((insert) => insert.id !== id), "discrete")
      setSelection((current) =>
        pruneInsertSelection(
          current,
          new Set(compositionRef.current.inserts.map((insert) => insert.id)),
        ),
      )
      setEditingTextId((current) => (current === id ? null : current))
      setUndoToast("Insert apagado")
    },
    [applyInserts],
  )

  const patchTimings = useCallback(
    (patches: { id: string; start: number; duration: number }[]) => {
      const duration = compositionRef.current.source.duration
      const baseline = gestureRef.current.active ? gestureRef.current.baseline : null
      applyInserts(
        (inserts) => applyTimingPatches(inserts, patches, duration, baseline),
        gestureRef.current.active ? "gesture" : "discrete",
      )
    },
    [applyInserts],
  )

  const removeSelection = useCallback(
    (ids: string[]) => {
      const unique = [...new Set(ids)]
      if (unique.length === 0) return
      if (unique.length > DELETE_CONFIRM_ABOVE && !window.confirm(`Apagar ${unique.length} itens?`)) {
        return
      }
      if (textEditRef.current && unique.includes(textEditRef.current.id)) {
        textEditRef.current = null
        setEditingTextId(null)
      }
      applyInserts((prev) => prev.filter((insert) => !unique.includes(insert.id)), "discrete")
      setSelection((current) =>
        pruneInsertSelection(
          current,
          new Set(compositionRef.current.inserts.map((insert) => insert.id)),
        ),
      )
      setEditingTextId((current) => (current && unique.includes(current) ? null : current))
      setUndoToast(unique.length === 1 ? "Insert apagado" : `${unique.length} itens apagados`)
    },
    [applyInserts],
  )

  const duplicateSelection = useCallback(
    (ids: string[]) => {
      finishTextEditRef.current("commit")
      const prev = compositionRef.current
      const delta = duplicateGroupDelta(selectableItems(prev.inserts), ids, prev.source.duration)
      if (delta == null) return
      const selected = prev.inserts.filter((insert) => ids.includes(insert.id))
      const stickerCount = prev.inserts.filter((insert) => insertKind(insert) === "sticker").length
      const addedStickers = selected.filter((insert) => insertKind(insert) === "sticker").length
      if (stickerCount + addedStickers > MAX_STICKERS) {
        setLiveMessage("Limite de 20 inserts PNG.")
        return
      }
      const primaryId = insertIdOf(selectionRef.current)
      const copies = selected.map((insert) => {
        const id = crypto.randomUUID()
        const start = insert.start + delta
        if (insertKind(insert) === "caption") {
          return finalizeCaptionInsert(
            applyCaptionPatch(insert, { id, start }),
            prev.source.duration,
          )
        }
        return mergeInsertPatch({ ...insert, id }, { start })
      })
      applyInserts((inserts) => [...inserts, ...copies], "discrete")
      const primaryCopy =
        copies[selected.findIndex((insert) => insert.id === primaryId)] ?? copies[0]
      if (primaryCopy) setSelection(insertSelection(primaryCopy.id, copies.map((copy) => copy.id)))
    },
    [applyInserts],
  )

  const nudgeSelection = useCallback(
    (ids: string[], frames: number) => {
      const prev = compositionRef.current
      const moved = moveTimelineGroup({
        items: selectableItems(prev.inserts),
        selectedIds: ids,
        delta: frames / 30,
        videoDuration: prev.source.duration,
        snapTolerance: 0,
        snapTargets: [],
      })
      if (!(Math.abs(moved.delta) > 1e-6)) return
      applyInserts(
        (inserts) => applyTimingPatches(inserts, moved.starts, prev.source.duration, null),
        "discrete",
      )
    },
    [applyInserts],
  )

  const alignSelection = useCallback(
    (primaryId: string, ids: string[]) => {
      const prev = compositionRef.current
      const items = selectableItems(prev.inserts)
      const primary = items.find((item) => item.id === primaryId)
      if (!primary) return
      const moved = moveTimelineGroup({
        items,
        selectedIds: ids,
        delta: playheadRef.current - primary.start,
        videoDuration: prev.source.duration,
        snapTolerance: 0,
        snapTargets: [],
      })
      if (!(Math.abs(moved.delta) > 1e-6)) return
      applyInserts(
        (inserts) => applyTimingPatches(inserts, moved.starts, prev.source.duration, null),
        "discrete",
      )
    },
    [applyInserts],
  )

  const finishTextEdit = useCallback(
    (outcome: "commit" | "cancel") => {
      const session = textEditRef.current
      setEditingTextId(null)
      if (!session) return
      textEditRef.current = null
      const baseline = gestureRef.current.baseline
      const current = compositionRef.current.inserts.find((item) => item.id === session.id)
      const original = baseline?.inserts.find((item) => item.id === session.id)
      const originalText = session.created ? DEFAULT_INLINE_TEXT : (original?.text ?? "")
      const finalText = outcome === "cancel" ? originalText : (current?.text ?? "")
      const empty = committedInlineText(finalText) === null
      if (outcome === "commit" && !empty) {
        closeOpenGesture()
        return
      }
      if (session.created) {
        if (empty) {
          // Criado e apagado na mesma edição: volta ao baseline, que nem tinha o insert.
          if (baseline) applyHistoryPresent(baseline)
          gestureRef.current = emptyGesture()
          setSelection((selected) => (insertIdOf(selected) === session.id ? null : selected))
          return
        }
        // Esc num texto recém-criado mantém o insert com o texto padrão (um passo de desfazer).
        applyInserts(
          (inserts) =>
            inserts.map((insert) => (insert.id === session.id ? { ...insert, text: DEFAULT_INLINE_TEXT } : insert)),
          "gesture",
        )
        closeOpenGesture()
        setSelection({ kind: "insert", id: session.id })
        return
      }
      // Cancelar (ou apagar tudo) volta ao estado de antes da edição sem deixar entrada no desfazer.
      if (baseline) applyHistoryPresent(baseline)
      gestureRef.current = emptyGesture()
      if (empty && current) removeInsert(session.id)
      else setSelection({ kind: "insert", id: session.id })
    },
    [applyHistoryPresent, applyInserts, closeOpenGesture, removeInsert],
  )
  finishTextEditRef.current = finishTextEdit

  const startTextEdit = useCallback(
    (id: string) => {
      if (textEditRef.current?.id === id) return
      if (textEditRef.current) finishTextEdit("commit")
      const insert = compositionRef.current.inserts.find((item) => item.id === id)
      if (!insert) return
      const kind = insertKind(insert)
      if (kind !== "text" && kind !== "caption") return
      closeOpenGesture()
      gestureRef.current = beginInsertGesture(historyPresent(compositionRef.current))
      textEditRef.current = { id, created: false }
      setSelection({ kind: "insert", id })
      setEditingTextId(id)
    },
    [closeOpenGesture, finishTextEdit],
  )

  const handleEditingTextId = useCallback(
    (id: string | null) => {
      if (id) startTextEdit(id)
      else finishTextEdit("commit")
    },
    [finishTextEdit, startTextEdit],
  )

  const cancelTextEdit = useCallback(() => finishTextEdit("cancel"), [finishTextEdit])

  const addTextInsertAt = useCallback(
    (x: number, y: number) => {
      finishTextEdit("commit")
      const created = createInsert("texto-livre")
      created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
      created.x = x
      created.y = y
      created.text = DEFAULT_INLINE_TEXT
      // O gesture abre antes de criar: confirmar vira um só desfazer (criar + digitar).
      closeOpenGesture()
      gestureRef.current = beginInsertGesture(historyPresent(compositionRef.current))
      applyInserts((inserts) => [...inserts, created], "gesture")
      textEditRef.current = { id: created.id, created: true }
      setSelection({ kind: "insert", id: created.id })
      setEditingTextId(created.id)
    },
    [applyInserts, closeOpenGesture, finishTextEdit],
  )

  const startNewProject = useCallback(() => {
    const prev = compositionRef.current
    const extra = previousSource?.fileId ? [previousSource.fileId] : []
    const ids = projectFileIds(prev, extra)
    importAbortRef.current?.abort()
    importAbortRef.current = null
    for (const url of Object.values(stickerBlobUrlsRef.current)) {
      URL.revokeObjectURL(url)
    }
    setStickerBlobUrls({})
    revokeObjectUrl()
    sourceBlobRef.current = null
    const next = newProjectComposition()
    compositionRef.current = next
    setComposition(next)
    saveCompositionJson(next)
    historyRef.current = emptyHistory()
    gestureRef.current = emptyGesture()
    textEditRef.current = null
    setEditingTextId(null)
    setSelection(null)
    setBackgroundUrl("")
    setDraftUrl("")
    setFileName("")
    setMissingFile(false)
    setQuotaWarning("")
    setImportState({ status: "idle" })
    setReplacingSource(false)
    setPreviousSource(null)
    setBurnedInWarning(false)
    setPasteCandidate(null)
    setActiveTemplateId(null)
    setUndoToast(null)
    setLiveMessage("Projeto novo")
    playheadRef.current = 0
    previewRef.current?.seekTo(0)
    void Promise.all(ids.map((id) => fileStoreRef.current.delete(id))).catch((error: unknown) => {
      console.error("[editor] falha ao apagar arquivos do projeto", error)
    })
  }, [previousSource, revokeObjectUrl])

  const clearInserts = useCallback(() => {
    finishTextEditRef.current("commit")
    const prev = compositionRef.current
    applyComposition(() => clearInsertsArt(prev), "discrete")
    setSelection(null)
    setUndoToast("Inserts apagados")
  }, [applyComposition])

  const clearCaptions = useCallback(() => {
    finishTextEditRef.current("commit")
    const prev = compositionRef.current
    applyComposition(() => clearCaptionInsertsArt(prev), "discrete")
    setSelection((current) => {
      const id = insertIdOf(current)
      if (!id) return current
      const selected = prev.inserts.find((item) => item.id === id)
      return selected && insertKind(selected) === "caption" ? null : current
    })
    setEditingTextId((current) => {
      if (!current) return current
      const editing = prev.inserts.find((item) => item.id === current)
      return editing && insertKind(editing) === "caption" ? null : current
    })
    setUndoToast("Legendas apagadas")
  }, [applyComposition])

  const undoLast = useCallback(() => {
    if (textEditRef.current) finishTextEditRef.current("commit")
    if (!canUndo(historyRef.current)) return
    const present = historyPresent(compositionRef.current)
    const result = undo(historyRef.current, present)
    historyRef.current = result.history
    applyHistoryPresent(result.present)
  }, [applyHistoryPresent])

  const redoLast = useCallback(() => {
    if (textEditRef.current) finishTextEditRef.current("commit")
    if (!canRedo(historyRef.current)) return
    const present = historyPresent(compositionRef.current)
    const result = redo(historyRef.current, present)
    historyRef.current = result.history
    applyHistoryPresent(result.present)
  }, [applyHistoryPresent])

  const seekPlayheadToInsert = useCallback((id: string) => {
    const insert = compositionRef.current.inserts.find((item) => item.id === id)
    if (!insert) return
    const next = seekTimeForInsert(playheadRef.current, insert)
    if (next != null) previewRef.current?.seekTo(next)
  }, [])

  const [panelSelectionTick, setPanelSelectionTick] = useState(0)

  const toggleInsert = useCallback((id: string) => {
    // O seek atualiza o estado do PreviewPanel; dentro do updater de setSelection seria setState durante render.
    if (insertIdOf(selection) === id) {
      setSelection(null)
      return
    }
    setSelection({ kind: "insert", id })
    setPanelSelectionTick((tick) => tick + 1)
    seekPlayheadToInsert(id)
  }, [seekPlayheadToInsert, selection])

  const revealCaption = useCallback((id: string) => {
    const insert = compositionRef.current.inserts.find((item) => item.id === id)
    if (!insert) return
    setSelection({ kind: "insert", id })
    setPanelSelectionTick((tick) => tick + 1)
    previewRef.current?.seekTo(insert.start)
  }, [])

  const selectInsert = useCallback(
    (id: string | null) => {
      if (id) {
        setSelection({ kind: "insert", id })
        setPanelSelectionTick((tick) => tick + 1)
        seekPlayheadToInsert(id)
        if (activeTab !== "editor") setActiveTab("editor")
        return
      }
      setSelection(null)
    },
    [activeTab, seekPlayheadToInsert],
  )

  const handlePreviewSelect = useCallback(
    (next: PreviewSelection) => {
      if (next?.kind === "insert") {
        if (textEditRef.current && textEditRef.current.id !== next.id) {
          finishTextEditRef.current("commit")
        }
        setSelection(insertSelection(next.id, next.ids ?? [next.id]))
        setPanelSelectionTick((tick) => tick + 1)
        if (activeTab !== "editor") setActiveTab("editor")
        if (!next.ids) seekPlayheadToInsert(next.id)
        return
      }
      finishTextEditRef.current("commit")
      setSelection(next)
    },
    [activeTab, seekPlayheadToInsert],
  )

  const mergeDuplicates = useCallback(
    (ids: string[]) => {
      patchInserts((prev) => mergeDuplicateGroup(prev, ids))
      setSelection((current) => {
        const currentId = insertIdOf(current)
        if (currentId && ids.includes(currentId) && ids[0] !== currentId) {
          return ids[0] ? { kind: "insert", id: ids[0] } : null
        }
        return current
      })
    },
    [patchInserts],
  )

  const applyTemplate = useCallback((template: Template, mode: "add" | "replace" = "replace") => {
    const duration = compositionRef.current.source.duration
    applyInserts(
      (prev) =>
        mode === "add"
          ? appendTemplateToInserts(prev, template, duration)
          : applyTemplateToInserts(prev, template, duration),
      "discrete",
    )
    setActiveTemplateId(template.id)
    setComboPreview(null)
    setComboChoice(false)
    setActiveTab("editor")
  }, [applyInserts])

  const previewCombo = useCallback((template: Template) => {
    setComboChoice(false)
    setComboPreview(template)
  }, [])

  const cancelComboPreview = useCallback(() => {
    setComboPreview(null)
    setComboChoice(false)
  }, [])

  const requestApplyCombo = useCallback(() => {
    if (!comboPreview) return
    if (projectHasArtInserts(compositionRef.current.inserts)) {
      setComboChoice(true)
      return
    }
    applyTemplate(comboPreview, "replace")
  }, [applyTemplate, comboPreview])

  useEffect(() => {
    if (!comboPreview) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || isEditableTarget(event.target)) return
      event.preventDefault()
      setComboPreview(null)
      setComboChoice(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [comboPreview])

  const loadAiMedia = useCallback(async (): Promise<File | null> => {
    const fileId = compositionRef.current.source.fileId
    if (!fileId) return null
    try {
      const record = await fileStoreRef.current.load(fileId)
      if (!record) return null
      return new File([record.blob], record.fileName || "video.mp4", {
        type: record.mimeType || "video/mp4",
      })
    } catch (error) {
      console.error("[editor] falha ao ler o vídeo para a IA", error)
      return null
    }
  }, [])

  const applyAIGenerate = useCallback(
    async (payload: GeneratePipelineResult) => {
      let sticker: { fileId: string; label: string } | undefined
      if (payload.pngBase64) {
        const file = pngFileFromBase64(payload.pngBase64)
        const fileId = crypto.randomUUID()
        try {
          await fileStoreRef.current.save(fileId, file, {
            fileName: file.name,
            mimeType: "image/png",
          })
          const url = URL.createObjectURL(file)
          setStickerBlobUrls((prev) => ({ ...prev, [fileId]: url }))
          sticker = { fileId, label: "IA" }
        } catch (error) {
          console.error("[editor] falha ao gravar PNG da IA", error)
          setLiveMessage("Inserts prontos. Não foi possível salvar o PNG.")
        }
      }
      const assembled = assembleInserts({
        inserts: payload.inserts,
        stickerHint: payload.stickerHint,
        duration: compositionRef.current.source.duration,
        sticker,
      })
      const captions = compositionRef.current.inserts.filter((i) => insertKind(i) === "caption")
      applyInserts(() => [...assembled, ...captions], "discrete")
      setActiveTab("editor")
    },
    [applyInserts],
  )

  const applyCaptions = useCallback(
    (lines: CaptionLine[]) => {
      const incoming = linesToCaptionInserts(lines, compositionRef.current.source.duration)
      applyInserts(
        (prev) => replaceCaptionInserts(prev, carryCaptionStyleRef(prev, incoming)),
        "discrete",
      )
      const first = incoming[0]
      if (first) setSelection({ kind: "insert", id: first.id })
      setActiveTab("editor")
    },
    [applyInserts],
  )

  const applyCaptionLookId = useCallback(
    (lookId: string) => {
      applyComposition((prev) => {
        const catalog = presetCatalogOf(userPresets, prev)
        const inserts = applyCaptionLook(prev.inserts, lookId, {
          videoDuration: prev.source.duration,
          catalog,
        })
        const host = captionStyleHost(inserts, selectedInsertId)
        const synced = host ? stampCaptionVisual(inserts, host) : inserts
        const named = catalog[lookId]
        const withPreset =
          named && canWritePresetId(lookId)
            ? { ...prev, inserts: synced, customPresets: upsertCustomPreset(prev.customPresets, named) }
            : { ...prev, inserts: synced }
        if (isNativeCaptionLook(lookId)) {
          return { ...withPreset, captionPreset: lookId }
        }
        return withPreset
      }, "discrete")
    },
    [applyComposition, selectedInsertId, userPresets],
  )

  const applyStylePreset = useCallback(
    (presetId: string, mode: "preserve" | "clean" = "preserve") => {
      applyComposition((prev) => {
        const catalog = presetCatalogOf(userPresets, prev)
        const named = catalog[presetId]
        const inserts = applyFactoryPreset(prev.inserts, presetId, {
          selectedId: selectedInsertId,
          videoDuration: prev.source.duration,
          mode,
          catalog,
        })
        const selected = inserts.find((item) => item.id === selectedInsertId)
        const synced =
          selected && insertKind(selected) === "caption"
            ? stampCaptionVisual(inserts, selected)
            : inserts
        if (named && canWritePresetId(presetId)) {
          return {
            ...prev,
            inserts: synced,
            customPresets: upsertCustomPreset(prev.customPresets, named),
          }
        }
        return { ...prev, inserts: synced }
      }, "discrete")
    },
    [applyComposition, selectedInsertId, userPresets],
  )

  const patchInsertStyle = useCallback(
    (id: string, path: string, value: unknown) => {
      applyComposition((prev) => {
        const insert = prev.inserts.find((item) => item.id === id)
        if (!insert) return prev
        const transformPatch = transformPatchFromStylePath(path, value)
        if (transformPatch) {
          if (insertKind(insert) === "caption") {
            const look = captionStylePatchFromTransform(transformPatch)
            const shared = applySharedCaptionVisual(
              prev.inserts,
              prev.captionStyle ?? DEFAULT_CAPTION_STYLE,
              look,
              id,
            )
            return { ...prev, inserts: shared.inserts, captionStyle: shared.captionStyle }
          }
          return {
            ...prev,
            inserts: prev.inserts.map((item) =>
              item.id === id
                ? applyUserTransformPatch(item, transformPatch, defaultTransformForInsert(item))
                : item,
            ),
          }
        }
        const catalog = presetCatalogOf(userPresets, prev)
        const track = trackStyleForInsert(insert, prev.tracks, prev.source.duration, catalog)
        const project = { styleRef: prev.styleRef }
        const nextRef = patchStyleRef(workingStyleRef(insert, track, project), path, value)
        const caption = insertKind(insert) === "caption"
        const host = { ...insert, styleRef: nextRef }
        const inserts = caption
          ? stampCaptionVisual(prev.inserts, host)
          : prev.inserts.map((item) => {
              if (item.id !== id) return item
              const extra: Partial<Insert> = {
                styleRef: nextRef,
                ...legacyInsertPatchFromStylePath(path, value),
              }
              return withSyncedComposeStyle(
                { ...item, ...extra },
                { project, track },
              )
            })
        const look = caption ? captionLookFromStylePath(path, value) : null
        return {
          ...prev,
          inserts,
          captionStyle: look
            ? mergeCaptionStylePatch(prev.captionStyle ?? DEFAULT_CAPTION_STYLE, look)
            : prev.captionStyle,
        }
      }, gestureRef.current.active ? "gesture" : "discrete")
    },
    [applyComposition, userPresets],
  )

  const resetInsertStyleField = useCallback(
    (id: string, path: string) => {
      applyComposition((prev) => {
        const insert = prev.inserts.find((item) => item.id === id)
        if (!insert?.styleRef) return prev
        const nextRef = resetStyleField(insert.styleRef, path)
        const caption = insertKind(insert) === "caption"
        const host = { ...insert, styleRef: nextRef }
        return {
          ...prev,
          inserts: caption
            ? stampCaptionVisual(prev.inserts, host)
            : prev.inserts.map((item) =>
                item.id === id
                  ? withSyncedComposeStyle(
                      { ...item, styleRef: nextRef },
                      { project: { styleRef: prev.styleRef } },
                    )
                  : item,
              ),
        }
      }, "discrete")
    },
    [applyComposition],
  )

  const resetInsertStyleOverrides = useCallback(
    (id: string) => {
      applyComposition((prev) => {
        const insert = prev.inserts.find((item) => item.id === id)
        if (!insert?.styleRef) return prev
        const nextRef = resetStyleOverrides(insert.styleRef)
        const caption = insertKind(insert) === "caption"
        const host = { ...insert, styleRef: nextRef }
        return {
          ...prev,
          inserts: caption
            ? stampCaptionVisual(prev.inserts, host)
            : prev.inserts.map((item) =>
                item.id === id
                  ? withSyncedComposeStyle(
                      { ...item, styleRef: nextRef },
                      { project: { styleRef: prev.styleRef } },
                    )
                  : item,
              ),
        }
      }, "discrete")
    },
    [applyComposition],
  )

  const resetInsertPosition = useCallback(
    (id: string) => {
      applyComposition((prev) => {
        const insert = prev.inserts.find((item) => item.id === id)
        if (!insert) return prev
        if (insertKind(insert) === "caption") {
          return {
            ...prev,
            inserts: prev.inserts.map((item) =>
              insertKind(item) === "caption" ? resetInsertTransform(item) : item,
            ),
            captionStyle: mergeCaptionStylePatch(prev.captionStyle ?? DEFAULT_CAPTION_STYLE, {
              x: DEFAULT_CAPTION_STYLE.x,
              y: DEFAULT_CAPTION_STYLE.y,
              rotation: DEFAULT_CAPTION_STYLE.rotation,
              maxWidthPct: DEFAULT_CAPTION_STYLE.maxWidthPct,
            }),
          }
        }
        return {
          ...prev,
          inserts: prev.inserts.map((item) => (item.id === id ? resetInsertTransform(item) : item)),
        }
      }, "discrete")
    },
    [applyComposition],
  )

  const applyInsertStyleToTrack = useCallback(
    (id: string) => {
      applyComposition((prev) => {
        const insert = prev.inserts.find((item) => item.id === id)
        if (!insert) return prev
        const catalog = presetCatalogOf(userPresets, prev)
        const track = trackStyleForInsert(insert, prev.tracks, prev.source.duration, catalog)
        const look = insert.styleRef ?? workingStyleRef(insert, track, { styleRef: prev.styleRef })
        const result = applyLookToTextInserts(prev.inserts, prev.tracks, look)
        return { ...prev, inserts: result.inserts, tracks: result.tracks }
      }, "discrete")
    },
    [applyComposition, userPresets],
  )

  const refreshUserPresets = useCallback(async () => {
    try {
      setUserPresets(await presetStoreRef.current.list())
    } catch (error) {
      console.error("[editor] falha ao listar presets", error)
    }
  }, [])

  const saveAsUserPreset = useCallback(
    (label: string) => {
      const prev = compositionRef.current
      const insert = prev.inserts.find((item) => item.id === selectedInsertId)
      if (!insert) return
      const catalog = presetCatalogOf(userPresets, prev)
      const preset = createUserPreset({
        label,
        group: insertKind(insert) === "caption" ? "legenda" : zoneForInsert(insert, prev.source.duration),
        style: resolvedInsertLook(prev, insert, catalog),
      })
      void presetStoreRef.current.save(preset).then(refreshUserPresets).catch((error: unknown) => {
        console.error("[editor] falha ao salvar preset", error)
      })
      applyComposition((current) => ({
        ...current,
        customPresets: upsertCustomPreset(current.customPresets, preset),
        inserts: applyFactoryPreset(current.inserts, preset.id, {
          selectedId: insert.id,
          videoDuration: current.source.duration,
          mode: "clean",
          catalog: { [preset.id]: preset },
        }),
      }), "discrete")
    },
    [applyComposition, refreshUserPresets, selectedInsertId, userPresets],
  )

  const renameUserPreset = useCallback(
    (id: string, label: string) => {
      const current =
        userPresets.find((preset) => preset.id === id) ??
        compositionRef.current.customPresets?.[id]
      if (!current) return
      const next = createUserPreset({ ...current, label })
      void presetStoreRef.current.save(next).then(refreshUserPresets).catch((error: unknown) => {
        console.error("[editor] falha ao renomear preset", error)
      })
      applyComposition((prev) => ({
        ...prev,
        customPresets: prev.customPresets?.[id]
          ? upsertCustomPreset(prev.customPresets, next)
          : prev.customPresets,
      }), "discrete")
    },
    [applyComposition, refreshUserPresets, userPresets],
  )

  const deleteUserPreset = useCallback(
    (id: string) => {
      void presetStoreRef.current.delete(id).then(refreshUserPresets).catch((error: unknown) => {
        console.error("[editor] falha ao excluir preset", error)
      })
      applyComposition((prev) => ({
        ...prev,
        customPresets: removeCustomPreset(prev.customPresets, id),
      }), "discrete")
    },
    [applyComposition, refreshUserPresets],
  )

  const updateUserPreset = useCallback(
    (id: string) => {
      const prev = compositionRef.current
      const insert = prev.inserts.find((item) => item.id === selectedInsertId)
      const current = userPresets.find((preset) => preset.id === id) ?? prev.customPresets?.[id]
      if (!insert || !current) return
      const catalog = presetCatalogOf(userPresets, prev)
      const next = createUserPreset({
        ...current,
        style: resolvedInsertLook(prev, insert, catalog),
      })
      void presetStoreRef.current.save(next).then(refreshUserPresets).catch((error: unknown) => {
        console.error("[editor] falha ao atualizar preset", error)
      })
      applyComposition((currentComp) => ({
        ...currentComp,
        customPresets: upsertCustomPreset(currentComp.customPresets, next),
      }), "discrete")
    },
    [applyComposition, refreshUserPresets, selectedInsertId, userPresets],
  )

  const exportUserPresets = useCallback(() => {
    downloadTextFile(
      "meus-presets.json",
      serializeUserPresetFile(Object.values(presetCatalogOf(userPresets, compositionRef.current))),
      "application/json",
    )
  }, [userPresets])

  const importUserPresets = useCallback(
    (file: File) => {
      void (async () => {
        try {
          const parsed = parseUserPresetFile(await file.text())
          for (const preset of parsed) {
            await presetStoreRef.current.save(preset)
          }
          await refreshUserPresets()
          setLiveMessage(
            parsed.length === 1
              ? "1 preset importado"
              : `${parsed.length} presets importados`,
          )
        } catch (error) {
          console.error("[editor] falha ao importar presets", error)
          setLiveMessage("JSON de presets inválido")
        }
      })()
    },
    [refreshUserPresets],
  )

  const presetLibrary = useMemo<PresetLibraryHandlers>(
    () => ({
      presets: Object.values(presetCatalogOf(userPresets, composition)),
      saveAs: saveAsUserPreset,
      rename: renameUserPreset,
      remove: deleteUserPreset,
      update: updateUserPreset,
      exportAll: exportUserPresets,
      importFile: importUserPresets,
    }),
    [
      composition,
      deleteUserPreset,
      exportUserPresets,
      importUserPresets,
      renameUserPreset,
      saveAsUserPreset,
      updateUserPreset,
      userPresets,
    ],
  )

  const handleMediaInfo = useCallback(
    (info: { duration: number; width: number; height: number; fps: number }) => {
      if (!(info.duration > 0)) return
      setComposition((prev) => {
        if (!prev.source.fileId) return prev
        const source = {
          ...prev.source,
          duration: info.duration,
          width: info.width || prev.source.width,
          height: info.height || prev.source.height,
        }
        const quality = qualityFromOutput(prev.output, prev.source)
        const output =
          quality === "source" ? outputFromQuality("source", source) : prev.output
        return clampComposition({
          ...prev,
          source,
          output,
          inserts: prev.inserts.map((insert) =>
            insertKind(insert) === "caption"
              ? finalizeCaptionInsert(insert, info.duration)
              : clampInsert(insert, info.duration),
          ),
        })
      })
    },
    [],
  )

  const playable = isPlayableUrl(backgroundUrl)
  const canExport = playable && composition.source.duration > 0
  const exportDisabledReason = !hasPlayableSource(composition.source)
    ? "Carregue um vídeo para exportar."
    : !playable
      ? "Carregue um vídeo para exportar."
      : composition.source.duration <= 0
        ? "Aguarde o vídeo carregar"
        : null

  const handleInterruptMacRender = useCallback(async () => {
    setLiveMessage("Interrompendo o render no Mac…")
    try {
      const stopped = await cancelFinalRender()
      setMacRenderBusy(false)
      setLiveMessage(stopped ? "Render no Mac interrompido." : "Nenhum render no Mac agora.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao interromper"
      setLiveMessage(message)
    }
  }, [])

  const startFinalExport = useCallback(
    async (stemName: string) => {
      try {
        const stored = composition.source.fileId
          ? await fileStoreRef.current.load(composition.source.fileId)
          : null
        const videoBlob = await resolveExportVideoBlob({
          memoryBlob: sourceBlobRef.current,
          storedBlob: stored?.blob ?? null,
          objectUrl: backgroundUrl,
        })
        const chosenName = sanitizeCapcutFileName(stemName)
        setExportFileName(sanitizeExportStem(stemName))
        setLiveMessage("")
        finalExportTask.start({
          video: videoBlob,
          props: toCliRenderProps(
            toRenderProps({
              composition: clampComposition({
                ...composition,
                output: outputFromQuality("1080", composition.source),
              }),
              videoSrc: "",
              stickerSrcs: stickerBlobUrls,
              watermarkPrefs,
            }),
          ),
          fileName: chosenName,
          saveToCapcut: true,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao exportar"
        console.error("[export]", error)
        setLiveMessage(`Falha ao exportar: ${message}`)
      }
    },
    [backgroundUrl, composition, stickerBlobUrls, watermarkPrefs],
  )

  const handleExport = useCallback(async () => {
    if (finalExport.running) {
      finalExportTask.cancel()
      setMacRenderBusy(false)
      setFinalNamePrompt(null)
      return
    }
    if (draftExporting) {
      abortRef.current?.abort()
      return
    }
    if (exportStartedRef.current) return
    if (!canExport) return

    if (exportMode === "final") {
      setFinalNamePrompt(sanitizeExportStem(exportFileName) || "video")
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    exportStartedRef.current = true
    setDraftExporting(true)
    setDraftProgress(0)
    setDraftPhase("encoding")

    try {
      const video = previewRef.current?.getVideo()
      if (!video) throw new Error("Vídeo não está pronto")
      setLiveMessage(formatExportStatus("encoding", 0))
      const result = await exportComposition({
        video,
        composition: clampComposition(composition),
        fontFamily: FONT_MAP[composition.brand.fontId]?.family ?? "var(--font-geist-sans)",
        signal: controller.signal,
        onProgress: (progress) => setDraftProgress(draftEncodeProgress(progress.ratio)),
        stickerBlobUrls,
        watermark: watermarkPaintInput(composition.watermarkEnabled, watermarkPrefs),
      })
      setDraftPhase("saving")
      setDraftProgress(0.98)
      setLiveMessage(formatExportStatus("saving", 0.98))
      const capcutName = sanitizeCapcutFileName(exportFileName)
      const diskExt = result.fileName.toLowerCase().endsWith(".webm") ? "webm" : "mp4"
      const diskName = exportDiskFileName(exportFileName, diskExt)
      const disk = await saveExportBlob(result.blob, diskName)
      const capcut = await applyCapcutCopy({
        wanted: shouldCopyBrowserExportToCapcut({
          wanted: saveToCapcut,
          source: "draft",
        }),
        blob: result.blob,
        fileName: capcutName,
      })
      if (disk === "cancelled") {
        setLiveMessage(formatExportSavedMessage({ disk, capcut }))
        return
      }
      setDraftProgress(1)
      if (result.backgrounded) {
        setLiveMessage(
          "A aba ficou em segundo plano durante o export — o vídeo pode ter perdido quadros. Exporte de novo com a aba visível.",
        )
      } else if (result.silent) {
        setLiveMessage(
          capcut === "saved"
            ? "Export concluído. Este navegador exporta sem áudio. Use Chrome 126+ para MP4 com som. Copiado para a pasta CapCut."
            : "Export concluído. Este navegador exporta sem áudio. Use Chrome 126+ para MP4 com som.",
        )
      } else {
        setLiveMessage(
          capcut === "skipped"
            ? "Export concluído"
            : formatExportSavedMessage({ disk, capcut }),
        )
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setLiveMessage("Export cancelado")
      } else {
        const message = error instanceof Error ? error.message : "Falha ao exportar"
        console.error("[editor] falha ao exportar", error)
        setLiveMessage(`Falha ao exportar: ${message}`)
      }
    } finally {
      exportStartedRef.current = false
      if (abortRef.current === controller) {
        setDraftExporting(false)
        setDraftPhase(null)
        abortRef.current = null
      }
    }
  }, [
    backgroundUrl,
    canExport,
    composition,
    draftExporting,
    exportMode,
    exportFileName,
    finalExport.running,
    saveToCapcut,
    stickerBlobUrls,
    watermarkPrefs,
  ])

  const fontFamily =
    FONT_MAP[composition.brand.fontId]?.family ?? "var(--font-geist-sans)"
  const watermarkPaint = watermarkPaintInput(composition.watermarkEnabled, watermarkPrefs)
  const previewFontFamily =
    activeTab === "batch" && batchPreview
      ? FONT_MAP[batchPreview.fontId]?.family ?? fontFamily
      : fontFamily
  const previewInserts = (() => {
    const base =
      activeTab === "batch" && batchPreview
        ? applyVariationPreview(composition.inserts, batchPreview.position)
        : composition.inserts
    if (!comboPreview || activeTab === "batch") return base
    const ghost = instantiateTemplate(comboPreview, composition.source.duration).map((insert) => ({
      ...insert,
      id: `preview-${insert.id}`,
    }))
    return [...base, ...ghost]
  })()
  const live = [liveMessage, quotaWarning].filter(Boolean).join(" ")
  const exportStatus =
    exporting && exportPhase
      ? formatExportStatus(exportPhase, exportProgress, exportElapsedSeconds)
      : live
  const exportFormat = tryPickExportFormat()
  const exportSize = resolveExportSize(composition)
  const outputQuality = qualityFromOutput(composition.output, composition.source)
  const exportSpec =
    exportMode === "final"
      ? formatExportSpec(
          1080,
          1920,
          30,
          "MP4",
          composition.source.duration,
        )
      : formatExportSpec(
          exportSize.width,
          exportSize.height,
          composition.output.fps,
          exportFormat?.label ?? "MP4",
          composition.source.duration,
        )
  const webmWarning =
    exportFormat?.ext === "webm"
      ? "Seu navegador exporta em WebM. Para MP4, use Chrome ou Edge."
      : null

  const exportWarnings = useMemo(
    () =>
      collectExportWarnings(
        checklistItemsFromComposition({
          inserts: composition.inserts,
          source: { duration: composition.source.duration },
          captionStyle: composition.captionStyle ?? DEFAULT_CAPTION_STYLE,
          captionPreset: composition.captionPreset,
          tracks: composition.tracks,
          styleRef: composition.styleRef,
          brand: { fontId: composition.brand.fontId, logo: composition.brand.logo },
        }),
      ),
    [
      composition.brand.fontId,
      composition.brand.logo,
      composition.captionPreset,
      composition.captionStyle,
      composition.inserts,
      composition.source.duration,
      composition.styleRef,
      composition.tracks,
    ],
  )

  const exportActionsRef = useRef<ExportMenuActions>(null!)
  exportActionsRef.current = {
    onExport: () => {
      void handleExport()
    },
    onInterruptMacRender: () => {
      void handleInterruptMacRender()
    },
    onRetryFinalExport: () => {
      setLiveMessage("")
      finalExportTask.retry()
    },
    onRecoverLastExport: () => {
      setLiveMessage("")
      finalExportTask.recoverLast()
    },
    onSaveToCapcutChange: (next) => {
      setSaveToCapcut(next)
      saveExportPrefs({ saveToCapcut: next })
    },
    onExportFileNameChange: setExportFileName,
    onExportModeChange: setExportMode,
    onOutputQualityChange: (quality) => {
      setComposition((prev) => ({
        ...prev,
        output: outputFromQuality(quality, prev.source),
      }))
    },
    onSelectInsert: (id) => {
      if (insertIdOf(selection) !== id) toggleInsert(id)
    },
  }

  const hasSourceForExport = hasPlayableSource(composition.source)
  const finalExportError = exportMode === "final" ? finalExport.error : null
  const canRecoverLastExport = exportMode === "final" && !exporting && hasLastExportJob
  const emptyComposition = composition.inserts.length === 0
  const headerActions = useMemo(
    () => (
      <EditorHeaderActions
        canUndo={historyFlags.canUndo}
        canRedo={historyFlags.canRedo}
        onUndo={undoLast}
        onRedo={redoLast}
        saveStatus={saveStatus}
        exportMenu={
          <ExportMenu
            actionsRef={exportActionsRef}
            hasSource={hasSourceForExport}
            canExport={canExport}
            exportDisabledReason={exportDisabledReason}
            exporting={exporting}
            exportProgress={exportProgress}
            exportStatus={exportStatus}
            macRenderBusy={macRenderBusy}
            finalExportError={finalExportError}
            canRetryFinalExport={finalExport.canRetry}
            canRecoverLastExport={canRecoverLastExport}
            saveToCapcut={saveToCapcut}
            exportFileName={exportFileName}
            exportMode={exportMode}
            exportSpec={exportSpec}
            emptyComposition={emptyComposition}
            outputQuality={outputQuality}
            sourceWidth={composition.source.width}
            sourceHeight={composition.source.height}
            webmWarning={webmWarning}
            warnings={exportWarnings}
          />
        }
      />
    ),
    [
      canExport,
      canRecoverLastExport,
      composition.source.height,
      composition.source.width,
      emptyComposition,
      exportDisabledReason,
      exportFileName,
      exportMode,
      exportProgress,
      exportSpec,
      exportStatus,
      exportWarnings,
      exporting,
      finalExport.canRetry,
      finalExportError,
      hasSourceForExport,
      historyFlags.canRedo,
      historyFlags.canUndo,
      macRenderBusy,
      outputQuality,
      redoLast,
      saveStatus,
      saveToCapcut,
      undoLast,
      webmWarning,
    ],
  )

  return (
    <main className="relative flex h-screen flex-col overflow-clip lg:flex-row">
      {finalNamePrompt !== null ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setFinalNamePrompt(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-name-title"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="final-name-title" className="text-sm font-semibold text-foreground">
              Nome do arquivo no CapCut
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Confirme ou edite o nome antes de iniciar o render no Mac.
            </p>
            <label className="mt-3 flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={finalNamePrompt}
                  maxLength={80}
                  aria-label="Nome do arquivo CapCut"
                  placeholder="meu-anuncio"
                  className="h-9 text-sm"
                  onChange={(event) => setFinalNamePrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setFinalNamePrompt(null)
                      return
                    }
                    if (event.key !== "Enter") return
                    event.preventDefault()
                    const stem = sanitizeExportStem(finalNamePrompt)
                    setFinalNamePrompt(null)
                    void startFinalExport(stem)
                  }}
                />
                <span className="shrink-0 font-mono text-[0.65rem] opacity-80">.mp4</span>
              </span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFinalNamePrompt(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                onClick={() => {
                  const stem = sanitizeExportStem(finalNamePrompt)
                  setFinalNamePrompt(null)
                  void startFinalExport(stem)
                }}
              >
                Iniciar render
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {pasteCandidate ? (
        <div
          role="status"
          className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-md"
        >
          <p className="text-xs text-foreground">
            {parseAllowedImportUrl(pasteCandidate).ok &&
            parseAllowedImportUrl(pasteCandidate).platform === "tiktok"
              ? "Link do TikTok detectado — importar?"
              : "Link de vídeo detectado — importar?"}
          </p>
          <Button
            type="button"
            size="xs"
            onClick={() => {
              const url = pasteCandidate
              setPasteCandidate(null)
              void importFromUrl(url)
            }}
          >
            Importar
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => setPasteCandidate(null)}>
            Ignorar
          </Button>
        </div>
      ) : null}
      <EditorNav active={activeTab} onChange={setActiveTab} />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] overflow-clip lg:grid-cols-[minmax(340px,30%)_1fr] lg:grid-rows-1">
        {activeTab === "editor" ? (
          <ControlPanel
            source={composition.source}
            importState={importState}
            draftUrl={draftUrl}
            replacingSource={replacingSource}
            elapsedSeconds={elapsedSeconds}
            recentSources={recentSources}
            previousSource={previousSource}
            burnedInWarning={burnedInWarning}
            inserts={composition.inserts}
            videoDuration={composition.source.duration}
            missingFile={missingFile}
            exporting={exporting}
            exportProgress={exportProgress}
            exportStatus={exportStatus}
            renderReplies={renderReplies}
            liveMessage={live}
            finalExportError={finalExportError}
            undoToast={undoToast}
            onUndoToast={undoLast}
            onDismissUndoToast={dismissUndoToast}
            selectedId={selectedInsertId}
            selectedIds={selection?.kind === "insert" ? (selection.ids ?? [selection.id]) : []}
            onDuplicateSelection={() => {
              if (selection?.kind === "insert") {
                duplicateSelection(selection.ids ?? [selection.id])
              }
            }}
            onDeleteSelection={() => {
              if (selection?.kind === "insert") {
                removeSelection(selection.ids ?? [selection.id])
              }
            }}
            onClearSelection={() => setSelection(null)}
            brandLogo={composition.brand.logo}
            brandFontId={composition.brand.fontId}
            onDraftUrlChange={(url) => {
              setDraftUrl(url)
              if (importState.status === "error") setImportState({ status: "idle" })
            }}
            onSubmitUrl={(url) => {
              void importFromUrl(url)
            }}
            onPickFile={handlePickFile}
            onUseRecent={(canonicalUrl) => {
              void importFromUrl(canonicalUrl)
            }}
            onReplaceSource={() => {
              setPreviousSource(null)
              setReplacingSource(true)
            }}
            onRestorePrevious={restorePrevious}
            onRetryImport={() => {
              const raw = importState.status === "error" ? importState.rawUrl : draftUrl
              if (raw) void importFromUrl(raw)
            }}
            onDownloadCopy={() => {
              if (!backgroundUrl || !composition.source.fileName) return
              const link = document.createElement("a")
              link.href = backgroundUrl
              link.download = composition.source.fileName
              link.click()
            }}
            onNewProject={startNewProject}
            onClearInserts={clearInserts}
            onClearCaptions={clearCaptions}
            onRevealCaption={revealCaption}
            panelSelectionTick={panelSelectionTick}
            onAddText={addTextInsert}
            onAddElement={addElement}
            onApplyTemplate={applyTemplate}
            activeTemplateId={activeTemplateId}
            onChangeInsert={changeInsert}
            onRemoveInsert={removeInsert}
            onSelectInsert={toggleInsert}
            onMergeDuplicates={mergeDuplicates}
            onGenerateAI={applyAIGenerate}
            loadAiMedia={loadAiMedia}
            onAiStatus={setLiveMessage}
            captionStyle={composition.captionStyle ?? DEFAULT_CAPTION_STYLE}
            captionPreset={composition.captionPreset}
            onChangeCaptionStyle={(patch) =>
              applyCaptionStyle(patch, gestureRef.current.active ? "gesture" : "discrete")
            }
            onApplyCaptionLook={applyCaptionLookId}
            onApplyStylePreset={applyStylePreset}
            tracks={composition.tracks}
            projectStyle={composition.styleRef ? { styleRef: composition.styleRef } : undefined}
            onPatchInsertStyle={patchInsertStyle}
            onResetInsertStyleField={resetInsertStyleField}
            onResetInsertStyleOverrides={resetInsertStyleOverrides}
            onResetInsertPosition={resetInsertPosition}
            onApplyStyleToTrack={applyInsertStyleToTrack}
            presetLibrary={presetLibrary}
            canGenerateCaptions={Boolean(composition.source.fileId) && !missingFile}
            onGenerateCaptions={applyCaptions}
            onBeginInsertGesture={beginInsertHistory}
            onEndInsertGesture={endInsertHistory}
            sourceSelected={isSourceSelected(selection)}
            onSelectSource={() => setSelection({ kind: "source" })}
            onResetTransform={handleResetAllSourceTransforms}
            watermarkEnabled={composition.watermarkEnabled === true}
            watermarkPrefs={watermarkPrefs}
            onWatermarkEnabledChange={handleWatermarkEnabled}
            onWatermarkPrefsChange={handleWatermarkPrefs}
          />
        ) : activeTab === "library" ? (
          <LibraryPanel
            fontId={composition.brand.fontId}
            onAddLibrarySticker={addLibrarySticker}
            stickerLimitReached={
              composition.inserts.filter((insert) => insertKind(insert) === "sticker").length >=
              MAX_STICKERS
            }
            onApplyTemplate={applyTemplate}
            onPreviewTemplate={previewCombo}
            onAddElement={(type, point) => {
              const created = createInsert(type)
              created.start = nextInsertStart(
                playheadRef.current,
                compositionRef.current.source.duration,
              )
              if (point) {
                created.x = Math.min(100, Math.max(0, Math.round(point.x * 10) / 10))
                created.y = Math.min(100, Math.max(0, Math.round(point.y * 10) / 10))
              }
              if (point?.text) created.text = point.text
              applyInserts((inserts) => [...inserts, created], "discrete")
              setSelection({ kind: "insert", id: created.id })
            }}
            onUndo={undoLast}
            videoDuration={composition.source.duration}
            videoUrl={backgroundUrl}
            videoId={composition.source.fileId}
            onSelectFont={(fontId) =>
              setComposition((prev) => ({
                ...prev,
                brand: { ...prev.brand, fontId },
              }))
            }
            projectInserts={composition.inserts}
            selectedTextId={
              composition.inserts.find(
                (insert) => insert.id === selectedInsertId && insertKind(insert) === "text",
              )?.id ?? null
            }
            usedFontIds={[
              composition.brand.fontId,
              ...composition.inserts.map((insert) => insert.fontFamily).filter((id): id is string => Boolean(id)),
            ]}
            onUseFontOnText={(fontId) => {
              if (!selectedInsertId) return
              changeInsert(selectedInsertId, { fontFamily: fontId })
            }}
          />
        ) : (
          <BatchPanel
            backgroundUrl={backgroundUrl}
            fileName={fileName}
            inserts={composition.inserts}
            fontId={composition.brand.fontId}
            batch={composition.batch}
            selectedVariationIndex={batchPreview?.index ?? null}
            onSelectVariation={setBatchPreview}
            onChangeBatch={(patch) =>
              setComposition((prev) => ({
                ...prev,
                batch: { ...prev.batch, ...patch },
              }))
            }
            customPresets={composition.customPresets}
            tracks={composition.tracks}
            styleRef={composition.styleRef}
          />
        )}
        <PreviewPanel
          ref={previewRef}
          backgroundUrl={backgroundUrl}
          inserts={previewInserts}
          comboPreviewLabel={comboPreview?.name ?? null}
          comboConfirming={comboChoice}
          onApplyComboPreview={requestApplyCombo}
          onConfirmComboPreview={(mode) => {
            if (comboPreview) applyTemplate(comboPreview, mode)
          }}
          onCancelComboPreview={cancelComboPreview}
          onDropElement={(type, x, y) => {
            const created = createInsert(type)
            created.start = nextInsertStart(playheadRef.current, compositionRef.current.source.duration)
            created.x = Math.min(100, Math.max(0, Math.round(x * 10) / 10))
            created.y = Math.min(100, Math.max(0, Math.round(y * 10) / 10))
            applyInserts((inserts) => [...inserts, created], "discrete")
            setSelection({ kind: "insert", id: created.id })
          }}
          selection={selection}
          sourceWidth={composition.source.width}
          sourceHeight={composition.source.height}
          sourceTransform={composition.source.transform}
          sourceCuts={composition.source.cuts}
          onSplitSource={handleSplitSource}
          onRemoveSourceCut={handleRemoveSourceCut}
          trim={composition.source.trim}
          onChangeTrim={handleChangeTrim}
          fontFamily={previewFontFamily}
          fontId={composition.brand.fontId}
          stickerBlobUrls={stickerBlobUrls}
          watermark={watermarkPaint}
          logoSrc={composition.brand.logo}
          captionPreset={composition.captionPreset}
          captionStyle={composition.captionStyle}
          styleRef={composition.styleRef}
          tracks={composition.tracks}
          customPresets={composition.customPresets}
          onPatchCaptionStyle={handlePreviewCaptionStyle}
          timelineDuration={composition.source.duration}
          showTimeline={hasPlayableSource(composition.source)}
          exporting={exporting}
          onMediaInfo={handleMediaInfo}
          onPlayheadChange={handlePlayheadChange}
          onSelect={handlePreviewSelect}
          onPatchSourceTransform={handlePatchSourceTransform}
          onResetSourceTransform={handleResetSourceTransform}
          onPatchInsert={changeInsert}
          onPatchTimings={patchTimings}
          onRemoveInsert={removeInsert}
          onDeleteSelection={removeSelection}
          onDuplicateSelection={duplicateSelection}
          onNudgeSelection={nudgeSelection}
          onAlignSelection={alignSelection}
          onCreateTextAt={addTextInsertAt}
          onDuplicateInsert={duplicateSelectedInsert}
          editingTextId={editingTextId}
          onEditingTextId={handleEditingTextId}
          onCancelTextEdit={cancelTextEdit}
          onBeginInsertGesture={beginInsertHistory}
          onEndInsertGesture={endInsertHistory}
          headerActions={headerActions}
        />
      </div>
    </main>
  )
}
