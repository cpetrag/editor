import { nonCaptionInserts } from "./caption-panel.ts"
import {
  createDefaultComposition,
  insertKind,
  type Composition,
} from "./composition.ts"

export function newProjectComposition(): Composition {
  return createDefaultComposition()
}

export function clearInsertsArt(composition: Composition): Composition {
  const fresh = createDefaultComposition()
  return {
    ...composition,
    inserts: [],
    captionPreset: fresh.captionPreset,
    captionStyle: { ...fresh.captionStyle },
    tracks: fresh.tracks,
    styleRef: undefined,
  }
}

export function clearCaptionInsertsArt(composition: Composition): Composition {
  return {
    ...composition,
    inserts: nonCaptionInserts(composition.inserts),
  }
}

export function projectFileIds(
  composition: Composition,
  extraIds: string[] = [],
): string[] {
  const ids = new Set<string>()
  const sourceId = composition.source.fileId
  if (sourceId) ids.add(sourceId)
  for (const insert of composition.inserts) {
    if (insertKind(insert) === "sticker" && insert.fileId) ids.add(insert.fileId)
  }
  for (const extra of extraIds) {
    if (extra) ids.add(extra)
  }
  return [...ids]
}
