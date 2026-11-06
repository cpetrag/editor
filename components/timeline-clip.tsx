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
  disabled,
  onPointerDown,
}: {
  insert: Insert
  leftPct: number
  widthPct: number
  top: number
  showLabel: boolean
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
      data-timeline-clip
      className={cn(
        "absolute flex items-center overflow-hidden rounded-[4px] opacity-90 ring-1 ring-black/40",
        selected && "z-10 opacity-100 ring-2 ring-brand",
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
      onPointerDown={(event) => onPointerDown(event, "move")}
    >
      {showLabel ? (
        <span className="pointer-events-none truncate px-2 text-[0.62rem] font-medium leading-none text-white [text-shadow:0_1px_1px_rgb(0_0_0/0.55)]">
          {label}
        </span>
      ) : null}
      <span
        className={cn(
          "absolute inset-y-0 left-0 z-[1] w-2 cursor-ew-resize rounded-l-[4px]",
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
          "absolute inset-y-0 right-0 z-[1] w-2 cursor-ew-resize rounded-r-[4px]",
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
