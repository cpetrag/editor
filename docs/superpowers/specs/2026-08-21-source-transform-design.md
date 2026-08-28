# Enquadramento do vídeo de origem (escala + pan)

> **Substituída em 2026-08-22.** Contrato vigente: [`docs/enquadramento.md`](../../enquadramento.md).
> Este arquivo descreve a fatia de 2026-08-21 (âncora `x/y` 0–100 default 50/50, sliders no card, zoom no centro do frame, **sem** roda). Não implementar a partir daqui.

**Data:** 2026-08-21  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** substituída 2026-08-22  
**Não bumpa** `Composition.version` (continua **4**). Campo aditivo opcional em `source`.  
**Não é** a Fase 3 de `docs/inserts-ui.md`. Sem encoder novo. Sem Ken Burns.

## Objetivo

O operador aumenta e desloca o **MP4 de fundo** no frame 9:16, com o mesmo recorte do primeiro ao último frame. Inserts (texto, chip, PNG, legenda) continuam no frame, não andam com o vídeo.

Hoje o fundo é sempre `cover` centralizado (`coverDrawRect` no rascunho, `object-fit: cover` no Remotion `Short`).

## Decisões

| Tema | Escolha |
| --- | --- |
| Tempo | **Fixo** no clipe inteiro. Sem keyframes / Ken Burns |
| Modelo | Multiplicador em cima do `cover` atual. Sem distorcer. Sem faixa preta (`contain`) |
| `scale` | 1–4. **1** = o `cover` de hoje. Acima de 1 = zoom |
| `x` / `y` | 0–100: ponto da **origem** que fica no centro do frame. Default 50/50 |
| Pan no zoom 1 | Permitido quando o arquivo não é 9:16 (16:9 escolhe a fatia X; vídeo mais alto, a fatia Y) |
| Inserts | Coordenadas de sempre (`%` do frame). Não seguem o pan/zoom do fundo |
| Gesto | Clique no vazio do preview seleciona o **Vídeo**; miolo = pan; cantos do frame = zoom (centro do frame fixo) |
| Roda / pinch / rotação do fundo | Fora |
| Card Origem | Sliders Escala / X / Y + **Resetar enquadramento** |
| Undo | `source.transform` entra no snapshot de Ctrl+Z |
| Trocar MP4 | Zera o enquadramento (origem nova). Restaurar anterior traz o transform antigo, se houver |
| Limpar inserts | Não mexe no enquadramento |
| Schema / encoder / Fase 3 / lote Remotion | Fora |

## O que o operador vê

Só com origem pronta (`hasPlayableSource`).

### Preview

1. Clique num insert: insert ganha, como hoje (caixa sky, cantos, haste de girar, E/W se couber).
2. Clique no vazio **dentro** do frame 9:16 (hit-test de insert falhou): seleciona o **Vídeo**. Começa pan se o ponteiro andar (igual `beginMove` do insert).
3. Clique fora da área pintada (`inside: false`): não muda a seleção.
4. Vídeo selecionado: chrome no **frame inteiro** (1080×1920 no play). Quatro cantos. **Sem** haste de rotação e **sem** E/W. `aria-label` **Enquadrar vídeo**.
5. Arrastar um canto: `scale` muda; `x`/`y` ficam (zoom no centro do frame). Depois o clamp do pan pode puxar `x`/`y` se a folga encolheu.
6. Overlay Feed / Safe area continua só CSS, não entra no MP4.

### Card Origem

Com vídeo pronto, abaixo da faixa atual (nome / técnica / Trocar):

- Escala **1–4** (3 casas, vírgula). Label **Escala 1–4**.
- X (%) e Y (%) 0–100, 1 casa.
- **Resetar enquadramento**: volta a `scale` 1, `x` 50, `y` 50. Desabilitado no default.
- Clique no card (não nos botões Trocar / Limpar / links) também seleciona o Vídeo.

### Teclado

Com o Vídeo selecionado e foco no stage (ou atalho global nas mesmas regras de `canHandleInsertNudge`, trocando “insert selecionado” por “vídeo selecionado”):

