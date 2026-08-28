# Legendas automáticas: karaoke híbrido (fatia A)

**Data:** 2026-08-19  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** fatia A implementada e no ar (2026-08-19). Look compartilhado (`captionStyle`) no ar em 2026-08-20 — ver [`2026-08-20-legendas-estilo-compartilhado-design.md`](2026-08-20-legendas-estilo-compartilhado-design.md) e [`docs/legendas.md`](../../legendas.md).  
**Não bumpa** `Composition.version` (continua **3**). Campos novos são opcionais.  
**Fora:** editor palavra a palavra, split/merge de linhas, tradução, SRT/VTT, “+ Legenda” vazia, chunk &gt; 25 MB, speakers, emojis automáticos.

O Whisper do Gerar estrutura continua devolvendo **só o texto** (chips). Legendas usam a rota irmã `POST /api/ai/captions` (`verbose_json` + words). Esta fatia queima legendas no canvas 1080×1920, alinhadas à fala, com destaque da palavra ativa.

---

## Objetivo

O operador clica **Gerar legendas** (vídeo já carregado) e recebe linhas na timeline. Cada linha mostra a frase; a palavra falada acende. Dois presets globais (**Viral** / **Limpo**). Dá para corrigir o texto da linha e o Início/Duração. Preview = export (mesmo `drawFrame`).

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Produto | Híbrido: gerar karaoke + trocar visual + editar linha |
| Destaque | Frase na tela + palavra ativa |
| Fatia | A: gerar, 2 presets, editar texto/tempo da linha. Sem editor de palavra |
| Modelo | Cada linha = insert `legenda` (`kind: "caption"`) |
| Preset | `composition.captionPreset`: `"viral"` \| `"limpo"` (padrão `"viral"`) |
| ASR | Mesmo `OPENAI_TRANSCRIBE_MODEL` (`whisper-1`), `verbose_json` + palavras |
| Rota | `POST /api/ai/captions` — **não** altera `/api/ai/generate` |
| Inserts atuais | Gerar legendas **só** substitui `kind === "caption"` |
| Gerar estrutura | Continua substituindo chips/texto/PNG, mas **preserva** as legendas |
| Schema | Sem bump. `captionPreset` e `words` opcionais |
| Tempos das palavras | Relativos ao `start` da linha |
| Posição inicial | `x: 50`, `y: 72` (acima da faixa Reels “Legenda / áudio”) |
| Animação | `animIn` / `animOut`: `"none"` |
| Idioma Whisper | `pt` |
| Teto | 25 MB, timeout 90 s, igual à IA |
| Chave | Só `.env.local`. Nunca `NEXT_PUBLIC_*` |

---

## Schema

### `Composition`

Campo novo opcional:

```ts
captionPreset?: "viral" | "limpo"  // ausente ou inválido → "viral"
```

`parseComposition` aceita o campo. Ausente ou inválido → `"viral"`. `serializeComposition` **sempre** grava o valor resolvido. Projetos antigos sem o campo abrem como `"viral"`.

### `InsertKind` / `InsertType`

- `InsertKind` ganha `"caption"`.
- `InsertType` ganha `"legenda"`.
- `resolvedKind`: `type === "legenda"` → `"caption"`. `kind: "caption"` só é válido com `type: "legenda"`.
- `CHIP_INSERT_TYPES` **não** inclui `legenda`. `layoutInserts` ignora caption (não empilha como chip).

### `CompositionInsert` (linha)

```ts
{
  id: string
  type: "legenda"
  kind: "caption"
  text: string              // frase na tela (caixa natural do Whisper)
  start: number
  duration: number          // mínimo MIN_DURATION (0,5 s)
  words: CaptionWord[]      // ausente no JSON → []
  anchor: "bottom"
  animIn: "none"
  animOut: "none"
  x: 50                     // % centro — **moveu para `composition.captionStyle`** (spec 2026-08-20)
  y: 72
  fontSize: 64              // DEFAULT_CAPTION_FONT_SIZE; clamp 40–360 (igual texto)
  maxWidthPct: 84
  textAlign: "center"
  style?: InsertStyle       // fonte/peso; cor de preenchimento do preset **vence** no draw
}
```

> **2026-08-20:** overlay da linha (`x`/`y`/`fontSize`/`maxWidthPct`/`style`) passou para `composition.captionStyle`. Na leitura e na escrita, inserts `legenda` só levam texto/tempo/`words`. Ver [`2026-08-20-legendas-estilo-compartilhado-design.md`](2026-08-20-legendas-estilo-compartilhado-design.md).

