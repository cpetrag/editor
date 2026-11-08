"use client"

import { INSERT_TYPE_MAP, formatTime, type Insert } from "@/lib/inserts"
import type { ClipMotionMarks } from "@/lib/motion/select"
import { insertLabel } from "@/lib/insert-ops"
import { stripMarks } from "@/lib/content/gallery"
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
  motion,
  onEmphasisMove,
  onEmphasisGesture,
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
  motion?: ClipMotionMarks
  onEmphasisMove?: (index: number, atFrame: number) => void
  onEmphasisGesture?: (phase: "start" | "end") => void
}) {
  const meta = INSERT_TYPE_MAP[insert.type]
  const marked = insert.text?.trim()
  const label = marked ? stripMarks(marked) || insertLabel(insert) : insertLabel(insert)
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
          "z-10 opacity-100 ring-2 ring-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.4)]",
        primary &&
          !pending &&
          "z-10 opacity-100 ring-[3px] ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.55)]",
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
      {motion && motion.enter > 0.004 ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-white/75 to-transparent"
          style={{ width: `${Math.min(100, motion.enter * 100)}%` }}
          aria-hidden
        />
      ) : null}
      {motion && motion.exit > 0.004 ? (
        <span
          className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-black/35 to-transparent"
          style={{ width: `${Math.min(100, motion.exit * 100)}%` }}
          aria-hidden
        />
      ) : null}
      {motion?.emphasis.map((diamond) => (
        <span
          key={diamond.index}
          role="slider"
          aria-label="Ênfase"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(diamond.ratio * 100)}
          className="absolute top-0 z-[2] size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border border-black/40 bg-white shadow"
          style={{ left: `${diamond.ratio * 100}%` }}
          onPointerDown={(event) => {
            event.stopPropagation()
            if (event.button !== 0 || !onEmphasisMove) return
            const bar = event.currentTarget.parentElement
            if (!bar) return
            onEmphasisGesture?.("start")
            const durationFrames = Math.max(1, insert.duration * 30)
            const move = (ev: PointerEvent) => {
              const rect = bar.getBoundingClientRect()
              const ratio = rect.width > 0 ? (ev.clientX - rect.left) / rect.width : 0
              onEmphasisMove(diamond.index, Math.round(Math.min(1, Math.max(0, ratio)) * durationFrames))
            }
            const up = () => {
              window.removeEventListener("pointermove", move)
              window.removeEventListener("pointerup", up)
              onEmphasisGesture?.("end")
            }
            window.addEventListener("pointermove", move)
            window.addEventListener("pointerup", up)
          }}
        />
      ))}
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
