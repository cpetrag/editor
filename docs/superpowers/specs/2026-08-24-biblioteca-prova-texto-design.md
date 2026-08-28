# Biblioteca: prova social + texto livre customizável

**Data:** 2026-08-24  
**Produto:** Editor de Inserts  
**Status:** spec — aguardando revisão  
**Não bumpa** `Composition.version`.  
**Não apaga** receitas de chip, templates nem inserts já no projeto.

## Objetivo

A lista de **elementos adicionáveis** fica só com prova social e um texto que o operador customiza. O resto dos chips some da escolha, não do motor.

## Decisões

| Tema | Escolha |
| --- | --- |
| Abordagem | Esconder na lista; manter no motor |
| Visíveis para adicionar | `estrelas`, `bubble-comentario`, `texto-livre` |
| Onde some o resto | Biblioteca → Elementos **e** picker **+ Elemento** |
| Templates / combos | Continuam; podem criar chips ocultos da lista |
| Projeto antigo | Inserts de selo/seta/cupom etc. continuam editáveis |
| PNG / fontes / aba Templates | Sem mudança |
| Customização do texto | Barra flutuante com controles explícitos (não só presets) |
| Schema / encoder / legendas | Fora |

## O que o operador vê

### Biblioteca → Elementos

Três cards, sem grupos Marca / Urgência / Conversão / Atenção:

1. Avaliação (estrelas)
2. Comentário TikTok
3. Texto livre

Duplicatas do catálogo local (`extraElements`) só aparecem se o `type` for um desses três.

### Picker **+ Elemento**

A grade de tipos usa a **mesma** lista de três. A seção de **combos/templates** no popover permanece: aplicar um combo ainda pode colocar selo, seta, tarja, etc.

### Fora do recorte

- Aba PNG, Fontes, Templates da Biblioteca.
- Timeline, hit-test, undo, export.
- Barra flutuante dos **chips** (estrelas / comentário): texto, cores, escala, largura máxima — como hoje.

## Texto livre — barra

Ao selecionar um insert `texto-livre`, a barra ganha (além de presets, cor, alinhamento, fonte e avançado):

| Controle | Comportamento |
| --- | --- |
| Fundo | Liga/desliga `style.text.background.enabled`. Ligado usa o modo/cor já no estilo (ou pílula preta padrão se não houver fundo). Não ciclar `none → pill → block → highlight` no botão principal — o operador pediu on/off. |
| Sombra | Liga/desliga. Off = `text.shadows` vazio. On = a sombra atual ou um drop padrão (`y`/`blur` pretos) se estava vazia. |
| Arredondamento | Só habilitado com fundo ligado. Nudge ou slider curto em `text.background.radius` (px no estilo composto). Sem fundo, o controle não some: fica desabilitado. |

Presets continuam: escolher um look aplica o pacote inteiro (fonte, fundo, sombra). Os três controles depois disso só patcham o campo correspondente, como o painel avançado já faz.

Preview e export leem o mesmo `style` — sem caminho paralelo.

## Motor e lista

Fonte única, algo como `ADDABLE_ELEMENT_TYPES` (os três ids).

- `pickerInsertTypes()` filtra por essa lista (hoje filtra `libraryAddable !== false` e ainda inclui logo, selo, seta…).
- `visibleElements()` usa a mesma lista.
- `texto-livre` passa a ser addable; `sticker-png` e `legenda` seguem fora dessas duas portas.
- `ELEMENT_PRESETS` / `INSERT_TYPES` **não** são apagados. `libraryAddable: false` nos chips ocultos é o mecanismo, mais o allowlist para não reabrir por extra de tipo antigo.

`createInsert("logo-shopee")` e combos **não** quebram.

## Testes

- `pickerInsertTypes` contém exatamente os três ids (ordem irrelevante); não contém `logo-shopee`, `seta`, `contador`, `sticker-png`, `legenda`.
- `visibleElements` no catálogo vazio = os três; extra de `cupom` não aparece; extra de `estrelas` aparece.
- Combos/templates: `TEMPLATES.length >= 1` e instanciar um combo ainda produz inserts cujo `type` pode estar fora da lista.
- Texto: fundo on grava `background.enabled true`; off grava `false`; sombra on/off altera `shadows`; radius só muda com fundo on.
- Regressão: paint de chip oculto (ex. `seta`) continua com painter; parse de composição com `type: "cupom"` não descarta o insert.

## Fora

- Apagar 13 receitas do catálogo.
- Redesenhar a Biblioteca inteira.
- Novos presets de texto.
- Customizar sombra/raio nos chips de estrelas/comentário nesta fatia.
- Fase nova de legendas.
