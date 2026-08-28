"use client"

import { INSERT_TYPE_MAP, formatTime, type Insert } from "@/lib/inserts"
import { insertLabel } from "@/lib/insert-ops"
import type { TimelineHandle } from "@/lib/timeline-clip"
import { cn } from "@/lib/utils"

export function TimelineClipBar({
  insert,
  leftPct,
  widthPct,
  top,
  selected,
  disabled,
  onPointerDown,
}: {
  insert: Insert
  leftPct: number
  widthPct: number
  top: number
  selected: boolean
  disabled: boolean
  onPointerDown: (event: React.PointerEvent, handle: TimelineHandle) => void
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
      className={cn(
        "absolute h-3 rounded-[3px] opacity-90 ring-1 ring-black/40",
        selected && "z-10 ring-2 ring-brand",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 1)}%`,
        top,
        backgroundColor: meta.dotVar,
      }}
      title={`${label} · ${range}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => onPointerDown(event, "move")}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 z-[1] w-2 cursor-ew-resize rounded-l-[3px]",
          selected && "bg-white/35",
        )}
        aria-hidden
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown(event, "in")
        }}
      />
      <span
        className={cn(
          "absolute inset-y-0 right-0 z-[1] w-2 cursor-ew-resize rounded-r-[3px]",
          selected && "bg-white/35",
        )}
        aria-hidden
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown(event, "out")
        }}
      />
    </div>
  )
}
