# Onda 1 — Destravar o Editor de Inserts

**Data:** 2026-08-18  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado (Onda 1)  
**Segue:** [Export correto](2026-08-18-export-correto.md) (clamp, zonas, logo, mime, spec, aba oculta).

## Objetivo

O botão **Renderizar e Exportar Vídeo** entrega um **MP4 H.264** baixável, com o vídeo de fundo e os inserts compostos, sem upload. Recarregar a página (F5) restaura composição e arquivo. Timings inválidos não esticam a timeline nem corrompem decimais.

Fora desta onda: timeline arrastável, checklist de conformidade, undo, IA real, lote ffmpeg, link de produto, kit de marca. O schema já reserva os campos que essas ondas vão preencher.

## Contexto atual (o que não se mexe)

Diferenciais que o redesenho não pode destruir:

- Simulador de Feed (chrome TikTok) e overlay de Safe area — **somente no preview**
- Marcadores GANCHO / PROVA / CTA na timeline
- Nomenclatura determinística no Lote + `manifest.json`
- Vídeo processado local (blob), sem upload no export único
- Biblioteca de templates com timings
- Layout responsivo, dark mode, botões com nome acessível

O estado hoje: `handleExport` só faz `console.log`; IA é mock; não há persistência; `totalDuration = max(video, fimDosInserts)`; `input type=number` + `Number()` corrompe `1.5` → `05`.

## Arquitetura

Fonte da verdade: um documento **`Composition` v1** em JSON. Preview CSS, compositor de export, persistência e (Onda 3) o worker ffmpeg consomem esse documento.

```
arquivo local ──► IndexedDB (blob)
                      │
composição ──► localStorage (JSON, sem blob:)
                      │
                      ▼
              Composition v1
                 │         │
                 ▼         ▼
         Preview CSS    Compositor canvas
         (Feed/Safe     (vídeo + inserts)
          só aqui)            │
                              ▼
                    canvas.captureStream()
                    + áudio do <video>
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     MediaRecorder                    WebCodecs VideoEncoder
     video/mp4; codecs=avc1           + mp4-muxer
     (caminho feliz)                  (fallback)
                              │
                              ▼
                         download .mp4
```

**Por que canvas no export e CSS no preview:** `HTMLElement.captureStream()` não existe. Só `<canvas>` e `<video>` geram `MediaStream`. Os inserts de hoje são chips (pílula, ponto colorido, texto) — o canvas reproduz esse layout a partir dos mesmos tokens (`INSERT_TYPE_MAP`, âncora, fonte). Feed e Safe area **nunca** entram no canvas.

**Remotion** fica fora do caminho. `VideoCompositionProps` some; quem chama o renderer recebe `Composition`.

### Módulos (fronteiras)

| Unidade | Faz | Não faz |
|---|---|---|
| `lib/composition.ts` | Tipos `Composition`/`CompositionInsert`, parse, serialize, migrate, clamp | I/O, canvas, React. Catálogos (cores, templates, fontes) continuam em `lib/inserts.ts`, que reexporta os tipos daqui. |
| `lib/parse-decimal.ts` | Aceitar `1.5`, `1,5` e opcionalmente sinal | Conhecer insert |
| `lib/project-store.ts` | localStorage + IndexedDB | Conhecer UI |
| `lib/insert-layout.ts` | âncora → retângulos/cores/texto do chip | Chamar `fillRect` / `fillText` (isso é o compositor) |
| `lib/export/compositor.ts` | `drawFrame(ctx, video, composition, time)` | Encoder |
| `lib/export/encoder.ts` | MediaRecorder → fallback WebCodecs; progresso; abort | Layout |
| `components/video-editor.tsx` | Estado, hidratação, orquestra export | Detalhe de mux |
| `components/preview-panel.tsx` | Preview CSS; `duration = source.duration` | Esticar pela lista de inserts |

Cada unidade se testa sem a seguinte.

## Schema `Composition` v1

```ts
export const COMPOSITION_VERSION = 1 as const

export type InsertType =
  | "logo-shopee"
  | "selo-frete"
  | "alerta-desconto"
  | "preco-riscado"
  | "cupom"
  | "contador"
  | "barra-estoque"
  | "estrelas"
  | "seta"
  | "tarja-frete"

export type InsertAnchor = "top" | "center" | "bottom"
export type AnimPresetId = "none" | "pop" | "slide-up" | "blur-in" | "typewriter" | "shake"

export interface CompositionInsert {
  id: string
  type: InsertType
  start: number
  duration: number
  text?: string
  anchor: InsertAnchor
  animIn: AnimPresetId
  animOut: AnimPresetId
}

export interface CompositionSource {
  duration: number
  fps: number
  width: number
  height: number
  fileName: string
  /** Chave do blob no IndexedDB; ausente se a fonte for URL remota. */
  fileId?: string
  /** URL remota playable; nunca gravar blob: aqui. */
  remoteUrl?: string
}

export interface CompositionBrand {
  fontId: string
  primary: string
  /** Data URI ou URL da marca. Default em `DEFAULT_BRAND_LOGO` (ver spec de export). */
  logo: string
}

export interface CompositionBatch {
  hooks: string[]
  fonts: string[]
  positions: InsertAnchor[]
  baseName: string
}

export interface Composition {
  version: typeof COMPOSITION_VERSION
  source: CompositionSource
  brand: CompositionBrand
  inserts: CompositionInsert[]
  batch: CompositionBatch
}
```

