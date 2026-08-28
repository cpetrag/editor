"use client"

import { useSyncExternalStore } from "react"

import { finalExportTask, type FinalTaskSnapshot } from "@/lib/export/final-task"

export function useFinalExportTask(): FinalTaskSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => finalExportTask.subscribe(onStoreChange),
    () => finalExportTask.getSnapshot(),
    () => finalExportTask.getSnapshot(),
  )
}
