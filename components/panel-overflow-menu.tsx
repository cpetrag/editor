"use client"

import { useState } from "react"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type PanelMenuItem = {
  id: string
  label: string
  disabled?: boolean
  destructive?: boolean
  confirmTitle?: string
  confirmBody?: string
  confirmLabel?: string
  onSelect: () => void
}

export function PanelOverflowMenu({
  label = "Mais ações",
  items,
}: {
  label?: string
  items: PanelMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pending = items.find((item) => item.id === pendingId) ?? null

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant="ghost" size="icon-xs" aria-label={label}>
              <MoreHorizontal />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-52 gap-0.5 p-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={cn(
                "flex w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-40",
                item.destructive ? "text-destructive" : "text-foreground",
              )}
              onClick={() => {
                setOpen(false)
                if (item.confirmTitle) {
                  setPendingId(item.id)
                  return
                }
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={() => setPendingId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-confirm-title"
            className="w-full max-w-sm rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="panel-confirm-title" className="text-sm font-semibold">
              {pending.confirmTitle}
            </h2>
            {pending.confirmBody ? (
              <p className="mt-1 text-xs text-muted-foreground">{pending.confirmBody}</p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPendingId(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  pending.onSelect()
                  setPendingId(null)
                }}
              >
                {pending.confirmLabel ?? "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