Constantes:

- `primary` padrão: `#EE4D2D`
- `fontId` padrão: `geist`
- `fps` padrão: `30`
- frame padrão se o vídeo ainda não carregou: `1080×1920`
- `batch` começa `{ hooks: [], fonts: [fontId], positions: ["top"], baseName: "" }` e a aba Lote já lê/escreve esse bloco (hoje o lote é estado solto)

Regras:

1. `blob:` nunca entra no JSON.
2. Campos desconhecidos na leitura: descartar (forward compatible).
3. `version !== 1`: recusar o documento, não migrar no escuro.
4. Aliases conhecidos da UI antiga, só na leitura: `startTime` → `start`, `position` → `anchor`. Não gravar os nomes velhos.
5. Insert interno da UI **é** `CompositionInsert`. Templates, AI mapper e lote passam a `start`/`anchor`.

### Clamp (duração do projeto = duração do vídeo)

`source.duration` é a única duração da timeline. Inserts fora do vídeo são **clampados**, nunca esticam o projeto.

```
MIN_DURATION = 0.5

clampInsert(insert, videoDuration):
  start'    = clamp(insert.start, 0, max(0, videoDuration - MIN_DURATION))
  maxDur    = max(MIN_DURATION, videoDuration - start')
  duration' = clamp(insert.duration, MIN_DURATION, maxDur)
  return { ...insert, start: start', duration: duration' }

clampComposition(c):
  return { ...c, inserts: c.inserts.map(i => clampInsert(i, c.source.duration)) }
```

Não mutar o objeto de entrada. Aplicar clamp em: blur do campo numérico, hidratação, imediatamente antes do encode. Enquanto o usuário edita o campo, o valor intermediário pode ser string (ver parser).

Se não houver vídeo (`duration === 0` ou ausente): timeline mínima de 15s só como placeholder visual; export continua bloqueado.

### Parser decimal

Campos de tempo **não** usam `input type="number"`. Usam `type="text"` + `inputMode="decimal"` + `autoComplete="off"`.

```
parseDecimal(raw: string): number | null
  trim
  vazio → null
  troca "," por "."
  opcional "-" no início (para o clamp tratar; o parser não descarta o sinal)
  aceita no máximo um separador decimal
  rejeita demais caracteres (letras, segundo ponto, espaços no meio)
  "05" → 5
  Number.isFinite → number, senão null

onChange: guarda string local no card (não dispara clamp a cada tecla)
onBlur / Enter: parseDecimal; se null, reverte ao último válido; senão clampInsert e grava number
display: timecode ao lado, `formatTimecode(seconds)` → `0:02,5` (vírgula pt-BR nos décimos, minutos com `m:ss`)
```

`1.5` e `1,5` viram `1.5`. `-5` no blur vira `MIN_DURATION` (0,5) se for duração, ou `0` se for início. Não concatena dígitos.

## Persistência

Chaves:

| Onde | Chave | Conteúdo |
|---|---|---|
| localStorage | `editor.composition.v1` | JSON de `Composition` |
| IndexedDB db | `editor-video` (v1) | object store `files` |
| IndexedDB record | `id` (igual a `source.fileId`) | `{ id, blob: Blob, mimeType, fileName, updatedAt }` |

`fileId` = UUID gerado no attach. Trocar o arquivo: apaga o record antigo, grava o novo, atualiza `source.fileId` / `fileName`.

Fluxo F5:

1. Ler JSON. Inválido ou ausente → estado inicial (inserts seed, sem arquivo).
2. Se `source.fileId`: `get(fileId)` → `File`/`Blob` → `URL.createObjectURL` (revogar o anterior).
3. Se o record não existe: composição permanece, `backgroundUrl` vazio, mensagem “Reanexe o vídeo para continuar”.
4. Se `source.remoteUrl`: usar a URL (sem IDB).
5. `loadedmetadata` atualiza `source.duration|fps|width|height` e reclampa inserts.

Debounce de escrita do JSON: 300ms após mudança de inserts/brand/batch. Blob no IDB: só no `change` do arquivo (não a cada frame).

