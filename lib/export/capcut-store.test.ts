import assert from "node:assert/strict"
import { test } from "node:test"

import {
  EXPORT_PREFS_KEY,
  loadExportPrefs,
  saveExportPrefs,
} from "./capcut-store.ts"

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
  }
}

test("sem chave o padrão é copiar para a pasta CapCut", () => {
  assert.deepEqual(loadExportPrefs(memoryStorage()), { saveToCapcut: true })
})

test("save then load round-trips saveToCapcut", () => {
  const storage = memoryStorage()
  saveExportPrefs({ saveToCapcut: false }, storage)
  assert.equal(storage.getItem(EXPORT_PREFS_KEY), JSON.stringify({ saveToCapcut: false }))
  assert.deepEqual(loadExportPrefs(storage), { saveToCapcut: false })
})

test("JSON inválido volta para o padrão", () => {
  const storage = memoryStorage({ [EXPORT_PREFS_KEY]: "{not json" })
  assert.deepEqual(loadExportPrefs(storage), { saveToCapcut: true })
})
