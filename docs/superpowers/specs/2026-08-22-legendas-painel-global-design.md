# Legendas: painel global e lista enxuta

**Data:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** spec; não implementado.  
**Não bumpa** `Composition.version` (continua **4**).  
**Spec pai:** [`2026-08-20-legendas-estilo-compartilhado-design.md`](2026-08-20-legendas-estilo-compartilhado-design.md). Ops: [`docs/legendas.md`](../../legendas.md).  
**Fora:** split/merge, SRT, “+ Legenda”, editor palavra a palavra, redesenhar acordeões do `StyleCustomizePanel`, devolver Início/Duração no painel das legendas, lista de todas as frases.

Hoje o look já é compartilhado (`captionStyle` + `stampCaptionStyleRefs`). A UI ainda abre Estilo/Movimento **em cada** card de linha e mistura as 18 legendas na lista de Inserts — o painel infla e o operador não consegue configurar o visual.

---

## Objetivo

Um bloco de visual (fonte, tamanho, cores, destaque, X/Y, rotação, animação) para **todas** as linhas. A lista de Inserts **não** mostra legendas. Tempo só na timeline. No painel, um campo de texto recolhível da linha clicada no clipe.

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Onde mora o visual | Igual hoje: `captionStyle` + `styleRef` carimbado em **todas** as captions (`stampCaptionStyleRefs`) |
| Onde a UI do visual vive | Bloco **Legendas**, uma vez. Não no card da linha |
| Lista de Inserts | Filtra `kind !== "caption"`. Contador também |
| Texto | Um campo, da caption **selecionada** (clique no clipe da timeline) |
| Tempo | Só timeline (trim / mover). Sem Início/Duração no painel |
| Recolher | O campo de texto abre/fecha. Visual continua no bloco de cima |
| Sem caption selecionada | Visual editável (host = primeira caption). Texto: “Clique uma legenda na timeline.” |
| Gerar de novo | Continua `replaceCaptionInserts` + `carryCaptionStyleRef`; `captionStyle` intacto |
| Schema | Sem bump, sem campo novo |
| Acordeões | Os de hoje (Tipografia, Preenchimento, Contorno, Fundo, Destaque, Entrada, Saída, Loop, Unidade). Só mudam de lugar |

---

## O que o operador vê

Bloco **Legendas** (já existe, acima de Inserts):

1. **Gerar legendas** — igual.
2. **Visual · todas as linhas** — thumbs Limpo/Viral/factory (`CaptionStyleCard`) **e** o `StyleCustomizePanel` (abas Estilo / Movimento) **uma vez**. Sem o botão “Aplicar a todos os inserts de texto”. Arrastar/resize/girar no preview continua valendo para todas.
3. **Texto** — uma fileira recolhível. Recolhida: preview da frase (ou o placeholder). Expandida: textarea. Sem Início/Duração, sem abas Conteúdo/Estilo/Movimento.
4. Contador de linhas no título (ex.: 18), só legendas.

Lista **Inserts**: chips, texto livre e PNG. Sem cards `Legenda`.

Timeline: clipes de legenda **continuam**. Clique seleciona a linha, faz seek no início (comportamento atual do clipe) e **abre** o campo de texto. Trim/mover gravam `start`/`duration` naquela linha. Delete apaga só ela.

Selecionar um chip/PNG: o texto das legendas **recolhe**; o Visual permanece (ainda é global).

Sem legendas geradas: some o Visual e o campo de texto; fica Gerar + “O estilo das legendas aparece depois de gerar.” (já existe).

---

## Componentes

| Unidade | Faz | Depende |
| --- | --- | --- |
| `control-panel.tsx` | Filtra a lista de Inserts; monta Visual + texto no bloco Legendas; passa a caption host ao painel de estilo | `inserts`, `selectedId` |
| `CaptionStyleCard` | Thumbs de look — **não muda** de papel | já existe |
| `StyleCustomizePanel` | Mesmos acordeões; ganha contexto `caption` para esconder “Aplicar a todos os inserts de texto” | host insert = caption selecionada **ou** a primeira |
| Campo de texto | Recolher/expandir; grava `text` só na linha selecionada via `applyCaptionPatch` | `selectedId` se `kind === "caption"` |
| `InsertCard` | Deixa de receber captions (não entra na lista) | — |
| Timeline / overlay | Intacto | — |

