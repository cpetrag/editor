"use client"

import { useRef, useState, type ReactNode } from "react"
import { Download, MoreHorizontal, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { PresetLibraryHandlers } from "@/components/style-customize-panel"
import { cn } from "@/lib/utils"

export function StylePresetMenu({
  presetLibrary,
  modified,
  positionTouched,
  isMine,
  showApplyToTrack,
  onSaveAs,
  saveLabel = "Salvar como…",
  onApplyClean,
  onResetStyle,
  onResetPosition,
  onApplyToTrack,
  onUpdate,
  onRename,
  onRemove,
}: {
  presetLibrary?: PresetLibraryHandlers
  modified: boolean
  positionTouched: boolean
  isMine: boolean
  showApplyToTrack?: boolean
  onSaveAs: () => void
  saveLabel?: string
  onApplyClean: () => void
  onResetStyle: () => void
  onResetPosition: () => void
  onApplyToTrack?: () => void
  onUpdate?: () => void
  onRename?: () => void
  onRemove?: () => void
}) {
  const [open, setOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  function pick(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Ações do estilo">
              <MoreHorizontal />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-52 gap-0.5 p-1">
          <MenuButton disabled={!presetLibrary} onClick={() => pick(onSaveAs)}>
            {saveLabel}
          </MenuButton>
          <MenuButton onClick={() => pick(onApplyClean)}>Aplicar limpo</MenuButton>
          <MenuButton disabled={!modified} onClick={() => pick(onResetStyle)}>
            Resetar estilo
          </MenuButton>
          <MenuButton disabled={!positionTouched} onClick={() => pick(onResetPosition)}>
            Resetar posição
          </MenuButton>
          {showApplyToTrack && onApplyToTrack ? (
            <MenuButton onClick={() => pick(onApplyToTrack)}>
              Aplicar a todos os textos
            </MenuButton>
          ) : null}
          {presetLibrary && isMine && onUpdate ? (
            <MenuButton onClick={() => pick(onUpdate)}>Atualizar</MenuButton>
          ) : null}
          {presetLibrary && isMine && onRename ? (
            <MenuButton onClick={() => pick(onRename)}>Renomear</MenuButton>
          ) : null}
          {presetLibrary && isMine && onRemove ? (
            <MenuButton destructive onClick={() => pick(onRemove)}>
              Excluir preset
            </MenuButton>
          ) : null}
          {presetLibrary ? (
            <>
              <MenuButton onClick={() => pick(presetLibrary.exportAll)}>
                <Download className="mr-1.5 inline size-3" aria-hidden />
                Exportar
              </MenuButton>
              <MenuButton
                onClick={() => {
                  setOpen(false)
                  importRef.current?.click()
                }}
              >
                <Upload className="mr-1.5 inline size-3" aria-hidden />
                Importar
              </MenuButton>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
      {presetLibrary ? (
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) presetLibrary.importFile(file)
            event.target.value = ""
          }}
        />
      ) : null}
    </>
  )
}

function MenuButton({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-40",
        destructive ? "text-destructive" : "text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
