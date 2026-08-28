import { materializeBlob } from "./blob.ts"
import {
  parseComposition,
  serializeComposition,
  type Composition,
} from "./composition.ts"

export const COMPOSITION_STORAGE_KEY = "editor.composition.v1"
export const EDITOR_DB_NAME = "editor-video"
export const EDITOR_DB_VERSION = 2
export const FILE_STORE = "files"
export const PRESET_STORE = "presets"

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface StoredVideoFile {
  blob: Blob
  fileName: string
  mimeType: string
}

export interface VideoFileStore {
  save(
    id: string,
    blob: Blob,
    meta: { fileName: string; mimeType: string },
  ): Promise<void>
  load(id: string): Promise<StoredVideoFile | null>
  delete(id: string): Promise<void>
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function saveCompositionJson(
  composition: Composition,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  storage.setItem(COMPOSITION_STORAGE_KEY, serializeComposition(composition))
}

export function loadCompositionJson(
  storage: StorageLike | null = defaultStorage(),
): Composition | null {
  if (!storage) return null
  const raw = storage.getItem(COMPOSITION_STORAGE_KEY)
  if (!raw) return null
  try {
    return parseComposition(JSON.parse(raw) as unknown)
  } catch (error) {
    console.warn("[editor] composição inválida no storage", error)
    return null
  }
}

export function createMemoryFileStore(): VideoFileStore {
  const map = new Map<string, StoredVideoFile>()
  return {
    async save(id, blob, meta) {
      map.set(id, { blob, fileName: meta.fileName, mimeType: meta.mimeType })
    },
    async load(id) {
      return map.get(id) ?? null
    },
    async delete(id) {
      map.delete(id)
    },
  }
}

export function openEditorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EDITOR_DB_NAME, EDITOR_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE)
      }
      if (!db.objectStoreNames.contains(PRESET_STORE)) {
        db.createObjectStore(PRESET_STORE, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("falha ao abrir IndexedDB"))
  })
}

export function createIndexedDbFileStore(): VideoFileStore {
  return {
    async save(id, blob, meta) {
      const db = await openEditorDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, "readwrite")
        tx.oncomplete = () => resolve()
        tx.onerror = () =>
          reject(tx.error ?? new Error("falha ao gravar vídeo no IndexedDB"))
        tx.objectStore(FILE_STORE).put(
          {
            blob,
            fileName: meta.fileName,
            mimeType: meta.mimeType,
            updatedAt: Date.now(),
          },
          id,
        )
      })
      db.close()
    },
    async load(id) {
      const db = await openEditorDb()
      const record = await new Promise<
        | { blob: Blob; fileName: string; mimeType: string }
        | undefined
      >((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, "readonly")
        const request = tx.objectStore(FILE_STORE).get(id)
        request.onsuccess = () =>
          resolve(request.result as { blob: Blob; fileName: string; mimeType: string } | undefined)
        request.onerror = () =>
          reject(request.error ?? new Error("falha ao ler vídeo no IndexedDB"))
      })
      if (!record?.blob) {
        db.close()
        return null
      }
      const blob = await materializeBlob(record.blob)
      db.close()
      return {
        blob,
        fileName: record.fileName,
        mimeType: record.mimeType,
      }
    },
    async delete(id) {
      const db = await openEditorDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, "readwrite")
        tx.oncomplete = () => resolve()
        tx.onerror = () =>
          reject(tx.error ?? new Error("falha ao apagar vídeo no IndexedDB"))
        tx.objectStore(FILE_STORE).delete(id)
      })
      db.close()
    },
  }
}
