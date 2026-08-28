# Legendas: estilo compartilhado e cores

**Data:** 2026-08-20  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado e no ar (2026-08-20).  
Doc de operador: [`docs/legendas.md`](../../legendas.md). Changelog: [`docs/changelog-2026-08-20.md`](../../changelog-2026-08-20.md).  
**Não bumpa** `Composition.version` (continua **3**). `captionStyle` é opcional na leitura.  
**Spec pai:** [`2026-08-19-legendas-automaticas-design.md`](2026-08-19-legendas-automaticas-design.md) (fatia A no ar).  
**Fora:** split/merge, SRT, “+ Legenda”, chunk &gt; 25 MB, cor por palavra, editor palavra a palavra, undo de `captionPreset`.

Antes desta fatia cada linha `legenda` tinha `x`/`y`/`fontSize`/`style` próprios. O draw ignorava cor/fundo do `style` e pintava Viral/Limpo com constantes (`#FFFFFF`, `#FFE500`, stroke preto, caixa `rgba(0,0,0,0.72)`). Mudar fonte ou posição numa linha não mexia nas outras.

---

## Objetivo

Fonte, tamanho, posição, cor do texto, cor do destaque, fundo e contorno são **um** visual. Editar no card de qualquer linha (Estilo / Movimento) ou arrastar/resize no preview aplica a **todas**. Texto e tempo continuam por linha. Viral | Limpo só escolhem o modo de desenho e **não** resetam cores. Gerar legendas de novo só troca frases/tempos. Preview = export.

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Onde mora o visual | `composition.captionStyle` (um objeto) |
| Por linha | `text`, `start`, `duration`, `words` |
| UI | Card da linha, como hoje. Estilo/Movimento gravam o objeto compartilhado |
| Viral / Limpo | Só modo: maiúsculas + contorno **ou** caixa. Não mexe em `captionStyle` |
| Gerar de novo | `replaceCaptionInserts` + `linesToCaptionInserts` não tocam `captionStyle` |
| Undo | Snapshot `{ inserts, captionStyle }`. `captionPreset` continua fora |
| Schema | Sem bump. Ausente → defaults (ou migração da primeira linha) |
| `composition.ts` | Continua **sem** importar `lib/captions.ts` |

---

## Schema

### `CaptionStyle`

Novo tipo em `lib/composition.ts` (não reutilizar `InsertStyle` inteiro — falta `highlightColor` e sobram uppercase/sombra/rotação).

```ts
interface CaptionStyle {
  x: number            // % centro, 0–100, default 50
  y: number            // % centro, 0–100, default 72
  fontSize: number     // 40–360, default 64
  maxWidthPct: number  // 20–100, default 84; sem controle novo na UI
  fontFamily: FontId   // default "geist"
  fontWeight: FontWeight // default 800; clamp na família
  color: string        // texto inativo, default "#FFFFFF"
  highlightColor: string // palavra ativa, default "#FFE500"
  bgColor: string      // caixa Limpo, default "rgba(0,0,0,0.72)"; nunca null
  strokeColor: string  // contorno Viral, default "#000000"
  strokeWidth: number  // 0–12, default 6
}
```

`parseCaptionStyle(raw)`: objeto inválido ou ausente → ver migração. Campos soltos inválidos caem no default daquele campo. Cores: mesmo parser de `parseInsertStyle` (hex / rgba). `serializeComposition` **sempre** grava o `captionStyle` resolvido.

### `Composition`

```ts
captionPreset: CaptionPreset  // já existe
captionStyle: CaptionStyle    // novo; serialize sempre escreve
```

### Insert `legenda`

Na leitura e na memória, captions **não** carregam `x` / `y` / `fontSize` / `maxWidthPct` / `style`. Na escrita, o JSON da linha só leva `id`, `type`, `kind`, `text`, `start`, `duration`, `words`, `anchor`, `animIn`, `animOut`.

`createInsert("legenda")` e `linesToCaptionInserts` **não** preenchem overlay de look. Quem precisa medir ou hit-testar mescla `captionStyle` num clone temporário (no overlay/preview), sem gravar no insert.

### Migração (JSON sem `captionStyle`)

1. Achar a primeira insert `kind === "caption"`.
2. Montar `captionStyle` a partir dos defaults, sobrescrevendo com `x`/`y`/`fontSize`/`maxWidthPct` e, se houver `style`: `fontFamily`, `fontWeight`, `color`, `bgColor` (se não null), `strokeColor`, `strokeWidth`.
3. `highlightColor` não existia → `"#FFE500"`.
4. Sem nenhuma caption → defaults puros.

Projetos só com fatia A (cores travadas no draw) abrem com posição/fonte da primeira linha e o amarelo/branco/caixa padrão.

---

## Undo

Estender `lib/composition-history.ts`: cada snapshot é `{ inserts, captionStyle }`.

- `beginInsertGesture` / `endInsertGesture` / `commitDiscrete` / `undo` / `redo` comparam e clonam os dois.
- Gesto de arraste no preview: uma entrada no undo ao soltar (igual chips).
- Patch discreto no card (Estilo/Movimento): uma entrada.
- Texto/tempo da linha: continua no array `inserts` (já coberto).
- `setCaptionPreset`: **não** chama o history.

Limite `HISTORY_LIMIT` 50 inalterado.

---

## UI

Card, tipo travado “Legenda”:

| Aba | Campos | Destino |
| --- | --- | --- |
| Conteúdo | textarea, Início, Duração | `applyCaptionPatch` na **linha** |
| Estilo | fonte, peso, tamanho, cor do texto, cor do destaque, fundo, cor do contorno, espessura | `captionStyle` |
| Movimento | X, Y | `captionStyle` |