Host do `StyleCustomizePanel`: se `selectedId` aponta para uma caption, usa essa; senão a primeira caption do array. Patches de estilo em caption **já** chamam `stampCaptionStyleRefs` + `mergeCaptionStylePatch` em `video-editor.tsx` — não mudar esse contrato.

Campo de texto: só habilita se a seleção atual é caption. Expandir ao selecionar uma caption; o operador pode recolher. Editar `text` não mexe em `start`/`duration`/`words` além do reflow que `applyCaptionPatch` já faz quando o texto muda.

---

## Dados e fluxo

```
Clique no clipe de legenda
  → selectedId = id da linha
  → campo de texto abre com insert.text

Patch Estilo/Movimento (painel Legendas ou overlay)
  → se host é caption
      → look em captionStyle (já existe)
      → styleRef em todas as captions (já existe)
  → undo: snapshot { inserts, captionStyle } (já existe)

Trim/move na timeline
  → applyCaptionPatch naquela linha (já existe)

Gerar legendas
  → replaceCaptionInserts + carryCaptionStyleRef
  → captionStyle e captionPreset intactos
```

Não há campo novo em `Composition`. `animIn`/`animOut` das linhas continuam `"none"` na criação; a animação que o operador vê é a do `styleRef` compartilhado (Entrada/Saída/Loop do painel).

---

## Avisos

Overflow e duplicata **continuam** calculados em todos os inserts (incluindo captions). O banner existente permanece. Clicar um aviso cuja linha é caption seleciona essa linha (campo de texto abre). Não é obrigatório mover o banner para o bloco Legendas nesta fatia.

O badge de Inserts **não** conta legendas. Overflow de caption ainda incrementa o banner (“N inserts passam do fim”).

---

## Testes (sem rede)

| Onde | Caso |
| --- | --- |
| Helper de lista (extrair se ainda não existir) | `inserts` com 2 captions + 1 chip → lista de Inserts tem 1 item; contagem de legendas = 2 |
| Host de estilo | seleção chip + captions existentes → host = primeira caption; patch de `text.fontSize` muda `captionStyle.fontSize` e todas as linhas |
| Texto | seleção caption A → fileira abre e o textarea mostra A; seleção chip → fileira recolhe, rótulo “Clique uma legenda na timeline.”, sem textarea |
| `carryCaptionStyleRef` | já coberto; não regressar ao gerar de novo |
| InsertCard | não renderiza `kind === "caption"` (asserção via helper de filtro, não snapshot de DOM obrigatório) |

Smoke manual: gerar ~18 linhas → lista de Inserts não cresce; um slider de fonte mexe o preview inteiro; clicar clipe 4 abre o texto dessa frase; trim na timeline não exige campo Início.

---

## Arquivos previstos

Modificar:

- `components/control-panel.tsx` — filtro da lista; Visual + texto no bloco Legendas; contadores
- `components/style-customize-panel.tsx` — esconder “Aplicar a todos os inserts de texto” no contexto caption
- `components/insert-card.tsx` — não recebe mais captions (filtro no control-panel). Não é obrigatório apagar o ramo `kind === "caption"` nesta fatia
- `docs/legendas.md` — operador: um visual no bloco Legendas; Inserts sem linhas; texto só da selecionada; tempo na timeline

Criar (opcional, se o JSX do texto sujar o control-panel): `components/caption-text-card.tsx`.

Não: `lib/composition.ts` schema, rota `/api/ai/captions`, encoder, timeline-clip (gestos já existem), bump de version.

---

## Critério de pronto

1. Lista de Inserts sem nenhum card `Legenda`.
2. Um `StyleCustomizePanel` no bloco Legendas; mudar fonte/tamanho/cor/animação/X/Y pinta **todas** as linhas.
3. Campo de texto único, recolhível, só da caption selecionada na timeline. Sem Início/Duração aí.
4. Sem legendas, Visual e texto somem; Gerar continua.
5. Sem caption selecionada, Visual ainda edita; texto pede o clique na timeline.
6. Gerar de novo preserva look. Ctrl+Z desfaz visual e texto como hoje.
7. Preview = export. Testes da tabela verdes.

---

## Fora desta fatia

- Mostrar a lista compacta de todas as frases (expandir para 18 fileiras)
- Seguir o playhead em vez da seleção
- Campos Início/Duração no painel
- Redesenhar os acordeões (sombra, pad, karaoke, etc.)
- Undo de `captionPreset`
- Split/merge / SRT / “+ Legenda”
