import { fillVars, type ProductData } from "./runs.ts"
import { hashSeed } from "../motion/hash.ts"

export type ContentSlot = "gancho" | "prova" | "oferta" | "cta"
export type ContentNiche = "shopee" | "moda" | "beleza" | "bebe"

export type ContentPreset = {
  id: string
  slot: ContentSlot
  niche: ContentNiche
  text: string
  style: string
  pack: string
  y: number
  claim?: boolean
}

export const CONTENT_PRESETS: ContentPreset[] = [
  { id: "gancho-shopee-1", slot: "gancho", niche: "shopee", text: "PARA TUDO 🛑", style: "duplo", pack: "carimbo", y: 20 },
  { id: "gancho-shopee-2", slot: "gancho", niche: "shopee", text: "Achei na Shopee e *não acreditei*", style: "sticker", pack: "estouro", y: 22 },
  { id: "gancho-shopee-3", slot: "gancho", niche: "shopee", text: "Isso aqui *viralizou* por um motivo", style: "sombra-longa", pack: "cascata", y: 22 },
  { id: "gancho-shopee-4", slot: "gancho", niche: "shopee", text: "Não compre {produto} antes de ver isso", style: "marca-texto", pack: "cascata", y: 24 },
  { id: "gancho-shopee-5", slot: "gancho", niche: "shopee", text: "POV: você achou o *achadinho* do mês", style: "sticker", pack: "estouro", y: 22 },
  { id: "gancho-shopee-6", slot: "gancho", niche: "shopee", text: "Só {preco}?! *Sério?*", style: "duplo", pack: "carimbo", y: 22 },
  { id: "gancho-moda-1", slot: "gancho", niche: "moda", text: "A calça que *afina* a cintura", style: "editorial", pack: "elegante", y: 20 },
  { id: "gancho-moda-2", slot: "gancho", niche: "moda", text: "Veste do {tamanhos} 😱", style: "vazado", pack: "estouro", y: 22 },
  { id: "gancho-moda-3", slot: "gancho", niche: "moda", text: "Parece de loja cara, custa *{preco}*", style: "script-caps", pack: "elegante", y: 22 },
  { id: "gancho-moda-4", slot: "gancho", niche: "moda", text: "Look pronto com *1 peça*", style: "editorial", pack: "elegante", y: 20 },
  { id: "gancho-beleza-1", slot: "gancho", niche: "beleza", text: "O perfume que *todo mundo* pergunta", style: "neon-rosa", pack: "elegante", y: 22 },
  { id: "gancho-beleza-2", slot: "gancho", niche: "beleza", text: "Make pronta em *5 minutos*", style: "por-do-sol", pack: "estouro", y: 22 },
  { id: "gancho-bebe-1", slot: "gancho", niche: "bebe", text: "Mamãe, *para tudo*!", style: "bolha", pack: "fofinho", y: 22 },
  { id: "gancho-bebe-3", slot: "gancho", niche: "bebe", text: "Salvou minhas noites 😴", style: "sticker", pack: "fofinho", y: 22 },
  { id: "prova-shopee-1", slot: "prova", niche: "shopee", text: "⭐ {nota} · {vendidos} vendidos", style: "pilula-marca", pack: "flutuar", y: 70 },
  { id: "prova-shopee-2", slot: "prova", niche: "shopee", text: "Chegou em *3 dias*", style: "balao", pack: "digitacao", y: 66 },
  { id: "prova-shopee-3", slot: "prova", niche: "shopee", text: "Comprei e *aprovei*", style: "marca-texto", pack: "flutuar", y: 68 },
  { id: "prova-shopee-4", slot: "prova", niche: "shopee", text: "ANTES × DEPOIS", style: "contador-bold", pack: "estouro", y: 50 },
  { id: "prova-moda-1", slot: "prova", niche: "moda", text: "Estica *sem deformar*", style: "fita", pack: "flutuar", y: 64, claim: true },
  { id: "prova-moda-2", slot: "prova", niche: "moda", text: "Cintura alta de verdade", style: "grife", pack: "digitacao", y: 70 },
  { id: "prova-moda-3", slot: "prova", niche: "moda", text: "Tem do {tamanhos}", style: "bilhete", pack: "flutuar", y: 68 },
  { id: "prova-beleza-1", slot: "prova", niche: "beleza", text: "Fixação de *12h*", style: "vidro", pack: "flutuar", y: 68, claim: true },
  { id: "prova-beleza-3", slot: "prova", niche: "beleza", text: "\"Meu marido perguntou o que eu passei\"", style: "balao", pack: "digitacao", y: 64 },
  { id: "prova-bebe-1", slot: "prova", niche: "bebe", text: "Pacote com *{qtd}* unidades", style: "bilhete", pack: "flutuar", y: 68 },
  { id: "prova-bebe-2", slot: "prova", niche: "bebe", text: "Não vazou *nenhuma vez*", style: "balao", pack: "digitacao", y: 66, claim: true },
  { id: "oferta-shopee-1", slot: "oferta", niche: "shopee", text: "~~{preco_de}~~ *{preco}*", style: "preco-gigante", pack: "preco", y: 58 },
  { id: "oferta-shopee-2", slot: "oferta", niche: "shopee", text: "-{desconto}% *SÓ HOJE*", style: "selo", pack: "alerta", y: 30 },
  { id: "oferta-shopee-3", slot: "oferta", niche: "shopee", text: "CUPOM *{cupom}*", style: "etiqueta", pack: "preco", y: 60 },
  { id: "oferta-shopee-4", slot: "oferta", niche: "shopee", text: "FRETE GRÁTIS 🚚", style: "tarja", pack: "alerta", y: 62 },
  { id: "oferta-shopee-5", slot: "oferta", niche: "shopee", text: "Últimas *unidades*", style: "contador-bold", pack: "alerta", y: 62 },
  { id: "oferta-moda-1", slot: "oferta", niche: "moda", text: "Combina com tudo e custa *{preco}*", style: "grife", pack: "preco", y: 66 },
  { id: "oferta-beleza-1", slot: "oferta", niche: "beleza", text: "Kit completo por *{preco}*", style: "pilula-marca", pack: "preco", y: 64 },
  { id: "oferta-bebe-1", slot: "oferta", niche: "bebe", text: "Sai *muito mais barato* no pacotão", style: "bolha", pack: "preco", y: 62 },
  { id: "cta-shopee-1", slot: "cta", niche: "shopee", text: "Toca no *carrinho laranja* 🧡", style: "pilula-marca", pack: "cta-seta", y: 78 },
  { id: "cta-shopee-2", slot: "cta", niche: "shopee", text: "Link aqui embaixo 👇", style: "sticker", pack: "cta-seta", y: 78 },
  { id: "cta-shopee-3", slot: "cta", niche: "shopee", text: "Comenta *EU QUERO* que te mando o link", style: "balao", pack: "cta-seta", y: 76 },
  { id: "cta-shopee-4", slot: "cta", niche: "shopee", text: "Salva pra não perder", style: "pilula-marca", pack: "flutuar", y: 78 },
  { id: "cta-shopee-5", slot: "cta", niche: "shopee", text: "Corre que tá *acabando*", style: "duplo", pack: "alerta", y: 76 },
  { id: "cta-moda-1", slot: "cta", niche: "moda", text: "Escolhe sua cor no *link*", style: "script-caps", pack: "cta-seta", y: 78 },
  { id: "cta-beleza-1", slot: "cta", niche: "beleza", text: "Manda pra *amiga* que precisa", style: "bilhete", pack: "cta-seta", y: 78 },
  { id: "cta-bebe-1", slot: "cta", niche: "bebe", text: "Manda pra *mamãe* que precisa", style: "bolha", pack: "cta-seta", y: 78 },
  { id: "gancho-shopee-7", slot: "gancho", niche: "shopee", text: "Você tá pagando caro *à toa*", style: "quadrinho", pack: "estouro", y: 22 },
  { id: "gancho-shopee-8", slot: "gancho", niche: "shopee", text: "O achadinho que *esgota* toda semana", style: "manchete", pack: "cascata", y: 20 },
  { id: "gancho-shopee-9", slot: "gancho", niche: "shopee", text: "ACHADO DO *DIA*", style: "fita-preta", pack: "carimbo", y: 18 },
  { id: "gancho-shopee-10", slot: "gancho", niche: "shopee", text: "Testei pra você não *errar*", style: "retro", pack: "estouro", y: 22 },
  { id: "gancho-shopee-11", slot: "gancho", niche: "shopee", text: "Ninguém te contou *isso*", style: "neon-azul", pack: "cascata", y: 22 },
  { id: "gancho-shopee-12", slot: "gancho", niche: "shopee", text: "Barato que *parece caro*", style: "dourado", pack: "elegante", y: 22 },
  { id: "gancho-moda-5", slot: "gancho", niche: "moda", text: "Look de *R$ 50* que parece de loja", style: "dourado", pack: "elegante", y: 20 },
  { id: "gancho-moda-6", slot: "gancho", niche: "moda", text: "Esse jeans *veste bem* todo corpo", style: "retro", pack: "estouro", y: 22, claim: true },
  { id: "gancho-moda-7", slot: "gancho", niche: "moda", text: "Para de comprar *roupa que não serve*", style: "manchete", pack: "cascata", y: 20 },
  { id: "gancho-beleza-4", slot: "gancho", niche: "beleza", text: "Pele de *vidro* em 3 passos", style: "dourado", pack: "elegante", y: 22 },
  { id: "gancho-beleza-5", slot: "gancho", niche: "beleza", text: "A make que *não derrete* no calor", style: "neon-rosa", pack: "cascata", y: 22, claim: true },
  { id: "gancho-beleza-6", slot: "gancho", niche: "beleza", text: "Cabelo de salão *em casa*", style: "script-caps", pack: "elegante", y: 22 },
  { id: "gancho-bebe-4", slot: "gancho", niche: "bebe", text: "Mamãe de primeira viagem, *salva esse*", style: "gordinho", pack: "fofinho", y: 22 },
  { id: "gancho-bebe-5", slot: "gancho", niche: "bebe", text: "O que eu *mais usei* no 1º mês", style: "post-it", pack: "fofinho", y: 22 },
  { id: "gancho-bebe-6", slot: "gancho", niche: "bebe", text: "Hora do banho *sem choro* 🛁", style: "gordinho", pack: "fofinho", y: 22, claim: true },
  { id: "prova-shopee-5", slot: "prova", niche: "shopee", text: "Chegou *bem embalado* 📦", style: "recibo", pack: "digitacao", y: 66 },
  { id: "prova-shopee-6", slot: "prova", niche: "shopee", text: "Já é a *terceira vez* que eu compro", style: "post-it", pack: "flutuar", y: 68 },
  { id: "prova-shopee-7", slot: "prova", niche: "shopee", text: "{vendidos} pessoas *já levaram*", style: "cartao", pack: "flutuar", y: 70 },
  { id: "prova-shopee-8", slot: "prova", niche: "shopee", text: "Nota *{nota}* de 5 ⭐", style: "quadrinho", pack: "estouro", y: 62 },
  { id: "prova-shopee-9", slot: "prova", niche: "shopee", text: "Comparei com a loja: *mesma coisa*", style: "sublinhado", pack: "digitacao", y: 68, claim: true },
  { id: "prova-moda-4", slot: "prova", niche: "moda", text: "Tecido *grosso*, não fica transparente", style: "recibo", pack: "digitacao", y: 66, claim: true },
  { id: "prova-moda-5", slot: "prova", niche: "moda", text: "Usei o {tamanhos}: *ficou perfeito*", style: "post-it", pack: "flutuar", y: 68 },
  { id: "prova-moda-6", slot: "prova", niche: "moda", text: "Não amassa *na mala*", style: "cartao", pack: "flutuar", y: 68, claim: true },
  { id: "prova-beleza-4", slot: "prova", niche: "beleza", text: "Antes e *depois* de 7 dias", style: "sublinhado", pack: "estouro", y: 66 },
  { id: "prova-beleza-5", slot: "prova", niche: "beleza", text: "Um pote rende *meses*", style: "cartao", pack: "flutuar", y: 68, claim: true },
  { id: "prova-beleza-6", slot: "prova", niche: "beleza", text: "Não testado em animais 🐰", style: "recibo", pack: "digitacao", y: 66, claim: true },
  { id: "prova-bebe-3", slot: "prova", niche: "bebe", text: "Pediatra *aprovou* aqui em casa", style: "post-it", pack: "flutuar", y: 66, claim: true },
  { id: "prova-bebe-4", slot: "prova", niche: "bebe", text: "Lava na máquina *sem estragar*", style: "cartao", pack: "flutuar", y: 68, claim: true },
  { id: "prova-bebe-5", slot: "prova", niche: "bebe", text: "Vem com *{qtd}* unidades", style: "gordinho", pack: "estouro", y: 64 },
  { id: "oferta-shopee-6", slot: "oferta", niche: "shopee", text: "*-{desconto}%*", style: "numero-gigante", pack: "preco", y: 42 },
  { id: "oferta-shopee-7", slot: "oferta", niche: "shopee", text: "De ~~{preco_de}~~ por *{preco}*", style: "manchete", pack: "preco", y: 60 },
  { id: "oferta-shopee-8", slot: "oferta", niche: "shopee", text: "Com o cupom *{cupom}*", style: "fita-preta", pack: "alerta", y: 58 },
  { id: "oferta-shopee-9", slot: "oferta", niche: "shopee", text: "Leve 2, *pague menos*", style: "quadrinho", pack: "alerta", y: 60 },
  { id: "oferta-shopee-10", slot: "oferta", niche: "shopee", text: "Menor preço *em 30 dias*", style: "cartao", pack: "preco", y: 64, claim: true },
  { id: "oferta-shopee-11", slot: "oferta", niche: "shopee", text: "Só até *meia-noite* ⏰", style: "fita-preta", pack: "alerta", y: 60, claim: true },
  { id: "oferta-moda-2", slot: "oferta", niche: "moda", text: "Todas as cores por *{preco}*", style: "dourado", pack: "preco", y: 64 },
  { id: "oferta-moda-3", slot: "oferta", niche: "moda", text: "Do {tamanhos} pelo *mesmo preço*", style: "retro", pack: "preco", y: 62 },
  { id: "oferta-beleza-2", slot: "oferta", niche: "beleza", text: "Leve o kit e *ganhe brinde* 🎁", style: "dourado", pack: "preco", y: 62, claim: true },
  { id: "oferta-beleza-3", slot: "oferta", niche: "beleza", text: "*{desconto}% OFF* hoje", style: "numero-gigante", pack: "preco", y: 44 },
  { id: "oferta-bebe-2", slot: "oferta", niche: "bebe", text: "Pacotão com *{qtd}* por *{preco}*", style: "gordinho", pack: "preco", y: 62 },
  { id: "oferta-bebe-3", slot: "oferta", niche: "bebe", text: "Frete grátis *pra todo o Brasil*", style: "tarja", pack: "alerta", y: 62, claim: true },
  { id: "cta-shopee-6", slot: "cta", niche: "shopee", text: "Clica no *link* antes que acabe", style: "botao", pack: "cta-seta", y: 78 },
  { id: "cta-shopee-7", slot: "cta", niche: "shopee", text: "Garante o seu 👇", style: "botao", pack: "cta-seta", y: 78 },
  { id: "cta-shopee-8", slot: "cta", niche: "shopee", text: "Segue pra ver *mais achadinhos*", style: "sublinhado", pack: "flutuar", y: 78 },
  { id: "cta-shopee-9", slot: "cta", niche: "shopee", text: "Marca quem *precisa disso*", style: "quadrinho", pack: "cta-seta", y: 76 },
  { id: "cta-shopee-10", slot: "cta", niche: "shopee", text: "Link na *bio* 🔗", style: "neon-azul", pack: "cta-seta", y: 78 },
  { id: "cta-moda-2", slot: "cta", niche: "moda", text: "Pega o seu no *link* 🛍️", style: "dourado", pack: "cta-seta", y: 78 },
  { id: "cta-moda-3", slot: "cta", niche: "moda", text: "Comenta *TAMANHO* que eu te ajudo", style: "cartao", pack: "cta-seta", y: 76 },
  { id: "cta-beleza-2", slot: "cta", niche: "beleza", text: "Salva pra *próxima compra* 💄", style: "post-it", pack: "flutuar", y: 78 },
  { id: "cta-beleza-3", slot: "cta", niche: "beleza", text: "Corre no *link* da bio", style: "neon-rosa", pack: "cta-seta", y: 78 },
  { id: "cta-bebe-2", slot: "cta", niche: "bebe", text: "Salva pra *lista do enxoval* 🍼", style: "post-it", pack: "flutuar", y: 78 },
  { id: "cta-bebe-3", slot: "cta", niche: "bebe", text: "Manda no grupo *das mães*", style: "gordinho", pack: "cta-seta", y: 78 },
]

