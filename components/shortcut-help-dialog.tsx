"use client"

import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { SHORTCUT_HELP } from "@/lib/editor-shortcuts"

export function ShortcutHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="text-sm font-semibold">Atalhos de teclado</Dialog.Title>
            <Dialog.Close
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-5 pt-3 text-xs text-muted-foreground">
            Os atalhos não disparam enquanto você digita em um campo de texto.
          </Dialog.Description>
          <div className="grid gap-x-8 gap-y-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            {SHORTCUT_HELP.map((group) => (
              <section key={group.title} aria-labelledby={`shortcut-group-${group.title}`}>
                <h3
                  id={`shortcut-group-${group.title}`}
                  className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {group.title}
                </h3>
                <dl className="flex flex-col gap-1.5">
                  {group.entries.map((entry) => (
                    <div key={`${entry.keys.join("+")}-${entry.description}`} className="flex items-center justify-between gap-3 text-xs">
                      <dt className="text-foreground">{entry.description}</dt>
                      <dd className="flex shrink-0 items-center gap-1">
                        {entry.keys.map((key) => (
                          <kbd
                            key={key}
                            className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[0.65rem] text-foreground"
                          >
                            {key}
                          </kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
