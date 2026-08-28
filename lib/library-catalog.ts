import {
  INSERT_TYPE_MAP,
  INSERT_TYPES,
  TEMPLATES,
  isAddableElementType,
  type InsertType,
  type InsertTypeMeta,
  type Template,
} from "./inserts.ts"
import { assertComboTemplate, COMBO_TEMPLATE_SCHEMA, type ComboBeat } from "./combos/schema.ts"

export const LIBRARY_CATALOG_KEY = "editor.library-catalog.v1"

export type CatalogKind = "template" | "element"

export type LibraryElementExtra = {
  id: string
  type: InsertType
  label: string
}

export type LibraryCatalog = {
  hiddenTemplateIds: string[]
  templateNames: Record<string, string>
  extraTemplates: Template[]
  hiddenElementIds: string[]
  elementNames: Record<string, string>
  extraElements: LibraryElementExtra[]
}

export type VisibleElement = {
  id: string
  type: InsertType
  label: string
  meta: InsertTypeMeta
}

export const EMPTY_LIBRARY_CATALOG: LibraryCatalog = {
  hiddenTemplateIds: [],
  templateNames: {},
  extraTemplates: [],
  hiddenElementIds: [],
  elementNames: {},
  extraElements: [],
}

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isInsertType(value: unknown): value is InsertType {
  return typeof value === "string" && value in INSERT_TYPE_MAP
}

function parseNameMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const names: Record<string, string> = {}
  for (const [id, label] of Object.entries(value)) {
    if (typeof label === "string" && label.trim()) names[id] = label.trim()
  }
  return names
}

function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function parseTemplateInsert(value: unknown): Template["inserts"][number] | null {
  if (!isRecord(value) || !isInsertType(value.type)) return null
  const start = typeof value.start === "number" && Number.isFinite(value.start) ? value.start : null
  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration) ? value.duration : null
  if (start === null || duration === null) return null
  return { ...value, type: value.type, start, duration } as Template["inserts"][number]
}

function parseBeats(
  value: unknown,
  id: string,
  name: string,
  description: string,
): ComboBeat[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  try {
    return assertComboTemplate({
      schema: COMBO_TEMPLATE_SCHEMA,
      id,
      name,
      goal: description || name,
      beats: value,
    }).beats
  } catch {
    return undefined
  }
}

function parseExtraTemplate(value: unknown): Template | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) return null
  if (typeof value.name !== "string" || !value.name.trim()) return null
  if (!Array.isArray(value.inserts)) return null
  const inserts = value.inserts
    .map(parseTemplateInsert)
    .filter((item): item is Template["inserts"][number] => item !== null)
  if (inserts.length === 0) return null
  const name = value.name.trim()
  const description = typeof value.description === "string" ? value.description : ""
  const beats = parseBeats(value.beats, value.id, name, description)
  return {
    id: value.id,
    name,
    description,
    inserts,
    ...(beats ? { beats } : {}),
  }
}

function parseExtraElement(value: unknown): LibraryElementExtra | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) return null
  if (!isInsertType(value.type) || typeof value.label !== "string" || !value.label.trim()) {
    return null
  }
  return { id: value.id, type: value.type, label: value.label.trim() }
}

