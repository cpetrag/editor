import type { CompositionInsert } from "../composition.ts"
import { offerStylePatch } from "../style/offer-styles.ts"
import { getPresetStyle, LEGADO_PRESET_ID } from "../style/presets.ts"
import type { InsertStyle } from "../style/types.ts"
import { scalePaintStyle } from "./draw.ts"

/** Inclinação do estilo nomeado. Soma com a rotação do insert; não a substitui. */
export function presetTiltOf(insert: Pick<CompositionInsert, "styleRef">): number {
  const presetId = insert.styleRef?.presetId
  if (!presetId || presetId === LEGADO_PRESET_ID) return 0
  return getPresetStyle(presetId).text.rotation ?? 0
}

function keepsFactorySize(insert: Pick<CompositionInsert, "styleRef">): boolean {
  const presetId = insert.styleRef?.presetId
  return Boolean(presetId) && presetId !== LEGADO_PRESET_ID && !offerStylePatch(presetId ?? "")
}

/**
 * O preset e os overrides já estão em `style`.
 * O layout do insert (x, y, rotação, escala, maxWidth, alinhamento) vence em seguida.
 * Rotação desenhada = inclinação do preset + rotação do insert.
 * `scale` multiplica fonte, padding e contornos. Sem scale, `fontSize` do insert
 * (exceto nos 16 de fábrica) substitui só o tamanho da fonte.
 */
export function applyInsertLayout(
  style: InsertStyle,
  insert: Pick<
    CompositionInsert,
    "x" | "y" | "rotation" | "scale" | "fontSize" | "maxWidthPct" | "textAlign" | "styleRef" | "transform"
  >,
  presetRotation = 0,
  presetFontSize?: number,
): InsertStyle {
  const scale =
    typeof insert.scale === "number" && Number.isFinite(insert.scale) && insert.scale > 0
      ? insert.scale
      : 1
  const scaled = scalePaintStyle(style, scale)
  const userRotation =
    typeof insert.rotation === "number" && Number.isFinite(insert.rotation) ? insert.rotation : null
  // Nos 16 de fábrica, x/y/caixa achatados só vencem depois que o usuário move.
  // Sem isso o padrão 50/35 cobriria o y do Hormozi.
  const place = !keepsFactorySize(insert) || insert.transform?.touchedByUser === true
  const fontSize =
    scale !== 1 && typeof presetFontSize === "number"
      ? presetFontSize * scale
      : scale === 1 && !keepsFactorySize(insert) && typeof insert.fontSize === "number"
        ? insert.fontSize
        : scaled.text.fontSize
  return {
    ...scaled,
    text: {
      ...scaled.text,
      fontSize,
      ...(place && typeof insert.x === "number" ? { x: insert.x } : {}),
      ...(place && typeof insert.y === "number" ? { y: insert.y } : {}),
      ...(place && typeof insert.maxWidthPct === "number" ? { maxWidth: insert.maxWidthPct } : {}),
      ...(insert.textAlign ? { textAlign: insert.textAlign } : {}),
      ...(userRotation === null ? {} : { rotation: presetRotation + userRotation }),
    },
  }
}
