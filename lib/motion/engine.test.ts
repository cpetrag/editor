import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { applyAnimRecipe } from "../style/anim-engine.ts"
import { LEGADO_STYLE, PRESETS } from "../style/presets.ts"
import { planStyledTextDraw } from "../style/caption-draw.ts"
import type { Animation } from "../style/types.ts"
import { applyPack, EMPHASIS, ENTER, EXIT, LOOPS, PACKS } from "./catalog.ts"
import { backgroundEnvelope, motionAt, stickerMotionAt, unitStaggerIndex, type MotionSpec } from "./engine.ts"
import { springProgress, UNIT_EASINGS, ease } from "./easings.ts"
import { hashSeed } from "./hash.ts"

const FPS = 30

type Sample = { scale: number; x: number; y: number; rotate: number; opacity: number; blur: number }
type Fixture = {
  fps: number
  cardStartFrame: number
  cardDurationFrames: number
  units: number[]
  frames: number[]
  presets: Record<string, Record<string, Sample[]>>
  recipes: Record<string, Record<string, Sample[]>>
}

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "legacy.json"), "utf8"),
) as Fixture

function specOf(animation: Animation, duration = fixture.cardDurationFrames): MotionSpec {
  return { animation, startFrame: fixture.cardStartFrame, durationInFrames: duration }
}

function samplePose(animation: Animation, frame: number, unit: number): Sample {
  const pose = motionAt(frame, FPS, specOf(animation), unit, Math.max(3, unit + 1), 0)
  return {
    scale: pose.scale,
    x: pose.x,
    y: pose.y,
    rotate: pose.rotate,
    opacity: pose.opacity,
    blur: pose.blur,
  }
}

function assertSample(actual: Sample, expected: Sample, label: string) {
  for (const key of ["scale", "x", "y", "rotate", "opacity", "blur"] as const) {
    const delta = Math.abs(actual[key] - expected[key])
    assert.ok(delta < 1e-6, `${label} ${key} Δ=${delta}`)
  }
}

function withMotion(patch: Partial<Animation>): Animation {
  const base = LEGADO_STYLE.animation
  return {
    ...base,
    ...patch,
    enter: { ...base.enter, ...patch.enter },
    exit: { ...base.exit, ...patch.exit },
    loop: { ...base.loop, ...patch.loop },
  }
}

test("regressão: presets e recipes legados batem com a fixture", () => {
  for (const [id, units] of Object.entries(fixture.presets)) {
    const animation = PRESETS[id]?.style.animation
    assert.ok(animation, id)
    for (const unit of fixture.units) {
      const frames = units[String(unit)]
      assert.ok(frames, `${id} unit ${unit}`)
      for (const frame of fixture.frames) {
        assertSample(samplePose(animation, frame, unit), frames[frame]!, `${id} u${unit} f${frame}`)
      }
    }
  }
  for (const name of ["pop", "slide-up", "zoom-out", "blur-in", "typewriter"] as const) {
    const animation = applyAnimRecipe(LEGADO_STYLE.animation, name)
    const units = fixture.recipes[name]
    assert.ok(units, name)
    for (const unit of fixture.units) {
      const frames = units[String(unit)]
      assert.ok(frames)
      for (const frame of fixture.frames) {
        assertSample(samplePose(animation, frame, unit), frames[frame]!, `${name} u${unit} f${frame}`)
      }
    }
  }
})

test("determinismo: a mesma entrada devolve o mesmo estado e a ordem aleatória só depende da seed", () => {
  const animation = withMotion({
    unit: "letra",
    order: "aleatorio",
    enter: {
      from: { opacity: 0 },
      durationInFrames: 4,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 3,
    },
    loop: { type: "tremor", amplitude: 4, speed: 7, recipeId: "tremor" },
  })
  const spec = specOf(animation)
  const first = motionAt(12, FPS, spec, 2, 6, 42)
  const second = motionAt(12, FPS, spec, 2, 6, 42)
  assert.deepEqual(first, second)
  assert.notDeepEqual(unitStaggerIndex("aleatorio", 2, 6, 42), unitStaggerIndex("aleatorio", 2, 6, 99))
  assert.equal(unitStaggerIndex("aleatorio", 2, 6, 42), unitStaggerIndex("aleatorio", 2, 6, 42))
  assert.notEqual(hashSeed("insert-a"), hashSeed("insert-b"))
  assert.equal(hashSeed("insert-a"), hashSeed("insert-a"))
})

test("todo easing de 0 a 1 termina em 0 e 1; a mola começa em 0", () => {
  for (const name of UNIT_EASINGS) {
    assert.equal(ease(name, 0), 0, name)
    assert.equal(ease(name, 1), 1, name)
  }
  assert.equal(springProgress(0, FPS, 0.15), 0)
})

