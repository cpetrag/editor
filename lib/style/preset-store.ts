import { openEditorDb, PRESET_STORE } from "../project-store.ts"
import { canWritePresetId, createUserPreset, parseUserPresetFile } from "./user-presets.ts"
import type { UserPreset } from "./types.ts"

export interface PresetStore {
  list(): Promise<UserPreset[]>
  save(preset: UserPreset): Promise<void>
  delete(id: string): Promise<void>
}

const WRITE_ERROR = "preset de fábrica é somente-leitura"

export function createMemoryPresetStore(initial: UserPreset[] = []): PresetStore {
  const map = new Map(initial.map((preset) => [preset.id, preset]))
  return {
    async list() {
      return [...map.values()]
    },
    async save(preset) {
      if (!canWritePresetId(preset.id)) throw new Error(WRITE_ERROR)
      map.set(preset.id, createUserPreset(preset))
    },
    async delete(id) {
      if (!canWritePresetId(id)) throw new Error(WRITE_ERROR)
      map.delete(id)
    },
  }
}

function asUserPresets(records: unknown[]): UserPreset[] {
  try {
    return parseUserPresetFile({ version: 1, presets: records })
  } catch {
    return []
  }
}

export function createIndexedDbPresetStore(): PresetStore {
  return {
    async list() {
      if (typeof indexedDB === "undefined") return []
      const db = await openEditorDb()
      const records = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(PRESET_STORE, "readonly")
        const request = tx.objectStore(PRESET_STORE).getAll()
        request.onsuccess = () => resolve((request.result as unknown[]) ?? [])
        request.onerror = () =>
          reject(request.error ?? new Error("falha ao listar presets no IndexedDB"))
      })
      db.close()
      return asUserPresets(records)
    },
    async save(preset) {
      if (!canWritePresetId(preset.id)) throw new Error(WRITE_ERROR)
      const db = await openEditorDb()
      const record = createUserPreset(preset)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PRESET_STORE, "readwrite")
        tx.oncomplete = () => resolve()
        tx.onerror = () =>
          reject(tx.error ?? new Error("falha ao gravar preset no IndexedDB"))
        tx.objectStore(PRESET_STORE).put(record)
      })
      db.close()
    },
    async delete(id) {
      if (!canWritePresetId(id)) throw new Error(WRITE_ERROR)
      const db = await openEditorDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PRESET_STORE, "readwrite")
        tx.oncomplete = () => resolve()
        tx.onerror = () =>
          reject(tx.error ?? new Error("falha ao apagar preset no IndexedDB"))
        tx.objectStore(PRESET_STORE).delete(id)
      })
      db.close()
    },
  }
}
