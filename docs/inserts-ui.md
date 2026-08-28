# UI de Inserts — Fases 1 e 2

**Atualizado:** 2026-08-21  
**Produto:** Editor de Inserts  
**Status:** Fases 1 e 2 **no ar** (2026-08-21). Fase 3 **não começou**.  
**Schema:** `COMPOSITION_VERSION` **4**. Esta fatia **não** bumpa para 5 e **não** mexe no encoder/Remotion.

Refatoração da seção de inserts em **3 fases**. Fases 1 e 2 feitas. **Fase 3 não começou** (abas Conteúdo/Aparência/Animação, timeline editável extra, atalhos, traduzir Recipe).

Índice do produto: [`README.md`](README.md). Legendas (Whisper, karaoke, `captionStyle`): [`legendas.md`](legendas.md). Preview: [`preview-overlays.md`](preview-overlays.md).

---

## 0. Auditoria vs. o que a UI parecia

Várias premissas da auditoria visual estavam erradas. O código manda:

| Premissa da UI | O que o código faz |
| --- | --- |
| Slider/preset “soltos” (`defaultValue`) | O painel lia `styleRef` factory (legado = 56 px) enquanto o JSON/paint legado usava `insert.fontSize`, `preset`, `animIn` |
| Sem undo ao apagar | Undo/redo **já existia** (`lib/composition-history.ts`, Cmd/Ctrl+Z). Faltava toast |
| Cabeçalho Gancho/Prova/CTA “errado” | A faixa usa o **meio** do clipe (`zoneForInsert`), não o `start`. Sintoma real; diagnóstico errado |
| Os ~10 chips eram `captionPreset` viral/limpo | Eram presets **factory** (`chipsForContext`). Hormozi **só carimba legendas** (`applyFactoryPreset` se `group === "legenda"`) |
| Insert novo nasce em 2,6 s por default | `createInsert` começa em 0; depois `nextInsertStart(playhead)` |
| Selo Avaliação / Contador = tipos de elemento | No chip row eram presets factory de **prova** (`seloAvaliacao`, `contador`). Os tipos `estrelas` / `contador` do seletor são outra coisa |

Dois sistemas de estilo (não misturar):

| Sistema | Onde | Paint |
| --- | --- | --- |
| **Legado** (achatada) | `insert.fontSize`, `insert.preset` (`bold-outline`…), `insert.animIn` | `drawStyledText` se `styleRef.presetId` é `legado` ou ausente |
| **Factory** | `insert.styleRef` → `resolveStyle` | se `presetId !== "legado"`. 16 presets em `lib/style/presets.ts` + `legado` |

`captionPreset` continua só `"viral" | "limpo"` (default **viral**). CTA factory default `carrinhoLaranja`. Caption CTA **não** herda carrinho. Não reexportar `lib/style-preset.ts` via `lib/style/index.ts` (ciclo).

Colisão de nome: `InsertStyle` achatado em `lib/compose/insert-style.ts`; o factory vive em `lib/style/`.

---

## 1. Fase 1 — Painel honesto (feita)

### 1.1 Hidratação e dual-write

`lib/style/editor-style.ts`:

- `usesFactoryPaint` / `resolveStyleForEditor` — legado mostra `insert.fontSize` / `x` / `y` **sem gravar** factory
- `activeAnimRecipe` / `recipeFromAnimation` (match estrito; typewriter exige `unit === "letra"`)
- Dropdown **“Legado · Outline”** quando o paint é legado
- Recipe/sombra com `value` real; rótulo **`Tamanho Npx · quadro 1080`** (`fontSize` é px no quadro 1080, não no arquivo 720)

`patchInsertStyle` faz dual-write via `legacyInsertPatchFromStylePath` (`fontSize`, `x`/`y`, `maxWidth`, `animIn` a partir da recipe). Sem `fontSizePct`.

### 1.2 Apagar + Desfazer

Toast no rodapé: “Insert apagado” + **Desfazer** (`undoToast` / `undoLast`). Histórico não foi reescrito. Cmd+Z limpa o toast (`applyHistoryPresent`).

### 1.3 Lista plana

`sortInsertsByStart` (`lib/insert-ops.ts`). Sumiram os cabeçalhos de faixa na lista. Botão **“Aplicar a todos os inserts de texto”** → `applyLookToTextInserts` (só `kind === "text"`; não mexe chip/legenda/tracks). `applyLookToTrack` permanece para testes/outros usos.

---

## 2. Fase 2 — Corte conceitual (feita)

### 2.1 Estilo das legendas fora de Inserts

Bloco **Legendas** (acima de Inserts): **Gerar legendas** + visual global (thumbs Limpo/Viral/factory **e** acordeões Estilo/Movimento, uma vez) + texto da linha selecionada na timeline. Cards `Legenda` **não** entram na lista de Inserts.

Ordem dos looks (`captionStyleChips`):

1. **Limpo** (`captionPreset: "limpo"`, tira factory das linhas)
2. **Viral** (`captionPreset: "viral"`, idem)
3. Os 8 factory de `group === "legenda"` (Hormozi, Karaoke, …)
4. Presets **meus** do grupo legenda

