import assert from "node:assert/strict"
import { test } from "node:test"

import { animatedPoseAt } from "../style/anim-engine.ts"
import { LEGADO_STYLE } from "../style/presets.ts"
import { planStyledTextDraw } from "../style/caption-draw.ts"
import type { Animation, InsertStyle } from "../style/types.ts"
import { backgroundEnvelope, motionAt } from "./engine.ts"
import { activeLoopId, addEmphasisAt, clipMotionMarks, moveEmphasis, selectEnter, selectPack } from "./select.ts"

const base: Animation = {
  ...LEGADO_STYLE.animation,
  enter: { ...LEGADO_STYLE.animation.enter, durationInFrames: 11, staggerInFrames: 0 },
  exit: { ...LEGADO_STYLE.animation.exit },
  loop: { ...LEGADO_STYLE.animation.loop },
}

test("recipe legada sozinha guarda o id e conserva a duração", () => {
  const next = selectEnter(base, "pop")
  assert.equal(next.enter.recipeId, "pop")
  assert.equal(next.enter.durationInFrames, 11)
  assert.equal(next.enter.from.scale, 0.6)
  assert.equal(next.enter.from.opacity, 0)
  assert.equal(next.packId, undefined)
  assert.equal(next.loop.recipeId, undefined)
})

test("recipe nova grava recipeId e a duração do catálogo", () => {
  const next = selectEnter(base, "glitch")
  assert.equal(next.enter.recipeId, "glitch")
  assert.equal(next.enter.durationInFrames, 10)
  assert.equal(next.enter.from.jitter, 1)
  assert.equal(next.clipDir, undefined)
})

test("pacote Carimbo grava packId, recipeId e a ênfase", () => {
  const next = selectPack(base, "carimbo")
  assert.equal(next.packId, "carimbo")
  assert.equal(next.enter.recipeId, "carimbo")
  assert.equal(next.exit.recipeId, "zoom-sai")
  assert.equal(next.loop.recipeId, "nenhum")
  assert.equal(next.emphasis?.[0]?.type, "tremida")
  assert.equal(next.emphasis?.[0]?.atFrame, 7)
  assert.equal(next.unit, "bloco")
})

test("pacote Cascata grava o loop que liga o envelope e o intervalo entre palavras", () => {
  const next = selectPack(base, "cascata")
  assert.equal(next.packId, "cascata")
  assert.equal(next.enter.recipeId, "cascata")
  assert.equal(next.loop.recipeId, "onda")
  assert.equal(next.unit, "palavra")
  assert.equal(next.enter.staggerInFrames, 3)
  assert.equal(activeLoopId(next), "onda")
})

test("ênfase no playhead e o arraste do losango mudam atFrame", () => {
  const added = addEmphasisAt(base, 12.4, "punch")
  assert.equal(added.emphasis?.[0]?.atFrame, 12)
  const moved = moveEmphasis(added, 0, 20)
  assert.equal(moved.emphasis?.[0]?.atFrame, 20)
  const marks = clipMotionMarks(moved, 2, 30)
  assert.equal(marks.emphasis[0]?.ratio, 20 / 60)
})

test("preview e export concordam quadro a quadro em Carimbo, Cascata e Glitch", () => {
  const fps = 30
  const duration = 60
  const cases: Array<{ name: string; animation: Animation; units: number }> = [
    { name: "carimbo", animation: selectPack(base, "carimbo"), units: 1 },
    { name: "cascata", animation: selectPack(base, "cascata"), units: 3 },
    { name: "glitch", animation: selectEnter(base, "glitch"), units: 1 },
  ]

  for (const item of cases) {
    for (let frame = 0; frame <= duration; frame += 1) {
      for (let rank = 0; rank < item.units; rank += 1) {
        const fromEngine = motionAt(
          frame,
          fps,
          { animation: item.animation, startFrame: 0, durationInFrames: duration },
          rank,
          item.units,
          7,
        )
        const fromPreview = animatedPoseAt({
          anim: item.animation,
          indexInCard: rank,
          cardStartFrame: 0,
          cardDurationFrames: duration,
          frame,
          fps,
          unitCount: item.units,
          seed: 7,
        })
        assert.deepEqual(fromPreview, fromEngine, `${item.name} f${frame} u${rank}`)
      }
    }
  }

  const carimbo = selectPack(base, "carimbo")
  const without = { ...carimbo, emphasis: undefined }
  const hit = motionAt(13, fps, { animation: carimbo, startFrame: 0, durationInFrames: duration }, 0, 1, 1)
  const calm = motionAt(13, fps, { animation: without, startFrame: 0, durationInFrames: duration }, 0, 1, 1)
  assert.notEqual(hit.x, calm.x)

  const cascata = selectPack(base, "cascata")
  const spec = { animation: cascata, startFrame: 0, durationInFrames: duration }
  const first = motionAt(4, fps, spec, 0, 3, 1)
  const second = motionAt(4, fps, spec, 1, 3, 1)
  assert.notEqual(first.y, second.y)
  const duringEnter = motionAt(2, fps, spec, 0, 3, 1)
  const held = motionAt(40, fps, spec, 0, 3, 1)
  assert.notEqual(duringEnter.y, held.y)
  assert.equal(backgroundEnvelope(0, spec, 3).opacity, 0)
  assert.equal(backgroundEnvelope(6, spec, 3).scale, 1)

  const style: InsertStyle = {
    ...LEGADO_STYLE,
    text: {
      ...LEGADO_STYLE.text,
      background: { ...LEGADO_STYLE.text.background, enabled: true, mode: "bloco" },
    },
    animation: cascata,
  }
  const hidden = planStyledTextDraw({
    lines: ["acha dinho"],
    words: [],
    style,
    time: 0,
    measure: (value) => value.length * 10,
    lineHeight: 40,
    blockW: 120,
    blockH: 40,
    spaceWidth: 8,
    fps,
    cardStart: 0,
    cardDuration: 2,
    followBackground: true,
    seed: 7,
  })
  const staggered = planStyledTextDraw({
    lines: ["acha dinho"],
    words: [],
    style,
    time: 4 / fps,
    measure: (value) => value.length * 10,
    lineHeight: 40,
    blockW: 120,
    blockH: 40,
    spaceWidth: 8,
    fps,
    cardStart: 0,
    cardDuration: 2,
    followBackground: true,
    seed: 7,
  })
  assert.equal(hidden.backgroundMotion?.opacity, 0)
  assert.equal(staggered.tokens.length, 2)
  assert.notEqual(staggered.tokens[0]?.pose.y, staggered.tokens[1]?.pose.y)
  assert.equal(staggered.tokens[0]?.pose.y, motionAt(4, fps, spec, 0, 2, 7).y)

  const glitch = selectEnter(base, "glitch")
  const a = motionAt(0, fps, { animation: glitch, startFrame: 0, durationInFrames: duration }, 0, 1, 3)
  const b = motionAt(0, fps, { animation: glitch, startFrame: 0, durationInFrames: duration }, 0, 1, 3)
  assert.deepEqual(a, b)
  assert.notEqual(a.x, 0)
  assert.equal(glitch.enter.recipeId, "glitch")
})
