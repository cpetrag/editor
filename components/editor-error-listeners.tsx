"use client"

import { useEffect } from "react"

import { installEditorErrorListeners } from "@/lib/export/editor-errors"
import { finalExportTask } from "@/lib/export/final-task"

export function EditorErrorListeners() {
  useEffect(() => {
    return installEditorErrorListeners((_message, error) => {
      finalExportTask.reportExternalError(error)
    })
  }, [])
  return null
}
