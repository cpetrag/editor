"use client"

import { Film, LibraryBig, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

export type EditorTab = "editor" | "library" | "batch"

interface EditorNavProps {
  active: EditorTab
  onChange: (tab: EditorTab) => void
}

const ITEMS: { id: EditorTab; label: string; icon: typeof Film }[] = [
  { id: "editor", label: "Editor", icon: Film },
  { id: "library", label: "Biblioteca", icon: LibraryBig },
  { id: "batch", label: "Lote", icon: Copy },
]

export function EditorNav({ active, onChange }: EditorNavProps) {
  return (
    <nav
      aria-label="Navegação do editor"
      className="flex shrink-0 flex-row items-center gap-1 border-b border-border bg-card px-2 py-2 lg:flex-col lg:border-b-0 lg:border-r lg:px-2 lg:py-4"
    >
      <span
        className="mb-0 flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground lg:mb-3"
        aria-hidden
      >
        <Film className="size-5" />
      </span>
      {ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[0.7rem] font-medium transition-colors lg:w-16",
              isActive
                ? "bg-brand/15 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