| Tecla | Efeito |
| --- | --- |
| Setas | ±1 no `x` ou `y` (eixo da seta) |
| Shift+setas | ±5 |
| Delete / Backspace | **Não** apaga a origem |

O clamp do desenho impede vazar preto: seta sem folga não altera o valor visível.

## Persistência

Schema **v4**. Sem campo incompatível.

```ts
interface SourceTransform {
  scale: number // 1–4, 3 casas
  x: number     // 0–100, 1 casa
  y: number     // 0–100, 1 casa
}

interface CompositionSource {
  // ...campos atuais
  transform?: SourceTransform
}
```

Ausente = `{ scale: 1, x: 50, y: 50 }`.

`serializeComposition` **omite** `source.transform` quando é identidade (`scale === 1 && x === 50 && y === 50`). `parseSource` lê o objeto, clampa números, ignora `NaN` / tipo errado (vira default). Não clampa pan “sem preto” no parse: isso depende do aspect do arquivo e acontece no draw / no `merge`.

`createDefaultComposition()` não grava `transform`.

Constantes novas (não reutilizar `SCALE_MIN` 0,2 dos inserts):

- `SOURCE_SCALE_MIN = 1`
- `SOURCE_SCALE_MAX = 4`

## Matemática (uma função, três saídas)

Em `lib/export/cover.ts`. `coverDrawRect` ganha 5º argumento opcional `transform`. Sem ele, os testes atuais continuam válidos.

Seja `z = max(1, transform.scale)`, âncora `(ax, ay) = (x/100, y/100)`:

1. `cover = max(destW / srcW, destH / srcH)`
2. `dw = srcW * cover * z`, `dh = srcH * cover * z`
3. `dx = destW / 2 - ax * dw`, `dy = destH / 2 - ay * dh`
4. Clamp para o dest ficar coberto: `dx ∈ [destW - dw, 0]` quando `dw ≥ destW`; idem `dy` com `dh` / `destH`. Origem 0×0 ou dest 0×0: `{ dx: 0, dy: 0, dw: destW, dh: destH }` como hoje.

Identidade + 9:16 no 1080×1920 = rect cheio (`dx = dy = 0`, `dw = 1080`, `dh = 1920`).

Inverso (gesto / clamp de slider), exportado ao lado:

`transformFromCoverRect(rect, srcW, srcH, destW, destH) → SourceTransform`

- `scale = (dw / srcW) / cover`, clampa 1–4
- `x = 100 * (destW / 2 - dx) / dw` (se `dw > 0`)
- `y` análogo

Dest no preview de gesto: `PLAY_W × PLAY_H` (1080×1920). Dest no rascunho / Final: canvas / `composition.output`. Mesmo aspect 9:16 → os `%` batem.

**Tamanho da origem no draw:** pixels reais do elemento de vídeo (`videoWidth` / `videoHeight`) quando existirem; senão `composition.source.width` / `.height`. Sem os dois: não grava transform no gesto; pinta `cover` 50/50.

## Gestos (coords do play)

O clique **nunca** usa `clientX`/`clientY` cru. Continua `getCanvasDisplayMetrics` → `clientToPlay`.

| Gesto | Grava |
| --- | --- |
| Pan (miolo) | `x`/`y` via inverso do rect deslocado com o delta do ponteiro (vídeo acompanha a mão: delta positivo em X **diminui** `x`) |
| Canto | `scale` via `scaleFactorFromDrag` com centro `(PLAY_W/2, PLAY_H/2)`; depois `transformFromCoverRect` no rect já clampado |
| Snap | Nenhum no fundo (Alt não se aplica) |

Histórico: o mesmo `beginInsertGesture` / `endInsertGesture`, com `source.transform` no snapshot. Slider / Reset = `commitDiscrete`.

## Seleção

Hoje só existe `selectedInsertId: string | null`. Passa a um union para não ter insert e vídeo ao mesmo tempo:

```ts
type PreviewSelection =
  | { kind: "insert"; id: string }
  | { kind: "source" }
  | null
```

