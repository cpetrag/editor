"use client"

import { useEffect, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react"
import {
  ImageIcon,
  LayoutTemplate,
  LibraryBig,
  MoreHorizontal,
  Sparkles,
  Type,
} from "lucide-react"

import { ComboStillPreview } from "@/components/combo-still"
import { FontPreviewCard } from "@/components/library-font-card"
import { StickerGrid } from "@/components/library-sticker-grid"
import {
  ComboCardMeta,
  ElementThumb,
} from "@/components/library-thumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { stickerThumbUrl } from "@/lib/compose/sticker-src"
import { FONT_OPTIONS, FONT_PREVIEW_SAMPLE } from "@/lib/fonts"
import {
  TEXT_PRESET_FONT_FILES,
  ensureTextPresetFontsReady,
  isTextPresetFontLoaded,
} from "@/lib/text-presets"
import {
  type InsertType,
  type Template,
} from "@/lib/inserts"
import {
  deleteCatalogItem,
  duplicateElement,
  duplicateTemplateInCatalog,
  formatApplyToast,
  readLibraryCatalog,
  renameCatalogItem,
  visibleElements,
  visibleTemplates,
  writeLibraryCatalog,
  type LibraryCatalog,
  type VisibleElement,
} from "@/lib/library-catalog"
import { readPngMeta, writePngMeta, type LibraryPngMeta } from "@/lib/library-png-meta"
import { comboOverflowsVideo } from "@/lib/library-preview"
import {
  countLibraryResults,
  formatLibrarySearchSubtitle,
  midTruncate,
  searchLibrary,
  type LibraryPngItem,
} from "@/lib/library-search"
import { cn } from "@/lib/utils"

type LibrarySection = "templates" | "elements" | "png" | "fonts"

const LIBRARY_TOAST_MS = 4000

type LibraryToast = {
  message: string
  undo?: () => void
}

function stopLibraryActionBubble(
  event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
) {
  event.stopPropagation()
}

interface LibraryPanelProps {
  fontId: string
  onSelectFont: (fontId: string) => void
  onAddLibrarySticker: (item: { id: string; name: string }) => void
  stickerLimitReached: boolean
  onApplyTemplate: (template: Template) => void
  onAddElement: (type: InsertType) => void
  onUndo: () => void
  videoDuration: number
  videoUrl?: string
  videoId?: string
}

export function LibraryPanel({
  fontId,
  onSelectFont,
  onAddLibrarySticker,
  stickerLimitReached,
  onApplyTemplate,
  onAddElement,
  onUndo,
  videoDuration,
  videoUrl,
  videoId,
}: LibraryPanelProps) {
  const [section, setSection] = useState<LibrarySection>("templates")
  const [catalog, setCatalog] = useState<LibraryCatalog>(readLibraryCatalog)
  const [toast, setToast] = useState<LibraryToast | null>(null)
  const [query, setQuery] = useState("")
  const [fontSample, setFontSample] = useState(FONT_PREVIEW_SAMPLE)
  const [pngs, setPngs] = useState<LibraryPngItem[]>([])
  const [pngMeta, setPngMeta] = useState<LibraryPngMeta>(readPngMeta)
  const [toastHover, setToastHover] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/compose/stickers/library")
        const data = (await response.json()) as { items?: LibraryPngItem[] }
        if (!cancelled) setPngs(data.items ?? [])
      } catch (error) {
        console.error("[editor] falha ao listar biblioteca PNG", error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function commitPngMeta(next: LibraryPngMeta) {
    setPngMeta(next)
    writePngMeta(next)
  }

  function commitCatalog(next: LibraryCatalog, message: string, previous: LibraryCatalog) {
    setCatalog(next)
    writeLibraryCatalog(next)
    setToast({
      message,
      undo: () => {
        setCatalog(previous)
        writeLibraryCatalog(previous)
        setToast(null)
      },
    })
  }

  function applyCombo(template: Template) {
    onApplyTemplate(template)
    setToast({
      message: formatApplyToast("combo", template.name, template.inserts.length),
      undo: () => {
        onUndo()
        setToast(null)
      },
    })
  }

  function applyElement(element: VisibleElement) {
    onAddElement(element.type)
    setToast({
      message: formatApplyToast("element", element.label, 1),
      undo: () => {
        onUndo()
        setToast(null)
      },
    })
  }

  function selectFont(nextId: string) {
    if (nextId === fontId) return
    const previous = fontId
    onSelectFont(nextId)
    const label = FONT_OPTIONS.find((font) => font.id === nextId)?.label ?? nextId
    setToast({
      message: `${label} agora é a fonte padrão`,
      undo: () => {
        onSelectFont(previous)
        setToast(null)
      },
    })
  }

  function duplicateCombo(template: Template) {
    const previous = catalog
    const result = duplicateTemplateInCatalog(catalog, template)
    commitCatalog(result.catalog, `Combo "${result.copy.name}" duplicado`, previous)
  }

  function renameCombo(template: Template, name: string) {
    const previous = catalog
    commitCatalog(
      renameCatalogItem(catalog, "template", template.id, name),
      `Combo "${name.trim()}" renomeado`,
      previous,
    )
  }

  function deleteCombo(template: Template) {
    const previous = catalog
    commitCatalog(
      deleteCatalogItem(catalog, "template", template.id),
      `Combo "${template.name}" excluído`,
      previous,
    )
  }

  function duplicateEl(element: VisibleElement) {
    const previous = catalog
    const result = duplicateElement(catalog, element)
    commitCatalog(result.catalog, `Elemento "${result.copy.label}" duplicado`, previous)
  }

  function renameEl(element: VisibleElement, name: string) {
    const previous = catalog
    commitCatalog(
      renameCatalogItem(catalog, "element", element.id, name),
      `Elemento "${name.trim()}" renomeado`,
      previous,
    )
  }

  function deleteEl(element: VisibleElement) {
    const previous = catalog
    commitCatalog(
      deleteCatalogItem(catalog, "element", element.id),
      `Elemento "${element.label}" excluído`,
      previous,
    )
  }

  const templates = visibleTemplates(catalog)
  const elements = visibleElements(catalog)
  const grouped = query.trim()
    ? searchLibrary(query, {
        templates,
        elements,
        pngs,
        fonts: FONT_OPTIONS.map((font) => ({ id: font.id, label: font.label })),
      })
    : null
  const resultCount = grouped ? countLibraryResults(grouped) : 0

  useEffect(() => {
    if (!toast) {
      setToastHover(false)
      return
    }
    if (toastHover) return
    const timer = window.setTimeout(() => setToast(null), LIBRARY_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, toastHover])

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <LibraryBig className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">Biblioteca</h1>
          <p className="truncate text-xs text-muted-foreground">
            {formatLibrarySearchSubtitle(query, resultCount)}
          </p>
        </div>
      </header>

      <div className="border-b border-border px-5 py-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar combos, elementos, PNGs e fontes"
          aria-label="Busca na biblioteca"
        />
      </div>

      <div className="border-b border-border px-5 py-3">
        <ToggleGroup
          value={[section]}
          onValueChange={(value) => {
            const next = value[0] as LibrarySection | undefined
            if (next) setSection(next)
          }}
          variant="outline"
          className="w-full"
        >
          <ToggleGroupItem value="templates" className="flex-1">
            <LayoutTemplate data-icon="inline-start" />
            Templates
          </ToggleGroupItem>
          <ToggleGroupItem value="elements" className="flex-1">
            <Sparkles data-icon="inline-start" />
            Elementos
          </ToggleGroupItem>
          <ToggleGroupItem value="png" className="flex-1">
            <ImageIcon data-icon="inline-start" />
            PNG
          </ToggleGroupItem>
          <ToggleGroupItem value="fonts" className="flex-1">
            <Type data-icon="inline-start" />
            Fontes
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn("px-5 py-5", toast ? "pb-16" : null)}>
          {grouped ? (
            <SearchResults
              grouped={grouped}
              videoDuration={videoDuration}
              fontId={fontId}
              videoUrl={videoUrl}
              videoId={videoId}
              fontSample={fontSample}
              stickerLimitReached={stickerLimitReached}
              onApplyCombo={applyCombo}
              onApplyElement={applyElement}
              onInsertPng={(item) => {
                onAddLibrarySticker(item)
                setToast({
                  message: `PNG "${item.name}" inserido`,
                  undo: () => {
                    onUndo()
                    setToast(null)
                  },
                })
              }}
              onSelectFont={selectFont}
              onDuplicateCombo={duplicateCombo}
              onRenameCombo={renameCombo}
              onDeleteCombo={deleteCombo}
              onDuplicateElement={duplicateEl}
              onRenameElement={renameEl}
              onDeleteElement={deleteEl}
            />
          ) : section === "templates" ? (
            <TemplatesList
              templates={templates}
              videoDuration={videoDuration}
              fontId={fontId}
              videoUrl={videoUrl}
              videoId={videoId}
              onApply={applyCombo}
              onDuplicate={duplicateCombo}
              onRename={renameCombo}
              onDelete={deleteCombo}
            />
          ) : section === "elements" ? (
            <ElementsGrid
              elements={elements}
              onApply={applyElement}
              onDuplicate={duplicateEl}
              onRename={renameEl}
              onDelete={deleteEl}
            />
          ) : section === "png" ? (
            <StickerGrid
              items={pngs}
              onItemsChange={setPngs}
              stickerLimitReached={stickerLimitReached}
              pngMeta={pngMeta}
              onPngMetaChange={commitPngMeta}
              onInsert={(item) => {
                onAddLibrarySticker(item)
                setToast({
                  message: `PNG "${item.name}" inserido`,
                  undo: () => {
                    onUndo()
                    setToast(null)
                  },
                })
              }}
              onToast={(next) => setToast(next)}
            />
          ) : (
            <FontsGrid
              fontId={fontId}
              sample={fontSample}
              onSampleChange={setFontSample}
              onSelectFont={selectFont}
            />
          )}
        </div>
      </ScrollArea>

      {toast ? (
        <div
          className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background px-5 py-2"
          role="status"
          onMouseEnter={() => setToastHover(true)}
          onMouseLeave={() => setToastHover(false)}
        >
          <p className="min-w-0 truncate text-xs text-muted-foreground">{toast.message}</p>
          {toast.undo ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                toast.undo?.()
              }}
            >
              Desfazer
            </Button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

function TemplatesList({
  templates,
  videoDuration,
  fontId,
  videoUrl,
  videoId,
  onApply,
  onDuplicate,
  onRename,
  onDelete,
}: {
  templates: Template[]
  videoDuration: number
  fontId: string
  videoUrl?: string
  videoId?: string
  onApply: (template: Template) => void
  onDuplicate: (template: Template) => void
  onRename: (template: Template, name: string) => void
  onDelete: (template: Template) => void
}) {
  if (templates.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum combo nesta biblioteca.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => (
        <LibraryActionCard
          key={template.id}
          name={template.name}
          ariaLabel={`Aplicar combo ${template.name}`}
          onApply={() => onApply(template)}
          onDuplicate={() => onDuplicate(template)}
          onRename={(name) => onRename(template, name)}
          onDelete={() => onDelete(template)}
        >
          <div className="flex gap-3 pr-24">
            <ComboStillPreview
              template={template}
              fontId={fontId}
              videoUrl={videoUrl}
              videoId={videoId}
              videoDuration={videoDuration}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
              <p className="text-xs text-muted-foreground">{template.description}</p>
            </div>
          </div>
          <ComboCardMeta
            template={template}
            overflows={comboOverflowsVideo(template, videoDuration)}
            videoDuration={videoDuration}
          />
        </LibraryActionCard>
      ))}
    </div>
  )
}

function ElementsGrid({
  elements,
  onApply,
  onDuplicate,
  onRename,
  onDelete,
}: {
  elements: VisibleElement[]
  onApply: (element: VisibleElement) => void
  onDuplicate: (element: VisibleElement) => void
  onRename: (element: VisibleElement, name: string) => void
  onDelete: (element: VisibleElement) => void
}) {
  if (elements.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum elemento nesta biblioteca.</p>
  }

  return (
        <div className="grid grid-cols-2 gap-2">
          {elements.map((item) => (
            <LibraryActionCard
              key={item.id}
              name={item.label}
              ariaLabel={`Aplicar elemento ${item.label}`}
              compact
              onApply={() => onApply(item)}
              onDuplicate={() => onDuplicate(item)}
              onRename={(name) => onRename(item, name)}
              onDelete={() => onDelete(item)}
            >
              <div className="flex items-center gap-2 pr-16">
                <ElementThumb type={item.type} />
                <span
                  className="min-w-0 flex-1 text-xs font-medium break-words text-foreground line-clamp-2"
                  title={item.label}
                >
                  {item.label.length > 22 ? midTruncate(item.label, 22) : item.label}
                </span>
              </div>
            </LibraryActionCard>
          ))}
        </div>
  )
}

function LibraryActionCard({
  name,
  ariaLabel,
  compact = false,
  onApply,
  onDuplicate,
  onRename,
  onDelete,
  children,
}: {
  name: string
  ariaLabel: string
  compact?: boolean
  onApply: () => void
  onDuplicate: () => void
  onRename: (name: string) => void
  onDelete: () => void
  children: ReactNode
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)

  useEffect(() => {
    setDraft(name)
  }, [name])

  if (renaming) {
    return (
      <form
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-brand bg-card",
          compact ? "p-2.5" : "p-3",
        )}
        onSubmit={(event) => {
          event.preventDefault()
          const next = draft.trim()
          if (next && next !== name) onRename(next)
          setRenaming(false)
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          aria-label={`Novo nome de ${name}`}
        />
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={() => setRenaming(false)}>
            Cancelar
          </Button>
          <Button type="submit" size="xs">
            Salvar
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onApply}
        className={cn(
          "flex w-full flex-col rounded-lg border border-border bg-card text-left transition-colors",
          "hover:border-brand/50 hover:bg-accent",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "gap-0 p-2.5" : "gap-3 p-3",
        )}
      >
        {children}
      </button>
      <div
        className={cn(
          "absolute z-20 flex items-center gap-0.5",
          compact ? "right-1 top-1" : "right-1.5 top-1.5",
        )}
        onClick={stopLibraryActionBubble}
        onPointerDown={stopLibraryActionBubble}
        onMouseDown={stopLibraryActionBubble}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            onApply()
          }}
          className={cn(
            "rounded-md bg-brand px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-foreground shadow-sm",
            "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          Aplicar
        </button>
        <OverflowMenu
          name={name}
          onDuplicate={onDuplicate}
          onRename={() => setRenaming(true)}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

function OverflowMenu({
  name,
  onDuplicate,
  onRename,
  onDelete,
}: {
  name: string
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Mais ações de ${name}`}
            onPointerDown={stopLibraryActionBubble}
            onMouseDown={stopLibraryActionBubble}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground",
              "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        }
      />
      <PopoverContent align="end" side="top" className="w-40 p-1">
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
          onClick={() => {
            onDuplicate()
            setOpen(false)
          }}
        >
          Duplicar
        </button>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
          onClick={() => {
            onRename()
            setOpen(false)
          }}
        >
          Renomear
        </button>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
          onClick={() => {
            onDelete()
            setOpen(false)
          }}
        >
          Excluir
        </button>
      </PopoverContent>
    </Popover>
  )
}

function FontsGrid({
  fontId,
  sample,
  onSampleChange,
  onSelectFont,
}: {
  fontId: string
  sample: string
  onSampleChange: (value: string) => void
  onSelectFont: (fontId: string) => void
}) {
  const [readyTick, setReadyTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    void ensureTextPresetFontsReady().then(() => {
      if (!cancelled) setReadyTick((tick) => tick + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Fonte padrão para novos textos</h2>
        <Input
          value={sample}
          onChange={(event) => onSampleChange(event.target.value)}
          aria-label="Texto de exemplo das fontes"
          placeholder="Digite um texto de exemplo"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {FONT_OPTIONS.map((font) => {
          const isActive = font.id === fontId
          const hosted = TEXT_PRESET_FONT_FILES.find((item) => item.id === font.id)
          const loaded = Boolean(
            readyTick && hosted && isTextPresetFontLoaded(hosted.family, hosted.weight),
          )
          return (
            <FontPreviewCard
              key={font.id}
              font={font}
              sample={sample}
              selected={isActive}
              loaded={loaded}
              onSelect={() => onSelectFont(font.id)}
              ariaLabel={`Definir ${font.label} como fonte padrão`}
            />
          )
        })}
      </div>
    </div>
  )
}

function SearchResults({
  grouped,
  videoDuration,
  fontId,
  videoUrl,
  videoId,
  fontSample,
  stickerLimitReached,
  onApplyCombo,
  onApplyElement,
  onInsertPng,
  onSelectFont,
  onDuplicateCombo,
  onRenameCombo,
  onDeleteCombo,
  onDuplicateElement,
  onRenameElement,
  onDeleteElement,
}: {
  grouped: ReturnType<typeof searchLibrary>
  videoDuration: number
  fontId: string
  videoUrl?: string
  videoId?: string
  fontSample: string
  stickerLimitReached: boolean
  onApplyCombo: (template: Template) => void
  onApplyElement: (element: VisibleElement) => void
  onInsertPng: (item: { id: string; name: string }) => void
  onSelectFont: (fontId: string) => void
  onDuplicateCombo: (template: Template) => void
  onRenameCombo: (template: Template, name: string) => void
  onDeleteCombo: (template: Template) => void
  onDuplicateElement: (element: VisibleElement) => void
  onRenameElement: (element: VisibleElement, name: string) => void
  onDeleteElement: (element: VisibleElement) => void
}) {
  const empty =
    grouped.templates.length + grouped.elements.length + grouped.pngs.length + grouped.fonts.length === 0
  if (empty) {
    return <p className="text-xs text-muted-foreground">Nada encontrado na biblioteca.</p>
  }
  return (
    <div className="flex flex-col gap-6">
      {grouped.templates.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Combos</h2>
          <TemplatesList
            templates={grouped.templates}
            videoDuration={videoDuration}
            fontId={fontId}
            videoUrl={videoUrl}
            videoId={videoId}
            onApply={onApplyCombo}
            onDuplicate={onDuplicateCombo}
            onRename={onRenameCombo}
            onDelete={onDeleteCombo}
          />
        </section>
      ) : null}
      {grouped.elements.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elementos</h2>
          <ElementsGrid
            elements={grouped.elements}
            onApply={onApplyElement}
            onDuplicate={onDuplicateElement}
            onRename={onRenameElement}
            onDelete={onDeleteElement}
          />
        </section>
      ) : null}
      {grouped.pngs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PNG</h2>
          <div className="grid grid-cols-3 gap-2">
            {grouped.pngs.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={stickerLimitReached}
                onClick={() => onInsertPng(item)}
                aria-label={`Inserir ${item.name}`}
                className="overflow-hidden rounded-lg border border-border bg-card hover:border-brand/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <span className="block aspect-square bg-[image:repeating-conic-gradient(#e7e5e4_0%_25%,#fafafa_0%_50%)] bg-[size:12px_12px]">
                  <img
                    src={stickerThumbUrl(item.id, 160)}
                    srcSet={`${stickerThumbUrl(item.id, 160)} 1x, ${stickerThumbUrl(item.id, 320)} 2x`}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-contain p-1"
                  />
                </span>
                <span className="block px-1 pb-1 text-[0.65rem] text-muted-foreground">
                  {midTruncate(item.name)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {grouped.fonts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fontes</h2>
          <div className="grid grid-cols-2 gap-3">
            {grouped.fonts.map((hit) => {
              const font = FONT_OPTIONS.find((item) => item.id === hit.id)
              if (!font) return null
              const isActive = font.id === fontId
              return (
                <FontPreviewCard
                  key={font.id}
                  font={font}
                  sample={fontSample}
                  selected={isActive}
                  onSelect={() => onSelectFont(font.id)}
                  ariaLabel={`Definir ${font.label} como fonte padrão`}
                />
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

