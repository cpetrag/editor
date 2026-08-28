import type { DeepPartial } from "./types.ts"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function mergeLayer<T>(base: T, overlay: DeepPartial<T> | undefined): T {
  if (overlay === undefined) return base
  if (Array.isArray(overlay)) return cloneJson(overlay) as T
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return cloneJson(overlay) as T
  }

  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      next[key] = cloneJson(value)
      continue
    }
    const current = next[key]
    if (isPlainObject(current) && isPlainObject(value)) {
      next[key] = mergeLayer(current, value)
      continue
    }
    next[key] = isPlainObject(value) || typeof value === "object" ? cloneJson(value) : value
  }
  return next as T
}

export function deepMerge<T>(base: T, ...layers: Array<DeepPartial<T> | undefined>): T {
  let result = cloneJson(base)
  for (const layer of layers) {
    result = mergeLayer(result, layer)
  }
  return result
}

export function hasPath(value: unknown, path: string): boolean {
  if (!path) return false
  let current: unknown = value
  for (const part of path.split(".")) {
    if (!isPlainObject(current) || !(part in current)) return false
    current = current[part]
    if (current === undefined) return false
  }
  return true
}

export function isEmptyOverrides(value: unknown): boolean {
  if (value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  if (isPlainObject(value)) {
    return Object.values(value).every((entry) => isEmptyOverrides(entry))
  }
  return false
}

export function setAtPath<T>(value: T, path: string, nextValue: unknown): T {
  if (!path) return cloneJson(nextValue) as T
  const parts = path.split(".")
  const root: Record<string, unknown> = isPlainObject(value) ? { ...value } : {}
  let cursor: Record<string, unknown> = root
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    if (!part) continue
    const current = cursor[part]
    cursor[part] = isPlainObject(current) ? { ...current } : {}
    cursor = cursor[part] as Record<string, unknown>
  }
  const leaf = parts[parts.length - 1]
  if (leaf) cursor[leaf] = cloneJson(nextValue)
  return root as T
}

export function deleteAtPath<T>(value: T, path: string): T {
  if (!path || !isPlainObject(value)) return value
  const parts = path.split(".")
  const root: Record<string, unknown> = { ...value }

  function prune(node: Record<string, unknown>, remaining: string[]): boolean {
    const [head, ...rest] = remaining
    if (!head || !(head in node)) return false
    if (rest.length === 0) {
      delete node[head]
      return true
    }
    const child = node[head]
    if (!isPlainObject(child)) return false
    const nextChild = { ...child }
    prune(nextChild, rest)
    if (isEmptyOverrides(nextChild)) delete node[head]
    else node[head] = nextChild
    return true
  }

  prune(root, parts)
  return root as T
}
