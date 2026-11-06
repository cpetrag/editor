"use client"

import { useEffect, useRef, useState } from "react"
import { MoreHorizontal, Star, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { stickerThumbUrl } from "@/lib/compose/sticker-src"
import {
  filterPngItems,
  pngBackdropClass,
  PNG_BRAND_TAGS,
  readPngBackdrop,
  setPngTags,
  togglePngFavorite,
  touchPngRecent,
  writePngBackdrop,
  type LibraryPngMeta,
  type PngBackdrop,
  type PngFilter,
} from "@/lib/library-png-meta"
import { matchesQuery, midTruncate, type LibraryPngItem } from "@/lib/library-search"
import { cn } from "@/lib/utils"

type LibraryToast = {
  message: string
  undo?: () => void
}

export function StickerGrid({
  items,
  onItemsChange,
  stickerLimitReached,
  pngMeta,
  onPngMetaChange,
  onInsert,
  onToast,
}: {
  items: LibraryPngItem[]
  onItemsChange: (items: LibraryPngItem[]) => void
  stickerLimitReached: boolean
  pngMeta: LibraryPngMeta
  onPngMetaChange: (meta: LibraryPngMeta) => void
  onInsert: (item: LibraryPngItem) => void
  onToast: (toast: LibraryToast) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<PngFilter>("all")
  const [tag, setTag] = useState<string | null>(null)
  const [backdrop, setBackdrop] = useState<PngBackdrop>("checker")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")

  const searched = items.filter((item) => matchesQuery(item.name, query))
  const tagged = tag
    ? searched.filter((item) => (pngMeta.tags[item.id] ?? []).includes(tag))
    : searched
  const visible = filterPngItems(tagged, filter, pngMeta)

  useEffect(() => {
    setBackdrop(readPngBackdrop())
  }, [])

  async function uploadFiles(files: FileList | File[]) {
    const pngs = [...files].filter(
      (file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"),
    )
    if (pngs.length === 0) {
      onToast({ message: "Envie um PNG com transparência, até 5 MB." })
      return
    }
    const uploaded: LibraryPngItem[] = []
    for (const file of pngs) {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch("/api/compose/stickers/library", { method: "POST", body })
      const data = (await response.json()) as { item?: LibraryPngItem; error?: string }
      if (!response.ok || !data.item) {
        onToast({ message: data.error ?? "Não foi possível enviar o PNG." })
        continue
      }
      uploaded.push(data.item)
    }
    if (uploaded.length === 0) return
    const next = [...uploaded, ...items]
    onItemsChange(next)
    onToast({
      message: uploaded.length === 1 ? `PNG "${uploaded[0]?.name}" enviado` : `${uploaded.length} PNGs enviados`,
      undo: () => {
        void (async () => {
          for (const item of uploaded) {
            await fetch(`/api/compose/stickers/media/${encodeURIComponent(item.id)}`, { method: "DELETE" })
          }
          onItemsChange(items)
        })()
      },
    })
  }

  function insertItem(item: LibraryPngItem) {
    onInsert(item)
    onPngMetaChange(touchPngRecent(pngMeta, item.id))
  }

  return (
    <div
      className={cn("flex flex-col gap-3 rounded-lg", dragging && "ring-2 ring-brand")}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void uploadFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files)
          event.target.value = ""
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-dashed border-border bg-card px-3 py-3 text-left text-xs text-muted-foreground hover:border-brand/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="block font-medium text-foreground">Arraste PNGs aqui ou clique para enviar</span>
        PNG com transparência, até 5 MB
      </button>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filtrar por nome"
        aria-label="Filtrar PNGs por nome"
      />
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          pressed={filter === "all"}
          onClick={() => setFilter("all")}
          label={`Todos (${items.length})`}
        />
        <FilterChip
          pressed={filter === "recent"}
          onClick={() => setFilter("recent")}
          label="Recentes"
        />
        <FilterChip
          pressed={filter === "favorite"}
          onClick={() => setFilter("favorite")}
          label="Favoritos"
        />
        {PNG_BRAND_TAGS.map((brand) => (
          <FilterChip
            key={brand}
            pressed={tag === brand}
            onClick={() => setTag((current) => (current === brand ? null : brand))}
            label={brand}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {(["checker", "light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={backdrop === mode}
            className={cn(
              "rounded-full px-2 py-1 text-[0.65rem]",
              backdrop === mode ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
            onClick={() => {
              setBackdrop(mode)
              writePngBackdrop(mode)
            }}
          >
            {mode === "checker" ? "Xadrez" : mode === "light" ? "Claro" : "Escuro"}
          </button>
        ))}
      </div>
      {stickerLimitReached ? (
        <p className="text-xs text-muted-foreground">Limite de 20 inserts PNG no projeto.</p>
      ) : null}
      {visible.length === 0 ? (
        <EmptyPngState filter={filter} querying={query.trim().length > 0} />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visible.map((item) => {
            const favorite = pngMeta.favorites.includes(item.id)
            if (renamingId === item.id) {
              return (
                <form
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border border-brand bg-card p-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const name = draftName.trim()
                    if (name && name !== item.name) {
                      void renameItem(item, name, items, onItemsChange, onToast)
                    }
                    setRenamingId(null)
                  }}
                >
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    autoFocus
                    aria-label={`Novo nome de ${item.name}`}
                  />
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setRenamingId(null)}>
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
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  disabled={stickerLimitReached}
                  onClick={() => insertItem(item)}
                  aria-label={`Inserir ${item.name}`}
                  className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left hover:border-brand/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  title={item.name}
                >
                  <span className={cn("aspect-square w-full", pngBackdropClass(backdrop))} title={item.name}>
                    <img
                      src={stickerThumbUrl(item.id, 160)}
                      srcSet={`${stickerThumbUrl(item.id, 160)} 1x, ${stickerThumbUrl(item.id, 320)} 2x`}
                      alt={item.name}
                      width={160}
                      height={160}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-contain p-1"
                    />
                  </span>
                  <span className="block px-1 pb-1 text-[0.65rem] text-muted-foreground">
                    {midTruncate(item.name)}
                  </span>
                </button>
                <div className="pointer-events-none absolute left-1 top-1 z-20 flex gap-1 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={favorite ? "Remover favorito" : "Favoritar"}
                    className="flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
                    onClick={(event) => {
                      event.stopPropagation()
                      onPngMetaChange(togglePngFavorite(pngMeta, item.id))
                    }}
                  >
                    <Star className={cn("size-3.5", favorite && "fill-amber-300 text-amber-300")} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Apagar ${item.name}`}
                    className="flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
                    onClick={(event) => {
                      event.stopPropagation()
                      setConfirmDelete(item.id)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {confirmDelete === item.id ? (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1 bg-black/75 p-2 text-center text-[0.65rem] text-white">
                    <p>Apagar este PNG?</p>
                    <button
                      type="button"
                      className="rounded bg-white px-2 py-0.5 text-zinc-950"
                      onClick={() => {
                        void deleteItem(item, items, onItemsChange, onToast)
                        setConfirmDelete(null)
                      }}
                    >
                      Apagar
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : null}
                <div
                  className="absolute right-1 top-1 z-20"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <PngOverflowMenu
                    name={item.name}
                    favorite={favorite}
                    onRename={() => {
                      setRenamingId(item.id)
                      setDraftName(item.name)
                    }}
                    onFavorite={() => {
                      const previous = pngMeta
                      const next = togglePngFavorite(pngMeta, item.id)
                      onPngMetaChange(next)
                      onToast({
                        message: next.favorites.includes(item.id)
                          ? `"${item.name}" nos favoritos`
                          : `"${item.name}" removido dos favoritos`,
                        undo: () => onPngMetaChange(previous),
                      })
                    }}
                    onDelete={() => {
                      void deleteItem(item, items, onItemsChange, onToast)
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[0.7rem] font-medium",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed
          ? "border-brand bg-brand/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-brand/50",
      )}
    >
      {label}
    </button>
  )
}

function EmptyPngState({ filter, querying }: { filter: PngFilter; querying: boolean }) {
  if (querying) {
    return <p className="text-xs text-muted-foreground">Nenhum PNG com esse nome.</p>
  }
  if (filter === "recent") {
    return <p className="text-xs text-muted-foreground">Nenhum PNG recente. Insira um da grade para aparecer aqui.</p>
  }
  if (filter === "favorite") {
    return <p className="text-xs text-muted-foreground">Nenhum favorito ainda. Use ⋯ → Favoritar.</p>
  }
  return <p className="text-xs text-muted-foreground">Pasta vazia. Arraste PNGs para cá.</p>
}

function PngOverflowMenu({
  name,
  favorite,
  onRename,
  onFavorite,
  onDelete,
}: {
  name: string
  favorite: boolean
  onRename: () => void
  onFavorite: () => void
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
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            className={cn(
              "flex size-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm",
              "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
              "hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        }
      />
      <PopoverContent align="end" className="w-40 p-1">
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
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
          onClick={() => {
            onFavorite()
            setOpen(false)
          }}
        >
          <Star className={cn("size-3", favorite && "fill-current text-brand")} />
          {favorite ? "Desfavoritar" : "Favoritar"}
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

async function renameItem(
  item: LibraryPngItem,
  name: string,
  items: LibraryPngItem[],
  onItemsChange: (items: LibraryPngItem[]) => void,
  onToast: (toast: LibraryToast) => void,
) {
  const previous = item
  const response = await fetch(`/api/compose/stickers/media/${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  })
  const data = (await response.json()) as { item?: LibraryPngItem; error?: string }
  if (!response.ok || !data.item) {
    onToast({ message: data.error ?? "Não foi possível renomear." })
    return
  }
    onItemsChange(items.map((entry) => (entry.id === item.id ? data.item! : entry)))
  onToast({
    message: `PNG renomeado para "${data.item.name}"`,
    undo: () => {
      void (async () => {
        await fetch(`/api/compose/stickers/media/${encodeURIComponent(data.item!.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: previous.name }),
        })
        onItemsChange(items)
      })()
    },
  })
}

async function deleteItem(
  item: LibraryPngItem,
  items: LibraryPngItem[],
  onItemsChange: (items: LibraryPngItem[]) => void,
  onToast: (toast: LibraryToast) => void,
) {
  const blob = await fetch(item.mediaUrl).then((response) => response.blob()).catch(() => null)
  const response = await fetch(`/api/compose/stickers/media/${encodeURIComponent(item.id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    onToast({ message: "Não foi possível excluir o PNG." })
    return
  }
  onItemsChange(items.filter((entry) => entry.id !== item.id))
  onToast({
    message: `PNG "${item.name}" excluído`,
    undo: () => {
      if (!blob) return
      void (async () => {
        const file = new File([blob], item.name, { type: "image/png" })
        const body = new FormData()
        body.set("file", file)
        const restored = await fetch("/api/compose/stickers/library", { method: "POST", body })
        const data = (await restored.json()) as { item?: LibraryPngItem }
        if (data.item) onItemsChange([data.item, ...items.filter((entry) => entry.id !== item.id)])
      })()
    },
  })
}
