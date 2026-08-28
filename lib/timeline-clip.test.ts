import { test } from "node:test"
import assert from "node:assert/strict"

import { MIN_DURATION } from "./composition.ts"
import {
  clientXToTime,
  hitTimelineHandle,
  moveInsertTiming,
  trimInsertIn,
  trimInsertOut,
} from "./timeline-clip.ts"

const insert = { start: 2, duration: 4 }

test("clientXToTime maps the track edges to 0 and the video duration", () => {
  const rect = { left: 100, width: 200 }
  assert.equal(clientXToTime(100, rect, 20), 0)
  assert.equal(clientXToTime(300, rect, 20), 20)
  assert.equal(clientXToTime(200, rect, 20), 10)
})

test("clientXToTime clamps outside the track and rounds to tenths", () => {
  const rect = { left: 0, width: 100 }
  assert.equal(clientXToTime(-40, rect, 15), 0)
  assert.equal(clientXToTime(180, rect, 15), 15)
  assert.equal(clientXToTime(33, rect, 10), 3.3)
})

test("moveInsertTiming keeps duration and clamps inside the video", () => {
  const moved = moveInsertTiming(insert, 5, 20)
  assert.equal(moved.start, 5)
  assert.equal(moved.duration, 4)

  const againstEnd = moveInsertTiming(insert, 19, 10)
  assert.equal(againstEnd.start, 6)
  assert.equal(againstEnd.duration, 4)
})

test("trimInsertIn keeps the out point and respects the minimum duration", () => {
  const trimmed = trimInsertIn(insert, 3, 20)
  assert.equal(trimmed.start, 3)
  assert.equal(trimmed.duration, 3)

  const min = trimInsertIn(insert, 5.9, 20)
  assert.equal(min.start, 5.5)
  assert.equal(min.duration, MIN_DURATION)

  const beforeZero = trimInsertIn(insert, -2, 20)
  assert.equal(beforeZero.start, 0)
  assert.equal(beforeZero.duration, 6)
})

test("trimInsertOut keeps the in point and clamps to the video end", () => {
  const trimmed = trimInsertOut(insert, 8, 20)
  assert.equal(trimmed.start, 2)
  assert.equal(trimmed.duration, 6)

  const min = trimInsertOut(insert, 2.1, 20)
  assert.equal(min.start, 2)
  assert.equal(min.duration, MIN_DURATION)

  const pastEnd = trimInsertOut(insert, 40, 10)
  assert.equal(pastEnd.start, 2)
  assert.equal(pastEnd.duration, 8)
})

test("hitTimelineHandle uses edge bands and the remaining center as move", () => {
  assert.equal(hitTimelineHandle(2, 80), "in")
  assert.equal(hitTimelineHandle(78, 80), "out")
  assert.equal(hitTimelineHandle(40, 80), "move")
})
