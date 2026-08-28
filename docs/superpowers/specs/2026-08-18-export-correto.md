# Export correto — Editor de Inserts

**Data:** 2026-08-18  
**Produto:** https://editor.macmini-capture.cc  
**Status:** implementado e publicado  
**Escopo:** só bugs que geravam **arquivo exportado errado**. Sem redesenho.

Complementa a [Onda 1](2026-08-18-onda-1-destravar-design.md) (schema, persistência,
pipeline canvas). A Onda 1 deixou o botão de export funcional; esta leva o
arquivo e a UI de timing a bater com o que o usuário aprovou na tela.

---

## Regras permanentes

- Tempos na UI: vírgula decimal, no máximo **1 casa** (`formatSeconds`).
- Mensagens em português do Brasil, curtas, sem jargão.
- Preview CSS e canvas de export leem o mesmo `Composition`.
- Feed / Safe area nunca entram no MP4/WebM.
- Nome interno do tipo (`INSERT_TYPES[].label`) **nunca** vai para o frame.

---

## 1. Campo de tempo após o clamp

**Era:** `17.588995` escrito cru no input → em pt-BR virava `17588995`.  
**Ficou:** `formatSeconds` em `lib/parse-decimal.ts`; `insert-card` usa isso no
draft. `17.588995` → `17,6`.

## 2. Clamp do Início não encolhe a Duração

`clampInsert(insert, videoDuration, field)` em `lib/composition.ts`:

- `field === "start"`: `inicioMax = video − duracaoInsert`; duração intacta.
- `field === "duration"`: teto `video − inicioAtual`; início intacto.
- Só encolhe duração se ela **sozinha** não cabe no vídeo; o card avisa.

Exemplo: vídeo 18,088s, insert 1s / 4s, Início `999` → início `14,1`, duração `4`.

## 3. Faixas de retenção contínuas

`retentionZones(total)` e `zoneForInsert` em `lib/insert-ops.ts`. Preview e
lista de cards usam a mesma função.

| Gancho | Prova | CTA |
| --- | --- | --- |
| 0 → 0,15·d | 0,15·d → 0,70·d | 0,70·d → d |

Classifica pelo ponto médio (`start + duration/2`). Insert `0:09–0:12` num
vídeo de 18,088s cai em **Prova**. Em 10s não há buraco nem sobreposição.

## 4. Logo não exporta o rótulo do tipo

`CompositionBrand.logo` (data URI / URL). Default: SVG de sacola laranja, **sem**
a palavra Shopee (`DEFAULT_BRAND_LOGO`).

`layoutInserts` / preview: tipo `logo-shopee` pinta a imagem, nunca `"Logo
Shopee"`. Sem asset: chip omitido + aviso no card. Tipos gráficos sem texto
(`selo-frete`, `seta`, `estrelas`) também não caem no label do catálogo.

## 5. Mime e extensão alinhados

`lib/export/mime.ts` — cascata:

1. `video/mp4;codecs=avc1…`
2. `video/webm;codecs=vp9,opus`
3. `video/webm;codecs=vp8,opus`
4. `video/webm`

A extensão vencedora vale no download único, em `buildVariations(..., ext)` e no
`manifest.json`. Sem suporte: erro *“Este navegador não suporta gravação de
vídeo.”* WebCodecs continua como fallback **MP4** se o MediaRecorder falhar no
meio. Se o resultado for WebM, aviso para usar Chrome ou Edge.

## 6. Spec visível antes do export

Sob o botão, valores reais (não hardcoded):

```
{largura}×{altura} · {fps}fps · {MP4|WebM} · ~{duração}s
```

Dimensões passam por `capExportSize` (teto 1080×1920). fps via `outputFps`
(usa o da origem se 24–60, senão 30). Duração com `formatSeconds`.

## 7. Aba em segundo plano

Enquanto exporta: *“Mantenha esta aba aberta e visível até o fim.”*  
`document.visibilitychange` no encoder. Se a aba ficou `hidden`, ao terminar:
*“A aba ficou em segundo plano durante o export — o vídeo pode ter perdido
quadros. Exporte de novo com a aba visível.”*

O MediaRecorder grava em tempo real; `requestAnimationFrame` throttled com a
aba oculta perde frames **sem lançar erro**.

---

## Mapa de arquivos

| Área | Arquivos |
| --- | --- |
| Tempo / clamp | `lib/parse-decimal.ts`, `lib/composition.ts`, `components/insert-card.tsx` |
| Zonas | `lib/insert-ops.ts`, `components/preview-panel.tsx`, `components/control-panel.tsx` |
| Logo | `lib/insert-layout.ts`, `lib/export/compositor.ts`, `lib/composition.ts` |
| Mime / spec | `lib/export/mime.ts`, `lib/export/encoder.ts`, `lib/inserts.ts`, lote + painel |
| Aba oculta | `lib/export/encoder.ts`, `components/video-editor.tsx`, `components/control-panel.tsx` |

Testes: `pnpm test` (inclui `lib/export/mime.test.ts`).

---

## Ainda não é esta spec

Arrastar/redimensionar na timeline, snap nas fronteiras, checklist pré-export
(contraste, colisão com UI do Feed), lote ffmpeg no Mac Mini, IA real.
