# Marca d’água global (texto / handle)

**Data:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** no ar 2026-08-22 (`editor.macmini-capture.cc`). Plano em `plans/2026-08-22-marca-dagua.md`.  
**Não bumpa** `Composition.version` (continua **4**). Campo aditivo opcional na composição.  
**Não é** a Fase 3 de `docs/inserts-ui.md`. Sem encoder novo. Sem PNG nesta fatia.

Não confundir com `source.watermarked` (flag da Shopee no MP4 importado). Esta marca é **nossa**, pintada no canvas.

## Objetivo

O operador liga uma marca d’água opcional no anúncio para dificultar cópia. O texto (`@handle`) e o movimento (parado / loop) são **do editor**, iguais em todos os vídeos. Só o interruptor **Neste vídeo** é do projeto. Preview, rascunho e Final pintam o mesmo raster.

## Decisões

| Tema | Escolha |
| --- | --- |
| Recorte | **A:** camada do compositor + config partida |
| Conteúdo | Texto / `@handle`. PNG fora |
| Visual | Um texto só, Geist 800, branco. Default opacidade **0,22** / **42 px**. Controles numéricos: [`2026-08-22-marca-dagua-controles-design.md`](2026-08-22-marca-dagua-controles-design.md) |
| Loop ligado | Quica nas bordas (ping-pong X/Y). Posição = `f(tempo do vídeo)` |
| Loop desligado | Canto inferior direito, margem 48 px |
| Global | `localStorage` `editor.watermark.v1` → `{ text, loop, opacityPct, fontPx, speed }` |
| Por vídeo | `composition.watermarkEnabled?: boolean`. Ausente = `false` |
| Novo projeto | Zera o toggle (composição nova). **Não** apaga handle/loop nem Opac./Tam./Vel. |
| Limpar inserts / Trocar MP4 | Não mexem em handle/loop. Toggle permanece (é do projeto) |
| UI | Duas linhas **dentro** do card **Vídeo de fundo**, sem card extra |
| Timeline / hit-test / lista de inserts | A marca **não** entra |
| Undo | Só o toggle. Handle e loop **não** entram no histórico |
| `prefers-reduced-motion` | Não para o loop (é conteúdo do MP4) |
| Schema / encoder / Fase 3 / lote | Fora |

## O que o operador vê

### Card Origem (`BackgroundSourceCard`)

Uma linha na **coluna do nome** (não na coluna dos botões), abaixo do nome / linha técnica / links. Trocar / Limpar inserts / Resetar enquadramento ficam onde estão.

1. Checkbox **Marca** — `watermarkEnabled`. `aria-label`: **Marca d’água neste vídeo**. Desabilitado se não houver origem reproduzível (`!hasPlayableSource`).
2. Campo de texto — handle global. Placeholder `@minhaloja`. `aria-label`: **Handle da marca d’água**. Máx. 40 caracteres.
3. Segmento **Parado | Loop** — `loop` global. `aria-label`: **Movimento da marca d’água**.
4. Segunda linha **Opac. / Tam. / Vel.** — globais. Contrato: [`../../marca-dagua.md`](../../marca-dagua.md).

Sem parágrafo de ajuda. Clique em checkbox / input / segmento **não** seleciona o Vídeo (estender o `closest("button, a")` do card para `button, a, input, label, textarea`).

As duas linhas aparecem no estado vazio (colar URL) e no estado de Trocar: handle, Loop e números editáveis; checkbox desabilitado sem origem.

Handle vazio (depois de trim) = **não pinta**, mesmo com Marca ligada.

### Preview e export

A marca fica **por cima** de chips, PNG, textos e legendas. Por baixo do chrome de seleção e do overlay Feed/Safe (CSS, nunca no MP4).

Não há caixa de seleção na marca. Clique atravessa para o insert / vídeo de fundo.

## Persistência

### Global — editor

Chave `editor.watermark.v1` (ao lado de `editor.composition.v1`).

```ts
type WatermarkPrefs = {
  text: string  // trim, sem \n (vira espaço), máx. 40
  loop: boolean
}

const DEFAULT_WATERMARK_PREFS: WatermarkPrefs = { text: "", loop: true }
const WATERMARK_OPACITY = 0.22
const WATERMARK_FONT_PX = 42
const WATERMARK_MARGIN_PX = 48
const WATERMARK_SPEED_X = 90  // px/s no quadro 1080
const WATERMARK_SPEED_Y = 110
```

JSON inválido / ausente → default. Falha ao gravar → `console.warn`, estado em memória segue.

`loadWatermarkPrefs` / `saveWatermarkPrefs` em `lib/watermark-store.ts`. Parse/normalize em `lib/watermark.ts`.

### Projeto — composição v4 aditiva

```ts
interface Composition {
  // ...campos atuais
  watermarkEnabled?: boolean
}
```

Parse: só persiste se for boolean `true`. Qualquer outra coisa (ausente, `"true"`, `1`) = desligado.  
Serialize: omite a chave se não for `true`.  
`createDefaultComposition()` **não** inclui o campo.

Não é `source.watermarked`.

### Snapshot de export Final

O Mac do Remotion **não** lê o `localStorage` do browser. `toRenderProps` recebe as prefs e, **somente** se `watermarkEnabled === true` e `text` normalizado não vazio, copia:

```ts
watermark?: { text: string; loop: boolean }
```

em `RenderProps`. Rascunho (`drawFrame` no browser) recebe o mesmo snapshot por argumento, não relê o storage no compositor.

`toCliRenderProps` mantém `watermark` (é texto). `isRenderProps` **não** exige o campo. Se `watermark` vier malformado, **omite** (não falha o job). Se vier objeto com `text` string e `loop` boolean, aceita.

