# Sessão 2026-08-19 — undo dos inserts e IA real

O que entrou no ar neste dia. Índice do produto: [`README.md`](README.md).
Publicar: [`../deploy.md`](../deploy.md).

**Não é git repo.** Caminho: rebuild no Mac + PM2 `editor-video` porta **4013**.
Hard refresh (Ctrl+F5).

---

## 1. Undo / redo dos inserts

Pedido: desfazer apagar/arrastar sem toast e sem botões.

- Só o array `inserts`. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
- Um gesto (arraste, timeline, slider, texto no blur) = um passo. Teto 50.
- F5 zera a pilha; `localStorage` continua só a Composition.

Spec: [`superpowers/specs/2026-08-19-undo-inserts-design.md`](superpowers/specs/2026-08-19-undo-inserts-design.md).

---

## 2. IA real

Pedido: ligar LLM (A + C), um PNG transparente, análise só de **áudio** (Whisper).

- **Gerar com IA:** Whisper opcional → `gpt-4o-mini` (JSON de inserts) → `gpt-image-1.5` (1 PNG 1024×1536, fundo alpha). Substitui a timeline; Ctrl+Z desfaz.
- **Sugerir ganchos:** 4 frases, acrescenta na lista do lote.
- Chave: `OPENAI_API_KEY` em `.env.local` (não usar `OPENAI_ADMIN_KEY`).
- Sem chave: 503. PNG falhou: chips entram mesmo assim.

Doc de operador: [`ia-real.md`](ia-real.md).  
Spec: [`superpowers/specs/2026-08-19-ia-real-design.md`](superpowers/specs/2026-08-19-ia-real-design.md).

---

## 3. Deploy

1. `pm2 delete editor-video`
2. `next build` no HD do Mini (lê `.env.local`)
3. `PORT=4013 pm2 start npm --name editor-video --cwd … -- start` + `pm2 save`
4. Smoke `/` → 200. Rotas novas: `/api/ai/generate`, `/api/ai/hooks`

Detalhe: [`../deploy.md`](../deploy.md) §2.

---

## 4. Testes novos

`lib/ai-schema.test.ts`, `lib/ai-generate.test.ts`, `lib/ai-hooks.test.ts`
(além de `ai-prompt.test.ts` e `composition-history.test.ts` do undo).
Lista completa: script `test` em `package.json`.
