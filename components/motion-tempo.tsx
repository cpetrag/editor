"use client"

import type { Animation } from "@/lib/style/types"
import { loopById } from "@/lib/motion/catalog"
import { displayLoopAmplitude, writeLoopAmplitude } from "@/lib/motion/select"
import {
  clampPhaseFrames,
  enterTotalFrames,
  formatMotionClock,
  formatMotionSeconds,
  framesToSeconds,
  motionHasExit,
  motionHasLoop,
  motionPhaseLimits,
  secondsToFrames,
} from "@/lib/motion/timing"
import { cn } from "@/lib/utils"

const SPEEDS = [
  [0.75, "0,75×"],
  [1, "1×"],
  [1.5, "1,5×"],
] as const

const LOOP_SPEEDS = [
  [0.5, "Lento"],
  [1, "Normal"],
  [2, "Rápido"],
] as const

function SliderRow({
  label,
  seconds,
  frames,
  maxFrames,
  minSeconds = 0.1,
  disabled,
  note,
  onSeconds,
  onBegin,
  onEnd,
}: {
  label: string
  seconds: number
  frames: number
  maxFrames: number
  minSeconds?: number
  disabled?: boolean
  note?: string
  onSeconds: (seconds: number) => void
  onBegin?: () => void
  onEnd?: () => void
}) {
  const maxSeconds = Math.min(2, framesToSeconds(maxFrames))
  const min = Math.min(minSeconds, maxSeconds)
  return (
    <label className={cn("flex flex-col gap-1 text-[0.7rem]", disabled && "opacity-50")}>
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{disabled ? "sem saída" : formatMotionClock(frames)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={Math.max(min, maxSeconds)}
        step={0.05}
        aria-label={label}
        disabled={disabled}
        value={Math.min(seconds, maxSeconds)}
        onPointerDown={() => onBegin?.()}
        onPointerUp={() => onEnd?.()}
        onPointerCancel={() => onEnd?.()}
        onChange={(event) => onSeconds(Number(event.target.value))}
      />
      {note ? <span className="text-muted-foreground">{note}</span> : null}
    </label>
  )
}

export function MotionTempo({
  animation,
  insertSeconds,
  unitCount,
  onChange,
  onRestore,
  onBegin,
  onEnd,
}: {
  animation: Animation
  insertSeconds: number
  unitCount: number
  onChange: (animation: Animation) => void
  onRestore: () => void
  onBegin?: () => void
  onEnd?: () => void
}) {
  const limits = motionPhaseLimits({
    insertSeconds,
    enterFrames: animation.enter.durationInFrames,
    delayFrames: animation.enter.delayInFrames,
    staggerFrames: animation.enter.staggerInFrames,
    exitFrames: animation.exit.durationInFrames,
    unitCount,
  })
  const perUnit = animation.unit === "bloco"
  const exitOn = motionHasExit(animation)
  const loopOn = motionHasLoop(animation)
  const amplitude = displayLoopAmplitude(animation)
  const recipeAmp = animation.loop.recipeId ? loopById(animation.loop.recipeId)?.amp : undefined
  const ampBase = recipeAmp && recipeAmp > 0 ? recipeAmp : amplitude.value || 1
  const totalEnter = enterTotalFrames({
    enterFrames: animation.enter.durationInFrames,
    delayFrames: animation.enter.delayInFrames,
    staggerFrames: animation.enter.staggerInFrames,
    unitCount,
  })

  function setEnter(seconds: number) {
    const frames = clampPhaseFrames(secondsToFrames(seconds), limits.enterMax)
    onChange({ ...animation, enter: { ...animation.enter, durationInFrames: frames } })
  }

  function setExit(seconds: number) {
    const frames = clampPhaseFrames(secondsToFrames(seconds), limits.exitMax)
    onChange({ ...animation, exit: { ...animation.exit, durationInFrames: frames } })
  }

  function setStagger(seconds: number) {
    const frames = Math.max(0, Math.min(limits.staggerMax, secondsToFrames(seconds)))
    onChange({ ...animation, enter: { ...animation.enter, staggerInFrames: frames } })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] font-medium text-foreground">Tempo</p>
        <button type="button" className="text-[0.65rem] text-blue-700 underline" onClick={onRestore}>
          Restaurar tempos do movimento
        </button>
      </div>
      <SliderRow
        label="Entrada"
        seconds={framesToSeconds(animation.enter.durationInFrames)}
        frames={animation.enter.durationInFrames}
        maxFrames={limits.enterMax}
        onSeconds={setEnter}
        onBegin={onBegin}
        onEnd={onEnd}
      />
      {perUnit ? null : (
        <SliderRow
          label="Intervalo"
          seconds={framesToSeconds(animation.enter.staggerInFrames)}
          frames={animation.enter.staggerInFrames}
          minSeconds={0}
          maxFrames={Math.max(limits.staggerMax, animation.enter.staggerInFrames)}
          note={`entra em ${formatMotionSeconds(framesToSeconds(totalEnter))} s no total`}
          onSeconds={setStagger}
          onBegin={onBegin}
          onEnd={onEnd}
        />
      )}
      <SliderRow
        label="Saída"
        seconds={framesToSeconds(animation.exit.durationInFrames)}
        frames={animation.exit.durationInFrames}
        maxFrames={exitOn ? limits.exitMax : 0}
        disabled={!exitOn}
        onSeconds={setExit}
        onBegin={onBegin}
        onEnd={onEnd}
      />
      {loopOn ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.7rem]">Velocidade do loop</span>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {LOOP_SPEEDS.map(([hz, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={Math.abs(animation.loop.speed - hz) < 0.05}
                className={cn(
                  "rounded px-2 py-1 text-[0.65rem]",
                  Math.abs(animation.loop.speed - hz) < 0.05 ? "bg-foreground text-background" : "text-muted-foreground",
                )}
                onClick={() => onChange({ ...animation, loop: { ...animation.loop, speed: hz } })}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0.2}
            max={4}
            step={0.1}
            aria-label="Velocidade do loop"
            value={animation.loop.speed}
            onPointerDown={() => onBegin?.()}
            onPointerUp={() => onEnd?.()}
            onChange={(event) =>
              onChange({ ...animation, loop: { ...animation.loop, speed: Number(event.target.value) } })
            }
          />
          <span className="text-[0.7rem]">Intensidade</span>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(
              [
                [ampBase * 0.6, "Suave"],
                [ampBase, "Médio"],
                [ampBase * 1.4, "Forte"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={Math.abs(amplitude.value - value) < 0.05}
                className={cn(
                  "rounded px-2 py-1 text-[0.65rem]",
                  Math.abs(amplitude.value - value) < 0.05 ? "bg-foreground text-background" : "text-muted-foreground",
                )}
                onClick={() => onChange(writeLoopAmplitude(animation, value))}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(ampBase * 2, amplitude.value)}
            step={0.1}
            aria-label="Intensidade do loop"
            value={amplitude.value}
            onPointerDown={() => onBegin?.()}
            onPointerUp={() => onEnd?.()}
            onChange={(event) => onChange(writeLoopAmplitude(animation, Number(event.target.value)))}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-[0.7rem]">Velocidade geral</span>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {SPEEDS.map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={Math.abs((animation.speed ?? 1) - value) < 0.01}
              className={cn(
                "rounded px-2 py-1 text-[0.65rem]",
                Math.abs((animation.speed ?? 1) - value) < 0.01 ? "bg-foreground text-background" : "text-muted-foreground",
              )}
              onClick={() => onChange({ ...animation, speed: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {limits.tight ? (
        <p className="text-[0.65rem] text-amber-700">o insert dura {formatMotionSeconds(insertSeconds)} s</p>
      ) : null}
    </div>
  )
}