export function isContentNiche(value: string): value is ContentNiche {
  return value === "shopee" || value === "moda" || value === "beleza" || value === "bebe"
}

export function contentPresetById(id: string): ContentPreset | undefined {
  return CONTENT_PRESETS.find((preset) => preset.id === id)
}

export function contentPresetsFor(slot: ContentSlot, niche: ContentNiche): ContentPreset[] {
  return CONTENT_PRESETS.filter((preset) => preset.slot === slot && preset.niche === niche)
}

export function contentPresetReady(preset: ContentPreset, data: ProductData | undefined): boolean {
  return fillVars(preset.text, data).empty.length === 0
}

function hasVariable(preset: ContentPreset): boolean {
  return fillVars(preset.text, {}).empty.length > 0
}

/** Receitas com variáveis preenchidas. Se nenhuma servir, a primeira sem variável. */
export function usableContentPresets(
  slot: ContentSlot,
  niche: ContentNiche,
  data: ProductData | undefined,
): ContentPreset[] {
  const all = contentPresetsFor(slot, niche)
  const ready = all.filter((preset) => contentPresetReady(preset, data))
  if (ready.length > 0) return ready
  return all.filter((preset) => !hasVariable(preset))
}

export function firstContentPreset(
  slot: ContentSlot,
  niche: ContentNiche,
  data?: ProductData,
): ContentPreset | undefined {
  if (data) return usableContentPresets(slot, niche, data)[0]
  return contentPresetsFor(slot, niche)[0]
}

/** Próxima receita do mesmo momento e nicho. O seed do projeto torna o salto reproduzível. */
export function nextContentPreset(
  currentId: string,
  seed: string,
  data?: ProductData,
): ContentPreset | undefined {
  const current = contentPresetById(currentId)
  if (!current) return undefined
  const pool = (data ? usableContentPresets(current.slot, current.niche, data) : contentPresetsFor(current.slot, current.niche)).filter(
    (preset) => preset.id !== currentId,
  )
  if (pool.length === 0) return data ? usableContentPresets(current.slot, current.niche, data)[0] : current
  const index = hashSeed(`${seed}:${currentId}`) % pool.length
  return pool[index]
}
