"use client"

import { ChevronDown, Download } from "lucide-react"

import { ExportPanel, type ExportMenuProps } from "@/components/export/ExportPanel"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ExportAnchor } from "@/hooks/useExportController"
import { cn } from "@/lib/utils"

export type { ExportMenuActions, ExportMenuProps } from "@/components/export/ExportPanel"

export function ExportMenu({
  placement,
  ui,
  ...props
}: ExportMenuProps & {
  placement: ExportAnchor
  ui: {
    isOpen: (place: ExportAnchor) => boolean
    setOpen: (place: ExportAnchor, open: boolean) => void
    triggerLabel: (place: ExportAnchor) => string
  }
}) {
  const open = ui.isOpen(placement)
  const label = ui.triggerLabel(placement)
  const wide = placement === "footer"
  const showAlert = Boolean(props.finalExportError) || props.warnings.length > 0 || Boolean(props.pendingNote)
  const statusLabel = props.exporting || Boolean(props.finalExportError) || label.startsWith("✓")

  return (
    <Popover open={open} onOpenChange={(next) => ui.setOpen(placement, next)}>
      <PopoverTrigger
        render={
          <Button
            size={wide ? "lg" : "sm"}
            className={cn(
              "relative gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90",
              wide && "h-10 w-full text-sm font-semibold",
            )}
            aria-label={label}
            title={props.exporting ? props.exportStatus : (props.exportDisabledReason ?? label)}
          >
            {statusLabel ? (
              <span className={cn("truncate", wide ? "text-sm" : "font-mono text-xs tabular-nums")}>{label}</span>
            ) : (
              <>
                <Download data-icon="inline-start" />
                {label}
              </>
            )}
            {wide ? null : <ChevronDown className="size-3.5 opacity-80" />}
            {showAlert && !props.exporting ? (
              <span
                className={cn(
                  "absolute -right-1 -top-1 size-2.5 rounded-full ring-2 ring-background",
                  props.finalExportError ? "bg-destructive" : "bg-amber-400",
                )}
                aria-hidden
              />
            ) : null}
          </Button>
        }
      />
      <PopoverContent
        side={placement === "footer" ? "top" : "bottom"}
        align={placement === "footer" ? "center" : "end"}
        className="w-80 gap-3 p-3"
      >
        <ExportPanel {...props} onAfterExport={() => ui.setOpen(placement, false)} />
      </PopoverContent>
    </Popover>
  )
}
