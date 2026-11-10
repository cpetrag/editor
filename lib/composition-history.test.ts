import { test } from "node:test"
import assert from "node:assert/strict"

import { DEFAULT_CAPTION_STYLE, type CaptionStyle, type CompositionInsert } from "./composition.ts"
import { defaultCompositionAudio, type CompositionAudio } from "./audio/types.ts"
import {
  HISTORY_LIMIT,
  beginInsertGesture,
  commitDiscrete,
  emptyHistory,
  endInsertGesture,
  historyShortcut,
  pushPast,
  redo,
  undo,
  type HistorySnapshot,
} from "./composition-history.ts"

function chip(id: string, text = "OFF"): CompositionInsert {
  return {
    id,
    type: "alerta-desconto",
    start: 0,
    duration: 2,
    text,
    anchor: "top",
    animIn: "none",
    animOut: "none",
  }
}

function snap(
  inserts: CompositionInsert[],
  captionStyle: CaptionStyle = DEFAULT_CAPTION_STYLE,
): HistorySnapshot {
  return { inserts, captionStyle }
}

test("pushPast + undo restores the previous array including deleted id", () => {
  const before = snap([chip("a"), chip("b")])
  const after = snap([chip("a")])
  const pushed = pushPast(emptyHistory(), before, after)
  const result = undo(pushed, after)
  assert.equal(result.present.inserts.length, 2)
  assert.equal(result.present.inserts[1]?.id, "b")
  assert.equal(result.history.past.length, 0)
  assert.equal(result.history.future.length, 1)
})

test("undo then redo returns the array from after the action", () => {
  const before = snap([chip("a")])
  const after = snap([chip("a"), chip("b")])
  const pushed = pushPast(emptyHistory(), before, after)
  const undone = undo(pushed, after)
  const redone = redo(undone.history, undone.present)
  assert.equal(redone.present.inserts.length, 2)
  assert.equal(redone.present.inserts[1]?.id, "b")
  assert.equal(redone.history.future.length, 0)
})

test("pushPast after undo clears future", () => {
  const a = snap([chip("a")])
  const b = snap([chip("a"), chip("b")])
  const c = snap([chip("c")])
  const pushed = pushPast(emptyHistory(), a, b)
  const undone = undo(pushed, b)
  const next = pushPast(undone.history, undone.present, c)
  assert.equal(next.future.length, 0)
  assert.equal(undo(next, c).present.inserts[0]?.id, "a")
})

function audioSnap(patch: {
  volume?: number
  muted?: boolean
  duckingEnabled?: boolean
} = {}): HistorySnapshot {
  const audio: CompositionAudio = defaultCompositionAudio()
  return {
    inserts: [],
    captionStyle: DEFAULT_CAPTION_STYLE,
    audio: {
      ...audio,
      original: { volume: patch.volume ?? 1, muted: patch.muted ?? false },
      ducking: { ...audio.ducking, enabled: patch.duckingEnabled ?? true },
    },
  }
}

test("undo restores original volume and redo puts it back", () => {
  const before = audioSnap({ volume: 1 })
  const after = audioSnap({ volume: 0.38 })
  const pushed = pushPast(emptyHistory(), before, after)
  const undone = undo(pushed, after)
  assert.equal(undone.present.audio?.original.volume, 1)
  const redone = redo(undone.history, undone.present)
  assert.equal(redone.present.audio?.original.volume, 0.38)
})

test("undo restores original mute and ducking toggle", () => {
  const audible = audioSnap({ muted: false, duckingEnabled: true })
  const muted = audioSnap({ muted: true, duckingEnabled: true })
  const undoneMute = undo(pushPast(emptyHistory(), audible, muted), muted)
  assert.equal(undoneMute.present.audio?.original.muted, false)
  assert.equal(redo(undoneMute.history, undoneMute.present).present.audio?.original.muted, true)

  const duckedOff = audioSnap({ duckingEnabled: false })
  const undoneDuck = undo(pushPast(emptyHistory(), audible, duckedOff), duckedOff)
  assert.equal(undoneDuck.present.audio?.ducking.enabled, true)
  assert.equal(redo(undoneDuck.history, undoneDuck.present).present.audio?.ducking.enabled, false)
})

test("a slider gesture with several inputs is a single history entry", () => {
  const start = audioSnap({ volume: 1 })
  const gesture = beginInsertGesture(start)
  const samples = [0.8, 0.55, 0.38].map((volume) => audioSnap({ volume }))
  const closed = samples.reduce(
    (open, sample) => ({ gesture: open.gesture, present: sample }),
    { gesture, present: start },
  )
  const committed = endInsertGesture(emptyHistory(), closed.gesture, closed.present)
  assert.equal(committed.history.past.length, 1)
  const undone = undo(committed.history, closed.present)
  assert.equal(undone.present.audio?.original.volume, 1)
  assert.equal(redo(undone.history, undone.present).present.audio?.original.volume, 0.38)
})

test("pushPast with equal JSON does not grow past", () => {
  const inserts = snap([chip("a", "OFF")])
  const same = snap([chip("a", "OFF")])
  const next = pushPast(emptyHistory(), inserts, same)
  assert.equal(next.past.length, 0)
})

