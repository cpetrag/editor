# IA real — Gerar estrutura, ganchos, Whisper e um PNG

**Atualizado:** 2026-08-20  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`, porta 4013)  
**Status:** em produção (PM2 `editor-video`). Spec:
[`superpowers/specs/2026-08-19-ia-real-design.md`](superpowers/specs/2026-08-19-ia-real-design.md).

O botão **Gerar com IA** e o **Sugerir ganchos** do lote deixaram de ser mock.
A chave fica só no servidor. Sem bump extra por legendas (`captionPreset`, `captionStyle`, `kind: caption`); `Composition.version` **3**.

---

## 1. O que o operador vê

### Gerar com IA (painel de inserts)

1. Descreve o produto no popover (textarea único).
2. Status: Transcrevendo… / Montando inserts… / Gerando PNG… (se não houver vídeo, pula a transcrição).
3. Os inserts atuais são **substituídos** (chips, texto e PNG); **legendas** (`kind: caption`) são **preservadas**. Ctrl+Z desfaz o lote inteiro (um passo).
4. Entra **um** PNG recortado (sticker `upload` no IndexedDB), além dos chips/texto.

Sem vídeo carregado o botão **não** bloqueia: gera só com o texto.

### Gerar legendas

Botão ao lado de **Gerar com IA** (sem popover). **Desabilitado** sem vídeo carregado.

- `POST /api/ai/captions` — Whisper `verbose_json` com `words`, timeout **90 s**, vídeo máx. **25 MB**
- Substitui **somente** inserts `kind: caption`; **não** apaga chips, texto nem PNG; **não** reseta `captionStyle`
- Toggle **Viral | Limpo** → `composition.captionPreset` (não entra no undo)
- Look (fonte, X/Y, cores) → `composition.captionStyle`; editar numa linha muda todas; Ctrl+Z desfaz o look

Doc: [`legendas.md`](legendas.md). Specs: fatia A [`superpowers/specs/2026-08-19-legendas-automaticas-design.md`](superpowers/specs/2026-08-19-legendas-automaticas-design.md); look [`superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md`](superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md).

### Sugerir ganchos (aba lote)

Gera até 4 frases e **acrescenta** na lista (não apaga as que já existem). Sem Whisper e sem PNG.

Erro **não** apaga o texto. O botão vira **Tentar de novo**.

---

## 2. Pipeline (Gerar)

```
browser (prompt + File do vídeo se houver + duração)
  → POST /api/ai/generate  (multipart, timeout 90 s)
       1. Whisper se arquivo ≤ 25 MB
       2. gpt-4o-mini → JSON de inserts (máx. 8)
       3. gpt-image-1.5 → 1 PNG transparente
  ← inserts + pngBase64? + warnings[]
browser: monta Inserts + grava PNG no IndexedDB → um applyInserts
```

Ganchos: `POST /api/ai/hooks` `{ prompt }` → `{ hooks: string[] }`.

Legendas: `POST /api/ai/captions`.

---

## 3. Modelos e PNG

| Papel | Env | Padrão | Notas |
| --- | --- | --- | --- |
| Texto / JSON | `OPENAI_TEXT_MODEL` | `gpt-4o-mini` | inserts e ganchos |
| Imagem | `OPENAI_IMAGE_MODEL` | `gpt-image-1.5` | **não** usar `gpt-image-2` (não gera alpha) |
| Áudio | `OPENAI_TRANSCRIBE_MODEL` | `whisper-1` | só fala; sem frames |

PNG gerado:

- Tamanho **1024 × 1536** (retrato 2:3)
- `background: transparent`, `output_format: png`
- Prompt sempre pede recorte, sem palco, sem sombra de chão
- No canvas 1080×1920 entra com escala padrão **0,7** (aba Movimento / resize)

`OPENAI_ADMIN_KEY` **não** serve. Tem que ser chave de projeto: `OPENAI_API_KEY=sk-proj-…`.

---

## 4. Env no Mac Mini

Arquivo: `.env.local` (ou `.env`) na raiz do app. Modelo: `.env.example`.

```
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_TRANSCRIBE_MODEL=whisper-1
```

O `next build` / `next start` lê `.env.local` no cwd do PM2. Nunca `NEXT_PUBLIC_*`.
Não commitar o valor. `.gitignore` ignora `.env` e `.env*.local`.

Sem chave: HTTP **503** — “IA não configurada no servidor.”

Conta OpenAI às vezes exige verificação da org para GPT Image. Se o PNG 403 e o texto 200: chips entram, live avisa que o PNG falhou.

---

## 5. Erros e avisos

| Situação | Comportamento |
| --- | --- |
| Prompt vazio | 400 |
| Sem chave | 503; inserts atuais intactos |
| JSON inválido (após 1 retry) | 502; inserts atuais intactos |
| Sem vídeo | `transcript-skipped`; segue |
| Arquivo > 25 MB ou Whisper falha | `transcript-failed`; segue com o texto |
| PNG falha | `image-failed`; chips entram, sem sticker |

---

## 6. Arquivos

| Arquivo | Papel |
| --- | --- |
| `app/api/ai/generate/route.ts` | multipart → pipeline |
| `app/api/ai/hooks/route.ts` | ganchos |
| `app/api/ai/captions/route.ts` | Whisper → legendas |
| `lib/ai-schema.ts` | Zod, aliases, drop `sticker-png` |
| `lib/ai-generate.ts` | duração, hint, prompt PNG, assemble |
| `lib/ai-openai.ts` | chave + OpenAI (só servidor) |
| `lib/ai-client.ts` | fetch 90 s no browser |
| `lib/ai-prompt.ts` | system prompt + mapper |
| `lib/ai-hooks.ts` | parse / merge de ganchos |
| `components/ai-generate-button.tsx` | popover |
| `components/generate-captions-button.tsx` | botão Gerar legendas |
| `components/batch-panel.tsx` | ganchos do lote |

Testes (sem rede OpenAI): `lib/ai-schema.test.ts`, `ai-generate.test.ts`, `ai-hooks.test.ts`, `ai-prompt.test.ts`. Legendas (sem rede): `lib/captions.test.ts`.

---

## 7. Fora desta fatia

Botão “gerar outra imagem”, campos produto/oferta/persona, visão de frames,
scrape Shopee, `gpt-image-2`. Legendas (split/SRT/+ Legenda): [`legendas.md`](legendas.md) §7.

Publicar mudanças: [`../deploy.md`](../deploy.md) §2 + hard refresh.