```ts
interface CaptionWord {
  text: string
  start: number  // segundos, relativo a insert.start, ≥ 0
  end: number    // > start, ≤ insert.duration
}
```

Parse: palavra sem `text` ou com tempos inválidos é dropada. Se `end > duration`, clampa. Se nenhuma palavra sobrar, o insert ainda entra (texto da linha só, sem karaoke até o operador editar — aí `reflowCaptionWords`).

Defaults no create: `fontSize` 64, `x` 50, `y` 72, `maxWidthPct` 84, `animIn`/`animOut` `"none"`, `anchor` `"bottom"`.

### Edição de texto e de tempo

- **Texto da linha muda:** `reflowCaptionWords(text, duration)` — tokenize por espaço, reparte a duração pelo número de caracteres (mínimo 0,05 s por palavra). Substitui `words`.
- **Início ou duração mudam (card ou trim na timeline):** `retargetCaptionWords(prev, next)` — converte palavras para tempo absoluto com o `start` antigo, recorta no novo intervalo `[next.start, next.start + next.duration)`, grava de novo relativo ao novo `start`. Não interpola. Palavras fora da janela saem.
- Sem UI de clicar palavra.

---

## Arquitetura

```
[Gerar legendas]
  browser (File do vídeo + duration)
    → POST /api/ai/captions  (multipart)
         1. recusar > 25 MB (também no client, antes do fetch)
         2. Whisper verbose_json + timestamp_granularities=word, language=pt
         3. groupCaptionLines(words) → lines[]
    ← { lines, warnings[] }
  browser: linesToCaptionInserts → replaceCaptionInserts(inserts, novos)
           (Ctrl+Z: pilha de inserts já cobre)

[Gerar estrutura]
  apply dos inserts da IA
    → não-captions atuais são trocados pelo resultado da IA
    → captions que já existiam ficam no fim do array
```

O Whisper de texto em `transcribeMedia` **não muda**. Nova função `transcribeCaptionWords` em `lib/ai-openai.ts`. Agrupamento e reflow são puros em `lib/captions.ts` (sem fetch).

`drawPlayInserts` ganha `captionPreset`. `drawFrame` e o overlay do preview passam `composition.captionPreset ?? "viral"`.

### Sequência do Gerar legendas

1. Sem vídeo no editor → botão desabilitado (não chama a rota).
2. Sem chave → 503 `"IA não configurada no servidor."`
3. Sem arquivo no multipart → 400 `"Carregue um vídeo."`
4. Arquivo &gt; 25 MB → 400 com o mesmo teto; client também bloqueia e escreve no status.
5. Whisper falha → 502 `"Não foi possível transcrever o áudio."` Inserts intactos.
6. Whisper ok mas nenhuma palavra/segmento → 422 `"Não encontramos fala no áudio."` Inserts intactos.
7. `groupCaptionLines` devolve `[]` → 422, mesma mensagem.
8. Senão → 200 `{ lines, warnings }`. Client substitui só captions.
9. Timeout do fetch no browser: **90 s**.

### Agrupamento `groupCaptionLines`

Entrada: palavras com tempos **absolutos** (`start`, `end`, `text`).

Nova linha quando:

- pausa entre o `end` da palavra anterior e o `start` da próxima &gt; **0,4 s**, ou
- a palavra anterior termina com `.` `?` `!`, ou
- a linha passaria de **32 caracteres** (contando espaços) — quebra **antes** da palavra nova, se a linha atual já tiver ≥ 1 palavra.

Pós-processo: se a última linha tiver `duration` &lt; 0,5 s e existir linha anterior, **funde** na anterior (texto e words). Se for a única linha, estica `duration` para 0,5 s (clamp no fim do vídeo fica no client via `clampInsert`).

Saída de cada linha:

- `start` = start absoluto da primeira palavra
- `duration` = end da última − start da primeira (mínimo 0,5 s depois do pós-processo)
- `text` = palavras juntas com espaço, sem forçar maiúsculas
- `words[]` com `start`/`end` **relativos** ao `start` da linha

Teto visual no draw: no máximo **2 linhas** de wrap (`maxWidthPct` 84). O agrupamento por 32 caracteres existe para o Whisper não entregar um parágrafo; o wrap do canvas ainda pode quebrar em 2.

