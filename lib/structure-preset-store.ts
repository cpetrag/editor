import { STRUCTURE_STORE, openEditorDb } from "./project-store.ts"

export type StructurePresetRecord = {
  id: string
  name: string
  hook: string
  proof: string
  cta: string
}

function isRecord(value: unknown): value is StructurePresetRecord {
  if (!value || typeof value !== "object") return false
  const record = value as StructurePresetRecord
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.hook === "string" &&
    typeof record.proof === "string" &&
    typeof record.cta === "string"
  )
}

export async function listStructurePresets(): Promise<StructurePresetRecord[]> {
  if (typeof indexedDB === "undefined") return []
  try {
    const db = await openEditorDb()
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(STRUCTURE_STORE, "readonly")
      const request = tx.objectStore(STRUCTURE_STORE).getAll()
      request.onsuccess = () => resolve((request.result as unknown[]) ?? [])
      request.onerror = () => reject(request.error)
    })
    db.close()
    return records.filter(isRecord)
  } catch (error) {
    console.warn("[editor] não foi possível ler estruturas", error)
    return []
  }
}

export async function saveStructurePreset(preset: StructurePresetRecord): Promise<void> {
  const db = await openEditorDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STRUCTURE_STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("falha ao gravar estrutura"))
    tx.objectStore(STRUCTURE_STORE).put(preset)
  })
  db.close()
}
