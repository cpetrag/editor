# Undo/redo dos inserts

**Data:** 2026-08-19  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado (publish à parte, deploy.md §2)  
**Não bumpa** `Composition.version` (continua `2`).  
**Fora:** toast, botões na barra, modal de confirmação, undo de vídeo/marca/lote/playhead/aba, persistir a pilha no `localStorage`, schema novo.

O operador apaga ou arrasta um insert e não tem como voltar. Delete e Backspace já removem na hora. Esta fatia coloca histórico só do array `inserts`.

---

## Objetivo

Ctrl+Z restaura o array `inserts` anterior. Ctrl+Shift+Z e Ctrl+Y avançam. Um arraste, um recorte na timeline ou um arraste de slider conta como **um** passo. F5 mantém o anúncio atual; a pilha some.

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Modelo | Pilha de **snapshots** do array `inserts` (cópia profunda). Não é command pattern nem Immer |
| Escopo | Só `inserts`. `source`, `brand`, `batch`, seleção, playhead e aba **não** entram |
| UI | Só atalho. Sem toast, sem ícones Desfazer/Refazer, sem modal no Delete |
| Gesto | `pointerdown` → `pointerup`/`pointercancel` = um passo. Slider `range`: um passo ao soltar |
| Discreto | Botão, Select, swatch, Delete, adicionar, template, IA mock: um passo por ação |
| Teto | 50 estados em `past`. O mais antigo cai |
| Persistência | Memória da sessão. `localStorage` continua salvando só a Composition atual |
| Igualdade | Se o snapshot novo é igual ao atual (JSON estável), não empilha |
| Schema | Sem campo novo. Sem bump de versão |
| Feedback visual | O preview muda. Sem linha extra no painel |
| Após undo | Se o `selectedInsertId` ainda existe no snapshot, mantém. Senão, `null` |

---

## Arquitetura

Módulo puro, sem React e sem I/O:

```ts
// lib/composition-history.ts
interface InsertHistory {
  past: Insert[][]
  future: Insert[][]
}

const HISTORY_LIMIT = 50
```

API (nomes finais podem ser estes):

| Função | Contrato |
| --- | --- |
| `emptyHistory()` | `{ past: [], future: [] }` |
| `cloneInserts(inserts)` | Cópia profunda via `JSON.parse(JSON.stringify(inserts))` (Insert é JSON) |
| `insertsEqual(a, b)` | `true` se `JSON.stringify(a) === JSON.stringify(b)` |
| `pushPast(history, before, after)` | Se `insertsEqual(before, after)`, no-op. Senão empilha `cloneInserts(before)` em `past`, zera `future`, corta em 50 |
| `undo(history, present)` | Se `past` vazio: `{ history, present }` inalterado. Senão: tira o último `past`, empurra `present` em `future`, devolve o snapshot como novo present |
| `redo(history, present)` | Simétrico com `future` |

O React guarda `present` em `composition.inserts` e o `InsertHistory` num `useRef` ou `useState`. Undo/redo chamam `setComposition` com o snapshot + `clampComposition`.

### Gesto (coalescing)

Ref no editor (não precisa ir para o JSON):

```
gesture = { active: boolean, baseline: Insert[] | null }
```

1. `beginInsertGesture()`: `active = true`, `baseline = cloneInserts(inserts atuais)`.
2. Patches durante o gesto atualizam a Composition **sem** `pushPast`.
3. `endInsertGesture()`: se `active` e `!insertsEqual(baseline, inserts atuais)`, `pushPast(history, baseline)`. Depois `active = false`, `baseline = null`.
4. `pointercancel` = mesmo que `pointerup`.
5. Se `end` sem nenhuma mudança, não empilha.

Quem **deve** abrir gesto:

- Arraste / resize no preview (`overlay-canvas.tsx`)
- Trim / move na timeline (`preview-panel.tsx`)
- Inputs `type="range"` da aba Estilo / Movimento (`insert-style-panel.tsx`): `pointerdown` / `pointerup` no range

Quem **não** abre gesto (passo discreto, `pushPast` do `prev` no próprio `setState`):

