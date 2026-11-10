"use client"

import { useMemo, useState, type ReactNode } from "react"

import { MotionThumb } from "@/components/motion-thumb"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { retentionZones, type RetentionCuts } from "@/lib/insert-ops"
import { EMPHASIS, ENTER, EXIT, LOOPS, PACKS } from "@/lib/motion/catalog"
import { ease, springProgress } from "@/lib/motion/easings"
import {
  activeLoopId,
  addEmphasisAt,
  displayLoopAmplitude,
  mirrorExitFromEnter,
  selectEnter,
  selectExit,
  selectLoop,
  selectPack,
  writeLoopAmplitude,
} from "@/lib/motion/select"
import { recipeFromAnimation } from "@/lib/style/anim-engine"
import { LEGADO_STYLE } from "@/lib/style/presets"
import type { Animation, EasingName } from "@/lib/style/types"
import type { CompositionInsert } from "@/lib/composition"
import { cn } from "@/lib/utils"

const FPS = 30

const EASING_LABEL: Record<EasingName, string> = {
  linear: "Linear",
  "ease-in": "Ease in",
  "ease-out": "Ease out",
  "ease-in-out": "Ease in out",
  spring: "Mola",
  "back-in": "Back in",
  "back-out": "Back out",
  "elastic-out": "Elástico",
  "bounce-out": "Quique",
}

const ORDER_OPTIONS = [
  ["inicio", "Início"],
  ["fim", "Fim"],
  ["centro", "Centro"],
  ["aleatorio", "Aleatório"],
] as const

const ORIGIN_OPTIONS = [
  ["centro", "Centro"],
  ["base", "Base"],
  ["topo", "Topo"],
] as const

function framesToSeconds(frames: number): number {
  return Math.round((frames / FPS) * 100) / 100
}

function secondsToFrames(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0
  return Math.max(0, Math.round(seconds * FPS))
}

function EasingCurve({ name, overshoot }: { name: EasingName; overshoot: number }) {
  const d = useMemo(() => {
    const parts: string[] = []
    for (let index = 0; index <= 20; index += 1) {
      const t = index / 20
      const y = name === "spring" ? springProgress(t * 18, FPS, overshoot) : ease(name, t)
      const clamped = Math.max(-0.15, Math.min(1.35, y))
      const x = (index / 20) * 56
      const py = 22 - ((clamped + 0.15) / 1.5) * 20
      parts.push(`${index === 0 ? "M" : "L"}${x.toFixed(1)} ${py.toFixed(1)}`)
    }
    return parts.join(" ")
  }, [name, overshoot])
  return (
    <svg viewBox="0 0 56 24" className="h-6 w-14 text-foreground" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function RecipeCard({
  label,
  active,
  animation,
  onClick,
}: {
  label: string
  active: boolean
  animation: Animation
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-[4.6rem] shrink-0 flex-col gap-1 rounded-md border border-border bg-background p-1 text-left",
        active && "border-brand ring-1 ring-brand",
      )}
    >
      <MotionThumb animation={animation} />
      <span className="truncate text-center text-[0.62rem] font-medium text-foreground">{label}</span>
    </button>
  )
}

function Adjustments({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[0.7rem] text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        <span>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="flex flex-col gap-2 border-t border-border px-2 py-2">{children}</div> : null}
    </div>
  )
}

