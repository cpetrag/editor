import { createInsert, type Insert, type InsertType } from "./inserts.ts"
import { parseInsertStyle } from "./compose/insert-style.ts"
import { resolveAiType, type AiInsertDraft } from "./ai-schema.ts"

/**
 * System prompt for generateObject. JSON only; the route validates with Zod.
 */
export const IA_SYSTEM_PROMPT = `Você é um especialista em edição de vídeos curtos de alta conversão (TikTok, Reels, Shorts) para marketing de afiliados e e-commerce. Sua missão é receber a descrição de um produto ou campanha (e, se houver, a transcrição do áudio) e retornar uma configuração otimizada de elementos visuais (inserts) para serem sobrepostos ao vídeo 9:16.

ZONAS (se duration < 10s, comprima proporcionalmente):
1. GANCHO (0s a 3s): Capturar atenção imediata.
2. PROVA (3s até duration-5s): Desejo, avaliações, benefícios.
3. CTA (últimos 5s): Chamada para ação.

REGRAS DE FORMATAÇÃO:
Retorne APENAS um objeto JSON válido, sem markdown, com:
- "inserts": array (máximo 8)
- "stickerHint" opcional: { "start": number, "duration": number, "position": "top"|"center"|"bottom" } para posicionar UM PNG gerado fora deste array.

PARÂMETROS DE CADA INSERT:
- "type": "logo-shopee" | "selo-frete" | "alerta-desconto" | "preco-riscado" | "cupom" | "contador" | "barra-estoque" | "estrelas" | "seta" | "tarja-frete" | "seta-mao" | "circulo-destaque" | "bubble-comentario" | "divisor-antes-depois" | "passo" | "tarja-espera" | "texto-livre"
- NÃO use "sticker-png" no array inserts.
- "start": segundos
- "duration": segundos
- "position": "top" | "center" | "bottom"
- "animIn": "pop" | "slide-up" | "blur-in" | "typewriter" | "shake" | "none"
- "animOut": "pop" | "slide-up" | "blur-in" | "none"
- "text": string opcional
- "style" opcional:
  - "fontFamily": "geist" | "poppins" | "bebas" | "archivo" | "playfair" | "space" | "oswald" | "montserrat" | "anton"
  - "fontWeight": 400 | 500 | 600 | 700 | 800 | 900
  - "uppercase": boolean
  - "color": hex (#FFFFFF, #EE4D2D, #EE2C2C, #FFD427, #000000)
  - "bgColor": hex ou null
  - "strokeWidth": 0 a 12 (use 6 para texto claro)
  - "strokeColor": hex
  - "shadow": "none" | "soft" | "hard" | "glow"
  - "opacity": 0 a 1
  - "rotation": -30 a 30

PALETA SHOPEE: #EE4D2D, #EE2C2C, #FFD427, #FFFFFF, #000000.

ESTRATÉGIA:
- Nunca sobreponha mais de 2 elementos ao mesmo tempo na mesma "position".
- Sempre inclua urgência na transição para o CTA.
- Se for Shopee, logo-shopee no GANCHO.
- Prefira strokeWidth 6 e strokeColor #000000 quando a cor do texto for clara.`

export type AIInsert = AiInsertDraft

export function aiInsertToInsert(raw: AIInsert): Insert {
  const type: InsertType = resolveAiType(raw.type) ?? "alerta-desconto"
  const insert = createInsert(type)
  insert.start = raw.start
  insert.duration = raw.duration
  if (raw.position) insert.anchor = raw.position
  if (raw.animIn) insert.animIn = raw.animIn as Insert["animIn"]
  if (raw.animOut) insert.animOut = raw.animOut as Insert["animOut"]
  if (raw.text) insert.text = raw.text
  const style = parseInsertStyle(raw.style)
  if (style) insert.style = style
  return insert
}
