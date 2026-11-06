"use client"

import { useEffect, useState } from "react"

import {
  loadPanelUi,
  savePanelBlocks,
  savePanelTab,
  togglePanelBlock,
  type PanelBlockScope,
  type PanelTabId,
} from "@/lib/panel-sections"

export type PanelBlockController = {
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  allOpen: boolean
}

export function usePanelTab(): [PanelTabId, (tab: PanelTabId) => void] {
  const [tab, setTab] = useState<PanelTabId | null>(null)

  useEffect(() => {
    setTab(loadPanelUi().tab)
  }, [])

  useEffect(() => {
    if (tab === null) return
    savePanelTab(tab)
  }, [tab])

  return [tab ?? "video", setTab]
}

export function usePanelBlocks(
  scope: PanelBlockScope,
  blockIds: readonly string[],
): PanelBlockController {
  const idsKey = blockIds.join("|")
  const [open, setOpen] = useState<string[] | null>(null)

  useEffect(() => {
    const allowed = new Set(idsKey.split("|").filter(Boolean))
    const stored = loadPanelUi().blocks[scope] ?? []
    setOpen(stored.filter((id) => allowed.has(id)))
  }, [idsKey, scope])

  useEffect(() => {
    if (open === null) return
    savePanelBlocks(scope, open)
  }, [open, scope])

  const current = open ?? []
  const allOpen = blockIds.length > 0 && blockIds.every((id) => current.includes(id))

  return {
    isOpen: (id) => current.includes(id),
    toggle: (id) => setOpen(togglePanelBlock(current, id)),
    expandAll: () => setOpen([...blockIds]),
    collapseAll: () => setOpen([]),
    allOpen,
  }
}
