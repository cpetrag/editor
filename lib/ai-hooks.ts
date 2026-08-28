import { hooksModelSchema } from "./ai-schema.ts"

const HOOK_LIMIT = 4

export function parseHooksPayload(raw: unknown): string[] {
  const parsed = hooksModelSchema.safeParse(raw)
  if (!parsed.success) return []
  const cleaned: string[] = []
  for (const hook of parsed.data.hooks) {
    const text = hook.trim()
    if (!text) continue
    cleaned.push(text)
    if (cleaned.length === HOOK_LIMIT) break
  }
  return cleaned
}

export function mergeHooks(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set([...existing, ...incoming]))
}
