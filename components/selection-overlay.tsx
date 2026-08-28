"use client"

import type { PlayBox } from "@/lib/compose/hit-test"
import {
  playBoxToCss,
  type CanvasDisplayMetrics,
  type RectLike,
} from "@/lib/compose/layout"
import { cn } from "@/lib/utils"

export type ResizeCorner = "nw" | "ne" | "sw" | "se"
export type ResizeEdge = "e" | "w"

const CORNERS: ResizeCorner[] = ["nw", "ne", "sw", "se"]

const CORNER_CLASS: Record<ResizeCorner, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
}

const CORNER_LABEL: Record<ResizeCorner, string> = {
  nw: "Redimensionar canto superior esquerdo",
  ne: "Redimensionar canto superior direito",
  sw: "Redimensionar canto inferior esquerdo",
  se: "Redimensionar canto inferior direito",
}

const HANDLE =
  "absolute size-2.5 rounded-[2px] border border-sky-300 bg-white shadow-sm"

type SelectionOverlayProps = {
  box: PlayBox
  metrics: CanvasDisplayMetrics
  host: RectLike
} & (
  | {
      ghost: true
    }
  | {
      ghost?: false
      showEdgeHandles?: boolean
      showRotate?: boolean
      onMovePointerDown: (event: React.PointerEvent) => void
      onResizePointerDown: (corner: ResizeCorner, event: React.PointerEvent) => void
      onEdgePointerDown: (edge: ResizeEdge, event: React.PointerEvent) => void
      onRotatePointerDown: (event: React.PointerEvent) => void
    }
)

export function SelectionOverlay(props: SelectionOverlayProps) {
  const { box, metrics, host, ghost = false } = props
  const css = playBoxToCss(box, metrics, host)
  return (
    <div
      className={cn(
        "absolute z-[1] border",
        ghost
          ? "pointer-events-none border-dashed border-sky-400/70 bg-transparent opacity-25"
          : "cursor-move border-sky-400/90 shadow-[0_0_0_1px_rgba(15,23,42,0.35)]",
      )}
      style={{
        left: css.left,
        top: css.top,
        width: Math.max(css.width, 12),
        height: Math.max(css.height, 12),
        transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      onPointerDown={ghost ? undefined : props.onMovePointerDown}
    >
      <span className="sr-only">
        {ghost
          ? "Insert fora da janela de tempo"
          : "showRotate" in props && props.showRotate === false
            ? "Enquadrar vídeo"
            : "Mover overlay"}
      </span>
      {ghost ? null : (
        <>
          {props.showRotate !== false ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 bottom-full h-5 w-px -translate-x-1/2 bg-sky-400"
              />
              <button
                type="button"
                aria-label="Girar"
                className="absolute left-1/2 bottom-full mb-5 size-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-sky-400 bg-white"
                onPointerDown={(event) => {
                  event.stopPropagation()
                  props.onRotatePointerDown(event)
                }}
              />
            </>
          ) : null}
          {props.showEdgeHandles
            ? (
                <>
                  <button
                    type="button"
                    aria-label="Largura esquerda"
                    className={cn(HANDLE, "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize")}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      props.onEdgePointerDown("w", event)
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Largura direita"
                    className={cn(HANDLE, "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize")}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      props.onEdgePointerDown("e", event)
                    }}
                  />
                </>
              )
            : null}
          {CORNERS.map((corner) => (
            <button
              key={corner}
              type="button"
              aria-label={CORNER_LABEL[corner]}
              className={cn(HANDLE, CORNER_CLASS[corner])}
              onPointerDown={(event) => {
                event.stopPropagation()
                props.onResizePointerDown(corner, event)
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