Sem: predefinição de texto livre, paleta de chip, maiúsculas (Viral já força no paint), sombra, opacidade, rotação, escala, anim in/out.

Toggle Viral | Limpo no header: só `captionPreset`.

Se não houver caption selecionada, não há card para editar o look — o operador seleciona qualquer linha. Sem painel extra no topo.

---

## Desenho, hit-test, canvas

`drawCaptionLine(ctx, insert, time, preset, brandFontId, style: CaptionStyle)`:

1. Fora de `[start, start+duration)` → não pinta.
2. Layout: clone visual da linha com `x/y/fontSize/maxWidthPct/fontFamily/fontWeight` de `style` (não do insert). Wrap igual ao atual.
3. **Viral:** `toLocaleUpperCase("pt-BR")`; `strokeText` com `strokeColor` / `strokeWidth` (escala com a fonte, como hoje); fill inativo `color`, ativo `highlightColor`; sem caixa.
4. **Limpo:** caixa `bgColor`, radius 8 (escala); fill `color` / `highlightColor`; sem maiúsculas forçadas; sem stroke.

`strokeWidth === 0` no Viral: não traça. `drawFrame` / overlay / preview passam `composition.captionStyle`.

Hit-test e resize: bbox da frase usando o mesmo layout (style compartilhado). Arraste X/Y e handle de tamanho (`fontSize`) escrevem em `captionStyle`, não no insert.

Ordem de paint inalterada: chips → stickers → texto livre → captions.

---

## Fluxo no editor

```
Card Estilo/Movimento ou drag/resize no overlay
  → se kind caption e o patch é look (x,y,fontSize,style/cores)
      → mergeCaptionStylePatch(composition.captionStyle, patch)
      → history inclui captionStyle
  → se patch é text/start/duration
      → applyCaptionPatch na linha (reflow / retarget) como a fatia A

Gerar legendas
  → POST /api/ai/captions (intacto)
  → replaceCaptionInserts(current, linesToCaptionInserts(lines, duration))
  → captionStyle e captionPreset intactos

Gerar estrutura
  → preserva captions (já existe) e não mexe em captionStyle
```

`mergeCaptionStylePatch` vive em `composition.ts` (clamps). `lib/captions.ts` não precisa conhecer cores.

---

## Testes (sem rede)

| Arquivo | Casos |
| --- | --- |
| `lib/composition.test.ts` | parse grava/lê `captionStyle`; inválido por campo → default; JSON sem o campo + primeira caption com `y: 60` → `captionStyle.y === 60`; serialize de caption **não** emite `x`/`style`; serialize sempre inclui `captionStyle` |
| `lib/composition-history.test.ts` | undo restaura `captionStyle` sem restaurar `captionPreset`; gesto + look não mistura com um patch de texto |
| `lib/captions.test.ts` | `linesToCaptionInserts` não depende de look; `replaceCaptionInserts` não exige campos de overlay |
| `lib/compose/hit-test.test.ts` | bbox de caption usa x/y/fontSize passados (o overlay vai injetar `captionStyle` no insert virtual) |

Draw karaoke: sem teste de canvas nesta fatia (igual fatia A). Smoke: mudar cor/destaque/fundo numa linha pinta todas; Viral/Limpo não apaga a cor; Gerar de novo mantém o look; Ctrl+Z desfaz a cor.

---

## Arquivos previstos

Criar: nenhum arquivo novo obrigatório (tipo e parse em `composition.ts`).

Modificar:

- `lib/composition.ts` — `CaptionStyle`, defaults, parse/serialize, `mergeCaptionStylePatch`; serialize caption sem overlay
- `lib/composition.test.ts`
- `lib/composition-history.ts` + teste — snapshot `{ inserts, captionStyle }`
- `lib/captions.ts` — `linesToCaptionInserts` / `createInsert` alinhados (sem look na linha)
- `lib/compose/draw-captions.ts` — lê `CaptionStyle`; tira constantes de cor
- `lib/compose/draw-play.ts`, `lib/export/compositor.ts`, overlay/preview — passam `captionStyle`
- `lib/compose/hit-test.ts` — layout de caption com style compartilhado (via insert já mesclado **ou** arg extra; preferir mesclar no caller para não importar ciclo)
- `components/video-editor.tsx` — history + interceptar patch de look; Gerar legendas não reseta style
- `components/insert-style-panel.tsx` / `insert-card.tsx` — pickers de cor/destaque/fundo/contorno; valores lidos de `captionStyle`
- `docs/README.md`, `docs/proximo.md`, spec pai (nota: look agora é compartilhado)

Não: encoder, muxer, rota `/api/ai/captions`, `pnpm add`, bump de version.

---

## Critério de pronto

1. Mudar fonte, tamanho, X/Y, cor, destaque, fundo ou contorno numa linha muda o paint de **todas**.
2. Viral ↔ Limpo não altera as cores escolhidas; só maiúsculas+contorno vs caixa.
3. Gerar legendas de novo troca frases; o visual permanece.
4. Ctrl+Z / Ctrl+Shift+Z desfaz o look compartilhado; não desfaz Viral/Limpo.
5. JSON antigo (look na linha) abre com a posição/fonte da primeira caption.
6. Export Chrome = preview.
7. Testes da tabela verdes.

---

## Fora desta fatia

- Painel “Estilo das legendas” no header
- Clicar Viral/Limpo como reset de cores
- `maxWidthPct` na UI
- Sombra / opacidade / rotação em caption
- Undo de `captionPreset`
