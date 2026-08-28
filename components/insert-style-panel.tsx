"use client"

import { useEffect, useId, useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { FONT_OPTIONS } from "@/lib/inserts"
import { FontOptionLabel } from "@/components/font-option-label"
import { TextPresetChips } from "@/components/text-preset-chips"
import { applyFontFamily, applyTextPreset, DEFAULT_TEXT_PRESET_ID, isTextPresetId } from "@/lib/text-presets"
import { hasInsertOverrides } from "@/lib/style/edit-style"
import {
  WEIGHTS_BY_FONT,
  clampFontWeight,
  SHOPEE_COLOR_SWATCHES,
  SHADOW_PRESETS,
  parseCssColor,
  patchInsertStyle,
  type FontId,
  type FontWeight,
  type InsertStyle,
  type ShadowPreset,
} from "@/lib/compose/insert-style"
import {
  CHIP_FONT_SIZE_MIN,
  DEFAULT_CAPTION_FONT_SIZE,
  DEFAULT_CHIP_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  insertHasFontSize,
  insertKind,
  type CaptionStyle,
  type CompositionInsert as Insert,
} from "@/lib/composition"

function rangeGestureHandlers(onBegin?: () => void, onEnd?: () => void) {
  return {
    onPointerDown: (event: React.PointerEvent<HTMLInputElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      onBegin?.()
    },
    onPointerUp: () => onEnd?.(),
    onPointerCancel: () => onEnd?.(),
    onLostPointerCapture: () => onEnd?.(),
  }
}

export function ColorField({
  id,
  label,
  value,
  allowEmpty,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  allowEmpty?: boolean
  onChange: (next: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? "")

  useEffect(() => {
    setDraft(value ?? "")
  }, [value])

  function commit(next: string) {
    const trimmed = next.trim()
    if (allowEmpty && (trimmed === "" || trimmed.toLowerCase() === "none")) {
      onChange(null)
      return
    }
    const parsed = parseCssColor(trimmed)
    if (!parsed) {
      setDraft(value ?? "")
      return
    }
    onChange(parsed)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowEmpty ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              "h-7 rounded-md border px-2 text-[0.7rem] font-medium",
              value === null
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            Sem fundo
          </button>
        ) : null}
        {SHOPEE_COLOR_SWATCHES.map((swatch) => {
          const active = (value ?? "").toUpperCase() === swatch.hex
          return (
            <button
              key={swatch.id}
              type="button"
              aria-label={swatch.label}
              aria-pressed={active}
              onClick={() => onChange(swatch.hex)}
              className={cn(
                "size-7 rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground" : "border-border hover:border-foreground/50",
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          )
        })}
        <Input
          id={id}
          value={draft}
          placeholder="#FFFFFF"
          className="h-7 min-w-[6.5rem] flex-1 font-mono text-xs"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
      </div>
    </Field>
  )
}

export function InsertStyleFields({
  insert,
  brandFontId,
  onChange,
  onBeginInsertGesture,
  onEndInsertGesture,
  captionStyle,
  onChangeCaptionStyle,
}: {
  insert: Insert
  brandFontId: string
  onChange: (id: string, patch: Partial<Insert>) => void
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  captionStyle?: CaptionStyle
  onChangeCaptionStyle?: (patch: Partial<CaptionStyle>) => void
}) {
  const kind = insertKind(insert)
  const style = patchInsertStyle(insert, {}, brandFontId)
  const weightOptions = WEIGHTS_BY_FONT[style.fontFamily] ?? [400]
  const weightValue = clampFontWeight(style.fontFamily, style.fontWeight)
  const weightLocked = weightOptions.length === 1
  const showFontSize = insertHasFontSize(insert)
  const fontSizeMin = kind === "text" || kind === "caption" ? FONT_SIZE_MIN : CHIP_FONT_SIZE_MIN
  const fontSizeValue =
    insert.fontSize ??
    (kind === "caption"
      ? DEFAULT_CAPTION_FONT_SIZE
      : kind === "text"
        ? DEFAULT_TEXT_FONT_SIZE
        : DEFAULT_CHIP_FONT_SIZE)
  const advancedId = useId()
  const [advancedOpen, setAdvancedOpen] = useState(
    style.opacity !== 1 || style.rotation !== 0,
  )

  function update(patch: Partial<InsertStyle>) {
    onChange(insert.id, {
      style: patchInsertStyle(insert, patch, brandFontId),
      ...(typeof patch.rotation === "number" ? { rotation: patch.rotation } : {}),
    })
  }

  if (kind === "caption" && captionStyle && onChangeCaptionStyle) {
    const weightOptions = WEIGHTS_BY_FONT[captionStyle.fontFamily] ?? [400]
    const weightValue = clampFontWeight(captionStyle.fontFamily, captionStyle.fontWeight)
    const weightLocked = weightOptions.length === 1
    return (
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={`font-${insert.id}`}>Fonte</FieldLabel>
          <Select
            value={captionStyle.fontFamily}
            onValueChange={(value) => onChangeCaptionStyle({ fontFamily: value as FontId })}
          >
            <SelectTrigger id={`font-${insert.id}`} className="h-auto min-h-9 w-full py-1.5 *:data-[slot=select-value]:line-clamp-none">
              <SelectValue>
                {(value) => (
                  <FontOptionLabel
                    font={FONT_OPTIONS.find((item) => item.id === value)}
                    fallback={value}
                  />
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FONT_OPTIONS.map((font) => (
                  <SelectItem key={font.id} value={font.id} className="h-auto items-start py-1.5">
                    <FontOptionLabel font={font} fallback={font.id} />
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor={`font-size-${insert.id}`}>
            Tamanho da fonte
            <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
              {captionStyle.fontSize}px
            </span>
          </FieldLabel>
          <input
            id={`font-size-${insert.id}`}
            type="range"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={captionStyle.fontSize}
            onChange={(event) => onChangeCaptionStyle({ fontSize: Number(event.target.value) })}
            {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
            className="h-7 w-full accent-brand"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`weight-${insert.id}`}>Peso</FieldLabel>
          <Select
            disabled={weightLocked}
            value={String(weightValue)}
            onValueChange={(value) =>
              onChangeCaptionStyle({ fontWeight: Number(value) as FontWeight })
            }
          >
            <SelectTrigger id={`weight-${insert.id}`} className="w-full" disabled={weightLocked}>
              <SelectValue>
                {(value) => (weightLocked ? "peso fixo" : value)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {weightOptions.map((weight) => (
                  <SelectItem key={weight} value={String(weight)}>
                    {weight}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <ColorField
          id={`color-${insert.id}`}
          label="Cor"
          value={captionStyle.color}
          onChange={(color) => {
            if (color) onChangeCaptionStyle({ color })
          }}
        />
        <ColorField
          id={`highlight-${insert.id}`}
          label="Destaque"
          value={captionStyle.highlightColor}
          onChange={(highlightColor) => {
            if (highlightColor) onChangeCaptionStyle({ highlightColor })
          }}
        />
        <ColorField
          id={`bg-${insert.id}`}
          label="Fundo"
          value={captionStyle.bgColor}
          onChange={(bgColor) => {
            if (bgColor) onChangeCaptionStyle({ bgColor })
          }}
        />
        <Field>
          <FieldLabel htmlFor={`stroke-${insert.id}`}>
            Contorno
            <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
              {captionStyle.strokeWidth}px
            </span>
          </FieldLabel>
          <input
            id={`stroke-${insert.id}`}
            type="range"
            min={0}
            max={12}
            step={1}
            value={captionStyle.strokeWidth}
            onChange={(event) => onChangeCaptionStyle({ strokeWidth: Number(event.target.value) })}
            {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
            className="h-7 w-full accent-brand"
          />
          <ColorField
            id={`stroke-color-${insert.id}`}
            label="Cor do contorno"
            value={captionStyle.strokeColor}
            onChange={(strokeColor) => {
              if (strokeColor) onChangeCaptionStyle({ strokeColor })
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`rotation-${insert.id}`}>
            Rotação
            <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
              {Math.round(captionStyle.rotation)}°
            </span>
          </FieldLabel>
          <input
            id={`rotation-${insert.id}`}
            type="number"
            step={1}
            value={captionStyle.rotation}
            onChange={(event) => onChangeCaptionStyle({ rotation: Number(event.target.value) })}
            {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
            className="h-7 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
          />
        </Field>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {kind === "text" ? (
        <TextPresetChips
          selectedId={insert.preset}
          modified={hasInsertOverrides(insert.styleRef)}
          onSelect={(id) => onChange(insert.id, applyTextPreset(insert, id))}
          onReset={() =>
            onChange(
              insert.id,
              applyTextPreset(
                insert,
                isTextPresetId(insert.preset) ? insert.preset : DEFAULT_TEXT_PRESET_ID,
              ),
            )
          }
        />
      ) : null}

      {kind === "sticker" ? (
        <p className="text-xs text-muted-foreground">
          PNG não usa fonte. Opacidade e rotação ficam em Avançado. Escala está em Movimento.
        </p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor={`font-${insert.id}`}>Fonte</FieldLabel>
            <Select
              value={style.fontFamily}
              onValueChange={(value) => onChange(insert.id, applyFontFamily(insert, value))}
            >
              <SelectTrigger id={`font-${insert.id}`} className="h-auto min-h-9 w-full py-1.5 *:data-[slot=select-value]:line-clamp-none">
                <SelectValue>
                  {(value) => (
                    <FontOptionLabel
                      font={FONT_OPTIONS.find((item) => item.id === value)}
                      fallback={value}
                    />
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font.id} value={font.id} className="h-auto items-start py-1.5">
                      <FontOptionLabel font={font} fallback={font.id} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {showFontSize ? (
            <Field>
              <FieldLabel htmlFor={`font-size-${insert.id}`}>
                Tamanho da fonte
                <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
                  {fontSizeValue}px
                </span>
              </FieldLabel>
              <input
                id={`font-size-${insert.id}`}
                type="range"
                min={fontSizeMin}
                max={FONT_SIZE_MAX}
                step={1}
                value={fontSizeValue}
                onChange={(event) =>
                  onChange(insert.id, { fontSize: Number(event.target.value) })
                }
                {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
                className="h-7 w-full accent-brand"
              />
            </Field>
          ) : null}

          <div className={kind === "caption" ? undefined : "grid grid-cols-2 gap-3"}>
            <Field>
              <FieldLabel htmlFor={`weight-${insert.id}`}>Peso</FieldLabel>
              <Select
                disabled={weightLocked}
                value={String(weightValue)}
                onValueChange={(value) => update({ fontWeight: Number(value) as FontWeight })}
              >
                <SelectTrigger id={`weight-${insert.id}`} className="w-full" disabled={weightLocked}>
                  <SelectValue>
                    {(value) => (weightLocked ? "peso fixo" : value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {weightOptions.map((weight) => (
                      <SelectItem key={weight} value={String(weight)}>
                        {weight}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {kind !== "caption" ? (
              <Field>
                <FieldLabel>Caixa alta</FieldLabel>
                <ToggleGroup
                  value={[style.uppercase ? "on" : "off"]}
                  onValueChange={(value) => {
                    const next = value[0]
                    if (next) update({ uppercase: next === "on" })
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <ToggleGroupItem value="off" className="flex-1 text-xs">
                    Aa
                  </ToggleGroupItem>
                  <ToggleGroupItem value="on" className="flex-1 text-xs">
                    AA
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
            ) : null}
          </div>

          {kind !== "caption" ? (
            <>
              <ColorField
                id={`color-${insert.id}`}
                label="Cor"
                value={style.color}
                onChange={(color) => {
                  if (color) update({ color })
                }}
              />
              <ColorField
                id={`bg-${insert.id}`}
                label="Cor de fundo"
                value={style.bgColor}
                allowEmpty
                onChange={(bgColor) => update({ bgColor })}
              />

              <Field>
                <FieldLabel htmlFor={`stroke-${insert.id}`}>
                  Contorno
                  <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
                    {style.strokeWidth}px
                  </span>
                </FieldLabel>
                <input
                  id={`stroke-${insert.id}`}
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={style.strokeWidth}
                  onChange={(event) => update({ strokeWidth: Number(event.target.value) })}
                  {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
                  className="h-7 w-full accent-brand"
                />
                <ColorField
                  id={`stroke-color-${insert.id}`}
                  label="Cor do contorno"
                  value={style.strokeColor}
                  onChange={(strokeColor) => {
                    if (strokeColor) update({ strokeColor })
                  }}
                />
              </Field>
            </>
          ) : null}

          <Field>
            <FieldLabel>Sombra</FieldLabel>
            <ToggleGroup
              value={[style.shadow]}
              onValueChange={(value) => {
                const next = value[0] as ShadowPreset | undefined
                if (next) update({ shadow: next })
              }}
              variant="outline"
              className="w-full flex-wrap"
            >
              {SHADOW_PRESETS.map((preset) => (
                <ToggleGroupItem key={preset.id} value={preset.id} className="flex-1 text-xs">
                  {preset.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </>
      )}

      <div className="rounded-md border border-border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs font-medium hover:bg-muted/60"
          aria-expanded={advancedOpen}
          aria-controls={advancedId}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          Avançado
          <span className="text-muted-foreground">{advancedOpen ? "Ocultar" : "Mostrar"}</span>
        </button>
        {advancedOpen ? (
          <div id={advancedId} className="flex flex-col gap-3 border-t border-border p-2.5">
            <Field>
              <FieldLabel htmlFor={`opacity-${insert.id}`}>
                Opacidade
                <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
                  {Math.round(style.opacity * 100)}%
                </span>
              </FieldLabel>
              <input
                id={`opacity-${insert.id}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(style.opacity * 100)}
                onChange={(event) => update({ opacity: Number(event.target.value) / 100 })}
                {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
                className="h-7 w-full accent-brand"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`rotation-${insert.id}`}>
                Rotação
                <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
                  {Math.round(style.rotation)}°
                </span>
              </FieldLabel>
              <input
                id={`rotation-${insert.id}`}
                type="number"
                step={1}
                value={style.rotation}
                onChange={(event) => update({ rotation: Number(event.target.value) })}
                {...rangeGestureHandlers(onBeginInsertGesture, onEndInsertGesture)}
                className="h-7 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
              />
            </Field>
          </div>
        ) : null}
      </div>
    </div>
  )
}
