import { assertComboTemplate, COMBO_TEMPLATE_SCHEMA, type ComboBeat, type ComboElementId, type ComboTemplate } from "./schema.ts"

function textBeat(
  track: ComboBeat["track"],
  presetId: string,
  text: string,
  x: number,
  y: number,
  extra: Partial<ComboBeat> = {},
): ComboBeat {
  return {
    track,
    atPct: 0.1,
    durPct: 0.75,
    kind: "text",
    presetId,
    text,
    x,
    y,
    scale: 1,
    ...extra,
  }
}

function elementBeat(
  track: ComboBeat["track"],
  elementId: ComboElementId,
  text: string,
  x: number,
  y: number,
  extra: Partial<ComboBeat> = {},
): ComboBeat {
  return {
    track,
    atPct: 0.1,
    durPct: 0.75,
    kind: "element",
    elementId,
    text,
    x,
    y,
    scale: 1,
    ...extra,
  }
}

const RAW_COMBOS: unknown[] = [
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "desconto-relampago",
    name: "Desconto Relâmpago",
    goal: "Parar o scroll e mostrar o preço",
    beats: [
      textBeat("gancho", "impacto", "PAREI TUDO PRA TE MOSTRAR ISSO", 50, 22),
      textBeat("prova", "etiqueta-preco", "R$ 49,90", 50, 48),
      textBeat("cta", "pilula-preta", "LINK NA BIO 👆", 50, 78),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "frete-gratis",
    name: "Frete Grátis",
    goal: "Destacar o frete e empurrar a compra",
    beats: [
      textBeat("gancho", "contorno-tiktok", "ACHEI COM FRETE GRÁTIS", 50, 22),
      elementBeat("prova", "selo-frete", "FRETE GRÁTIS", 50, 48),
      textBeat("cta", "pilula-preta", "CORRE QUE ACABA", 50, 78),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "prova-social",
    name: "Prova Social",
    goal: "Mostrar que muita gente já comprou",
    beats: [
      textBeat("gancho", "impacto", "12 MIL PESSOAS JÁ COMPRARAM", 50, 22),
      elementBeat("prova", "estrelas", "4,9 · 12mil", 50, 42, { durPct: 0.8 }),
      textBeat("prova", "apoio", "nota 4,9 de 5", 50, 58, { atPct: 0.2, durPct: 0.65 }),
      textBeat("cta", "bloco", "GARANTA O SEU", 50, 78),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "escassez",
    name: "Escassez",
    goal: "Criar urgência de estoque",
    beats: [
      textBeat("gancho", "marcador", "últimas unidades", 50, 22),
      elementBeat("prova", "barra-estoque", "Restam 3", 50, 50),
      textBeat("cta", "etiqueta-preco", "ESGOTANDO", 50, 78),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "antes-depois",
    name: "Antes e Depois",
    goal: "Contrastar o resultado",
    beats: [
      textBeat("gancho", "bloco", "ANTES", 28, 28, { durPct: 0.8 }),
      textBeat("gancho", "bloco", "DEPOIS", 72, 28, { atPct: 0.12, durPct: 0.78 }),
      textBeat("prova", "apoio", "o resultado que você vai ver", 50, 52),
      textBeat("cta", "pilula-preta", "QUERO ESSE RESULTADO", 50, 78),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "tutorial-3-passos",
    name: "Tutorial 3 Passos",
    goal: "Ensinar o caminho até a compra",
    beats: [
      textBeat("gancho", "maquina", "1. ABRA O APP", 50, 28),
      textBeat("prova", "maquina", "2. ESCOLHA O PRODUTO", 50, 48),
      textBeat("cta", "maquina", "3. TOQUE EM COMPRAR", 50, 72),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "cupom-preco",
    name: "Cupom + Preço",
    goal: "Mostrar o desconto com código",
    beats: [
      textBeat("gancho", "impacto", "ESSE CUPOM MUDA O PREÇO", 50, 22),
      elementBeat("prova", "preco-riscado", "R$ 49,90", 50, 42, { durPct: 0.8 }),
      elementBeat("prova", "cupom", "SHOPEE10", 50, 58, { atPct: 0.2, durPct: 0.65 }),
      textBeat("cta", "etiqueta-preco", "SHOPEE10", 50, 78),
    ],
  },
  {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "espera-final",
    name: "Espera até o Final",
    goal: "Segurar até a revelação",
    beats: [
      textBeat("gancho", "marcador", "espera até o final", 50, 22),
      textBeat("prova", "apoio", "tem uma condição especial", 50, 50),
      textBeat("cta", "impacto", "A CONDIÇÃO É AGORA", 50, 72),
    ],
  },
]

export const COMBO_TEMPLATES: ComboTemplate[] = RAW_COMBOS.map((raw) => assertComboTemplate(raw))

export const COMBO_TEMPLATE_IDS = COMBO_TEMPLATES.map((combo) => combo.id)

export function getComboTemplate(id: string): ComboTemplate | undefined {
  return COMBO_TEMPLATES.find((combo) => combo.id === id)
}