## Pintura

`drawWatermark(ctx, time, frame, prefs)` em `lib/watermark.ts`. Chamada no **fim** de `drawPlayInserts` (depois de captions). Assinatura de `drawPlayInserts` ganha `watermark?: { text: string; loop: boolean } | null`.

Quadro de desenho: sempre `PLAY_W` × `PLAY_H` (1080×1920). Export 720 continua com `ctx.scale` em `drawFrame` — a marca escala junto com os inserts.

Fonte: `Geist, sans-serif`, peso 800, fill branco, `globalAlpha = 0.22`. Sem contorno. Fonte atrasada → fallback `sans-serif` (a marca **pinta** mesmo assim).

Texto vazio ou `watermark` ausente → no-op.

### Posição

Âncora = **centro** da caixa. Largura = `measureText(text).width`. Altura da caixa de bounce = `WATERMARK_FONT_PX` (não usa bounding box da fonte — testes determinísticos).

Função pura `watermarkCenter(t, frame, box, loop): { x, y }` — é o que os testes de ping-pong exercitam. `drawWatermark` só mede, chama isso e pinta.

Caixa útil: centro em

```
minX = MARGIN + width/2
maxX = frame.width - MARGIN - width/2
minY = MARGIN + height/2
maxY = frame.height - MARGIN - height/2
```

Se `max < min` (texto enorme), clampa no centro do frame.

**Loop off:** centro em `(maxX, maxY)` — canto inferior direito.

**Loop on:** ping-pong independente por eixo, a partir de `t = 0` no canto estático (mesmo `(maxX, maxY)`), velocidades `WATERMARK_SPEED_X` / `_Y`:

```
function pingPong(t, min, max, speed): number {
  const range = max - min
  if (!(range > 0) || !(speed > 0)) return max
  const span = 2 * range
  let u = (t * speed) % span
  if (u < 0) u += span
  return u <= range ? max - u : min + (u - range)
}
```

Assim `t = 0` coincide com o canto parado. X e Y com velocidades diferentes evitam diagonal eterna. Sem aleatoriedade.

## Fluxo de dados

```
localStorage editor.watermark.v1     composition.watermarkEnabled
            \                       /
             \                     /
              snapshot { text, loop }?   (só se enabled && text)
                       |
        OverlayCanvas / drawFrame / InsertRenderer
                       |
                 drawPlayInserts → drawWatermark
```

`VideoEditor` segura prefs em estado, hidrata na montagem, grava a cada mudança de handle/loop. Toggle chama `commitDiscrete` (entra no undo). Handle/loop **não** passam por `historyPresent`.

`historyPresent` / `applyHistoryPresent` / `HistorySnapshot` ganham `watermarkEnabled?: boolean` (omitido = false). Gestos de insert/enquadramento **não** capturam mudança de marca; o checkbox é commit discreto, como Limpar inserts.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/watermark.ts` | tipos, constantes, normalize, ping-pong, `drawWatermark` |
| `lib/watermark-store.ts` | load/save `editor.watermark.v1` |
| `lib/composition.ts` | parse/serialize `watermarkEnabled` |
| `lib/composition-history.ts` | snapshot do toggle |
| `lib/compose/draw-play.ts` | chama `drawWatermark` por último |
| `lib/export/compositor.ts` | `drawFrame` recebe snapshot |
| `remotion/types.ts` | `RenderProps.watermark?`, `toRenderProps` |
| `remotion/InsertRenderer.tsx` | já usa `drawPlayInserts` |
| `components/overlay-canvas.tsx` | passa snapshot |
| `components/background-source-card.tsx` | a linha Marca / handle / Loop |
| `components/video-editor.tsx` | estado, persistência, undo do toggle, props do export |

## Erros

| Caso | Comportamento |
| --- | --- |
| Prefs JSON lixo | Default `{ text: "", loop: true }` |
| `localStorage` indisponível / quota | Warn; memória segue |
| Handle só espaços | Trata como vazio; não pinta |
| `\n` no handle | Vira espaço; depois trim e corte em 40 |
| Toggle on + handle vazio | Checkbox pode ficar on; raster ignora |
| Projetos antigos sem o campo | Desligado |
| `source.watermarked` | Intocado |

## Testes

TDD em `lib/watermark.test.ts` (+ acréscimos nos testes já existentes):

1. `normalizeWatermarkPrefs` — trim, `\n` → espaço, corte 40, `loop` default true se ausente.
2. `watermarkCenter`: para `t` em 0, 1, 10, 100 s, o centro fica dentro de `[min, max]` nos dois eixos.
3. `watermarkCenter(0, …, loop: true)` = `watermarkCenter(0, …, loop: false)` (canto inferior direito).
4. `drawWatermark` com texto `""` não chama `fillText` (spy / pixels inalterados).
5. Parse composição: ausente / `false` / lixo → sem `watermarkEnabled`; `true` persiste; serialize omite se false.
6. `toRenderProps` inclui `watermark` só com enabled + texto; omite se vazio.
7. `newProjectComposition()` não lê nem apaga o storage de prefs (teste do store: save, new project, load igual).
8. Snapshot de histórico: mudar só o toggle gera undo; mudar handle **não** empilha histórico (teste de `historyPresent` / igualdade).

## Fora desta fatia

- PNG / logo como marca
- Opacidade, tamanho e velocidade numéricos — **no ar 2026-08-22**, spec [`2026-08-22-marca-dagua-controles-design.md`](2026-08-22-marca-dagua-controles-design.md)
- Cor, padrão repetido (tile)
- Aviso no checklist de export
- Marca na capa / thumb
- Remover watermark da Shopee
- Preferência por máquina sincronizada além deste `localStorage`
