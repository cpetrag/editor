import { deepMerge, hasPath } from "./deep-merge.ts"
import { getPresetStyle } from "./presets.ts"
import type { InsertStyle, StyleLayer, StyleRef } from "./types.ts"

function nearestRef(
  insert: StyleLayer,
  track: StyleLayer | null,
  project: StyleLayer,
): StyleRef | undefined {
  return insert.styleRef ?? track?.styleRef ?? project.styleRef
}

export function resolveStyle(
  insert: StyleLayer,
  track: StyleLayer | null,
  project: StyleLayer,
): InsertStyle {
  const ref = nearestRef(insert, track, project)
  return deepMerge(
    getPresetStyle(ref?.presetId),
    project.styleRef?.overrides,
    track?.styleRef?.overrides,
    insert.styleRef?.overrides,
  )
}

export function fieldOrigin(
  path: string,
  insert: StyleLayer,
  track: StyleLayer | null,
  project: StyleLayer,
): "preset" | "projeto" | "faixa" | "insert" {
  if (hasPath(insert.styleRef?.overrides, path)) return "insert"
  if (hasPath(track?.styleRef?.overrides, path)) return "faixa"
  if (hasPath(project.styleRef?.overrides, path)) return "projeto"
  return "preset"
}
