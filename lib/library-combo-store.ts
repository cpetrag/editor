import { LIBRARY_COMBO_STORE, openEditorDb } from "./project-store.ts"
import type { Template } from "./inserts.ts"

export async function listUserCombos(): Promise<Template[]> {
  if (typeof indexedDB === "undefined") return []
  try {
    const db = await openEditorDb()
    const records = await new Promise<Template[]>((resolve, reject) => {
      const tx = db.transaction(LIBRARY_COMBO_STORE, "readonly")
      const request = tx.objectStore(LIBRARY_COMBO_STORE).getAll()
      request.onsuccess = () => resolve((request.result as Template[]) ?? [])
      request.onerror = () => reject(request.error)
    })
    db.close()
    return records.filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
  } catch (error) {
    console.warn("[editor] não foi possível ler os combos", error)
    return []
  }
}

export async function saveUserCombo(template: Template): Promise<void> {
  const db = await openEditorDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIBRARY_COMBO_STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(LIBRARY_COMBO_STORE).put(template)
  })
  db.close()
}

export async function deleteUserCombo(id: string): Promise<void> {
  const db = await openEditorDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIBRARY_COMBO_STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(LIBRARY_COMBO_STORE).delete(id)
  })
  db.close()
}
