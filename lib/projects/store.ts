import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export type StoredEditorProject = {
  id: string
  createdAt: string
  videoJobId: string
  videoFileName: string
  voiceJobId?: string
  voiceFileName?: string
  composition: unknown
}

const ID_PATTERN = /^[a-f0-9]{24}$/i

function dir(): string {
  return path.join(process.cwd(), "data", "editor-projects")
}

export function saveEditorProject(project: Omit<StoredEditorProject, "id" | "createdAt">): StoredEditorProject {
  fs.mkdirSync(dir(), { recursive: true })
  const stored: StoredEditorProject = {
    id: crypto.randomBytes(12).toString("hex"),
    createdAt: new Date().toISOString(),
    ...project,
  }
  fs.writeFileSync(path.join(dir(), `${stored.id}.json`), JSON.stringify(stored))
  return stored
}

export function readEditorProject(id: string): StoredEditorProject | null {
  if (!ID_PATTERN.test(id)) return null
  const file = path.join(dir(), `${id}.json`)
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as StoredEditorProject
  } catch {
    return null
  }
}
