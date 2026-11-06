"use client"

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react"
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
import { FONT_MOOD, FONT_OPTIONS, FONT_PREVIEW_SAMPLE, type FontMood } from "@/lib/fonts"
import {
  TEXT_PRESET_FONT_FILES,
  ensureTextPresetFontsReady,
  isTextPresetFontLoaded,
} from "@/lib/text-presets"
import {
  type Insert,
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
import {
  comboContentSummary,
  comboMainText,
  comboMatchesEtapa,
  type ComboEtapaFilter,
} from "@/lib/library-combo"
import { deleteUserCombo, listUserCombos, saveUserCombo } from "@/lib/library-combo-store"
import { listLibraryFonts, saveLibraryFont, type StoredLibraryFont } from "@/lib/library-font-store"
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
  onPreviewTemplate: (template: Template) => void
  onAddElement: (type: InsertType, point?: { x: number; y: number; text?: string }) => void
  projectInserts: Insert[]
  selectedTextId: string | null
  usedFontIds: string[]
  onUseFontOnText: (fontId: string) => void
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
  onPreviewTemplate,
  onAddElement,
  projectInserts,
  selectedTextId,
  usedFontIds,
  onUseFontOnText,
  onUndo,
  videoDuration,
  videoUrl,
  videoId,
}: LibraryPanelProps) {
  const [section, setSection] = useState<LibrarySection>("templates")
  const [etapa, setEtapa] = useState<ComboEtapaFilter>("todos")
  const [userCombos, setUserCombos] = useState<Template[]>([])
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

  useEffect(() => {
    void listUserCombos().then(setUserCombos).catch(() => setUserCombos([]))
  }, [])

  function applyCombo(template: Template) {
    onPreviewTemplate(template)
  }

  async function saveProjectAsCombo() {
    const name = window.prompt("Nome do combo")?.trim()
    if (!name) return
    const art = projectInserts.filter((insert) => insert.kind !== "caption" && insert.type !== "legenda")
    if (art.length === 0) {
      setToast({ message: "O projeto não tem inserts para salvar." })
      return
    }
    const template: Template = {
      id: `combo-${crypto.randomUUID()}`,
      name,
      description: "Meu combo",
      etapa: "gancho",
      inserts: art.map(({ id: _id, ...rest }) => rest),
    }
    await saveUserCombo(template)
    setUserCombos((current) => [template, ...current])
    setToast({ message: `Combo "${name}" salvo` })
  }

  function applyElement(element: VisibleElement) {
    onAddElement(
      element.type,
      element.id === "mais-vendido" ? { x: 50, y: 40, text: "MAIS VENDIDO" } : undefined,
    )
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
              templates={templates.filter((template) => comboMatchesEtapa(template, etapa))}
              userCombos={userCombos.filter((template) => comboMatchesEtapa(template, etapa))}
              etapa={etapa}
              onEtapa={setEtapa}
              videoDuration={videoDuration}
              fontId={fontId}
              videoUrl={videoUrl}
              videoId={videoId}
              onPreview={onPreviewTemplate}
              onSaveProject={saveProjectAsCombo}
              onDuplicate={duplicateCombo}
              onRename={renameCombo}
              onDelete={deleteCombo}
              onRenameUser={async (template, name) => {
                const next = { ...template, name }
                await saveUserCombo(next)
                setUserCombos((current) => current.map((item) => (item.id === template.id ? next : item)))
              }}
              onDuplicateUser={async (template) => {
                const copy = { ...template, id: `combo-${crypto.randomUUID()}`, name: `${template.name} cópia` }
                await saveUserCombo(copy)
                setUserCombos((current) => [copy, ...current])
              }}
              onDeleteUser={async (template) => {
                await deleteUserCombo(template.id)
                setUserCombos((current) => current.filter((item) => item.id !== template.id))
              }}
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
              selectedTextId={selectedTextId}
              usedFontIds={usedFontIds}
              onUseFontOnText={onUseFontOnText}
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
  userCombos,
  etapa,
  onEtapa,
  videoDuration,
  fontId,
  videoUrl,
  videoId,
  onPreview,
  onSaveProject,
  onDuplicate,
  onRename,
  onDelete,
  onRenameUser,
  onDuplicateUser,
  onDeleteUser,
}: {
  templates: Template[]
  userCombos: Template[]
  etapa: ComboEtapaFilter
  onEtapa: (etapa: ComboEtapaFilter) => void
  videoDuration: number
  fontId: string
  videoUrl?: string
  videoId?: string
  onPreview: (template: Template) => void
  onSaveProject: () => void
  onDuplicate: (template: Template) => void
  onRename: (template: Template, name: string) => void
  onDelete: (template: Template) => void
  onRenameUser: (template: Template, name: string) => void
  onDuplicateUser: (template: Template) => void
  onDeleteUser: (template: Template) => void
}) {
  const filters: Array<{ id: ComboEtapaFilter; label: string }> = [
    { id: "todos", label: "Todos" },
    { id: "gancho", label: "Gancho" },
    { id: "prova", label: "Prova" },
    { id: "cta", label: "CTA" },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={etapa === item.id}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              etapa === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
            onClick={() => onEtapa(item.id)}
          >
            {item.label}
          </button>
        ))}
        <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={onSaveProject}>
          Salvar projeto atual como combo
        </Button>
      </div>
      {userCombos.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meus combos</h2>
          <ComboGrid
            templates={userCombos}
            videoDuration={videoDuration}
            fontId={fontId}
            videoUrl={videoUrl}
            videoId={videoId}
            onPreview={onPreview}
            onDuplicate={onDuplicateUser}
            onRename={onRenameUser}
            onDelete={onDeleteUser}
          />
        </section>
      ) : null}
      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum combo nesta etapa.</p>
      ) : (
        <ComboGrid
          templates={templates}
          videoDuration={videoDuration}
          fontId={fontId}
          videoUrl={videoUrl}
          videoId={videoId}
          onPreview={onPreview}
          onDuplicate={onDuplicate}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function ComboGrid({
  templates,
  videoDuration,
  fontId,
  videoUrl,
  videoId,
  onPreview,
  onDuplicate,
  onRename,
  onDelete,
}: {
  templates: Template[]
  videoDuration: number
  fontId: string
  videoUrl?: string
  videoId?: string
  onPreview: (template: Template) => void
  onDuplicate: (template: Template) => void
  onRename: (template: Template, name: string) => void
  onDelete: (template: Template) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map((template) => (
        <LibraryActionCard
          key={template.id}
          name={template.name}
          ariaLabel={`Ver prévia do combo ${template.name}`}
          compact
          onApply={() => onPreview(template)}
          onDuplicate={() => onDuplicate(template)}
          onRename={(name) => onRename(template, name)}
          onDelete={() => onDelete(template)}
        >
          <div className="relative mb-2 aspect-[9/16] overflow-hidden rounded-md bg-zinc-900">
            <div className="absolute inset-0 opacity-40">
              <ComboStillPreview
                template={template}
                fontId={fontId}
                videoUrl={videoUrl}
                videoId={videoId}
                videoDuration={videoDuration}
              />
            </div>
            <div className="absolute inset-0 bg-black/55" />
            <p className="absolute inset-2 flex items-center justify-center text-center text-sm font-black uppercase leading-tight text-white">
              {comboMainText(template)}
            </p>
          </div>
          <p className="truncate text-xs font-semibold text-foreground">{template.name}</p>
          <p className="text-[0.65rem] text-muted-foreground">{comboContentSummary(template)}</p>
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
  const showcase = elements.some((item) => item.label.toLowerCase().includes("mais vendido"))
    ? elements
    : [
        ...elements,
        {
          ...elements.find((item) => item.type === "selo-frete"),
          id: "mais-vendido",
          type: "selo-frete" as const,
          label: "Selo Mais vendido",
        },
      ].filter((item) => item && item.type)

  return (
        <div className="grid grid-cols-2 gap-2">
          {showcase.map((item) => (
            <LibraryActionCard
              key={item.id}
              name={item.label}
              ariaLabel={`Aplicar elemento ${item.label}`}
              compact
              dragType={item.type}
              onApply={() =>
                onApply(
                  item.id === "mais-vendido"
                    ? { ...item, label: "Selo Mais vendido" }
                    : item,
                )
              }
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
  dragType,
  children,
}: {
  name: string
  ariaLabel: string
  compact?: boolean
  onApply: () => void
  onDuplicate: () => void
  onRename: (name: string) => void
  onDelete: () => void
  dragType?: string
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
        draggable={Boolean(dragType)}
        onDragStart={(event) => {
          if (!dragType) return
          event.dataTransfer.setData("application/x-editor-element", dragType)
          event.dataTransfer.effectAllowed = "copy"
        }}
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
  selectedTextId,
  usedFontIds,
  onUseFontOnText,
}: {
  fontId: string
  sample: string
  onSampleChange: (value: string) => void
  onSelectFont: (fontId: string) => void
  selectedTextId: string | null
  usedFontIds: string[]
  onUseFontOnText: (fontId: string) => void
}) {
  const [readyTick, setReadyTick] = useState(0)
  const [mood, setMood] = useState<FontMood | "todos">("todos")
  const [customFonts, setCustomFonts] = useState<StoredLibraryFont[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    let cancelled = false
    void ensureTextPresetFontsReady().then(() => {
      if (!cancelled) setReadyTick((tick) => tick + 1)
    })
    void listLibraryFonts().then((fonts) => {
      if (!cancelled) setCustomFonts(fonts)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const moods: Array<{ id: FontMood | "todos"; label: string }> = [
    { id: "todos", label: "Todas" },
    { id: "impacto", label: "Impacto" },
    { id: "condensada", label: "Condensada" },
    { id: "elegante", label: "Elegante" },
    { id: "manuscrita", label: "Manuscrita" },
    { id: "tecnica", label: "Técnica" },
  ]
  const fonts = FONT_OPTIONS.filter((font) => mood === "todos" || FONT_MOOD[font.id] === mood)
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
        <div className="flex flex-wrap gap-1">
          {moods.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mood === item.id}
              className={cn(
                "rounded-full px-2 py-1 text-[0.65rem]",
                mood === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
              onClick={() => setMood(item.id)}
            >
              {item.label}
            </button>
          ))}
          <Button type="button" size="xs" variant="outline" onClick={() => inputRef.current?.click()}>
            Enviar .ttf/.otf
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".ttf,.otf,font/ttf,font/otf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void saveLibraryFont(file).then((saved) => {
                  if (saved) setCustomFonts((current) => [saved, ...current])
                })
              }
              event.target.value = ""
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {customFonts.map((font) => (
          <FontPreviewCard
            key={font.id}
            font={{ id: font.id, label: font.label, family: font.family, vibe: "Enviada" }}
            sample={sample}
            selected={fontId === font.id}
            used={usedFontIds.includes(font.family) || usedFontIds.includes(font.id)}
            canUseOnText={Boolean(selectedTextId)}
            onUseOnText={() => onUseFontOnText(font.family)}
            onSelect={() => onSelectFont(font.id)}
            ariaLabel={`Fonte ${font.label}`}
          />
        ))}
        {fonts.map((font) => {
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
              used={usedFontIds.includes(font.id)}
              canUseOnText={Boolean(selectedTextId)}
              onUseOnText={() => onUseFontOnText(font.id)}
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