test("51 pushes keep only 50; oldest is dropped", () => {
  let history = emptyHistory()
  let present = snap([chip("0")])
  for (let i = 1; i <= 51; i++) {
    const next = snap([chip(String(i))])
    history = pushPast(history, present, next)
    present = next
  }
  assert.equal(history.past.length, HISTORY_LIMIT)
  const first = undo(history, present)
  assert.notEqual(first.present.inserts[0]?.id, "0")
})

test("gesture with three patches is one pushPast; undo returns baseline", () => {
  const baseline = snap([chip("a", "OFF")])
  const end = snap([{ ...chip("a", "x"), x: 40, y: 50 }])
  const gesture = beginInsertGesture(baseline)
  const closed = endInsertGesture(emptyHistory(), gesture, end)
  assert.equal(closed.history.past.length, 1)
  const undone = undo(closed.history, end)
  assert.equal(undone.present.inserts[0]?.text, "OFF")
  assert.equal(undone.present.inserts[0]?.x, undefined)
})

test("endInsertGesture with no change leaves past empty", () => {
  const inserts = snap([chip("a")])
  const gesture = beginInsertGesture(inserts)
  const closed = endInsertGesture(emptyHistory(), gesture, inserts)
  assert.equal(closed.history.past.length, 0)
  assert.equal(closed.gesture.active, false)
})

test("undo with empty past leaves present unchanged", () => {
  const present = snap([chip("a")])
  const result = undo(emptyHistory(), present)
  assert.equal(result.present.inserts[0]?.id, "a")
  assert.equal(result.history.past.length, 0)
})

test("commitDiscrete while a gesture is open records baseline then the discrete step", () => {
  const baseline = snap([chip("a"), chip("b")])
  const dragged = snap([{ ...chip("a"), x: 10 }, chip("b")])
  const deleted = snap([{ ...chip("a"), x: 10 }])
  const gesture = beginInsertGesture(baseline)
  const committed = commitDiscrete(emptyHistory(), gesture, dragged, deleted)
  assert.equal(committed.gesture.active, false)
  const once = undo(committed.history, deleted)
  assert.equal(once.present.inserts.length, 2)
  assert.equal(once.present.inserts[0]?.x, 10)
  const twice = undo(once.history, once.present)
  assert.equal(twice.present.inserts[0]?.x, undefined)
})

test("beginInsertGesture while already active keeps the first baseline", () => {
  const first = beginInsertGesture(snap([chip("a")]))
  const second = beginInsertGesture(snap([chip("b")]), first)
  assert.equal(second.baseline?.inserts[0]?.id, "a")
})

test("historyShortcut maps ctrl/meta z y and shift+z", () => {
  assert.equal(
    historyShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false }),
    "undo",
  )
  assert.equal(
    historyShortcut({ key: "Z", ctrlKey: false, metaKey: true, shiftKey: true }),
    "redo",
  )
  assert.equal(
    historyShortcut({ key: "y", ctrlKey: true, metaKey: false, shiftKey: false }),
    "redo",
  )
  assert.equal(
    historyShortcut({ key: "z", ctrlKey: false, metaKey: false, shiftKey: false }),
    null,
  )
})

test("undo restores tracks.styleRef", () => {
  const before = snap([chip("a")])
  const after: HistorySnapshot = {
    ...snap([chip("a")]),
    tracks: { cta: { styleRef: { presetId: "carrinhoLaranja", overrides: {} } } },
  }
  const pushed = pushPast(emptyHistory(), before, after)
  const result = undo(pushed, after)
  assert.equal(result.present.tracks, undefined)
  const redone = redo(result.history, result.present)
  assert.equal(redone.present.tracks?.cta?.styleRef?.presetId, "carrinhoLaranja")
})

test("undo restores captionStyle and not captionPreset", () => {
  const before = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, color: "#FF0000" })
  const after = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, color: "#00FF00" })
  const pushed = pushPast(emptyHistory(), before, after)
  const result = undo(pushed, after)
  assert.equal(result.present.captionStyle.color, "#FF0000")
  assert.equal(result.present.inserts[0]?.id, "a")
})

test("gesture snapshot restores captionStyle from baseline", () => {
  const baseline = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, y: 72 })
  const end = snap([chip("a")], { ...DEFAULT_CAPTION_STYLE, y: 50 })
  const gesture = beginInsertGesture(baseline)
  const closed = endInsertGesture(emptyHistory(), gesture, end)
  const undone = undo(closed.history, end)
  assert.equal(undone.present.captionStyle.y, 72)
})

test("undo restores sourceTransform pan", () => {
  const before = snap([chip("a")])
  const after: HistorySnapshot = {
    ...snap([chip("a")]),
    sourceTransform: { scale: 1.5, x: 40, y: 62 },
  }
  const pushed = pushPast(emptyHistory(), before, after)
  const undone = undo(pushed, after)
  assert.equal(undone.present.sourceTransform, undefined)
  const redone = redo(undone.history, undone.present)
  assert.deepEqual(redone.present.sourceTransform, { scale: 1.5, x: 40, y: 62 })
})

test("pushPast treats watermarkEnabled change as a new snapshot", () => {
  const before = snap([chip("a")])
  const after: HistorySnapshot = { ...snap([chip("a")]), watermarkEnabled: true }
  const pushed = pushPast(emptyHistory(), before, after)
  assert.equal(pushed.past.length, 1)
  const undone = undo(pushed, after)
  assert.equal(undone.present.watermarkEnabled, undefined)
})
