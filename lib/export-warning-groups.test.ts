import { test } from "node:test"
import assert from "node:assert/strict"

import type { ExportWarning } from "./export-checklist.ts"
import { groupExportWarnings } from "./export-warning-groups.ts"

function warning(code: ExportWarning["code"], id: string): ExportWarning {
  return { id: `${code}:${id}`, code, insertIds: [id], title: `${code} ${id}` }
}

test("groupExportWarnings merges warnings of the same code in first-seen order", () => {
  const groups = groupExportWarnings([
    warning("overlap", "a"),
    warning("safe-top", "b"),
    warning("overlap", "c"),
  ])
  assert.deepEqual(
    groups.map((group) => [group.code, group.warnings.length]),
    [
      ["overlap", 2],
      ["safe-top", 1],
    ],
  )
  assert.equal(groups[0]?.label, "Coincidem no tempo")
})

test("groupExportWarnings returns nothing for no warnings", () => {
  assert.deepEqual(groupExportWarnings([]), [])
})
