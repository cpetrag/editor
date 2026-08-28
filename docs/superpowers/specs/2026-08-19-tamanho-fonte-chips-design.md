# Tamanho da fonte nos chips + Escala 0,2–4

**Data:** 2026-08-19  
**Produto:** Editor de Inserts  
**Status:** implementado e publicado (19/08)  
**Não bumpa** `Composition.version` (continua `2`).  
**Fora:** animações, tipos novos, encoder/export.

## Problema

O controle de tamanho mistura px e multiplicador, e chips não têm tamanho de letra. Escala silencia valores > 2. Peso lista 400–900 mesmo quando a família só tem 400.

## Decisões

| Tema | Escolha |
| --- | --- |
| Estilo | Campo **Tamanho da fonte** (px) em todo insert com texto (texto livre e chip com `text`) |
| Chip + fonte | `insert.fontSize` no JSON. Pílula cresce por padding. Logo/ícone sem texto **ignoram** `fontSize` (só `scale`) |
| Default chip | `13` (= look atual: `round(CHIP_HEIGHT * 0.46)`). Ausente no JSON = 13 no draw |
| Faixa fonte | Texto 40–360. Chip 12–360 |
| Movimento | Só **Escala** (multiplicador) em chip e PNG. Texto livre: X/Y, **sem** Tamanho |
| Escala | `0,2–4` (3 casas). Label visível: `Escala 0,2–4` |
| Resize no preview | Texto → `fontSize`. Chip/PNG → `scale` (igual hoje) |
| Peso | Só pesos reais. 1 peso → Select **desabilitado**, valor **peso fixo** |

## Layout do chip

```
factor = (fontSize ?? 13) / 13     // 1 se logo ou ícone sem texto
size = baseSize * factor * scale
fontPx no draw = (fontSize ?? 13) * scale
```

`fontSize` 26 + `scale` 1 e `fontSize` 13 + `scale` 2 geram a mesma caixa; a letra acompanha.

## Schema

Mesmo campo `fontSize` já usado em texto. Parse/serialize de chip passam a persistir se presente. Sem bump de versão.