`onSelectInsert(null)` no miss **deixa de** deselecionar para o vazio: o miss **dentro** do frame vira `{ kind: "source" }`. Miss de insert com o vídeo já selecionado continua pan.

Delete na timeline / teclado só apaga se `kind === "insert"`.

## Caminho preview → rascunho → Final

| Superfície | Onde |
| --- | --- |
| Conta | `lib/export/cover.ts` |
| Parse / omit identity | `lib/composition.ts` (`parseSource`, `serializeComposition`) |
| Merge / identidade / defaults | `lib/source-transform.ts` (espelha o papel de `insert-transform.ts`, sem inflar `composition.ts`) |
| Undo | `HistorySnapshot.sourceTransform?: SourceTransform` |
| Rascunho | `drawVideoCover` em `lib/export/compositor.ts` passa o transform |
| Remotion | `RenderProps.video` ganha `width`, `height` e `transform?`. `BackgroundVideo` posiciona com `left/top/width/height` do rect (não `object-fit: cover`). `AbsoluteFill` continua `overflow` escondido |
| Preview ao vivo | O Player já usa `Short`; o overlay só desenha inserts + chrome |
| UI | `overlay-canvas.tsx`, `selection-overlay.tsx` (modo frame), `background-source-card.tsx`, `video-editor.tsx`, `keyboard-scope.ts` |

`commitReadySource` substitui o `source` inteiro pelo `next` que o caller montou. Callers de arquivo/URL novo **não** copiam `transform`. `previousSource` é o objeto inteiro: restaurar devolve o enquadramento antigo. `newProjectComposition()` não tem transform. `clearInsertsArt` não toca em `source`.

## Erros

- Origem vazia / import em curso: sem seleção `{ kind: "source" }`, sliders desligados.
- Canvas tainted no rascunho: o mesmo `CanvasTaintError`.
- JSON podre: parse vira default, não quebra o hydrate.
- Fill preto atrás do `drawImage` permanece; o clamp do rect não deve deixá-lo visível no frame.

## Testes

TDD (`pnpm test`). Não pintar CSS no MP4.

`lib/export/cover.test.ts`:

1. Sem transform: os dois casos atuais (576×1024 e 1920×1080) inalterados.
2. 1080×1920, `scale` 1, 50/50: rect cheio.
3. 1920×1080, `scale` 1: `dx < 0`, `dh ≥ 1920`; pan X no limite (`x` min/max) → `dx` em `{0, destW - dw}`; nenhum vaza (`dx + dw ≥ destW`, `dx ≤ 0`).
4. Fonte mais alta que 9:16: pan Y no limite, X travado em 50.
5. `scale` 2, 50/50: `dw`/`dh` ~2× o cover; centro alinhado ao dest.
6. `transformFromCoverRect(coverDrawRect(...))` round-trip (folga 1e-6 no rect, 1 casa em x/y, 3 em scale).

`lib/source-transform.test.ts` + `lib/composition.test.ts`:

7. Parse omite identidade; clampa `scale` 0 → 1, 9 → 4, `x` −10 → 0.
8. Round-trip com `{ scale: 1.5, x: 40, y: 62 }`.

`lib/commit-source.test.ts` + `lib/project-reset.test.ts`:

9. `commitReadySource` com `next` sem transform: origem nova sem o campo.
10. Novo projeto: sem transform. Limpar inserts: `source.transform` permanece.

`lib/composition-history.test.ts`:

11. Snapshot com `sourceTransform` desfaz o pan. `historyPresent` copia `composition.source.transform`. `applyHistoryPresent` grava `snapshot.sourceTransform` em `source.transform` (`undefined` = identidade).

## Fora desta fatia

Ken Burns, `contain` / faixa preta, rotação do fundo, pinch, zoom com a roda, Fase 3 da UI de inserts, lote Remotion, worker ffmpeg, `textAlign`, duração de animação.

## Docs a atualizar na implementação

- `docs/preview-overlays.md` — parágrafo do fundo (gesto e coords)
- `docs/proximo.md` — item no “já está” quando publicar
- `docs/README.md` — `source.transform` na fonte da verdade, se a seção de schema citar o `source`
