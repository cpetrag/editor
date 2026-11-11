const SENTENCE_END = /[.!?…]+["'”»)\]]*$/

function capitalizeFirst(text: string): string {
  return text.replace(
    /^([^0-9A-Za-zÀ-ÖØ-öø-ÿ]*)([a-zà-öø-ÿ])/u,
    (_, lead: string, letter: string) => lead + letter.toLocaleUpperCase("pt-BR"),
  )
}

function isLoneE(text: string): boolean {
  return /^[^A-Za-zÀ-ÖØ-öø-ÿ]*E[^A-Za-zÀ-ÖØ-öø-ÿ]*$/.test(text)
}

/**
 * "E" solto só vira "e" no meio da frase.
 * Depois de . ! ? — inclusive na linha seguinte — a primeira letra fica maiúscula.
 */
export function tidyCaptionSpeech<T extends { text: string }>(words: readonly T[]): T[] {
  return words.map((word, index) => {
    const previous = index > 0 ? words[index - 1]!.text.trim() : ""
    const sentenceStart = index > 0 && SENTENCE_END.test(previous)
    let text = word.text
    if (sentenceStart) text = capitalizeFirst(text)
    else if (isLoneE(text)) text = text.replace("E", "e")
    if (text === word.text) return word
    return { ...word, text }
  })
}