function SecondsField({
  id,
  label,
  frames,
  onFrames,
}: {
  id: string
  label: string
  frames: number
  onFrames: (frames: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[0.7rem]" htmlFor={id}>
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          id={id}
          type="number"
          min={0}
          step={0.05}
          className="h-7 w-16 rounded-md border border-border bg-background px-2 font-mono text-xs"
          value={framesToSeconds(frames)}
          onChange={(event) => onFrames(secondsToFrames(Number(event.target.value)))}
        />
        <span className="text-muted-foreground">s</span>
        <span className="w-8 text-right text-muted-foreground">{Math.round(frames)} f</span>
      </span>
    </label>
  )
}

export function MotionPanel({
  insert,
  animation,
  videoDuration,
  retentionCuts,
  onChange,
  getPlayhead,
  onPlayRange,
}: {
  insert: CompositionInsert
  animation: Animation
  videoDuration: number
  retentionCuts?: RetentionCuts | null
  onChange: (animation: Animation) => void
  getPlayhead?: () => number
  onPlayRange?: (start: number, end: number) => void
}) {
  const previews = useMemo(() => {
    const idle = LEGADO_STYLE.animation
    return {
      pack: Object.fromEntries(PACKS.map((pack) => [pack.id, selectPack(idle, pack.id)])),
      enter: Object.fromEntries(ENTER.map((recipe) => [recipe.id, selectEnter(idle, recipe.id)])),
      loop: Object.fromEntries(LOOPS.map((recipe) => [recipe.id, selectLoop(idle, recipe.id)])),
      exit: Object.fromEntries(EXIT.map((recipe) => [recipe.id, selectExit(idle, recipe.id)])),
      emphasis: Object.fromEntries(EMPHASIS.map((recipe) => [recipe.id, addEmphasisAt(idle, 6, recipe.id)])),
    }
  }, [])

  const slot = useMemo(() => {
    const zones = retentionZones(videoDuration, retentionCuts)
    const mid = insert.start + insert.duration / 2
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index]
      if (!zone) continue
      const last = index === zones.length - 1
      if (last ? mid >= zone.from : mid >= zone.from && mid < zone.to) return zone.id
    }
    return "cta" as const
  }, [insert.duration, insert.start, retentionCuts, videoDuration])

  const packs = PACKS.filter((pack) => pack.slot === slot || pack.slot === "oferta")
  const enterId = animation.enter.recipeId ?? recipeFromAnimation(animation)
  const exitId = animation.exit.recipeId
  const loopId = activeLoopId(animation)
  const amplitude = displayLoopAmplitude(animation)
  const localFrame = () => {
    const time = getPlayhead?.() ?? insert.start
    return Math.max(0, (time - insert.start) * FPS)
  }

  return (
    <div className="flex flex-col gap-3" role="tabpanel">
      <label className="flex items-center justify-between gap-2 text-[0.7rem] text-foreground">
        Começa pronto no 1º frame (capa)
        <input
          type="checkbox"
          checked={animation.entryFromFrame0 !== "play" && (animation.entryFromFrame0 === "final" || insert.start < 0.05)}
          onChange={(event) =>
            onChange({ ...animation, entryFromFrame0: event.target.checked ? "final" : "play" })
          }
        />
      </label>
      <section className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] font-medium text-foreground">
          Pacotes · {slot === "gancho" ? "Gancho" : slot === "prova" ? "Prova" : "CTA"}
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {packs.map((pack) => (
            <div key={pack.id} className="relative">
              <RecipeCard
                label={pack.label}
                active={animation.packId === pack.id}
                animation={previews.pack[pack.id] ?? animation}
                onClick={() => onChange(selectPack(animation, pack.id))}
              />
              {pack.slot === "oferta" && slot !== "oferta" ? (
                <span className="pointer-events-none absolute right-1 top-1 rounded bg-background/80 px-1 text-[0.55rem] text-muted-foreground">
                  oferta
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] font-medium text-foreground">Entrada</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ENTER.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              label={recipe.label}
              active={enterId === recipe.id}
                animation={previews.enter[recipe.id] ?? animation}
              onClick={() => onChange(selectEnter(animation, recipe.id))}
            />
          ))}
        </div>
        <Adjustments title="Ajustes da entrada">
          <SecondsField
            id={`enter-sec-${insert.id}`}
            label="Duração"
            frames={animation.enter.durationInFrames}
            onFrames={(frames) => onChange({ ...animation, enter: { ...animation.enter, durationInFrames: frames } })}
          />
          <label className="flex items-center justify-between gap-2 text-[0.7rem]">
            Easing
            <span className="flex items-center gap-2">
              <EasingCurve name={animation.enter.easing} overshoot={animation.enter.overshoot} />
              <select
                className="h-7 rounded-md border border-border bg-background px-1 text-xs"
                value={animation.enter.easing}
                onChange={(event) =>
                  onChange({
                    ...animation,
                    enter: { ...animation.enter, easing: event.target.value as EasingName },
                  })
                }
              >
                {(Object.keys(EASING_LABEL) as EasingName[]).map((name) => (
                  <option key={name} value={name}>
                    {EASING_LABEL[name]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          {animation.enter.easing === "spring" ? (
            <label className="flex items-center justify-between gap-2 text-[0.7rem]">
              Overshoot
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="h-7 w-16 rounded-md border border-border bg-background px-2 font-mono text-xs"
                value={animation.enter.overshoot}
                onChange={(event) =>
                  onChange({
                    ...animation,
                    enter: { ...animation.enter, overshoot: Number(event.target.value) },
                  })
                }
              />
            </label>
          ) : null}
          <SecondsField
            id={`enter-delay-${insert.id}`}
            label="Atraso"
            frames={animation.enter.delayInFrames}
            onFrames={(frames) => onChange({ ...animation, enter: { ...animation.enter, delayInFrames: frames } })}
          />
        </Adjustments>
      </section>

      <section className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] font-medium text-foreground">Durante</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {LOOPS.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              label={recipe.label}
              active={loopId === recipe.id}
                animation={previews.loop[recipe.id] ?? animation}
              onClick={() => onChange(selectLoop(animation, recipe.id))}
            />
          ))}
        </div>
        <Adjustments title="Ajustes do loop">
          <label className="flex items-center justify-between gap-2 text-[0.7rem]">
            Amplitude {amplitude.unit}
            <input
              type="number"
              min={0}
              step={0.1}
              className="h-7 w-16 rounded-md border border-border bg-background px-2 font-mono text-xs"
              value={Math.round(amplitude.value * 100) / 100}
              onChange={(event) => onChange(writeLoopAmplitude(animation, Number(event.target.value)))}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-[0.7rem]">
            Velocidade (Hz)
            <input
              type="number"
              min={0}
              step={0.1}
              className="h-7 w-16 rounded-md border border-border bg-background px-2 font-mono text-xs"
              value={animation.loop.speed}
              onChange={(event) =>
                onChange({ ...animation, loop: { ...animation.loop, speed: Number(event.target.value) } })
              }
            />
          </label>
        </Adjustments>
      </section>

      <section className="flex flex-col gap-1.5">
        <p className="text-[0.7rem] font-medium text-foreground">Ênfase</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {EMPHASIS.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              label={recipe.label}
              active={animation.emphasis?.some((hit) => hit.type === recipe.id) ?? false}
                animation={previews.emphasis[recipe.id] ?? animation}
              onClick={() => onChange(addEmphasisAt(animation, localFrame(), recipe.id))}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(addEmphasisAt(animation, localFrame(), "punch"))}
        >
          + Ênfase no playhead
        </Button>
      </section>

      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.7rem] font-medium text-foreground">Saída</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(mirrorExitFromEnter(animation))}>
            Espelhar entrada
          </Button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {EXIT.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              label={recipe.label}
              active={exitId === recipe.id}
                animation={previews.exit[recipe.id] ?? animation}
              onClick={() => onChange(selectExit(animation, recipe.id))}
            />
          ))}
        </div>
        <Adjustments title="Ajustes da saída">
          <SecondsField
            id={`exit-sec-${insert.id}`}
            label="Duração"
            frames={animation.exit.durationInFrames}
            onFrames={(frames) => onChange({ ...animation, exit: { ...animation.exit, durationInFrames: frames } })}
          />
          <label className="flex items-center justify-between gap-2 text-[0.7rem]">
            Easing
            <span className="flex items-center gap-2">
              <EasingCurve name={animation.exit.easing} overshoot={0} />
              <select
                className="h-7 rounded-md border border-border bg-background px-1 text-xs"
                value={animation.exit.easing}
                onChange={(event) =>
                  onChange({
                    ...animation,
                    exit: { ...animation.exit, easing: event.target.value as EasingName },
                  })
                }
              >
                {(Object.keys(EASING_LABEL) as EasingName[]).map((name) => (
                  <option key={name} value={name}>
                    {EASING_LABEL[name]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <SecondsField
            id={`exit-stagger-${insert.id}`}
            label="Intervalo da saída"
            frames={animation.exit.staggerInFrames ?? 0}
            onFrames={(frames) =>
              onChange({ ...animation, exit: { ...animation.exit, staggerInFrames: frames } })
            }
          />
        </Adjustments>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border p-2">
        <FieldRow label="Animar por">
          <ToggleGroup
            value={[animation.unit]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === "bloco" || next === "palavra" || next === "letra") {
                onChange({ ...animation, unit: next })
              }
            }}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="bloco" className="flex-1 text-xs">Bloco</ToggleGroupItem>
            <ToggleGroupItem value="palavra" className="flex-1 text-xs">Palavra</ToggleGroupItem>
            <ToggleGroupItem value="letra" className="flex-1 text-xs">Letra</ToggleGroupItem>
          </ToggleGroup>
        </FieldRow>
        <FieldRow label="Ordem">
          <ToggleGroup
            value={[animation.order ?? "inicio"]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === "inicio" || next === "fim" || next === "centro" || next === "aleatorio") {
                onChange({ ...animation, order: next })
              }
            }}
            variant="outline"
            className="w-full flex-wrap"
          >
            {ORDER_OPTIONS.map(([id, label]) => (
              <ToggleGroupItem key={id} value={id} className="flex-1 text-xs">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldRow>
        <SecondsField
          id={`stagger-${insert.id}`}
          label="Intervalo entre unidades"
          frames={animation.enter.staggerInFrames}
          onFrames={(frames) => onChange({ ...animation, enter: { ...animation.enter, staggerInFrames: frames } })}
        />
        <FieldRow label="Intensidade">
          <ToggleGroup
            value={[String(animation.intensity ?? 1)]}
            onValueChange={(value) => {
              const next = Number(value[0])
              if (next === 0.6 || next === 1 || next === 1.4) onChange({ ...animation, intensity: next })
            }}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="0.6" className="flex-1 text-xs">Suave</ToggleGroupItem>
            <ToggleGroupItem value="1" className="flex-1 text-xs">Médio</ToggleGroupItem>
            <ToggleGroupItem value="1.4" className="flex-1 text-xs">Forte</ToggleGroupItem>
          </ToggleGroup>
        </FieldRow>
        <FieldRow label="Velocidade">
          <ToggleGroup
            value={[String(animation.speed ?? 1)]}
            onValueChange={(value) => {
              const next = Number(value[0])
              if (next === 0.75 || next === 1 || next === 1.5) onChange({ ...animation, speed: next })
            }}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="0.75" className="flex-1 text-xs">0,75×</ToggleGroupItem>
            <ToggleGroupItem value="1" className="flex-1 text-xs">1×</ToggleGroupItem>
            <ToggleGroupItem value="1.5" className="flex-1 text-xs">1,5×</ToggleGroupItem>
          </ToggleGroup>
        </FieldRow>
        <FieldRow label="Origem">
          <ToggleGroup
            value={[animation.origin ?? "centro"]}
            onValueChange={(value) => {
              const next = value[0]
              if (next === "centro" || next === "base" || next === "topo") onChange({ ...animation, origin: next })
            }}
            variant="outline"
            className="w-full"
          >
            {ORIGIN_OPTIONS.map(([id, label]) => (
              <ToggleGroupItem key={id} value={id} className="flex-1 text-xs">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldRow>
      </section>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPlayRange?.(insert.start, insert.start + insert.duration)}
      >
        Tocar só este insert
      </Button>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.7rem] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
