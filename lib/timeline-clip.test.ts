import { test } from "node:test"
import assert from "node:assert/strict"

import { MIN_DURATION } from "./composition.ts"
import { resolveTrimWindow } from "./source-trim.ts"
import { buildVideoTimeline } from "./video/timeline.ts"
import {
  clientXToTime,
  hitTimelineHandle,
  insertOutputLimit,
  moveInsertTiming,
  trimInsertIn,
  formatTimecode,
  stepFrameIndex,
  trimInsertOut,
} from "./timeline-clip.ts"

const insert = { start: 2, duration: 4 }

test("stepFrameIndex parte do quadro mais próximo e fica dentro do vídeo", () => {
  assert.equal(stepFrameIndex(1, 1, 30, 10), 31)
  assert.equal(stepFrameIndex(1, -10, 30, 10), 20)
  // 4,4s veio de um clique na timeline (décimos): quadro 132, não 131 ou 133.
  assert.equal(stepFrameIndex(4.4, 1, 30, 10), 133)
  assert.equal(stepFrameIndex(0, -1, 30, 10), 0)
  assert.equal(stepFrameIndex(10, 5, 30, 10), 299)
  assert.equal(stepFrameIndex(5, 1, 0, 10), 0)
})

test("formatTimecode mostra minuto, segundo e quadro", () => {
  assert.equal(formatTimecode(0, 30), "0:00:00")
  assert.equal(formatTimecode(4.4, 30), "0:04:12")
  assert.equal(formatTimecode(65 + 29 / 30, 30), "1:05:29")
  assert.equal(formatTimecode(-3, 30), "0:00:00")
})

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

test("insertOutputLimit uses the output timeline when playback separates the clocks", () => {
  const sourceTrimEnd = 5.733
  const timelineDuration = 14.6
  const limit = insertOutputLimit({
    timelineDuration,
    sourceTrimEnd,
    separateOutputClock: true,
  })
  assert.equal(limit, timelineDuration)

  const endingAtSource = { start: 3.733, duration: 2 }
  const stuck = moveInsertTiming(endingAtSource, 30, sourceTrimEnd)
  assert.ok(stuck.start + stuck.duration <= sourceTrimEnd + 0.02)

  const freed = moveInsertTiming(endingAtSource, 30, limit)
  assert.equal(freed.duration, 2)
  assert.ok(freed.start + freed.duration > sourceTrimEnd + 1)
  assert.ok(freed.start + freed.duration <= timelineDuration + 0.001)
})

test("insertOutputLimit on a 0.85× boomerang is the output duration, not the source end", () => {
  const media = { duration: 5.73, fps: 30 }
  const timeline = buildVideoTimeline(
    media,
    { speed: 0.85, fill: "pingpong", fit: "audio" },
    13.48,
  )
  const sourceTrimEnd = resolveTrimWindow(media).end
  assert.ok(timeline.duration > sourceTrimEnd + 1)
  const limit = insertOutputLimit({
    timelineDuration: timeline.duration,
    sourceTrimEnd,
    separateOutputClock: true,
  })
  assert.equal(limit, timeline.duration)
  const clip = { start: 3.7, duration: 2 }
  const moved = moveInsertTiming(clip, timeline.duration, limit)
  assert.ok(moved.start + moved.duration > sourceTrimEnd + 1)
})

test("insertOutputLimit keeps the source trim when the timeline clock is the file", () => {
  assert.equal(
    insertOutputLimit({ timelineDuration: 12, sourceTrimEnd: 12, separateOutputClock: false }),
    12,
  )
  assert.equal(
    insertOutputLimit({ timelineDuration: 12, sourceTrimEnd: 8, separateOutputClock: false }),
    8,
  )
  assert.equal(
    insertOutputLimit({ timelineDuration: 0, sourceTrimEnd: 0, separateOutputClock: false }),
    0,
  )
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
