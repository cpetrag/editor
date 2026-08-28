export function splitBubbleCopy(text: string): { user: string; body: string } {
  const trimmed = text.trim()
  if (!trimmed) return { user: "", body: "" }
  const breakAt = trimmed.search(/\r?\n/)
  if (breakAt !== -1) {
    const first = trimmed.slice(0, breakAt).trim()
    const user = first.startsWith("@") ? first : `@${first}`
    return { user, body: trimmed.slice(breakAt + 1).trim() }
  }
  const withAt = trimmed.startsWith("@") ? trimmed : `@${trimmed}`
  const space = withAt.indexOf(" ")
  if (space === -1) return { user: withAt, body: "" }
  return { user: withAt.slice(0, space), body: withAt.slice(space + 1).trim() }
}

export function wrapsElementShape(shape: string): boolean {
  return shape === "stars" || shape === "bubble"
}
