# Fontes — catálogo, picker e carregamento

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** 16 famílias **no ar** (preview, rascunho e MP4 Final). Dropdown pinta o nome **na própria família**.  
**Schema:** `Composition.version` **4**. Sem campo novo. Sem bump.  
**Spec 2026-08-19 (9 famílias):** [`superpowers/specs/2026-08-19-fontes-novas-design.md`](superpowers/specs/2026-08-19-fontes-novas-design.md) — pesos honestos e `clampFontWeight` continuam; o catálogo deste arquivo **substitui** a lista de 9.

Uma tabela só (`FONT_IDS` + `WEIGHTS_BY_FONT`). UI, `document.fonts.load`, canvas e Remotion leem ela. JSON antigo com peso que a família não tem **abre** e pinta o peso clampado; o parse **não** reescreve o arquivo.

---

## 1. O que o operador vê

1. Abrir **Fonte** (bloco Visual das legendas, acordeão Tipografia na aba Estilo, card de insert legado). Cada linha mostra o **nome no desenho da família** e uma vibe curta embaixo (ex.: Alfa Slab One · “Slab · gancho”).
2. Biblioteca → Fontes e o lote: cards com texto de exemplo na família (`FontPreviewCard`). O dropdown e os cards usam o mesmo `FONT_OPTIONS`.
3. **Peso** lista só o que a família tem. Família de um peso (Anton, Bebas, …): o Select fica, com um item `400`.
4. Trocar a família com peso inválido na nova **grava o peso clampado** (mais próximo para baixo).
5. Preview, rascunho e Final usam a mesma família. Geist / Playfair / Space Grotesk / Oswald **continuam** no catálogo (não saíram para caber as novas).

Hard refresh (Ctrl+Shift+R) depois do publish.

---

## 2. Catálogo (ordem estável)

IDs em `FONT_IDS` (`lib/compose/insert-style.ts`). Labels e CSS vars em `FONT_OPTIONS` (`lib/fonts.ts`, reexportado por `lib/inserts.ts`).

| ID | Família | Pesos | CSS var | Vibe |
| --- | --- | --- | --- | --- |
| `geist` | Geist | 400–900 | `--font-geist-sans` | Neutra · padrão |
| `poppins` | Poppins | 400–900 | `--font-poppins` | Geométrica · amigável |
| `bebas` | Bebas Neue | 400 | `--font-bebas` | Condensada · impacto |
| `archivo` | Archivo Black | 400 | `--font-archivo` | Pesada · chamativa |
| `playfair` | Playfair Display | 400–900 | `--font-playfair` | Serifada · elegante |
| `space` | Space Grotesk | 400–700 | `--font-space` | Técnica · moderna |
| `oswald` | Oswald | 400–700 | `--font-oswald` | Condensada · anúncio |
| `montserrat` | Montserrat | 400–900 | `--font-montserrat` | Geométrica · hook |
| `anton` | Anton | 400 | `--font-anton` | Display · impacto |
| `inter` | Inter | 400–900 | `--font-inter` | Neutra · UI |
| `alfa` | Alfa Slab One | 400 | `--font-alfa` | Slab · gancho |
| `nunito` | Nunito | 400–900 | `--font-nunito` | Redonda · amigável |
| `lilita` | Lilita One | 400 | `--font-lilita` | Display · brincalhona |
| `luckiest` | Luckiest Guy | 400 | `--font-luckiest` | HQ · cartoon |
| `baloo` | Baloo 2 | 400–800 | `--font-baloo` | Redonda · infantil |
| `titan` | Titan One | 400 | `--font-titan` | Pesada · grito |

`FontWeight` continua `400 | 500 | 600 | 700 | 800 | 900`. Não entra 200/300 na UI.

Famílias só 400: Bebas Neue, Archivo Black, Anton, Alfa Slab One, Lilita One, Luckiest Guy, Titan One.

### Aliases (`parseFontId`)

Canônico = o ID da tabela. Também aceitos:

| Alias | Vira |
| --- | --- |
| `bebas-neue` | `bebas` |
| `archivo-black` | `archivo` |
| `playfair-display` | `playfair` |
| `space-grotesk` | `space` |
| `alfa-slab`, `alfa-slab-one` | `alfa` |
| `lilita-one` | `lilita` |
| `luckiest-guy` | `luckiest` |
| `baloo-2`, `baloo2` | `baloo` |
| `titan-one` | `titan` |

Desconhecido → `undefined` (cai no default do tipo / Geist). Não há alias `montserrat-extrabold`.

