# IA real: inserts, ganchos, Whisper e um PNG

**Data:** 2026-08-19  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado e no ar (2026-08-19). Chave `OPENAI_API_KEY` em `.env.local`.  
**Não bumpa** `Composition.version` (continua `2`).  
**Fora:** formulário produto/oferta/persona, botão “gerar outra imagem”, visão de frames, karaoke, scrape Shopee, lote ffmpeg, bump de schema.

Hoje **Gerar com IA** e **sugerir ganchos** esperam 2s e devolvem sempre o mesmo mock. Esta fatia liga OpenAI no Mac Mini e troca os mocks.

---

## Objetivo

O operador descreve o produto no popover que já existe e recebe inserts reais (chips + texto) nas zonas Gancho / Prova / CTA, **um** PNG transparente na timeline, e (se houver vídeo) o timing alinhado à fala. No lote, sugerir ganchos acrescenta frases reais sem apagar as que já estão na lista.

---

## Decisões

| Tema | Escolha |
| --- | --- |
| Escopo | A (Gerar estrutura) + C (ganchos do lote) + 1 PNG + Whisper de áudio |
| Texto | OpenAI `gpt-4o-mini` (`OPENAI_TEXT_MODEL`) |
| Imagem | OpenAI `gpt-image-1.5` (`OPENAI_IMAGE_MODEL`). **Não** `gpt-image-2` (não aceita fundo transparente) |
| Áudio | `whisper-1` (`OPENAI_TRANSCRIBE_MODEL`). Sem frames, sem visão |
| PNG | Sempre 1 por Gerar. `background: "transparent"`, `output_format: "png"`, `size: "1024x1536"` |
| Pedir outro PNG | Fora. Fatia futura; Gerar de novo substitui **todos** os inserts (Ctrl+Z desfaz) |
| Arquitetura | Uma rota sequencial para Gerar. Rota irmã só de ganchos |
| UI | Popover e botão do lote atuais. Sem campos novos. Status + Tentar de novo |
| Inserts atuais | **Substituídos** pelo resultado. Undo da pilha de inserts já cobre |
| Ganchos | **Acrescenta** na lista (`Set` para não duplicar) |
| Sticker gerado | `sourceKind: "upload"` + `fileId` no IndexedDB (mesmo caminho de PNG que o operador sobe) |
| Schema | Sem campo novo. Sem bump |
| Chave | Só `.env` no Mac. Nunca `NEXT_PUBLIC_*`. Nunca no client bundle |
| Deps | Instalar **no Mac** (`ai`, `@ai-sdk/openai`, `zod`). Não `pnpm add` no share Windows |

---

## Arquitetura

```
[Gerar com IA]
  browser (prompt + File do vídeo se houver, duração)
    → POST /api/ai/generate  (multipart)
         1. Whisper se arquivo ≤ 25 MB
         2. generateObject (Mini) → inserts
         3. images.generate (1.5) → 1 PNG
    ← { inserts, pngBase64?, warnings[] }
  browser: aiInsertToInsert + File PNG → IndexedDB → applyInserts (substitui)

[Ganchos]
  browser (prompt)
    → POST /api/ai/hooks  (JSON)
    ← { hooks: string[] }
  browser: concatena em batch.hooks
```

Chave e modelos só nas rotas Node. `lib/ai-prompt.ts` deixa de mockar no client: vira mapper + schemas + helpers puros. O fetch mora nas rotas e num cliente fino (`lib/ai-client.ts` ou equivalente) chamado pelos botões.

### Sequência do Gerar

1. Prompt vazio → 400. Sem chave → 503 `"IA não configurada no servidor."`
2. Sem arquivo de mídia → pula Whisper.
3. Arquivo > 25 MB ou Whisper falha → `warnings` inclui transcrição; segue com o prompt.
4. Mini devolve JSON validado (Zod). Se inválido: **um** retry no servidor. Se persistir: 502, inserts atuais intactos.
5. PNG: prompt de imagem = texto do operador + primeiro `text` de chip de oferta (`alerta-desconto` ou `cupom`, se houver) + sufixo fixo de alpha. Falha ou 403 de org verification → chips mesmo assim, `warnings` inclui `image-failed`.
6. O JSON **não** contém `sticker-png`. O Mini pode devolver `stickerHint: { start, duration, position }` fora do array. Se ausente: `start: min(3, duration/3)`, `duration: 4`, `position: "bottom"`. **O client** (não o servidor) transforma `pngBase64` em `File`, grava no IndexedDB e chama `createStickerInsert({ sourceKind: "upload", fileId, label })` com o hint. Sem `pngBase64`, não cria sticker.

### Cliente do vídeo

O blob mora no IndexedDB. O `video-editor` passa o `File`/`Blob` para o popover no Gerar. Sem vídeo carregado, não envia arquivo e não bloqueia.

Timeout do fetch no browser: **90 s**.

---

## Contratos

### Env (Mac Mini, nunca commitar valor)

```
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_TRANSCRIBE_MODEL=whisper-1
```

Arquivo `.env.example` com as chaves vazias / defaults acima. `.env` no `.gitignore` (já deve estar; conferir).

### `POST /api/ai/generate`

Multipart:

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| `prompt` | sim | texto do popover |
| `duration` | sim | segundos do vídeo (número); se 0, assumir 15 |
| `media` | não | `File` (mp4/webm/audio). Teto 25 MB |

Resposta 200:

```ts
{
  inserts: AIInsert[]
  stickerHint?: { start: number; duration: number; position: "top" | "center" | "bottom" }
  pngBase64?: string   // PNG, sem prefixo data:
  warnings: string[]   // códigos estáveis, ver tabela
}
```

