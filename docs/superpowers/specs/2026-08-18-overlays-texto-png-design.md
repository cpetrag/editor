# Overlays texto e PNG — `kind` no insert

**Data:** 2026-08-18  
**Produto:** Editor de Inserts  
**Status:** implementado (abordagem C) + seguimentos no mesmo dia  
**Origem:** `montador-textos-inserts.md`  
**Não bumpa** `Composition.version` (continua `1`).  
**Ops atual:** [`docs/preview-overlays.md`](../../preview-overlays.md).

## Objetivo

O mesmo array `inserts` passa a aceitar três kinds: chips de marketing (os 10 tipos atuais), texto estilizado livre e sticker PNG. Timeline, zonas Gancho/Prova/CTA, clamp e lote continuam. Preview e export pintam texto/PNG com o mesmo raster (canvas). CSS **não** pinta texto nem PNG.

Fora desta fatia: karaoke/ASR, reviews Shopee, AnimBlock, arraste/resize no preview, unificar chips no canvas, mapear os 10 tipos para presets.

## Decisão

Abordagem **C**: `kind` no insert. Não há `overlays` paralelo. Não se substitui os chips.

## Schema

```ts
export type InsertKind = "chip" | "text" | "sticker"

export type InsertType =
  | /* os 10 atuais */
  | "texto-livre"
  | "sticker-png"
```

Pares válidos:

| kind | type | Layout |
|---|---|---|
| `chip` (default se omitido) | um dos 10 | `anchor` top/center/bottom |
| `text` | `texto-livre` | `x`/`y` % (centro do bloco) |
| `sticker` | `sticker-png` | `x`/`y` % + `scale` |

Leitura: se `kind` faltar, infere pelo `type`. Par inválido → insert descartado (como malformado hoje).

Campos compartilhados (já existem): `id`, `type`, `start`, `duration`, `anchor`, `animIn`, `animOut`. Clamp de tempo **não muda**. Zonas usam o ponto médio.

`anchor` em texto/PNG **não posiciona**. O lote só permuta `anchor` de chips. Texto/PNG mantêm `x`/`y`.

### Texto (`emptyText` / `createInsert("texto-livre")`)

Default: `text: "NOVO"`, `x: 50`, `y: 35`, `fontSize: 56`, `preset: "bold-outline"`, `maxWidthPct: 84`, `textAlign: "center"`, `anchor: "center"`, duração 3s.

Faixas: `x` 0–100; `y` 5–95; `fontSize` 40–360.

Opcionais: `fontFamily`, `rotation`.

### PNG

Não há fábrica vazia. Só via biblioteca / upload / colar.

Campos: `label`, `sourceKind` (`library` | `upload` | `paste`), `libraryId` **ou** `fileId`, `x: 50`, `y: 78`, `scale: 0.70` (0.40–2.00). Teto **20** stickers.

`src` **não** entra no JSON. `blob:` continua proibido. Upload/colar: blob no IndexedDB store `files` (mesmo do vídeo), chave = `fileId`.

Chip **nesta spec** não ganhava `x`/`y`. Seguimento do mesmo dia: chip pode
persistir `x`/`y`/`scale` opcionais — ver § Seguimento abaixo. Serialize de
chip ainda omite `kind`; omite `x`/`y`/`scale` se não existirem.

Parser **persiste** os campos novos (hoje descarta desconhecidos). `version` segue `1`.

## Compositor e preview

Ordem: vídeo → chips (`layoutInserts`, só `kind=chip`) → stickers PNG → textos → chrome de seleção (preview, depois) → Feed/Safe area (preview CSS, nunca no MP4).

Hit-test futuro: texto > PNG.

`drawFrame` é o único raster do arquivo. Preview nesta spec: chips CSS + canvas
transparente `object-contain` 1080×1920 só para texto/PNG. **Seguimento:** chips
também vão para o canvas (`drawChips`); CSS não pinta mais gancho.

Visível se `start <= t < start + duration`. Animação: estado settled (como Onda 1). Antes de desenhar texto: `document.fonts.load`. Fonte não pronta → não pinta o overlay.

`resolveLayerStyle(layer, "text" | "sticker", { brand })`. Chip não passa por isso. `brand.fontId` é fallback de família. Lote de fontes não sobrescreve `fontFamily` explícito do texto.

## UI

| Ação | Resultado |
|---|---|
| Adicionar Insert | cicla **só** os 10 chips, no playhead |
| + Texto | `createInsert("texto-livre")` no playhead |
| biblioteca PNG / upload / Ctrl+V | sticker; sem “+ vazio” |

Sem vídeo: colar imagem → erro curto, não cria. 20 stickers → recusa com motivo.

Card: tempo e anim para os três. Chip: tipo + texto + âncora. Texto: textarea, preset, fontSize, x/y % (números). PNG: thumb, scale, x/y. Sem âncora no card de overlay. Sem seletor dos 10 tipos.

Biblioteca: Elementos ganha “Texto livre”. Nova seção PNG (grid + enviar). Templates/lote **não** instanciam texto/PNG nesta fatia.

Duplicatas/mesclar: **só chips**. Timeline: duas cores novas.

## Biblioteca PNG (disco)

Root: `STICKER_PNG_DIR` (env, strip de aspas) ou `./data/stickers` a partir do cwd. Só raiz, só `.png`. Id estável: slug NFKD do basename + 10 chars SHA-1 do nome. Path traversal bloqueado.

| Rota | Papel |
|---|---|
| `GET /api/compose/stickers/library` | `{ ok, items: [{ id, name, mediaUrl }] }` — pasta vazia → `[]` |
| `GET /api/compose/stickers/media/[id]` | `image/png`, cache 1 h |

Sem `requireAiAuth`. Preview hidrata `Map<id, HTMLImageElement>`.

## Erros

| Situação | Comportamento |
|---|---|
| kind/type inválido | insert ignorado na leitura |
| `blob:` em qualquer campo | não serializa; parse zera o campo |
| colar sem vídeo | “Carregue um vídeo primeiro.” |
| 21º sticker | “Limite de 20 inserts PNG.” |
| pasta PNG ausente | `items: []` |
| id com `..` `/` `\` | 404 |
| fonte não carregou | overlay de texto omitido naquele frame |

## Testes

- parse: documento antigo sem `kind` → chip; texto roundtrip; sticker sem `src`; par inválido drop; `blob:` fora
- `layoutInserts` ignora texto/PNG
- `nextInsertType` ignora overlays na rotação
- `applyVariationPreview` não mexe `x`/`y`
- `wrapLines` + `resolveLayerStyle`
- stickerLibrary: path traversal, pasta vazia

## Seguimento (mesmo dia, já no ar)

Não faz parte da fatia C original; documentado para não contradizer o código.

1. **Gestos no preview (T4):** arraste, resize de canto, snap, nudge. Texto, PNG
   e chip. [`docs/preview-overlays.md`](../../preview-overlays.md).
2. **Chips no canvas:** `drawChips` no preview e no export. Chip opcionalmente
   tem `x`/`y`/`scale`. Sem `x`/`y` continua empilhado por `anchor`. Topo/Centro/Base
   no card limpa `x`/`y`.
3. **Timeline (abordagem A):** trim in/out, move, Delete.
   [`docs/timeline-clip.md`](../../timeline-clip.md).

Hit-test vigente: texto > PNG > chip.

## Fora

Inline editor, AnimBlock, karaoke, substituir chips (B), auth do Studio, tema
localStorage por `themeId`, undo, handles E/W e rotate.