### Fallback sem `words`

Se `verbose_json` vier só com `segments` (sem array `words`): para cada segmento, `split` em tokens e reparte o tempo do segmento de forma uniforme. `warnings` inclui `words-estimated`.

---

## Contratos

### Env

Sem chaves novas. Reusa:

```
OPENAI_API_KEY=
OPENAI_TRANSCRIBE_MODEL=whisper-1
```

### `POST /api/ai/captions`

`runtime = "nodejs"`, `maxDuration = 90`. Multipart:

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `duration` | sim | segundos do vídeo; se 0, assumir 15 |
| `media` | sim | File (mp4/webm/áudio). Teto 25 MB |

Não envia `prompt`.

Resposta 200:

```ts
{
  lines: Array<{
    text: string
    start: number
    duration: number
    words: Array<{ text: string; start: number; end: number }>
  }>
  warnings: string[]  // códigos estáveis
}
```

| `warnings[]` | Significado |
| --- | --- |
| `words-estimated` | tempos de palavra interpolados a partir de segmentos |

Erros HTTP:

| Status | Quando | Body |
| --- | --- | --- |
| 400 | sem media, duration inválida, &gt; 25 MB | `{ error: string }` |
| 422 | transcrição vazia | `{ error: "Não encontramos fala no áudio." }` |
| 503 | sem chave | `{ error: "IA não configurada no servidor." }` |
| 502 | Whisper/API falhou | `{ error: "Não foi possível transcrever o áudio." }` |

Log: `console.error("[editor] falha em /api/ai/captions", message)` — sem chave, sem bytes de áudio.

### Client

`requestCaptions({ duration, media: File })` em `lib/ai-client.ts`. `AiRequestError` igual ao Gerar. `linesToCaptionInserts(lines)` aplica defaults e `clampInsert`. `replaceCaptionInserts(current, incoming)` = não-captions atuais + incoming (incoming no fim).

---

## UI

- Botão **Gerar legendas** ao lado de Gerar com IA, sem popover. Desabilitado sem vídeo. Status na live region: “Transcrevendo…” → “Legendas prontas” (ou a mensagem de erro). Não zera inserts em erro.
- Toggle **Viral | Limpo** sempre visível no header de Inserts (default Viral). Muda só `captionPreset`.
- Card: tipo travado em “Legenda” (Select de tipo desabilitado). Abas:
  - **Conteúdo:** textarea do `text` + Início + Duração. Sem âncora de chip.
  - **Estilo:** fonte, peso, tamanho. Sem picker de cor de preenchimento que brigue com o preset (stroke/caixa vêm do preset no draw).
  - **Movimento:** X/Y. Sem sliders de animação (valores fixos `none`). Sem escala (caption não é PNG).
- Timeline: clipe com o `text` da linha. Trim / move / Delete iguais. Faixas de overlap iguais.
- Preview: arraste e resize como texto (`fontSize`). Hit-test = bbox da **frase**, não da palavra.
- Sem confirmação ao regenerar. Ctrl+Z desfaz.
- Sem botão “+ Legenda”.

---

## Desenho e export

Ordem em `drawPlayInserts`: chips → stickers → texto livre → **captions**.

`drawCaptionLine(ctx, insert, time, preset, brandFontId)`:

1. Inativo se `time` fora de `[start, start+duration)`.
2. `local = time - start`. Palavra ativa: `words` cujo `[start, end)` contém `local`. Se `local` cai num buraco, usa a palavra **anterior** (se `local` &lt; primeira palavra, nenhuma ativa — todas no estilo “inativo”).
3. Layout: mede cada palavra + espaço, wrap no máximo 2 linhas em `maxWidthPct` (reusa lógica de `wrap-lines` / `layoutInsertText` por tokens, não por string única opaca). Centro em `x`/`y` %.
4. **Viral:** `text-transform` só no paint (maiúsculas). Fill inativo `#FFFFFF`, ativo `#FFE500`. Stroke preto 6 px (escala com a fonte, igual `drawStyledText`). Sem caixa.
5. **Limpo:** caixa preta 72% / radius 8 (mesmo `caption-box`). Fill inativo `#FFFFFF`, ativo `#FFE500`. Sem forçar maiúsculas.

`captionPreset` vence `style.color` / `style.bgColor` no draw da caption. Fonte e `fontSize` do insert valem.