| `warnings[]` | Significado |
| --- | --- |
| `transcript-skipped` | sem arquivo |
| `transcript-failed` | Whisper falhou ou arquivo grande |
| `image-failed` | PNG não gerado; chips ok |

Erros HTTP: 400 prompt vazio; 503 sem chave; 502 JSON inválido após retry; 500 genérico sem vazar a chave.

### `POST /api/ai/hooks`

JSON `{ prompt: string }`. 200 `{ hooks: string[] }` (4 itens). Mesmos 400/503/502.

### `AIInsert` (Mini)

Campos: `type`, `start`, `duration`, `position?`, `animIn?`, `animOut?`, `text?`, `style?`.

`type` permitido no schema (depois do alias): os chips reais + `texto-livre`. **Não** `sticker-png`.

Aliases (já em `TYPE_ALIASES`): `selo-cupom` → `cupom`, `prova-social` → `estrelas`, `seta-animada` → `seta`, etc.

Regras no system prompt (atualizar `IA_SYSTEM_PROMPT` para fontes atuais e tipos reais):

- Zonas: Gancho 0–3s, Prova 3s até `duration - 5`, CTA últimos 5s (se `duration < 10`, comprimir proporcionalmente).
- Máximo 8 inserts.
- Nunca 3 inserts com overlap no mesmo `position`.
- Sem markdown na resposta.

`aiInsertToInsert` existente continua; o Gerar chama `clampInsert` / `clampComposition` com a duração real.

### PNG

Parâmetros API fixos: `model` do env, `background: "transparent"`, `output_format: "png"`, `size: "1024x1536"`.

Sufixo obrigatório no prompt de imagem (sempre concatenado, em inglês para o modelo de imagem):

> Isolated cutout on a fully transparent background (alpha channel). PNG. No floor, no studio, no drop shadow, no 3D box, no extra scene. Subject centered. Do not fill the canvas with a solid color.

Prefixo: tema da oferta em PT ou EN, paleta Shopee se o prompt for afiliado (`#EE4D2D`, `#FFD427`).

### Ganchos

4 strings PT-BR, curtas, sem aspas, sem numeração, tom de anúncio vertical.

---

## UI

- `ai-generate-button.tsx`: chama a rota, envia `media` se o editor fornecer, status: “Transcrevendo…”, “Montando inserts…”, “Gerando PNG…”, “Estrutura pronta”. Em erro: mensagem + o textarea **não** zera. Tentar de novo = mesmo `handleGenerate`.
- `batch-panel.tsx`: troca o mock por `POST /api/ai/hooks`. Loading e falha visíveis. Prompt do lote **não** some no erro.
- Sem toast novo. Live region que já existe (`onStatus`).

---

## Testes (sem rede OpenAI)

| Arquivo | Casos |
| --- | --- |
| `lib/ai-prompt.test.ts` (estender) | mapper + aliases; style inválido ignorado (já existe) |
| `lib/ai-generate.test.ts` (novo) | Zod rejeita type desconhecido / sem `inserts`; `sticker-png` no array é dropado; `assembleGenerateResult` sem `pngBase64` devolve só chips; com PNG devolve sticker `upload`; Whisper skip não aborta |
| `lib/ai-hooks.test.ts` (novo) | parse de 4 strings; concatena sem duplicar |

Rotas: não precisam de teste HTTP nesta fatia. Smoke manual no Mac com chave.

Registrar os `.test.ts` novos no script `test` do `package.json`.

---

## Arquivos previstos

Criar:

- `app/api/ai/generate/route.ts`
- `app/api/ai/hooks/route.ts`
- `lib/ai-schema.ts` (Zod)
- `lib/ai-generate.ts` (orquestração pura + assemble sticker)
- `lib/ai-openai.ts` (wrappers da API; chave só aqui)
- `.env.example`

Modificar:

- `lib/ai-prompt.ts` — remover delay/mock; manter mapper e system prompt atualizado
- `components/ai-generate-button.tsx`
- `components/batch-panel.tsx`
- `components/video-editor.tsx` — passar blob/duração ao Gerar
- `package.json` — deps (no Mac) + lista de testes
- `docs/README.md` §7, `docs/proximo.md` item 8

Não alterar compositor, encoder, schema v2.

---

## Critério de pronto

1. Com `OPENAI_API_KEY` no Mac: Gerar com um prompt de fraldas devolve inserts **diferentes** do mock antigo.
2. Com vídeo curto: status passa por Transcrevendo; timings respeitam a duração.
3. PNG aparece como sticker recortado (fundo alpha) no preview e no export.
4. Sem chave: 503, inserts atuais intactos.
5. Falha de PNG: chips na timeline, aviso no live.
6. Ganchos no lote acrescentam 4 frases novas.
7. Ctrl+Z depois do Gerar volta os inserts anteriores.
8. `pnpm test` (ou `node --experimental-strip-types --test …`) verde.

---

## Fora desta fatia

- Botão “gerar outra imagem”
- Campos produto / oferta / persona / duração no popover
- Análise visual (frames / GPT-5.6)
- Karaoke / legendas palavra a palavra
- Link de produto Shopee
- `gpt-image-2`
- Regenerar um insert só

---

## Deploy

`.env` no Mac **antes** do `next build` não é obrigatório (Next lê env no `next start` para rotas Node), mas a chave precisa estar no ambiente do processo PM2 (`editor-video`). Depois: `deploy.md` §2. Smoke: Gerar com IA + um gancho no lote. Hard refresh (Ctrl+F5).
