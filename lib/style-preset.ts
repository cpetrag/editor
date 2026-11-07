import {
  insertKind,
  type CompositionInsert,
} from "./composition.ts"
import {
  groupCaptionLines,
  linesToCaptionInserts,
  replaceCaptionInserts,
} from "./captions.ts"
import { zoneForInsert, type RetentionBucket } from "./insert-ops.ts"
import {
  LEGADO_PRESET_ID,
  extraPresetCatalog,
  factoryPresetsInGroup,
  getPresetStyle,
  lookupNamedPreset,
} from "./style/presets.ts"
import { applyPresetToStyleRef } from "./style/edit-style.ts"
import { withSyncedComposeStyle } from "./style/resolve-insert-style.ts"
import { omitTransformOverrides } from "./insert-transform.ts"
import type { Preset, PresetGroup, StyleLayer, StyleRef, TrackId, UserPreset } from "./style/types.ts"

export type StyleChip = {
  id: string
  label: string
  group: PresetGroup
  mine?: boolean
}

function userChips(userPresets: UserPreset[], group: PresetGroup): StyleChip[] {
  return userPresets
    .filter((preset) => preset.group === group)
    .map((preset) => ({
      id: preset.id,
      label: preset.label,
      group: preset.group,
      mine: true,
    }))
}

export function applyPresetRef(current: StyleRef | undefined, presetId: string): StyleRef {
  return {
    presetId,
    overrides: omitTransformOverrides(current?.overrides),
  }
}

export function carryCaptionStyleRef(
  previous: CompositionInsert[],
  incoming: CompositionInsert[],
): CompositionInsert[] {
  const source = previous.find((insert) => insertKind(insert) === "caption")
  if (!source?.styleRef) return incoming
  return incoming.map((insert) => ({ ...insert, styleRef: source.styleRef }))
}

const NATIVE_CAPTION_LOOKS: StyleChip[] = [
  { id: "limpo", label: "Limpo", group: "legenda" },
  { id: "viral", label: "Viral", group: "legenda" },
]

export function isNativeCaptionLook(lookId: string): lookId is "limpo" | "viral" {
  return lookId === "limpo" || lookId === "viral"
}

export function captionStyleChips(userPresets: UserPreset[] = []): StyleChip[] {
  return [
    ...NATIVE_CAPTION_LOOKS,
    ...factoryPresetsInGroup("legenda"),
    ...userChips(userPresets, "legenda"),
  ]
}

export function activeCaptionLookId(
  inserts: CompositionInsert[],
  captionPreset: "viral" | "limpo",
): string | null {
  const captions = inserts.filter((insert) => insertKind(insert) === "caption")
  if (captions.length === 0) return null
  const ids = new Set(
    captions.map((insert) => {
      const presetId = insert.styleRef?.presetId
      if (!presetId || presetId === LEGADO_PRESET_ID) return captionPreset
      return presetId
    }),
  )
  if (ids.size !== 1) return null
  return [...ids][0] ?? null
}

export function applyCaptionLook(
  inserts: CompositionInsert[],
  lookId: string,
  options: {
    videoDuration: number
    mode?: "preserve" | "clean"
    catalog?: Record<string, UserPreset | Preset>
  },
): CompositionInsert[] {
  if (isNativeCaptionLook(lookId)) {
    return inserts.map((insert) =>
      insertKind(insert) === "caption" ? { ...insert, styleRef: undefined } : insert,
    )
  }
  return applyFactoryPreset(inserts, lookId, {
    selectedId: null,
    videoDuration: options.videoDuration,
    mode: options.mode,
    catalog: options.catalog,
  })
}

export function chipsForContext(
  insert: CompositionInsert | null,
  videoDuration: number,
  userPresets: UserPreset[] = [],
): StyleChip[] {
  if (!insert || insertKind(insert) === "caption") return []
  const zone = zoneForInsert(insert, videoDuration)
  return [...factoryPresetsInGroup(zone), ...userChips(userPresets, zone)]
}

