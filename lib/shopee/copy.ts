import { completeShortCopy } from "../ai-openai.ts"
import { acceptCopiedPhrase, acceptShortName, clipPhrase, fallbackShortName } from "./format.ts"

const NAME_SYSTEM = [
  "Você resume o título de um produto da Shopee em 2 a 4 palavras, em português do Brasil.",
  "Use só palavras que já estão no título.",
  "Não invente adjetivo, não cite marca de terceiro e não use aspas.",
  "Se o título trouxer qualificador de material ou autenticidade — PU, sintético, eco, réplica, inspired, tipo, similar — não o apague.",
  "Couro PU continua Couro PU. Nunca escreva só couro quando o título diz PU ou sintético.",
  "Se não couber o qualificador, tire o material do nome curto em vez de omitir PU, sintético, eco, réplica, inspired, tipo ou similar.",
  "Responda apenas o nome curto.",
].join(" ")

const PHRASE_SYSTEM = [
  "Escolha um trecho completo de até 60 caracteres, copiado palavra por palavra do texto da avaliação.",
  "Não reescreva o sentido e não troque nenhuma palavra.",
  "O trecho termina no fim de uma frase ou numa vírgula, nunca no meio de uma oração.",
  "Pode ajustar só a maiúscula da primeira letra.",
  "Sem aspas. Se não houver um trecho completo, responda EXTRACT_FAIL.",
].join(" ")

export async function shortenTitle(title: string): Promise<string> {
  if (!title.trim()) return ""
  try {
    const text = await completeShortCopy(NAME_SYSTEM, title)
    return acceptShortName(title, text)
  } catch (error) {
    console.error("[shopee] nome curto", error instanceof Error ? error.message : error)
    return fallbackShortName(title)
  }
}

export async function phraseFromReview(text: string): Promise<string> {
  try {
    const raw = await completeShortCopy(PHRASE_SYSTEM, text)
    if (!raw || /EXTRACT_FAIL/i.test(raw)) return clipPhrase(text)
    return acceptCopiedPhrase(text, raw)
  } catch (error) {
    console.error("[shopee] frase de avaliação", error instanceof Error ? error.message : error)
    return clipPhrase(text)
  }
}