Quota excedida (`QuotaExceededError`): toast/inline visível, composição em localStorage mesmo assim, arquivo não persistido. F5 perde o vídeo até reanexar.

Não persistir: `currentTime`, aba ativa, modo de overlay, object URL.

## Pipeline de export (1 vídeo, cliente)

### Pré-condições (botão)

Habilitado só se **todas** forem verdade:

- há vídeo playable (blob local ou URL que não seja `exemplo.com`)
- `source.duration > 0`

Enquanto exporta, o **mesmo** botão troca o rótulo para **Cancelar** e permanece clicável (dispara abort). Não existe um segundo botão.

Motivo no `title` / texto auxiliar quando desabilitado, nesta ordem: “Carregue um vídeo primeiro” → “Aguarde o vídeo carregar”.

### Resolução e fps

- Largura/altura: as do `source`, **cap 1080×1920** (escala proporcional, nunca upscale).
- fps: `source.fps` se 24–60, senão 30.

### Compositor

Canvas offscreen (não visível; o preview CSS continua na tela). A cada frame:

1. `drawImage(video, 0, 0, w, h)`
2. Para cada insert com `start <= t < start+duration`: desenhar chip via `lib/insert-layout.ts`

Chip no canvas (paridade com `InsertChip`):

- pílula `bg rgba(0,0,0,0.6)`, borda branca 15%, padding equivalente a `px-2.5 py-1`
- bolinha da cor `dotVar` do tipo
- ícone estrela se `estrelas`
- texto: `insert.text` ou `meta.label`; `preco-riscado` com line-through
- `fontFamily` resolvido de `brand.fontId` (as 6 fontes já carregadas no layout)
- âncora: top / center / bottom, centralizado no eixo x, empilhados com gap se vários na mesma âncora no mesmo `t`
- animações: Onda 1 desenha o estado “já visível” (sem interpolar pop/slide). O campo `animIn`/`animOut` permanece no schema para a Onda 2.

Feed, Safe area, HUD de tempo, marcadores de retenção: **fora** do canvas.

Áudio e frames: **o mesmo** `<video>` do preview. Durante o export o preview CSS pausa a interação (play/seek bloqueados) e o elemento roda do frame 0 ao fim para o compositor. Nada de segundo decoder. Trilha de áudio via `video.captureStream().getAudioTracks()`.

### Encoder

1. Montar `MediaStream`: video track de `canvas.captureStream(fps)` + audio tracks do vídeo.
2. Se `MediaRecorder.isTypeSupported("video/mp4")` ou `"video/mp4;codecs=avc1.42E01E,mp4a.40.2"`: gravar, `onstop` → `Blob` → download `fileName` slug + `_export.mp4`.
3. Senão: fallback WebCodecs — `MediaStreamTrackProcessor` (ou rAF + `VideoFrame` do canvas) → `VideoEncoder` `avc1.4d0032` (baseline/main 1080p) → `mp4-muxer`. Áudio: se `AudioEncoder` + AAC disponível, mux junto; senão MP4 **sem áudio** e aviso persistente: “Este navegador exporta sem áudio. Use Chrome 126+ para MP4 com som.”
4. Qualquer falha: mensagem visível + log `console.error` sem dados do vídeo.

Dependência nova permitida: `mp4-muxer`. Proibido: ffmpeg.wasm, Remotion, upload do arquivo no export único.

### Progresso e cancelamento

- Barra 0–100% = `currentTime / source.duration` durante o playback de export.
- `role="progressbar"` + `aria-valuenow`.
- Região `aria-live="polite"`: “Exportando…”, “Export concluído”, “Export cancelado”, “Falha ao exportar: {motivo}”.
- Botão vira **Cancelar** durante o job (`AbortController`). Abort para o playback, solta encoder, não baixa arquivo parcial.
- Preview CSS pausa durante o export para não competir pelo mesmo `<video>`.

### Download

`URL.createObjectURL(blob)` + `<a download>` + revoke no próximo tick. Nome: `slug(source.fileName || "video")_export.mp4`.

## UI da Onda 1 (só o que o motor exige)

- Duração do vídeo visível no painel esquerdo (`0:20` / `20,3 s`), não só no player.
- Campos Início/Duração: parser + timecode, sem `type="number"`.
- Timeline: largura baseada **só** em `source.duration`; insert com start 999 é clampado, GANCHO/PROVA/CTA não colapsam.
- Botão de export: estado + motivo, nunca habilitado mentindo.
- `aria-live` para o ciclo de export (e reutilizar para o mock de IA já existente: “Gerando…”, “Estrutura pronta”).
- Não redesenhar Lote, Biblioteca, Feed, Safe area, templates.

