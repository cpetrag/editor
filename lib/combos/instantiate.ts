import { insertKind, MIN_DURATION, type CompositionInsert } from "../composition.ts"
import { PLAY_W } from "../compose/layout.ts"
import { applyTextPreset, getTextPreset, isTextPresetId } from "../text-presets/index.ts"
import { createInsert } from "../inserts.ts"
import { comboVideoDuration, resolveBeatTime } from "./resolve.ts"
import type { ComboBeat, ComboTemplate } from "./schema.ts"

function beatToInsert(beat: ComboBeat, videoDuration: number): CompositionInsert {
  const time = resolveBeatTime(beat, videoDuration)
  const duration = Math.max(MIN_DURATION, time.duration)
  if (beat.kind === "text") {
    const presetId = beat.presetId && isTextPresetId(beat.presetId) ? beat.presetId : "impacto"
    const created = applyTextPreset(createInsert("texto-livre"), presetId)
    return {
      ...created,
      text: beat.text ?? created.text,
      start: time.start,
      duration,
      x: beat.x,
      y: beat.y,
      fontSize: Math.round(getTextPreset(presetId).size.ratio * PLAY_W * beat.scale),
      rotation: beat.rotate,
    }
  }
  const created = createInsert(beat.elementId ?? "selo-frete")
  return {
    ...created,
    text: beat.text ?? created.text,
    start: time.start,
    duration,
    x: beat.x,
    y: beat.y,
    scale: beat.scale,
    rotation: beat.rotate,
  }
}

export function instantiateCombo(
  combo: ComboTemplate,
  videoDuration: number,
): CompositionInsert[] {
  return combo.beats.map((beat) => beatToInsert(beat, comboVideoDuration(videoDuration)))
}

export function applyComboToInserts(
  previous: CompositionInsert[],
  combo: ComboTemplate,
  videoDuration: number,
): CompositionInsert[] {
  const captions = previous.filter((insert) => insertKind(insert) === "caption")
  return [...instantiateCombo(combo, videoDuration), ...captions]
}

