"use client"

import { INSERT_TYPE_MAP, formatTime, type Insert } from "@/lib/inserts"
import { insertLabel } from "@/lib/insert-ops"
import type { TimelineHandle } from "@/lib/timeline-clip"
import { TIMELINE_CLIP_HEIGHT } from "@/lib/timeline-layout"
import { cn } from "@/lib/utils"

export function TimelineClipBar({
  insert,
  leftPct,
  widthPct,
  top,
  showLabel,
  selected,
  primary,
  showHandles,
  pending = false,
  disabled,
  onPointerDown,
  onContextMenu,
}: {
  insert: Insert
  leftPct: number
  widthPct: number
  top: number
  showLabel: boolean
  selected: boolean
  primary: boolean
  showHandles: boolean
  pending?: boolean
  disabled: boolean
  onPointerDown: (event: React.PointerEvent, handle: TimelineHandle) => void
  onContextMenu?: (event: React.MouseEvent) => void
}) {
  const meta = INSERT_TYPE_MAP[insert.type]
  const label = insertLabel(insert)
  const range = `${formatTime(insert.start)} → ${formatTime(insert.start + insert.duration)}`

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label} · ${range}`}
      aria-pressed={selected}
      data-timeline-clip
      className={cn(
        "absolute flex items-center overflow-hidden rounded-[4px] opacity-90",
        !pending && "ring-1 ring-black/40",
        selected &&
          !primary &&
          !pending &&
          "z-10 opacity-100 ring-2 ring-brand/80 shadow-[0_0_8px_color-mix(in_oklch,var(--brand)_50%,transparent)]",
        primary &&
          !pending &&
          "z-10 opacity-100 ring-[3px] ring-brand shadow-[0_0_12px_color-mix(in_oklch,var(--brand)_75%,transparent)]",
        pending &&
          "z-30 border-2 border-dashed border-amber-300 opacity-100 outline outline-2 outline-dashed outline-amber-300 outline-offset-1 ring-0",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: `${leftPct}%`,
        width: `max(${Math.max(widthPct, 0.2)}%, 6px)`,
        top,
        height: TIMELINE_CLIP_HEIGHT,
        backgroundColor: meta?.dotVar ?? "var(--muted-foreground)",
      }}
      title={`${label} · ${range}`}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextMenu?.(event)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.button !== 0) return
        onPointerDown(event, "move")
      }}
    >
      {showLabel ? (
        <span className="pointer-events-none truncate px-2 text-[0.62rem] font-medium leading-none text-white [text-shadow:0_1px_1px_rgb(0_0_0/0.55)]">
          {label}
        </span>
      ) : null}
      {showHandles ? (
        <>
          <span
            className="absolute inset-y-0 left-0 z-[1] w-2 cursor-ew-resize rounded-l-[4px] bg-white/35"
            aria-hidden
            onPointerDown={(event) => {
              event.stopPropagation()
              if (event.button !== 0) return
              onPointerDown(event, "in")
            }}
          />
          <span
            className="absolute inset-y-0 right-0 z-[1] w-2 cursor-ew-resize rounded-r-[4px] bg-white/35"
            aria-hidden
            onPointerDown={(event) => {
              event.stopPropagation()
              if (event.button !== 0) return
              onPointerDown(event, "out")
            }}
          />
        </>
      ) : null}
    </div>
  )
}
