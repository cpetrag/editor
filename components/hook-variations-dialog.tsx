"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export function HookVariationsDialog({
  open,
  initialHook,
  jobs,
  running,
  onClose,
  onExport,
}: {
  open: boolean
  initialHook: string
  jobs: { fileName: string; status: "queued" | "running" | "ok" | "error"; error: string | null }[]
  running: boolean
  onClose: () => void
  onExport: (hooks: string[]) => void
}) {
  const [fields, setFields] = useState<string[]>(() => [initialHook, "", ""])

  if (!open) return null
  const filled = fields.map((item) => item.trim()).filter(Boolean)
  const canExport = filled.length >= 2 && filled.length <= 5 && !running

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => {
        if (!running) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hook-variations-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="hook-variations-title" className="text-sm font-semibold text-foreground">
          Variações de gancho
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          De 2 a 5 textos. Cada um vira um MP4 Final, mudando só o gancho.
        </p>
        {filled.length < 2 ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
            Informe pelo menos 2 ganchos para exportar.
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {fields.map((value, index) => (
            <label key={index} className="flex flex-col gap-1 text-[0.7rem] text-muted-foreground">
              Gancho {index + 1}
              <input
                value={value}
                disabled={running}
                onChange={(event) =>
                  setFields((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                }
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={running || fields.length >= 5}
            onClick={() => setFields((current) => [...current, ""])}
          >
            Adicionar campo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={running || fields.length <= 2}
            onClick={() => setFields((current) => current.slice(0, -1))}
          >
            Remover último
          </Button>
        </div>
        {jobs.length > 0 ? (
          <ol className="mt-3 flex flex-col gap-1 text-xs">
            {jobs.map((job, index) => (
              <li key={job.fileName} className="flex justify-between gap-2">
                <span className="truncate">{job.fileName}</span>
                <span>
                  {job.status === "running"
                    ? `${index + 1}/${jobs.length}`
                    : job.status === "ok"
                      ? "ok"
                      : job.status === "error"
                        ? job.error || "erro"
                        : "na fila"}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={running} onClick={onClose}>
            Fechar
          </Button>
          <Button type="button" size="sm" disabled={!canExport} onClick={() => onExport(filled)}>
            Exportar variações
          </Button>
        </div>
      </div>
    </div>
  )
}
