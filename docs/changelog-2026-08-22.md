# Sessão 2026-08-22

O que entrou **no ar** neste dia. Índice: [`README.md`](README.md).
Publicar: [`../deploy.md`](../deploy.md) §2 + hard refresh (Ctrl+F5).
**Não é git repo.**

---

## A. Legendas — painel global

Spec: [`superpowers/specs/2026-08-22-legendas-painel-global-design.md`](superpowers/specs/2026-08-22-legendas-painel-global-design.md).
Ops: [`legendas.md`](legendas.md).

Fonte, tamanho, cores, animação e X/Y ficam num bloco **Visual** na seção Legendas (um controle, todas as linhas). A lista de Inserts não mostra cards `Legenda`. Texto da frase só no campo recolhível da linha clicada na timeline; tempo só no clipe.

Slider, arraste no preview e looks factory/nativo gravam o visual em **todas** as linhas (`transform` + `styleRef` + `captionStyle`). Antes, X/Y/rotação/largura iam só para a caption selecionada.

Schema v4 inalterado. Whisper / `POST /api/ai/captions` inalterado.

Avisos pré-export iguais (coluna dos botões, topo, contraste) de **várias legendas** viram **um** aviso (“As legendas entram na coluna dos botões.”). Clique seleciona a primeira linha. O rodapé não cresce mais uma fileira por frase.

---

## C. Fontes no picker

Ops: [`fontes.md`](fontes.md). Spec antiga (9 famílias): [`superpowers/specs/2026-08-19-fontes-novas-design.md`](superpowers/specs/2026-08-19-fontes-novas-design.md).

O dropdown de Fonte (Visual das legendas, aba Estilo, insert legado) mostra o **nome na própria família** + vibe. Biblioteca/lote já tinham card de exemplo.

Entraram Alfa Slab One, Nunito, Lilita One, Luckiest Guy, Baloo 2 e Titan One (preview + canvas + MP4 Final). Geist, Playfair, Space Grotesk, Oswald e Inter **ficam**. Catálogo = **16**. Pesos honestos iguais aos de 19/08 (família de um corte = Select só com 400).

Schema v4 inalterado. Mudou `remotion/load-fonts.ts` → `pm2 restart editor-render` neste publish.

---

## B. Enquadramento CapCut (já no ar neste dia)

Contrato: [`enquadramento.md`](enquadramento.md).

Clique no vazio = Vídeo. Arraste = pan 1:1; roda = zoom no cursor; alças = escala no canto oposto. Card Origem: só **Resetar enquadramento** (sem sliders). `x`/`y` = offset do centro (0 = centro).

---

## D. Marca d’água — Opac. / Tam. / Vel.

Ops: [`marca-dagua.md`](marca-dagua.md).
Spec: [`superpowers/specs/2026-08-22-marca-dagua-controles-design.md`](superpowers/specs/2026-08-22-marca-dagua-controles-design.md).

Segunda linha no card Origem: opacidade 8–50 (default 22), tamanho 24–80 px (default 42), velocidade 0,25–3× (default 1). Globais em `editor.watermark.v1`, iguais em todos os vídeos. Novo projeto **não** zera. Vel. desliga em Parado. Preview, rascunho e Final usam o mesmo snapshot.

Schema v4 inalterado. `source.watermarked` (Shopee) intocado. Publicar exigiu `next build` + `pm2 restart editor-render`.
