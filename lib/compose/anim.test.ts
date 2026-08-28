import { test } from "node:test"
import assert from "node:assert/strict"

import type { CompositionInsert } from "../composition.ts"
import {
  ANIM_DURATION_SEC,
  IDENTITY_POSE,
  animAt,
  phaseDurations,
  type AnimPose,
} from "./anim.ts"

function insert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "i1",
    type: "alerta-desconto",
    start: 0,
    duration: 3,
    text: "OFF",
    anchor: "top",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

function assertIdentity(pose: AnimPose) {
  assert.equal(pose.opacity, IDENTITY_POSE.opacity)
  assert.equal(pose.scale, IDENTITY_POSE.scale)
  assert.equal(pose.dx, IDENTITY_POSE.dx)
  assert.equal(pose.dy, IDENTITY_POSE.dy)
  assert.equal(pose.blurPx, IDENTITY_POSE.blurPx)
  assert.equal(pose.clipProgress, IDENTITY_POSE.clipProgress)
}

test("none/none is identity for any local time inside the insert", () => {
  assertIdentity(animAt(insert(), 0))
  assertIdentity(animAt(insert(), 1.5))
  assertIdentity(animAt(insert(), 2.99))
})

test("middle of a long pop insert is identity", () => {
  const row = insert({ animIn: "pop", animOut: "pop" })
  assertIdentity(animAt(row, 1.5))
})

test("pop at t === start is small and faded", () => {
  const pose = animAt(insert({ animIn: "pop" }), 0)
  assert.ok(pose.scale < 1)
  assert.ok(pose.opacity < 1)
})

test("pop is settled at start + 0.45 on a long insert", () => {
  assertIdentity(animAt(insert({ animIn: "pop" }), 0.45))
})

test("pop out on the last visible instant is small and faded", () => {
  const pose = animAt(insert({ animOut: "pop" }), 2.999)
  assert.ok(pose.scale < 1)
  assert.ok(pose.opacity < 1)
})

test("0.5s pop+pop compresses so phases meet in the middle", () => {
  const row = insert({ animIn: "pop", animOut: "pop", duration: 0.5 })
  const { inDur, outDur } = phaseDurations(row)
  assert.ok(Math.abs(inDur + outDur - 0.5) < 1e-10)
  assertIdentity(animAt(row, 0.25))
  const enter = animAt(row, 0)
  const leave = animAt(row, 0.499)
  assert.ok(enter.scale < 1)
  assert.ok(leave.scale < 1)
})

test("none + pop on 0.5s insert does not shrink the exit", () => {
  const row = insert({ animIn: "none", animOut: "pop", duration: 0.5 })
  const { inDur, outDur } = phaseDurations(row)
  assert.equal(inDur, 0)
  assert.equal(outDur, ANIM_DURATION_SEC.pop)
  assertIdentity(animAt(row, 0))
})

test("typewriter enter has 18 clip steps then 1 when settled", () => {
  const row = insert({ animIn: "typewriter", duration: 3 })
  const seen = new Set<number>()
  for (let i = 0; i < 18; i += 1) {
    const t = ((i + 0.01) / 18) * ANIM_DURATION_SEC.typewriter
    seen.add(animAt(row, t).clipProgress)
  }
  assert.equal(seen.size, 18)
  assert.equal(animAt(row, ANIM_DURATION_SEC.typewriter).clipProgress, 1)
})

test("shake enter keeps opacity at 1", () => {
  const row = insert({ animIn: "shake" })
  assert.equal(animAt(row, 0).opacity, 1)
  assert.equal(animAt(row, 0.2).opacity, 1)
  assert.equal(animAt(row, 0.49).opacity, 1)
})

test("slide-up out moves down and fades", () => {
  const pose = animAt(insert({ animOut: "slide-up" }), 2.999)
  assert.ok(pose.dy > 0)
  assert.ok(pose.opacity < 1)
})