test("envelope: loop novo fica em zero durante a entrada e o shake antigo não", () => {
  const entering = withMotion({
    enter: {
      from: { y: 40, opacity: 0 },
      durationInFrames: 12,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 0,
    },
    loop: { type: "flutuar", amplitude: 10, speed: 0.5, recipeId: "flutuar" },
  })
  const still = withMotion({
    ...entering,
    loop: { type: "nenhum", amplitude: 0, speed: 0 },
  })
  const during = motionAt(4, FPS, specOf(entering), 0, 1, 1)
  const without = motionAt(4, FPS, specOf(still), 0, 1, 1)
  assert.equal(during.y, without.y)
  const after = motionAt(24, FPS, specOf(entering), 0, 1, 1)
  const afterStill = motionAt(24, FPS, specOf(still), 0, 1, 1)
  assert.notEqual(after.y, afterStill.y)

  const shake = PRESETS.urgencia?.style.animation
  assert.ok(shake)
  assert.notEqual(motionAt(3, FPS, specOf(shake), 0, 1, 0).x, 0)
})

test("intensidade 1 e velocidade 1 reproduzem a animação sem esses campos", () => {
  const base = PRESETS.hormozi?.style.animation
  assert.ok(base)
  const marked: Animation = { ...base, intensity: 1, speed: 1 }
  const spec = specOf(base, 90)
  const withFields = specOf(marked, 90)
  for (const frame of [0, 4, 15, 40, 88]) {
    assert.deepEqual(motionAt(frame, FPS, spec, 1, 4, 7), motionAt(frame, FPS, withFields, 1, 4, 7))
  }
  const pulsing = PRESETS.carrinhoLaranja?.style.animation
  assert.ok(pulsing)
  assert.deepEqual(
    motionAt(40, FPS, specOf(pulsing), 0, 1, 0),
    motionAt(40, FPS, specOf({ ...pulsing, intensity: 1, speed: 1 }), 0, 1, 0),
  )
})

test("Estouro escala a caixa e o texto juntos, e o frame 0 da capa já está pronto", () => {
  const animation = applyPack(LEGADO_STYLE.animation, "estouro")
  for (const time of [0, 0.1, 0.25, 0.4, 1]) {
    const motion = stickerMotionAt({ time, fps: 30, duration: 3, animation })
    assert.equal(motion.boxScale, motion.textScale)
  }
  const cover = stickerMotionAt({
    time: 0,
    fps: 30,
    duration: 3,
    animation,
    entryFromFrame0: "final",
  })
  assert.equal(cover.boxScale, 1)
  assert.equal(cover.textScale, 1)
  assert.equal(cover.opacity, 1)
})

test("catálogo tem 22 entradas, 11 saídas, 13 loops, 5 ênfases e 10 pacotes", () => {
  assert.equal(ENTER.length, 22)
  assert.equal(EXIT.length, 11)
  assert.equal(LOOPS.length, 13)
  assert.equal(EMPHASIS.length, 5)
  assert.equal(PACKS.length, 10)
  const pack = applyPack(LEGADO_STYLE.animation, "estouro")
  assert.equal(pack.packId, "estouro")
  assert.equal(pack.enter.recipeId, "pop")
  assert.equal(pack.enter.from.scale, 0.6)
  assert.equal(pack.loop.recipeId, "pulse")
  assert.equal(pack.loop.amplitude, 4)
  assert.equal(pack.exit.recipeId, "pop-out")
  assert.equal(pack.unit, "bloco")
})

test("glitch é estável para a mesma seed e a saída em stagger apaga a última unidade primeiro", () => {
  const glitch = withMotion({
    enter: {
      from: { jitter: 1, opacity: 0, skewX: 20 },
      durationInFrames: 10,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 0,
    },
  })
  const a = motionAt(0, FPS, specOf(glitch), 1, 3, 5)
  const b = motionAt(0, FPS, specOf(glitch), 1, 3, 5)
  assert.deepEqual(a, b)
  assert.notEqual(a.x, motionAt(0, FPS, specOf(glitch), 1, 3, 6).x)
  assert.notEqual(a.x, 0)

  const erase = withMotion({
    exit: { to: { opacity: 0 }, durationInFrames: 4, easing: "linear", staggerInFrames: 2 },
  })
  const spec = specOf(erase, 30)
  const last = motionAt(23, FPS, spec, 2, 3, 0)
  const first = motionAt(23, FPS, spec, 0, 3, 0)
  assert.ok(last.opacity < 1)
  assert.equal(first.opacity, 1)
})

test("fundo de palavra entra em 6 frames e legenda não recebe esse envelope", () => {
  const animation = withMotion({
    unit: "palavra",
    exit: { to: { opacity: 0 }, durationInFrames: 6, easing: "linear" },
  })
  const spec = specOf(animation, 60)
  assert.equal(backgroundEnvelope(0, spec, 3).opacity, 0)
  assert.equal(backgroundEnvelope(0, spec, 3).scale, 0.9)
  assert.equal(backgroundEnvelope(6, spec, 3).opacity, 1)
  assert.equal(backgroundEnvelope(6, spec, 3).scale, 1)

  const caption = planStyledTextDraw({
    lines: ["oi"],
    words: [],
    style: PRESETS.hormozi!.style,
    time: 0,
    measure: (value) => value.length * 10,
    lineHeight: 40,
    blockW: 40,
    blockH: 40,
    spaceWidth: 8,
    fps: 30,
    cardStart: 0,
    cardDuration: 2,
  })
  assert.equal(caption.backgroundMotion, undefined)
})
