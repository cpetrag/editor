# Legendas automáticas — operador e contrato

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`, porta **4013**)  
**Status:** gerar + karaoke + `captionStyle` + painel global (bloco **Visual** em Legendas; Limpo/Viral/factory) **no ar** (2026-08-22).  
**Schema:** `Composition.version` **4**.

Três camadas de look (não são a mesma coisa):

| Camada | Campo | Onde na UI |
| --- | --- | --- |
| Nativo Viral/Limpo | `captionPreset` + `captionStyle` | card **Estilo das legendas** (primeiros dois thumbs) |
| Factory (Hormozi…) | `styleRef` em cada linha `caption` | o resto do mesmo card |
| Estilo compartilhado antigo | `captionStyle` (fonte, X/Y, cores) | bloco Visual em Legendas + arraste no preview |

Clique em Hormozi **não** grava `captionPreset`. Clique em Limpo/Viral tira o factory das linhas e grava o preset nativo. Sem legendas o card fica vazio (thumbs desabilitados).

Contrato da UI: [`inserts-ui.md`](inserts-ui.md).

Entregáveis:

| Fatia | Status |
| --- | --- |
| A — 2026-08-19 | **Gerar legendas** (Whisper), linhas, karaoke — **no ar** |
| Estilo compartilhado — 2026-08-20 | `captionStyle` único — **no ar** |
| Card de looks — 2026-08-21 | Limpo / Viral / factory no bloco Legendas — **no ar** |
| Painel global — 2026-08-22 | Visual uma vez; Inserts sem cards `Legenda`; texto da selecionada — **no ar** |

Specs: [`superpowers/specs/2026-08-19-legendas-automaticas-design.md`](superpowers/specs/2026-08-19-legendas-automaticas-design.md), [`superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md`](superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md), [`superpowers/specs/2026-08-22-legendas-painel-global-design.md`](superpowers/specs/2026-08-22-legendas-painel-global-design.md).  
IA (chave, timeouts, 25 MB): [`ia-real.md`](ia-real.md). Preview/export: [`preview-overlays.md`](preview-overlays.md).

---

## 1. O que o operador vê

1. Carrega o vídeo (arquivo ou Por URL). Sem vídeo o botão **Gerar legendas** fica desabilitado.
2. Bloco **Legendas** (acima de Inserts): **Gerar legendas**, bloco **Visual** (thumbs + Estilo/Movimento, um só, vale para todas) e um campo de **texto** recolhível da linha selecionada na timeline.
3. Status: “Transcrevendo…” → “Legendas prontas”. Entram clipes `Legenda` na timeline. Chips, texto livre e PNG **não** saem.
4. No preview, a palavra falada acende. Export pinta o mesmo canvas (não entra CSS de Feed / Safe area).
5. Tempo (início/duração) só na timeline (trim / mover o clipe). No painel: corrigir o texto da linha clicada. Lista de **Inserts** não mostra cards `Legenda`.
6. Arrastar a caixa no preview move todas (nativo e factory). Canto de resize muda o `fontSize` de todas. X/Y/rotação/largura no bloco Visual também. O Select **Fonte** pinta o nome na própria família ([`fontes.md`](fontes.md)).
7. Looks no card: **Limpo** / **Viral** (nativo) e depois Hormozi, Karaoke, etc. (factory). **Não** há mais toggle Viral/Limpo no header de Inserts.
8. Aviso pré-export de coluna dos botões / topo / contraste: **um** por tipo quando o look é global (“As legendas entram na coluna dos botões.”), não uma fileira por frase.

Gerar legendas de novo troca só frases/tempos e **copia** o `styleRef` da primeira caption (`carryCaptionStyleRef`). O `captionStyle` permanece.

Gerar estrutura (IA) substitui chips/texto/PNG e **preserva** as legendas e o look.

---

## 2. Viral e Limpo

`composition.captionPreset`: `"viral"` (padrão) ou `"limpo"`. **Não** entra no undo.

| Modo | Paint |
| --- | --- |
| Viral | Maiúsculas `pt-BR` só no canvas. Contorno `strokeColor` / `strokeWidth` (0 = sem traço). Sem caixa. |
| Limpo | Caixa `bgColor` (nunca `null`), radius 8 (escala com a fonte). Sem maiúsculas forçadas. Sem stroke. |

Nos dois: fill inativo = `color`; palavra ativa = `highlightColor`.

Defaults (iguais ao que a fatia A pintava com constantes):

| Campo | Default |
| --- | --- |
| `x` / `y` | 50 / **72** (% centro; 72 fica acima da faixa “Legenda / áudio” do mock de Feed) |
| `fontSize` | 64 (40–360) |
| `maxWidthPct` | 84 (sem controle na UI) |
| `fontFamily` / `fontWeight` | `geist` / 800 (peso clampa na família) |
| `color` | `#FFFFFF` |
| `highlightColor` | `#FFE500` |
| `bgColor` | `rgba(0,0,0,0.72)` |
| `strokeColor` / `strokeWidth` | `#000000` / 6 (0–12) |

Cores aceitam hex e `rgba()` / `hsla()` (`parseCssColor`). Fundo no card **não** tem “Sem fundo”.

---

## 3. Schema

### Composition