### Canvas (`lib/compose/fonts.ts`)

Nome que o `ctx.font` usa, não a CSS var:

`Geist` / `Poppins` / `"Bebas Neue"` / `"Archivo Black"` / `"Playfair Display"` / `"Space Grotesk"` / `"Oswald"` / `Montserrat` / `Anton` / `Inter` / `"Alfa Slab One"` (serif) / `Nunito` / `"Lilita One"` / `"Luckiest Guy"` / `"Baloo 2"` / `"Titan One"`.

---

## 3. Três carregamentos

O picker precisa da família no **DOM** (`next/font`). O preview/rascunho pintam no **canvas**. O Final carrega de novo no processo Remotion.

| Camada | Onde | Como |
| --- | --- | --- |
| UI (dropdown + cards) | `app/layout.tsx` | `next/font/google`, `display: 'block'`, `subsets: ['latin']`, variável `--font-*` |
| Preview + rascunho | `ensureComposeFontsReady` | `document.fonts.load` só dos pesos de `WEIGHTS_BY_FONT` |
| MP4 Final | `remotion/load-fonts.ts` | `@remotion/google-fonts/<Família>` via `LOADERS[fontId]`; `fontIdsForRender` pega brand + inserts + captionStyle + presets |

`next/font` (export do Google): `Alfa_Slab_One`, `Nunito`, `Lilita_One`, `Luckiest_Guy`, `Baloo_2`, `Titan_One` (+ as 10 antigas).

Módulos Remotion: `AlfaSlabOne`, `Nunito`, `LilitaOne`, `LuckiestGuy`, `Baloo2`, `TitanOne` (+ as 10 antigas).

Mudou `remotion/load-fonts.ts` → rebuild Next **e** `pm2 restart editor-render`. Só `pm2 restart editor-video` **não** recarrega o bundle do Final. Ver [`remotion-export.md`](remotion-export.md) §3 e [`../deploy.md`](../deploy.md) §2.

---

## 4. Picker com preview

`components/font-option-label.tsx`: nome em `font.family` (`text-base`) + vibe em `font-sans` 0,65 rem.

Usado no Select de Fonte de:

- `style-customize-panel.tsx` (Visual das legendas e Estilo factory)
- `insert-style-panel.tsx` (caption legado + texto)

O `SelectTrigger` padrão faz `line-clamp-1` e cortava as duas linhas. Esses triggers usam `h-auto min-h-9` e `*:data-[slot=select-value]:line-clamp-none`.

Biblioteca / lote: `components/library-font-card.tsx` (`FontPreviewCard`) — já pintava o sample na família.

---

## 5. Testes

```bash
node --experimental-strip-types --test lib/compose/insert-style.test.ts lib/compose/fonts.test.ts
```

- `FONT_IDS` tem os 16 IDs na ordem da tabela
- `parseFontId` aceita canônicos + aliases das 6 novas
- `WEIGHTS_BY_FONT` das famílias 400 e Baloo/Nunito
- `canvasFontFamily("alfa" | "nunito" | …)` devolve o nome do canvas
- `fontIdsForRender` inclui as fontes dos presets mesmo sem inserts

---

## 6. Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/compose/insert-style.ts` | `FONT_IDS`, `WEIGHTS_BY_FONT`, aliases, `clampFontWeight` |
| `lib/compose/fonts.ts` | `canvasFontFamily`, `fontIdsUsedInComposition`, `fontIdsForRender` |
| `lib/fonts.ts` | `FONT_OPTIONS` (label, var, vibe) |
| `app/layout.tsx` | `next/font/google` + variáveis |
| `remotion/load-fonts.ts` | loaders do Final |
| `components/font-option-label.tsx` | nome na família no dropdown |
| `components/style-customize-panel.tsx` / `insert-style-panel.tsx` | Select Fonte |
| `components/library-font-card.tsx` | cards da Biblioteca / lote |

---

## 7. Fora deste contrato

- Upload de TTF, Inter Tight, pesos 200/300, alias `montserrat-extrabold`
- Mudar IDs `archivo` / `bebas` / `space`
- **Gerar com IA** ainda lista no system prompt só as 9 de 2026-08-19 (`geist`…`anton`). O picker já tem Inter + as 6 novas; a Mini não as escolhe sozinha até alguém atualizar `lib/ai-prompt.ts`. Não misturar com este doc.

Changelog do dia: [`changelog-2026-08-22.md`](changelog-2026-08-22.md) §C.