export function trackStyleForInsert(
  insert: CompositionInsert,
  tracks: Partial<Record<TrackId, StyleLayer>> | undefined,
  videoDuration: number,
  catalog?: Record<string, Pick<Preset, "group">>,
): StyleLayer | null {
  if (!tracks) return null
  const zone = zoneForInsert(insert, videoDuration)
  const track = tracks[zone]
  if (!track?.styleRef) return null
  const group =
    lookupNamedPreset(track.styleRef.presetId, catalog ?? extraPresetCatalog())?.group
  if (insertKind(insert) === "caption") {
    return group === "legenda" ? track : null
  }
  return group === zone ? track : null
}

function regroupCaptions(
  inserts: CompositionInsert[],
  videoDuration: number,
  maxWords: number,
): CompositionInsert[] {
  const captions = inserts.filter((insert) => insertKind(insert) === "caption")
  const words = captions
    .flatMap((insert) => insert.words ?? [])
    .slice()
    .sort((a, b) => a.start - b.start)
  if (words.length === 0) return inserts
  const lines = groupCaptionLines(words, { maxWords })
  return replaceCaptionInserts(inserts, linesToCaptionInserts(lines, videoDuration))
}

export function applyFactoryPreset(
  inserts: CompositionInsert[],
  presetId: string,
  options: {
    selectedId: string | null
    videoDuration: number
    mode?: "preserve" | "clean"
    catalog?: Record<string, UserPreset | Preset>
  },
): CompositionInsert[] {
  const preset = lookupNamedPreset(presetId, options.catalog)
  if (!preset || presetId === LEGADO_PRESET_ID) return inserts

  let next = inserts
  if (preset.maxWords === 1) {
    next = regroupCaptions(next, options.videoDuration, 1)
  }

  const mode = options.mode ?? "preserve"
  const painted = getPresetStyle(presetId)
  const stamp = (insert: CompositionInsert): CompositionInsert => ({
    ...insert,
    styleRef: applyPresetToStyleRef(insert.styleRef, presetId, mode),
    ...(painted.text.rotation ? { rotation: painted.text.rotation } : { rotation: undefined }),
  })

  if (preset.group === "legenda") {
    return next.map((insert) => (insertKind(insert) === "caption" ? stamp(insert) : insert))
  }

  if (options.selectedId) {
    return next.map((insert) => (insert.id === options.selectedId ? stamp(insert) : insert))
  }

  const zone = preset.group as RetentionBucket
  return next.map((insert) =>
    insertKind(insert) !== "caption" && zoneForInsert(insert, options.videoDuration) === zone
      ? stamp(insert)
      : insert,
  )
}

export function applyLookToTrack(
  inserts: CompositionInsert[],
  tracks: Partial<Record<TrackId, StyleLayer>> | undefined,
  zone: TrackId,
  look: StyleRef,
  videoDuration: number,
): {
  inserts: CompositionInsert[]
  tracks: Partial<Record<TrackId, StyleLayer>>
} {
  const nextTracks: Partial<Record<TrackId, StyleLayer>> = {
    ...tracks,
    [zone]: { styleRef: { presetId: look.presetId, overrides: look.overrides ?? {} } },
  }
  const nextInserts = inserts.map((insert) => {
    if (zoneForInsert(insert, videoDuration) !== zone) return insert
    if (!trackStyleForInsert(insert, nextTracks, videoDuration)) return insert
    return { ...insert, styleRef: { presetId: look.presetId, overrides: {} } }
  })
  return { inserts: nextInserts, tracks: nextTracks }
}

export function applyLookToTextInserts(
  inserts: CompositionInsert[],
  tracks: Partial<Record<TrackId, StyleLayer>> | undefined,
  look: StyleRef,
): {
  inserts: CompositionInsert[]
  tracks: Partial<Record<TrackId, StyleLayer>>
} {
  return {
    tracks: tracks ?? {},
    inserts: inserts.map((insert) =>
      insertKind(insert) === "text"
        ? withSyncedComposeStyle({
            ...insert,
            styleRef: { presetId: look.presetId, overrides: {} },
          })
        : insert,
    ),
  }
}

export function stampCaptionStyleRefs(
  inserts: CompositionInsert[],
  styleRef: StyleRef,
): CompositionInsert[] {
  return inserts.map((insert) =>
    insertKind(insert) === "caption" ? { ...insert, styleRef } : insert,
  )
}
