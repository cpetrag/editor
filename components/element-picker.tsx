"use client"

import { useState } from "react"
import { LayoutTemplate, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  INSERT_TYPE_MAP,
  TEMPLATES,
  pickerInsertTypes,
  type InsertType,
  type Template,
} from "@/lib/inserts"

export function ElementPicker({
  activeTemplateId,
  onAddElement,
  onApplyTemplate,
}: {
  activeTemplateId: string | null
  onAddElement: (type: InsertType) => void
  onApplyTemplate: (template: Template) => void
}) {
  const [open, setOpen] = useState(false)
  const types = pickerInsertTypes()

  function pickElement(type: InsertType) {
    onAddElement(type)
    setOpen(false)
  }

  function pickTemplate(template: Template) {
    onApplyTemplate(template)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus data-icon="inline-start" />
            Elemento
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-h-[min(70vh,32rem)] overflow-y-auto">
        <PopoverHeader>
          <PopoverTitle>Adicionar elemento</PopoverTitle>
          <p className="text-xs text-muted-foreground">
            Nada é criado até você escolher um tipo ou um combo.
          </p>
        </PopoverHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1.5">
            {types.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => pickElement(item.value)}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-left hover:border-brand/50 hover:bg-accent"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-bold text-background"
                  style={{ backgroundColor: item.dotVar }}
                  aria-hidden
                >
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 truncate text-xs font-medium text-foreground">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutTemplate className="size-3" />
              Combos
            </p>
            {TEMPLATES.map((template) => {
              const isActive = template.id === activeTemplateId
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => pickTemplate(template)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-md border p-2 text-left",
                    isActive
                      ? "border-brand bg-brand/10"
                      : "border-border bg-card hover:border-brand/50 hover:bg-accent",
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">{template.name}</span>
                  <span className="text-[0.7rem] text-muted-foreground">{template.description}</span>
                  <span className="flex flex-wrap gap-1">
                    {template.inserts.map((insert, index) => (
                      <span
                        key={`${template.id}-${index}`}
                        className="rounded bg-muted px-1 py-0.5 text-[0.6rem] text-muted-foreground"
                      >
                        {INSERT_TYPE_MAP[insert.type]?.label ?? insert.type}
                      </span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