export function parseLibraryCatalog(raw: unknown): LibraryCatalog {
  const data = typeof raw === "string" ? safeJson(raw) : raw
  if (!isRecord(data)) return { ...EMPTY_LIBRARY_CATALOG }
  const extraTemplates = Array.isArray(data.extraTemplates)
    ? data.extraTemplates.map(parseExtraTemplate).filter((item): item is Template => item !== null)
    : []
  const extraElements = Array.isArray(data.extraElements)
    ? data.extraElements
        .map(parseExtraElement)
        .filter((item): item is LibraryElementExtra => item !== null)
    : []
  return {
    hiddenTemplateIds: parseIdList(data.hiddenTemplateIds),
    templateNames: parseNameMap(data.templateNames),
    extraTemplates,
    hiddenElementIds: parseIdList(data.hiddenElementIds),
    elementNames: parseNameMap(data.elementNames),
    extraElements,
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function readLibraryCatalog(
  storage: StorageLike | null = defaultStorage(),
): LibraryCatalog {
  if (!storage) return { ...EMPTY_LIBRARY_CATALOG }
  return parseLibraryCatalog(storage.getItem(LIBRARY_CATALOG_KEY))
}

export function writeLibraryCatalog(
  catalog: LibraryCatalog,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  storage.setItem(LIBRARY_CATALOG_KEY, JSON.stringify(catalog))
}

function newCatalogId(prefix: string): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${raw.replace(/-/g, "").slice(0, 16)}`
}

function copyLabel(name: string): string {
  return `${name} (cópia)`
}

export function visibleTemplates(catalog: LibraryCatalog): Template[] {
  const hidden = new Set(catalog.hiddenTemplateIds)
  const builtIn = TEMPLATES.filter((item) => !hidden.has(item.id)).map((item) => ({
    ...item,
    name: catalog.templateNames[item.id] ?? item.name,
  }))
  const extras = catalog.extraTemplates.map((item) => ({
    ...item,
    name: catalog.templateNames[item.id] ?? item.name,
  }))
  return [...builtIn, ...extras]
}

export function visibleElements(catalog: LibraryCatalog): VisibleElement[] {
  const hidden = new Set(catalog.hiddenElementIds)
  const builtIn = INSERT_TYPES.filter(
    (item) => isAddableElementType(item.value) && !hidden.has(item.value),
  ).map((item) => ({
    id: item.value,
    type: item.value,
    label: catalog.elementNames[item.value] ?? item.label,
    meta: item,
  }))
  const extras = catalog.extraElements.flatMap((item) => {
    const meta = INSERT_TYPE_MAP[item.type]
    if (!meta || !isAddableElementType(item.type)) return []
    return [
      {
        id: item.id,
        type: item.type,
        label: catalog.elementNames[item.id] ?? item.label,
        meta,
      },
    ]
  })
  return [...builtIn, ...extras]
}

export function duplicateTemplateInCatalog(
  catalog: LibraryCatalog,
  template: Template,
): { catalog: LibraryCatalog; copy: Template } {
  const copy: Template = {
    ...template,
    id: newCatalogId("tpl"),
    name: copyLabel(template.name),
    inserts: template.inserts.map((insert) => ({ ...insert })),
    ...(template.beats ? { beats: template.beats.map((beat) => ({ ...beat })) } : {}),
  }
  return {
    catalog: { ...catalog, extraTemplates: [...catalog.extraTemplates, copy] },
    copy,
  }
}

export function duplicateElement(
  catalog: LibraryCatalog,
  element: { id: string; type: InsertType; label: string },
): { catalog: LibraryCatalog; copy: LibraryElementExtra } {
  const copy: LibraryElementExtra = {
    id: newCatalogId("el"),
    type: element.type,
    label: copyLabel(element.label),
  }
  return {
    catalog: { ...catalog, extraElements: [...catalog.extraElements, copy] },
    copy,
  }
}

export function renameCatalogItem(
  catalog: LibraryCatalog,
  kind: CatalogKind,
  id: string,
  name: string,
): LibraryCatalog {
  const label = name.trim()
  if (!label) return catalog
  if (kind === "template") {
    const extraTemplates = catalog.extraTemplates.map((item) =>
      item.id === id ? { ...item, name: label } : item,
    )
    return {
      ...catalog,
      extraTemplates,
      templateNames: { ...catalog.templateNames, [id]: label },
    }
  }
  const extraElements = catalog.extraElements.map((item) =>
    item.id === id ? { ...item, label } : item,
  )
  return {
    ...catalog,
    extraElements,
    elementNames: { ...catalog.elementNames, [id]: label },
  }
}

export function deleteCatalogItem(
  catalog: LibraryCatalog,
  kind: CatalogKind,
  id: string,
): LibraryCatalog {
  if (kind === "template") {
    if (catalog.extraTemplates.some((item) => item.id === id)) {
      return {
        ...catalog,
        extraTemplates: catalog.extraTemplates.filter((item) => item.id !== id),
      }
    }
    if (catalog.hiddenTemplateIds.includes(id)) return catalog
    return { ...catalog, hiddenTemplateIds: [...catalog.hiddenTemplateIds, id] }
  }
  if (catalog.extraElements.some((item) => item.id === id)) {
    return {
      ...catalog,
      extraElements: catalog.extraElements.filter((item) => item.id !== id),
    }
  }
  if (catalog.hiddenElementIds.includes(id)) return catalog
  return { ...catalog, hiddenElementIds: [...catalog.hiddenElementIds, id] }
}

export function formatApplyToast(
  kind: "combo" | "element",
  name: string,
  count: number,
): string {
  const noun = count === 1 ? "elemento" : "elementos"
  if (kind === "combo") return `Combo "${name}" aplicado · ${count} ${noun}`
  return `Elemento "${name}" aplicado · ${count} ${noun}`
}
