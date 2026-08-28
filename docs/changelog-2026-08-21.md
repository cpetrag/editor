# Sessão 2026-08-21

O que entrou **no ar** neste dia. Índice: [`README.md`](README.md).  
Publicar: [`../deploy.md`](../deploy.md) §2 + hard refresh (Ctrl+F5).  
**Não é git repo.** PM2 `editor-video` porta **4013**. Encoder/Remotion **não** mudou nestas fatias (`editor-render` :4014 ficou como estava).

---

## A. UI de inserts — Fases 1 e 2

Contrato: [`inserts-ui.md`](inserts-ui.md).

Painel honesto (legado vs factory, toast Desfazer, lista plana) e corte
conceitual (card **Estilo das legendas**, **+ Texto** / **+ Elemento**, ghost
sem alças). Fase 3 **não** começou.

---

## B. Origem e revelação progressiva

Card de vídeo não destrutivo (`SourceImport`). **Trocar** troca o MP4 e
**mantém** inserts. Schema v4 aditivo. **Não** é a Fase 3 de `inserts-ui.md`.

---

## C. Checklist pré-export

Avisos acima do botão de export (clip curto, overlap, colisão, safe area,
contraste da pintura). Não bloqueia. Clique no aviso seleciona o insert.
`lib/export-checklist.ts`.

---

## D. Handles de rotação e E/W

Spec: [`superpowers/specs/2026-08-21-preview-handles-design.md`](superpowers/specs/2026-08-21-preview-handles-design.md).  
Ops: [`preview-overlays.md`](preview-overlays.md).

Haste + círculo para girar (ângulo livre). E/W só em texto/legenda
(`maxWidthPct`). PNG pinta `insert.rotation`. Legenda nativa:
`captionStyle.rotation` compartilhado. Chrome HTML **não** entra no MP4.

---

## E. Novo projeto e Limpar inserts

Contrato: [`novo-projeto.md`](novo-projeto.md).  
Spec: [`superpowers/specs/2026-08-21-novo-projeto-design.md`](superpowers/specs/2026-08-21-novo-projeto-design.md).

### Pedido

Terminar um anúncio e começar outro no mesmo navegador, sem F5 / limpar site.

### O que entrou

- **Novo projeto** no cabeçalho (dois cliques: Novo projeto → Confirmar). Zera
  vídeo, inserts e legendas. Grava JSON vazio na hora. Apaga blobs IndexedDB
  deste projeto. Sem undo. Presets “meus” e URLs recentes ficam.
- **Limpar inserts** no card Origem (abaixo de **Trocar**). O MP4 fica. Undo /
  toast **Desfazer**. Não apaga PNGs no IndexedDB (o undo precisa deles).

Testes: `lib/project-reset.test.ts`, `lib/project-store.test.ts`.

Smoke: `http://127.0.0.1:4013/` e `https://editor.macmini-capture.cc/` → 200
(publicado 2026-08-21 ~14:19 UTC).

---

## F. Não feito nesta data

Fase 3 da UI de inserts. Schema v5. Lote Remotion Fase 4. Encoder.

Enquadramento do fundo nesta data: âncora 50/50 + sliders. **Substituído em
2026-08-22** — ver [`changelog-2026-08-22.md`](changelog-2026-08-22.md) e
[`enquadramento.md`](enquadramento.md).