Clique em Limpo/Viral: `applyCaptionLook` zera `styleRef` das captions e grava `captionPreset`. Clique em Hormozi: `applyFactoryPreset` nas captions **somente** — **não** muda `captionPreset`.

Miniaturas: canvas com a palavra **EXEMPLO**, mesmo `drawResolvedInsertText` das legendas. Selecionado = `aria-pressed` + anel brand.

Sem linhas `kind: caption`: estado vazio e thumbs desabilitados (nada de clique mudo).

`chipsForContext` em insert **não** mistura presets de legenda. Selo Avaliação / Contador **não** entram no card; continuam tipos em **+ Elemento** e, se um insert de prova estiver selecionado, chips de faixa no card do insert.

### 2.2 Duas entradas

Seção **Inserts** (antes “Inserts Avulsos”):

| Botão | O que faz |
| --- | --- |
| **Texto** | `createInsert("texto-livre")` no playhead |
| **Elemento** | Popover. Nada é criado até escolher tipo ou combo |

Taxonomia do picker = Biblioteca: Marca / Urgência / Conversão / Prova social / Atenção (`INSERT_TYPES` / `CATEGORY_LABELS`). **Texto livre**, PNG e **legenda** ficam de fora (`pickerInsertTypes`). Combos = `TEMPLATES` (aplicar **substitui** os inserts atuais, igual ao clique antigo na Biblioteca).

Biblioteca: templates e elementos são **consulta**. Criar = + Elemento. PNG e fontes continuam na Biblioteca. Catálogo de famílias: [`fontes.md`](fontes.md).

### 2.3 Preview honesto

- Paint (Remotion / `drawPlayInserts`) **já ignorava** insert fora de `[start, start+duration)`.
- Selecionar insert com playhead fora da janela → `seekTimeForInsert` leva ao `start`.
- Fora da janela, com o insert ainda selecionado: **ghost** tracejado, ~25% opacidade, sem alças (`SelectionOverlay` `ghost`).
- Bounding box de texto factory: `layoutOverlayInsertForPlay` / `stampPaintedLayout` (ex.: Hormozi `y=50`, não o `fontSize` achatado).

---

## 3. Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/style/editor-style.ts` | Hidratação legado vs factory, dual-write |
| `lib/style-preset.ts` | `chipsForContext`, `captionStyleChips`, `applyCaptionLook`, `applyLookToTextInserts` |
| `lib/insert-ops.ts` | lista plana, `seekTimeForInsert`, `isInsertActiveAt` |
| `lib/inserts.ts` | `pickerInsertTypes`, `texto-livre` `libraryAddable: false` |
| `lib/compose/caption-layout.ts` | `layoutOverlayInsertForPlay`, `stampPaintedLayout` |
| `components/caption-style-card.tsx` / `caption-style-thumb.tsx` | Card + miniatura EXEMPLO |
| `components/element-picker.tsx` | + Elemento |
| `components/control-panel.tsx` | blocos Legendas / Inserts |
| `components/library-panel.tsx` | catálogo sem criar |
| `components/overlay-canvas.tsx` / `selection-overlay.tsx` | ghost + layout factory |
| `components/preview-panel.tsx` | `PreviewHandle.seekTo` |
| `components/video-editor.tsx` | dual-write, look de legendas, seek ao selecionar |

Testes: `lib/style/editor-style.test.ts`, `apply-preset.test.ts`, `user-presets.test.ts`, `lib/insert-ops.test.ts`, `lib/insert-picker.test.ts`, `lib/compose/caption-layout.test.ts`. Suite recente: **414 pass / 4 fail** (`lib/ai-*.test.ts` — `Cannot find package 'zod'` no Windows; pré-existente).

---

## 4. Como testar (depois do deploy)

Hard refresh (Ctrl+F5).

1. Texto legado com `fontSize: 207`: slider 207, dropdown **Legado · Outline**, recipe Pop se `animIn` for pop.
2. Apagar insert → toast **Desfazer**. Cmd+Z também desfaz.
3. Mudar `start` atravessando faixa → lista **sem** grupo Gancho/Prova/CTA.
4. **Aplicar a todos os inserts de texto** só pega `texto-livre`.
5. Bloco Inserts **sem** chips Hormozi. Card **Estilo das legendas** com Limpo primeiro.
6. Sem legendas: thumbs desabilitados + aviso. Gerar → clicar Hormozi marca o thumb e muda o preview.
7. **+ Elemento** não cria até escolher. Texto livre não aparece na lista. Biblioteca não adiciona elemento/template.
8. Selecionar texto em 2,6 s com playhead em 0:02 → playhead vai para 2,6 s. Scrub para fora → ghost, sem alças.

---

## 5. Fase 3 (não começar sem pedido)

Abas Conteúdo / Aparência / Animação no card, timeline mais editável, atalhos extra, desambiguar a palavra “limpo” (preset limpo vs `captionPreset` vs “Aplicar limpo”). Sem schema v5.
