const MARK = /[,.!?;:…]+$/

function stem(token: string): string {
  return token.replace(/^[\s"'“”«»()[\]-]+|[\s"'“”«»()[\].,:;!?…-]+$/g, "").toLocaleLowerCase("pt-BR")
}

/** Cola pontuação solta no token anterior e devolve a mesma quantidade de palavras. */
export function alignPunctuatedTokens(
  words: readonly string[],
  raw: readonly string[],
): string[] | null {
  const glued: string[] = []
  for (const token of raw) {
    const trimmed = token.trim()
    if (!trimmed) continue
    if (/^[,.!?;:…]+$/.test(trimmed)) {
      if (glued.length > 0) glued[glued.length - 1] += trimmed
      continue
    }
    glued.push(trimmed)
  }

  const aligned = [...words]
  let cursor = 0
  let attached = 0
  for (let index = 0; index < words.length; index += 1) {
    const want = stem(words[index] ?? "")
    if (!want) continue
    let found = -1
    for (let probe = cursor; probe < glued.length; probe += 1) {
      if (stem(glued[probe] ?? "") === want) {
        found = probe
        break
      }
    }
    if (found < 0) continue
    cursor = found + 1
    const mark = (glued[found] ?? "").match(MARK)?.[0] ?? ""
    if (!mark || aligned[index]?.endsWith(mark)) continue
    aligned[index] = `${words[index]}${mark}`
    attached += 1
  }
  return attached > 0 ? aligned : null
}
