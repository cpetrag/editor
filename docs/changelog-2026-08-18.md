# Sessão 2026-08-18 — overlays no preview, chips no canvas, timeline

O que entrou no ar neste dia, depois da fatia `kind` (texto + PNG). Índice do
produto: [`README.md`](README.md). Publicar: [`../deploy.md`](../deploy.md).

**Não é git repo.** `git push` não publica. Caminho: rebuild no Mac + PM2
`editor-video` na porta **4013**.

---

## 1. Posição e tamanho no preview

Pedido: copiar o sistema do Montador (arrastar X/Y, resize nos cantos, coords
1080×1920). Fora: karaoke, FFmpeg, cards de review.

- Clique mapeia para o canvas via `object-contain` (`clientToPlay`).
- Persistência: `%` do frame, âncora centro, 1 casa.
- Texto: canto → `fontSize` 40–360. PNG: canto → `scale` 0.40–2.00.
- Snap ~8 px; Alt desliga. Setas ±1% / Shift ±5%.
- Sem handles E/W, sem rotate, sem undo.

Doc: [`preview-overlays.md`](preview-overlays.md).

## 2. Timeline — abordagem A

Pedido: manipular entrada/saída na timeline (arrastar, mover, apagar).

- Esquerda = in, direita = out, miolo = move, vazio = seek, Delete = apaga.
- Passo 0,1 s, mín. 0,5 s, mesmo `clampInsert` do card.

Doc: [`timeline-clip.md`](timeline-clip.md).

## 3. Qualquer elemento no vídeo (não só PNG)

Pedido: textos, ganchos e PNG movimentar e aumentar com o mouse.

- Chip pode ter `x`/`y`/`scale` opcionais. Sem `x`/`y` → empilha por âncora.
- Preview e export desenham chips com `drawChips` (acabou o chip CSS).
- Hit-test: texto > PNG > chip. Primeiro gesto num chip empilhado grava `x`/`y`.
- Card: Topo/Centro/Base limpa `x`/`y`. Escala sempre visível.

## 4. Deploy

Fluxo estável no Windows (não `pnpm dev` no SMB):

1. `pm2 delete editor-video`
2. `next build` no path nativo do HD no Mini
3. `PORT=4013 pm2 start npm --name editor-video --cwd … -- start` + `pm2 save`
4. Smoke `http://127.0.0.1:4013/` e `https://editor.macmini-capture.cc/` → 200
5. Hard refresh (`Ctrl+Shift+R`)

Detalhe: [`../deploy.md`](../deploy.md) §2.

## 5. Testes novos nesta sessão

`lib/compose/layout.test.ts`, `hit-test.test.ts`, `preview-snap.test.ts`,
`lib/timeline-clip.test.ts` (e asserts extras em `composition` / `insert-layout`).
Lista completa: script `test` em `package.json`.