Estado vazio “arraste o vídeo aqui”, nomes de insert por conteúdo, confirmação de delete: **Onda 2**.

## Erros

| Situação | Comportamento |
|---|---|
| Sem vídeo | Botão desabilitado, motivo |
| Codec MP4 + WebCodecs indisponíveis | “Não foi possível gerar MP4 neste navegador. Use Chrome recente.” |
| Quota IDB | Aviso; composição salva; vídeo não |
| IDB sem blob no F5 | “Reanexe o vídeo”; inserts intactos |
| `version` ≠ 1 | Ignorar storage, começar limpo, `console.warn` |
| Abort | Sem arquivo; live “Export cancelado” |
| Erro no meio do encode | Live + inline; encoder destruído |
| Vídeo remoto CORS bloqueando canvas | Detectar `SecurityError` no `drawImage`; pedir arquivo local |

Não engolir `catch` vazio. Não logar o conteúdo do vídeo.

## Testes

Adicionar **Vitest** + **fake-indexeddb** (`pnpm add -D vitest fake-indexeddb`). Script `"test": "vitest run"`. Sem browser E2E nesta onda.

| Arquivo | Casos |
|---|---|
| `lib/parse-decimal.test.ts` | `1.5`, `1,5`, `05`, `2,50`, `""`, `"abc"`, `"-5"`, `"1.2.3"` |
| `lib/composition.test.ts` | parse v1; rejeita v2; ignora campo extra; `clampInsert` start 999 / duration -5 / start+dur > vídeo; `blob:` não serializa; migrate `startTime`/`position` de documentos seed se ainda existirem em memória |
| `lib/project-store.test.ts` | roundtrip JSON; fileId sem blob; nunca escreve `blob:` |
| `lib/insert-layout.test.ts` | âncora top/center/bottom em frame 1080×1920; dois inserts na mesma âncora empilham (y diferente) |

Encoder e canvas: sem teste automatizado na Onda 1. Verificação manual no Chrome: vídeo ~20s, 2 inserts, download MP4, play no player do SO, F5 restaura.

## Fora de escopo (reservado)

### Onda 2

Timeline drag/resize + snap GANCHO/PROVA/CTA; checklist pré-export (colisão, safe area, <0,8s, overlap); undo/redo; estado vazio; insert nomeado pelo `text`; Safe area **combinável** com Feed; Reels/Shorts; confirmação ou undo ao deletar; interpolar `animIn`/`animOut` no canvas.

### Onda 3

`batch` no JSON já existe; worker ffmpeg no Mac Mini consome o mesmo `Composition` + arquivo; preview de 3–4 variações; aviso se produto cartesiano > 20; teto 90. Campo “cole o link do produto”. IA real com contrato produto+oferta+persona+duração → composição alinhada às zonas; erro/retry/regenerar um insert. Manifest + UTM + reimport de CSV. Kit de marca no bloco `brand`.

Nada disso é implementado na Onda 1. Campos extra no JSON são ignorados na leitura para não travar essas ondas.

## Critério de pronto

1. Clicar em Renderizar com vídeo local baixa um MP4 que abre e mostra os inserts nos timings certos.
2. F5: inserts, fonte, eixos de lote e o arquivo de vídeo voltam.
3. Digitar `1.5` em Início grava 1,5s, não `05`.
4. Início `999` não muda a duração do projeto; o insert é clampado.
5. Duração `-5` vira 0,5s no blur.
6. Sem vídeo, o botão explica por quê.
7. Feed/Safe area visíveis no preview **não** aparecem no MP4.
8. `pnpm test` e `pnpm lint` passam.

## Arquivos previstos

Criar:

- `lib/composition.ts`
- `lib/parse-decimal.ts`
- `lib/project-store.ts`
- `lib/insert-layout.ts`
- `lib/export/compositor.ts`
- `lib/export/encoder.ts`
- `lib/parse-decimal.test.ts`
- `lib/composition.test.ts`
- `lib/project-store.test.ts`
- `lib/insert-layout.test.ts`

Modificar:

- `lib/inserts.ts` — catálogos e helpers; `export type Insert = CompositionInsert`; `start`/`anchor`; `VideoCompositionProps` removido
- `lib/ai-prompt.ts` — mapper `start`/`anchor`
- `components/video-editor.tsx` — hidratação, persistência, `handleExport` real
- `components/insert-card.tsx` — parser decimal
- `components/control-panel.tsx` — duração visível, botão com motivo, aria-live
- `components/preview-panel.tsx` — `totalDuration = source.duration`
- `components/batch-panel.tsx` — ler/escrever `composition.batch`
- `package.json` — vitest, fake-indexeddb, mp4-muxer

Não modificar o visual de Feed, Safe area, chips de preview CSS, nem a aba Biblioteca além do rename de campos.