> **2026-08-20:** o draw lê `composition.captionStyle` (cores, fonte, posição). Viral/Limpo só escolhem o modo (maiúsculas+contorno vs caixa).

Export: nenhum caminho extra. `drawFrame` já chama `drawPlayInserts`. Sem arquivo SRT.

A guia CSS “Legenda / áudio” **não** entra no MP4. Default `y: 72` posiciona o bloco acima dessa faixa.

---

## Testes (sem rede OpenAI)

| Arquivo | Casos |
| --- | --- |
| `lib/captions.test.ts` (novo) | `groupCaptionLines`: pausa 0,4 s; pontuação; teto 32 caracteres; fundir &lt; 0,5 s; words relativos. `activeCaptionWord`: no intervalo; buraco → anterior; antes da primeira → null. `reflowCaptionWords`: 3 tokens, duração 3 s. `retargetCaptionWords`: trim à direita descarta a última palavra. `replaceCaptionInserts`: chip+texto intactos |
| `lib/composition.test.ts` | parse `legenda` + `words`; `captionPreset` inválido → viral; JSON antigo sem o campo continua version 3 |
| `lib/compose/hit-test.test.ts` | caption devolve bbox de frase (não null) |

Registrar `lib/captions.test.ts` no script `test` do `package.json`.

Rotas: sem teste HTTP nesta fatia. Smoke no Mac com chave + vídeo curto com fala em PT.

---

## Arquivos previstos

Criar:

- `app/api/ai/captions/route.ts`
- `lib/captions.ts` — group, active, reflow, retarget, replace, linesToInserts
- `lib/captions.test.ts`
- `lib/compose/draw-captions.ts` — paint karaoke
- `components/generate-captions-button.tsx`

Modificar:

- `lib/composition.ts` — kind, type, parse, serialize, mergeInsertPatch (retarget), defaults
- `lib/ai-openai.ts` — `transcribeCaptionWords`
- `lib/ai-client.ts` — `requestCaptions`
- `lib/ai-schema.ts` — `WHISPER_MAX_BYTES` já existe; warning `words-estimated`
- `lib/compose/draw-play.ts` — preset + draw captions por último
- `lib/compose/draw-overlays.ts` — não tratar caption como texto
- `lib/compose/hit-test.ts` — bbox caption = texto
- `lib/insert-layout.ts` — pular caption na pilha de chips
- `lib/export/compositor.ts` / `components/overlay-canvas.tsx` — passar preset
- `components/control-panel.tsx` — botão + toggle
- `components/insert-card.tsx` — card travado, sem anim/cor de preenchimento
- `components/video-editor.tsx` — apply captions; Gerar estrutura preserva captions
- `lib/ai-generate.ts` (assemble) **ou** o apply no editor — preservar `kind === "caption"`
- `package.json` — lista de testes
- `docs/README.md`, `docs/proximo.md` item 14

Não: encoder, muxer, bump de version, `pnpm add` (deps já existem).

---

## Critério de pronto

1. Com vídeo curto e chave: Gerar legendas cria N clipes `legenda`; o preview acende a palavra no tempo da fala.
2. Viral vs Limpo muda o paint de **todas** as linhas sem retranscrever.
3. Editar o texto da linha atualiza o preview; Início/Duração e trim na timeline recortam as palavras.
4. Export MP4 (Chrome) contém a mesma legenda do preview.
5. Gerar legendas de novo só troca captions; chips/PNG/texto livre ficam. Ctrl+Z volta.
6. Gerar estrutura **não** apaga as legendas.
7. Sem vídeo / sem chave / arquivo grande / sem fala: mensagens da tabela; inserts intactos.
8. `pnpm test` (ou `node --experimental-strip-types --test …`) verde.

---

## Fora desta fatia (ainda vale)

- Clicar palavra, split/merge, arrastar tempo por palavra
- Tradução, speakers, emojis, export SRT/VTT
- Botão “+ Legenda” vazia
- Arquivo &gt; 25 MB (chunk / compressão)
- Mudar o Whisper de texto do Gerar estrutura para `verbose_json`
- Visão de frames

Look compartilhado (fonte, cores, X/Y num objeto só): **feito** em 2026-08-20 — [`2026-08-20-legendas-estilo-compartilhado-design.md`](2026-08-20-legendas-estilo-compartilhado-design.md).
