"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { scrollIntoPanelViewport } from "@/lib/scroll-panel"
import { cn } from "@/lib/utils"

export function CollapsibleBlock({
  title,
  summary,
  open,
  onToggle,
  headerAside,
  children,
}: {
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  headerAside?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const wasOpen = useRef(open)

  useEffect(() => {
    const becameOpen = open && !wasOpen.current
    wasOpen.current = open
    if (!becameOpen) return
    const element = ref.current
    if (!element) return
    const run = () => scrollIntoPanelViewport(element)
    const frame = window.requestAnimationFrame(run)
    const timer = window.setTimeout(run, 160)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [open])

  return (
    <section ref={ref} data-collapsible-block className="rounded-md border border-border">
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-2 text-left"
          aria-expanded={open}
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          <span className="shrink-0 text-xs font-medium text-foreground">{title}</span>
          {!open && summary ? (
            <span className="truncate text-xs text-muted-foreground">· {summary}</span>
          ) : null}
        </button>
        {headerAside}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden" inert={open ? undefined : true}>
          <div className="flex flex-col gap-3 border-t border-border p-2.5">{children}</div>
        </div>
      </div>
    </section>
  )
}

export function BlockToolbar({
  allOpen,
  onExpandAll,
  onCollapseAll,
  hidden = false,
}: {
  allOpen: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
  /** Reserva a largura mesmo quando a subaba não usa o botão. */
  hidden?: boolean
}) {
  return (
    <button
      type="button"
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      className={cn(
        "w-[7.5rem] shrink-0 rounded-md px-2 py-1 text-center text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
        hidden && "invisible",
      )}
      onClick={hidden ? undefined : allOpen ? onCollapseAll : onExpandAll}
    >
      {allOpen ? "Recolher tudo" : "Expandir tudo"}
    </button>
  )
}

export function PanelSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        "relative h-4 w-7 shrink-0 rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-brand" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-3 rounded-full bg-background shadow-sm transition-transform duration-150",
          checked ? "translate-x-3.5" : "translate-x-0.5",
        )}
        aria-hidden
      />
    </button>
  )
}
