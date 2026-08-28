# Fontes novas + pesos honestos

**Data:** 2026-08-19  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado (9 famílias + pesos honestos). Catálogo **atual** (16 famílias, picker com preview, 2026-08-22): [`../../fontes.md`](../../fontes.md).  
**Não bumpa** `Composition.version`.  
**Depende:** `style.fontFamily` / `style.fontWeight` da Fase 1; `ensureComposeFontsReady` no preview/export.

Este spec descreve a fatia de **19/08** (Oswald, Montserrat, Anton + `WEIGHTS_BY_FONT`). Não editar a tabela abaixo como se fosse o catálogo vivo.

Hoje há 6 famílias. Bebas Neue e Archivo Black só existem no peso 400, mas a UI
oferece 400–900. Playfair e Space Grotesk no `layout` não pedem pesos
explícitos. O export dá `fonts.load` em 400/600/700/800 para **todas**.

---

## Objetivo

Três famílias novas no picker (Biblioteca, aba Estilo, lote) **e** o dropdown de
peso só lista o que aquela fonte realmente tem. Preview e MP4 carregam só esses
pesos. JSON antigo com peso inválido **abre** e pinta o peso clampado; o parse
não reescreve o arquivo.

Fora: Inter Tight, upload TTF, pesos 200/300 na UI, renomear IDs antigos,
`AnimBlock`, tipos novos, lote ffmpeg.

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Famílias novas | `oswald`, `montserrat`, `anton` (IDs iguais ao Studio) |
| Pesos na UI | Só os reais da família. 1 peso → Select visível com 400 |
| Peso inválido no JSON | Draw usa `clampFontWeight` (mais próximo **para baixo**). Parse **não** altera o JSON |
| Trocar família no card | Grava o peso clampado se o atual não existir na nova |
| Schema | Sem campo novo. Sem bump de versão |
| Catálogo | Uma tabela `WEIGHTS_BY_FONT`; UI e `fonts.load` leem ela |

---

## Catálogo

`FONT_IDS` (ordem estável; as 6 atuais primeiro, depois as 3):

```
geist, poppins, bebas, archivo, playfair, space, oswald, montserrat, anton
```

`WEIGHTS_BY_FONT`:

| ID | Família CSS | Pesos |
| --- | --- | --- |
| `geist` | Geist | 400, 500, 600, 700, 800, 900 |
| `poppins` | Poppins | 400, 500, 600, 700, 800, 900 |
| `bebas` | Bebas Neue | 400 |
| `archivo` | Archivo Black | 400 |
| `playfair` | Playfair Display | 400, 500, 600, 700, 800, 900 |
| `space` | Space Grotesk | 400, 500, 600, 700 |
| `oswald` | Oswald | 400, 500, 600, 700 |
| `montserrat` | Montserrat | 400, 500, 600, 700, 800, 900 |
| `anton` | Anton | 400 |

`FontWeight` continua `400 \| 500 \| 600 \| 700 \| 800 \| 900`. Não entra 200/300.

`parseFontId` aceita os IDs canônicos e aliases atuais (`bebas-neue` → `bebas`,
`archivo-black` → `archivo`, `space-grotesk` → `space`). Novos aliases: `oswald`,
`montserrat`, `anton` (id = alias). Desconhecido → `undefined` (comportamento
atual: cai no default do tipo / geist).

`FONT_OPTIONS` (`lib/inserts.ts`) ganha 3 linhas no mesmo formato (`label`,
`family: var(--font-…)`, `vibe` curto). Biblioteca e lote consomem isso.

---

## `clampFontWeight(fontId, weight)`

1. Se `weight` está em `WEIGHTS_BY_FONT[fontId]`, devolve `weight`.
2. Senão, o maior peso da lista que seja `<= weight`.
3. Se nenhum for `<=` (não acontece com as tabelas acima, mínimo 400), o menor da lista.

Exemplos:

- `clampFontWeight("bebas", 800)` → `400`
- `clampFontWeight("oswald", 900)` → `700`
- `clampFontWeight("montserrat", 700)` → `700`
- `clampFontWeight("anton", 400)` → `400`

`resolveInsertStyle` / o `ctx.font` usam o peso **já clampado**. O objeto
`style` persistido pode continuar com 800 em Bebas até o operador mexer na UI.

Ao mudar `fontFamily` no card: se o peso atual não está na nova lista, `onChange`
grava `{ fontFamily, fontWeight: clampFontWeight(next, atual) }`.

---

## `next/font` (`app/layout.tsx`)

`display: 'block'`, `subsets: ['latin']`.

- Poppins, Geist, Playfair, Montserrat: `weight` explícito `400`–`900` (os da tabela).
- Space Grotesk, Oswald: `400`–`700`.
- Bebas Neue, Archivo Black, Anton: `400`.
- Variáveis: `--font-oswald`, `--font-montserrat`, `--font-anton` + as 6 atuais.
- `canvasFontFamily` em `lib/compose/fonts.ts` mapeia os 9 IDs para o nome de
  família que o canvas usa (`"Oswald, sans-serif"`, `"Montserrat, sans-serif"`,
  `"Anton, sans-serif"`, …).

`ensureComposeFontsReady`: para cada id usado, `document.fonts.load` **só** dos
pesos de `WEIGHTS_BY_FONT[id]` (não a lista fixa 400/600/700/800).

---

## UI

Aba Estilo: Select de peso itera `WEIGHTS_BY_FONT[fontId]`, não `FONT_WEIGHTS`.
Fonte de 1 peso: o Select permanece, com um item `400`.

Biblioteca → Fontes e o painel de lote: 9 cards/checks, mesmo `FONT_OPTIONS`.

CSS `.ins-*` e animações: intocados.

---

## Testes

`lib/compose/insert-style.test.ts`:

- `FONT_IDS` tem os 9 IDs na ordem do spec
- `parseFontId("oswald" | "montserrat" | "anton")` canônico
- `clampFontWeight` nos quatro exemplos acima
- `WEIGHTS_BY_FONT.space` não inclui 800/900; `bebas` / `archivo` / `anton` só `[400]`

`lib/compose/fonts.test.ts`:

- `canvasFontFamily("oswald")` contém `Oswald`
- `fontIdsUsedInComposition` coleta `oswald` de `insert.style.fontFamily`

---

## Fora desta fatia

- Inter Tight, Anton “falso negrito”, upload de fonte
- Alias `montserrat-extrabold` do Studio
- Mudar IDs `archivo` / `bebas` / `space`
- IA, lote no servidor, tipos novos de insert