- Lixeira, Delete, Backspace
- Adicionar chip / texto / PNG / biblioteca
- Select de fonte, peso, preset, alinhamento
- Swatch de cor, campo hex ao confirmar (blur/Enter), botão “Sem fundo”
- Template e IA mock (substitui o array inteiro = um passo)
- Seta no preview (`ArrowUp` etc.): **cada keydown** é um passo

Se um `pushPast` discreto chegar com gesto ainda aberto, fecha o gesto primeiro (`endInsertGesture`) e depois empilha o discreto. Evita misturar arraste + Delete no mesmo passo.

### O que não entra na pilha

| Ação | Por quê |
| --- | --- |
| Hidratar do `localStorage` | A pilha começa vazia |
| `handleMediaInfo` (clamp de duração ao carregar o vídeo) | Efeito colateral da mídia, não edição do operador |
| Trocar arquivo / URL / `source` | Fora do escopo |
| `brand.fontId`, `batch` | Fora do escopo |
| `setSelectedInsertId`, playhead, aba | Chrome, não anúncio |

Todo caminho que muda `inserts` por intenção do operador passa por um único hub no `video-editor.tsx` (hoje: `patchInserts` + uns `setComposition` com `inserts:`). Esses caminhos passam a registrar histórico. `applyTemplate` e `applyAIInserts` também.

---

## Teclado

Listener em `window` no `video-editor.tsx` (não só no preview), para funcionar com o card focado.

| Atalho | Ação |
| --- | --- |
| Ctrl+Z / Meta+Z | Undo |
| Ctrl+Shift+Z / Meta+Shift+Z | Redo |
| Ctrl+Y / Meta+Y | Redo |

Regras:

- Ignorar se `isEditableTarget` (INPUT, TEXTAREA, SELECT, `contentEditable`). Ctrl+Z no campo de texto do insert continua sendo o undo nativo do browser naquele campo; o histórico do anúncio não mexe.
- Se a pilha não puder undo/redo, **não** chama `preventDefault` (deixa o browser). Se puder, `preventDefault` e aplica.
- Não interceptar se o gesto ainda está ativo (pointer down). O passo só existe no `pointerup`.

`isEditableTarget` já existe em `overlay-canvas.tsx` e `preview-panel.tsx`. Extrair para `lib/` (ex. `lib/is-editable-target.ts`) e reusar, inclusive no listener de undo. Range focado conta como INPUT: Ctrl+Z com o slider focado **não** desfaz o anúncio. Clicar no preview e Ctrl+Z desfaz.

---

## Integração UI

Nada novo na `EditorNav`. Sem botão, sem tooltip de atalho obrigatório nesta fatia.

Delete continua imediato. A recuperação é Ctrl+Z.

Persistência atual (debounce 300 ms em `saveCompositionJson`) já vê o `composition` depois do undo. Não gravar `past`/`future`.

---

## Testes

Arquivo: `lib/composition-history.test.ts`. Incluir no script `test` do `package.json`.

Casos mínimos:

1. `pushPast` + `undo` restaura o array anterior (incluindo `id` do insert apagado)
2. `undo` + `redo` volta o array de depois da ação
3. `pushPast` depois de undo **apaga** `future`
4. Dois `pushPast` iguais (mesmo JSON) não crescem `past`
5. 51 pushes: `past.length === 50`, o mais antigo sumiu
6. Gesto: três patches com o mesmo `baseline` geram **um** `pushPast` no `end`; undo volta ao baseline, não ao meio do arraste
7. Gesto sem mudança: `past` inalterado
8. Undo com `past` vazio: present inalterado

Não precisa de teste de React nesta fatia.

---

## Fora desta fatia

- Toast “Insert removido”
- Botões na barra
- Snap/ripple entre clipes
- Checklist pré-export
- Handles de rotação
- Undo de vídeo, marca ou lote
- Persistência da pilha
- IA real

---

## Deploy

Depois dos testes verdes: `deploy.md` §2 (build no Mac, PM2 `editor-video` porta 4013). Smoke: apagar insert, Ctrl+Z, hard refresh.
