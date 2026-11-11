import { openEditorDb, PALETTE_STORE } from "../project-store.ts"
import { parseCustomBrandKit, type CustomBrandKit } from "./kits.ts"

export interface PaletteStore {
  list(): Promise<CustomBrandKit[]>
  save(kit: CustomBrandKit): Promise<void>
  delete(id: string): Promise<void>
}

export function createMemoryPaletteStore(initial: CustomBrandKit[] = []): PaletteStore {
  const map = new Map(initial.map((kit) => [kit.id, kit]))
  return {
    async list() {
      return [...map.values()]
    },
    async save(kit) {
      const parsed = parseCustomBrandKit(kit)
      if (!parsed) throw new Error("paleta inválida")
      map.set(parsed.id, parsed)
    },
    async delete(id) {
      map.delete(id)
    },
  }
}

export function createIndexedDbPaletteStore(): PaletteStore {
  return {
    async list() {
      if (typeof indexedDB === "undefined") return []
      const db = await openEditorDb()
      const records = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(PALETTE_STORE, "readonly")
        const request = tx.objectStore(PALETTE_STORE).getAll()
        request.onsuccess = () => resolve((request.result as unknown[]) ?? [])
        request.onerror = () => reject(request.error ?? new Error("falha ao listar paletas"))
      })
      db.close()
      return records.flatMap((record) => {
        const kit = parseCustomBrandKit(record)
        return kit ? [kit] : []
      })
    },
    async save(kit) {
      const parsed = parseCustomBrandKit(kit)
      if (!parsed) throw new Error("paleta inválida")
      const db = await openEditorDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PALETTE_STORE, "readwrite")
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error("falha ao gravar paleta"))
        tx.objectStore(PALETTE_STORE).put(parsed)
      })
      db.close()
    },
    async delete(id) {
      const db = await openEditorDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PALETTE_STORE, "readwrite")
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error("falha ao apagar paleta"))
        tx.objectStore(PALETTE_STORE).delete(id)
      })
      db.close()
    },
  }
}