```ts
captionPreset: "viral" | "limpo"   // serialize sempre grava
captionStyle: CaptionStyle         // serialize sempre grava; leitura: ver migração
```

`lib/composition.ts` **não** importa `lib/captions.ts`.

### Insert `legenda`

`type: "legenda"`, `kind: "caption"`. Na memória e no JSON a linha **não** leva `x` / `y` / `fontSize` / `maxWidthPct` / `style`.

Só: `id`, `type`, `kind`, `text`, `start`, `duration`, `words`, `anchor`, `animIn`/`animOut` (`"none"`).

`createInsert("legenda")` e `linesToCaptionInserts` não preenchem look nativo. Overlay/draw usam `layoutCaptionInsertForPlay` / `resolveCaptionInsertStyle`. Se `styleRef.presetId` ≠ `legado`, o paint factory ganha do `captionStyle`.

### Migração (JSON antigo sem `captionStyle`)

1. Primeira insert `type === "legenda"` ou `kind === "caption"`.
2. Copia `x`/`y`/`fontSize`/`maxWidthPct` e, se houver `style`, fonte/peso/cor/fundo/contorno.
3. `highlightColor` não existia → `#FFE500`.
4. Sem caption → defaults.

Projetos da fatia A abrem com a posição/fonte da primeira linha e o amarelo/branco/caixa padrão.

---

## 4. Pipeline (Gerar legendas)

```
vídeo no IndexedDB (fileId)
  → POST /api/ai/captions  (multipart, Whisper verbose_json + words, 90 s, máx. 25 MB)
  → groupCaptionLines (pausa 0,4 s, pontuação, teto 32 caracteres, fundir < 0,5 s)
  → linesToCaptionInserts + replaceCaptionInserts
  → captionStyle e captionPreset intactos
```

A rota **não** mudou nesta fatia. Whisper do Gerar estrutura continua só texto para chips.

Palavra ativa: `activeCaptionWord(words, time - start)`. Buraco → palavra anterior; antes da primeira → nenhuma ativa.

Editar texto da linha: `reflowCaptionWords`. Mudar Início/Duração ou trim na timeline: `retargetCaptionWords` (não ressuscita palavra já cortada).

---

## 5. Desenho, hit-test, undo

Ordem em `drawPlayInserts`: chips → stickers → texto livre → **captions**.

`drawCaptionLine` lê `CaptionStyle`. Preview (`overlay-canvas`) e export (`drawFrame`) passam o mesmo objeto → MP4 = preview.

Hit-test: o overlay mescla o clone antes de `approxBox` / `hitTestOverlays`. Arraste → `{ x, y }` no `captionStyle`. Resize → `{ fontSize }`. Setas no preview também.

Undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y): snapshot `{ inserts, captionStyle, sourceTransform }`, teto 50, só teclado. F5 zera a pilha. `captionPreset` **não** desfaz. Enquadramento do fundo: [`enquadramento.md`](enquadramento.md).

---

## 6. Arquivos

| Arquivo | Papel |
| --- | --- |
| `app/api/ai/captions/route.ts` | Whisper → linhas |
| `lib/captions.ts` | group, active, reflow, retarget, replace, `linesToCaptionInserts` |
| `lib/composition.ts` | `CaptionStyle`, parse/migrate/serialize, `mergeCaptionStylePatch`, `captionInsertForLayout` |
| `lib/composition-history.ts` | snapshot `{ inserts, captionStyle, sourceTransform }` |
| `lib/compose/draw-captions.ts` | karaoke no canvas |
| `lib/compose/draw-play.ts` / `lib/export/compositor.ts` | passam preset + style |
| `components/generate-captions-button.tsx` | botão + palavras por card |
| `components/caption-style-card.tsx` | Limpo / Viral / factory; miniatura EXEMPLO |
| `components/caption-visual-panel.tsx` | Visual global (thumbs + StyleCustomizePanel) |
| `components/caption-text-card.tsx` | Texto recolhível da caption selecionada |
| `components/control-panel.tsx` | bloco Legendas (não mais chips no header de Inserts) |
| `lib/caption-panel.ts` | Filtro da lista, host de estilo, estado do textarea |
| `lib/style-preset.ts` | `captionStyleChips`, `applyCaptionLook`, `activeCaptionLookId` |
| `components/insert-card.tsx` / `insert-style-panel.tsx` | Conteúdo na linha; Estilo/Movimento só para inserts da lista (legendas **fora**) |
| `components/overlay-canvas.tsx` | mescla style; drag/resize → `captionStyle` |
| `components/video-editor.tsx` | `applyCaptionStyle`, Gerar legendas não reseta look |

Testes (sem rede): `lib/captions.test.ts`, `lib/caption-panel.test.ts`, `lib/composition.test.ts`, `lib/composition-history.test.ts`, `lib/compose/hit-test.test.ts`. Sem teste de canvas (paint conferido no smoke).

---

## 7. Fora (próximas fatias)

Split/merge por palavra, editor palavra a palavra, cor por palavra, export SRT/VTT, botão **+ Legenda**, chunk &gt; 25 MB, desambiguar “limpo” (Fase 3), `maxWidthPct` na UI, sombra/opacidade/rotação em caption nativa, undo do `captionPreset`.

Publicar: [`../deploy.md`](../deploy.md) §2 + hard refresh (Ctrl+F5).
