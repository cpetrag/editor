# Editor de Inserts — Automação de Marketing de Vídeo

Editor visual para sobrepor **inserts** (logo, selos, alertas, provas) em vídeos
verticais 9:16 (Reels / TikTok / Shorts). Preview no navegador, **export Final
no Mac (Remotion)** ou rascunho no Chrome, persistência da composição, import
por URL (YouTube / TikTok / Instagram / Pinterest / X / Shopee Video) e
variações A/B em lote.

**Ao vivo:** https://editor.macmini-capture.cc  
**Publicar:** `deploy.md` (Next :4013) + [`remotion-export.md`](remotion-export.md) (render :4014).

Preview pinta inserts no canvas 1080×1920 a partir do documento `Composition`.
CSS da UI (Feed / Safe area / caixa de seleção) **não** entra no MP4. O modo
**Final** renderiza a mesma arte no Mac, frame a frame (Remotion `Short`).

Legendas (gerar, karaoke, look compartilhado): [`legendas.md`](legendas.md).  
UI de Inserts (Fases 1–2, factory vs legado): [`inserts-ui.md`](inserts-ui.md).  
Fontes (16 famílias, picker com preview, pesos): [`fontes.md`](fontes.md).  
Novo projeto / Limpar inserts: [`novo-projeto.md`](novo-projeto.md).  
Enquadramento do fundo (pan/zoom CapCut): [`enquadramento.md`](enquadramento.md).  
Marca d’água (`@handle`, Loop, Opac./Tam./Vel.): [`marca-dagua.md`](marca-dagua.md).  
Export Final / rascunho / CapCut / poll do túnel: [`remotion-export.md`](remotion-export.md).  
Changelog 28/08 (Final estável + modal de nome): [`changelog-2026-08-28.md`](changelog-2026-08-28.md).

---

## 1. Stack

| Item | Detalhe |
| --- | --- |
| Framework | Next.js 16 (App Router), porta **4013** (PM2 `editor-video`) |
| Render Final | Remotion no Mac, porta **4014** (`127.0.0.1`, PM2 `editor-render`) |
| UI | shadcn/ui (`@base-ui/react`) |
| Estilo | Tailwind v4 (`app/globals.css`) |
| Tema | `next-themes` (padrão escuro) |
| Testes | `node --experimental-strip-types --test` (`pnpm test`) |

> `Select` usa `value` / `onValueChange`. `ToggleGroup` usa `toggleMultiple`.
> Triggers customizados usam `render`, não `asChild`.

---

## 2. Pastas

```
app/                    layout, página, tokens CSS, rotas /api/import, stickers, /api/ai, /api/render
lib/
  composition.ts        schema Composition v4 (parse, serialize, clamp, captionStyle, styleRef)
  captions.ts           Whisper words → linhas → inserts `kind: caption` (group pipeline)
  composition-history.ts undo `{ inserts, captionStyle, sourceTransform, watermarkEnabled }`
  source-transform.ts   zoom/pan do MP4 (`Framing` scale/x/y centro; `space:offset`)
  preview-selection.ts  seleção `{ insert | source }` no preview
  inserts.ts            catálogos (tipos, fontes, templates, lote); picker de + Elemento
  insert-ops.ts         playhead, zonas, duplicatas, lista plana, seek na janela
  style-preset.ts       chips de faixa, looks de legenda, applyFactoryPreset
  style/                factory (presets, resolveStyle) — não reexportar style-preset daqui
  insert-layout.ts      chips: empilhar por âncora ou posição livre (x/y)
  timeline-clip.ts      trim in/out, move, hit da borda na timeline
  parse-decimal.ts      1,5 / 1.5; formatSeconds (1 casa, vírgula)
  project-store.ts      localStorage + IndexedDB
  project-reset.ts      Novo projeto / Limpar inserts (puro)
  watermark.ts          marca d’água (prefs, clamp, bounce, draw)
  watermark-store.ts    load/save `editor.watermark.v1`
  ai-prompt.ts          system prompt + mapper JSON → Insert
  ai-schema.ts          Zod da IA (inserts, ganchos, warnings)
  ai-generate.ts        pipeline Whisper → Mini → PNG (deps injetáveis)
  ai-openai.ts          chave e chamadas OpenAI (só servidor)
  compose/              layout 1080×1920, hit-test, snap, draw texto/PNG/chips/legendas
  import/               allowlist, yt-dlp, Shopee Video, fila, store
  export/
    mime.ts             cascata de mime → extensão
    compositor.ts       drawFrame (vídeo cover/enquadramento → chips → PNG → texto → legendas → marca)
    encoder.ts          rascunho: MediaRecorder / WebCodecs
    cover.ts            getVideoRect (enquadramento 1080×1920)
    final-client.ts     Final: POST + watchJobUntilDone (XHR) + download
    final-task.ts       singleton fora do React (start/cancel/retry/recover/nudge)
    last-job.ts         sessionStorage do último jobId
    export-status.ts    textos e faixas da barra / CapCut-only
    save.ts             Salvar como (Chrome) ou Downloads — rascunho / fallback
    render-proxy.ts     Next → render-server :4014 (JSON bufferizado)
    render-errors.ts    409 / 507 / offline (sem cair pra rascunho)
    capcut-*.ts         pasta CapCut, cópia, prefs
remotion/               Composition Short (preview Player + render)
render-server/          HTTP :4014, mutex, bundle quente, /media, CapCut
hooks/
  use-final-export-task.ts  useSyncExternalStore no finalExportTask
vendor/mp4-muxer/       muxer vendorizado (não usar pnpm add neste share)
components/             VideoEditor, painéis, overlay-canvas, timeline-clip
docs/                   ops e specs (índice abaixo)
scripts/                deploy no HD do Mac Mini
tmp/render/             jobs do Final (entrada/saída; gitignored)
```

---

## 3. Fonte da verdade: `Composition` v4

Definido em `lib/composition.ts`. Preview, export, persistência e o manifest
de lote leem o mesmo JSON. Const `COMPOSITION_VERSION` = **4** (lê v1–v3).
Docs históricos ainda citam v2/v3.

Campos de tempo: `start`, `duration` (não `startTime` / `position`). Aliases
antigos são aceitos só na leitura. `kind`: `chip` | `text` | `sticker` |
`caption` (omitido → infere pelo `type`; legendas usam `type: "legenda"`).
Composição: `captionPreset` `viral` | `limpo` e `captionStyle` (look nativo
das legendas). Factory: `insert.styleRef`, faixas `tracks`, `customPresets`.
Linhas `legenda` no JSON só levam texto/tempo/`words` no caminho nativo;
factory (`hormozi` etc.) grava `styleRef` em cada linha. Detalhe:
[`inserts-ui.md`](inserts-ui.md), [`legendas.md`](legendas.md).

```ts
interface CompositionInsert {
  id: string
  type: InsertType
  kind?: InsertKind
  start: number
  duration: number
  text?: string
  anchor: "top" | "center" | "bottom"
  animIn: AnimPresetId
  animOut: AnimPresetId
  x?: number          // % centro; texto/PNG sempre; chip só se colocado
  y?: number
  fontSize?: number   // texto 40–360; chip com texto 12–360
  scale?: number      // PNG/chip 0,2–4
  // texto: preset, fontFamily, rotation, maxWidthPct, textAlign
  // PNG: label, sourceKind, libraryId | fileId
  // legenda: text, words — look em composition.captionStyle
}

interface CaptionStyle {
  x: number            // % centro, default 50
  y: number            // % centro, default 72
  fontSize: number     // 40–360, default 64
  maxWidthPct: number  // 20–100, default 84
  fontFamily: FontId
  fontWeight: FontWeight
  color: string
  highlightColor: string
  bgColor: string
  strokeColor: string
  strokeWidth: number
}

interface CompositionBrand {
  fontId: string
  primary: string
  logo: string   // data URI / URL; default SVG de sacola, sem texto de marca
}
```

Regras:

- `blob:` nunca entra no JSON.
- Duração da timeline = `source.duration` (não o fim dos inserts).
- Clamp do **Início** recua o início e **preserva a duração**.
- Clamp da **Duração** não mexe no início.
- Tempos na UI: vírgula decimal, no máximo 1 casa (`formatSeconds`).
- Posição de overlay: % do frame, âncora centro, 1 casa. Detalhe:
  [`docs/preview-overlays.md`](preview-overlays.md).
- `source.transform?`: `{ scale, x, y }` — zoom/pan fixo do MP4. `scale` 1–4 (1 = cover). `x`/`y` = deslocamento do **centro** do vídeo em % do canvas (0 = centralizado). Ausente = identidade. Disco grava `space: "offset"`. Detalhe: [`docs/enquadramento.md`](enquadramento.md).
- `watermarkEnabled?: boolean` — v4 aditivo; omitido = off. Handle, loop, `opacityPct`, `fontPx` e `speed` ficam em `editor.watermark.v1`, não no JSON da composição. Contrato: [`marca-dagua.md`](marca-dagua.md).

Zonas Gancho / Prova / CTA (`lib/insert-ops.ts` → `retentionZones`):

| Faixa | Fração do vídeo |
| --- | --- |
| Gancho | 0 → 15% |
| Prova | 15% → 70% |
| CTA | 70% → 100% |

Classificação pelo **ponto médio** do insert (`start + duration/2`). A mesma
função pinta as faixas da timeline. A **lista** de cards é plana (`sortInsertsByStart`),
sem cabeçalho Gancho/Prova/CTA.

Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y desfaz e refaz o snapshot `{ inserts, captionStyle, sourceTransform }`
(memória da sessão, teto 50). Apagar mostra toast **Desfazer**. `captionPreset`
(Viral/Limpo) não entra no undo. Delete continua imediato.

---

## 4. UI

Três abas (`editor` | `library` | `batch`) + preview à direita.

| Peça | Papel |
| --- | --- |
| `video-editor.tsx` | Estado, hidratação, persistência, orquestra o export |
| `control-panel.tsx` | Vídeo, bloco Legendas, lista Inserts, export |
| `generate-captions-button.tsx` | Gerar legendas (Whisper words) |
| `caption-style-card.tsx` | Looks Limpo / Viral / factory (miniatura EXEMPLO) |
| `caption-visual-panel.tsx` | Visual global das legendas (thumbs + Estilo/Movimento) |
| `caption-text-card.tsx` | Texto recolhível da linha selecionada na timeline |
| `element-picker.tsx` | + Elemento (tipos + Combos) |
| `insert-card.tsx` | Tipo, texto, início/duração; Estilo/Movimento |
| `preview-panel.tsx` | `<video>` + overlay canvas + timeline; Safe area / Feed **só no preview** |
| `overlay-canvas.tsx` | Raster 1080×1920 + arraste/resize; ghost fora da janela |
| `timeline-clip.tsx` | Bloco na trilha (in / out / move) |
| `library-panel.tsx` | Consulta: templates, elementos, fontes, PNG (criar = + Elemento) |
| `batch-panel.tsx` | Permuta da composição atual; preview da variação; manifest |

**16 fontes** no picker (dropdown pinta o nome na família). Catálogo, pesos,
aliases e Remotion: [`fontes.md`](fontes.md).

**Texto** cria `texto-livre` no playhead. **Elemento** abre o seletor; nada nasce
antes da escolha. PNG entra pela biblioteca, upload ou Ctrl+V. Combos aplicam
`TEMPLATES` (substituem os inserts atuais). Contrato: [`inserts-ui.md`](inserts-ui.md).

Clique num bloco da timeline seleciona o card. Bordas = entrada/saída; miolo =
move; Delete apaga. Detalhe: [`docs/timeline-clip.md`](timeline-clip.md).
Inserts sobrepostos empilham em faixas (não fundem).

**Por URL:** cola o link público e **Baixar**. O Mac baixa o MP4 (yt-dlp ou
parse Shopee Video); o editor abre o blob como se fosse arquivo local. Doc:
[`import-social-url.md`](import-social-url.md).

---

## 5. Export

Toggle **Rascunho / Final** no rodapé (`control-panel.tsx`). **Final** é o padrão.
Contrato de operador, poll do túnel, CapCut e deploy do render:
[`remotion-export.md`](remotion-export.md) (atualizado 2026-08-28, **v1.1.11**).

**Final:** modal de nome CapCut → `POST /api/render` (vídeo + `RenderProps` +
`saveToCapcut` + `fileName`) → proxy Next → Remotion em `127.0.0.1:4014`.
Progresso por `GET /api/render/status/:jobId` (XHR, JSON bufferizado — o túnel
mata streams). Destino = pasta CapCut no HD; **sem** “Salvar como” do Chrome
quando `capcutSaved`. Se o status sumir: health + `nudgeMacIdle` + Recuperar
último export. O compositor **não** aceita `file://`; entrada em
`GET /media/:jobId` (http).

**Rascunho:** `lib/export/encoder.ts` compõe cada frame no canvas (`drawFrame`)
a partir da `Composition`: vídeo → chips → PNG → textos → **legendas**. Feed,
Safe area e a caixa de seleção **não** entram no arquivo. Preview usa as mesmas
funções de draw (`components/overlay-canvas.tsx`). Qualidade (1080 / 720 /
original) só neste modo. “Salvar como” / Downloads; CapCut opcional.

Cada insert ativo passa por `animAt(insert, time)` antes do paint (`pop`,
`slide-up`, `blur-in`, `typewriter`, `shake`). A caixa de seleção ignora a pose.

Cascata de mime do rascunho (`lib/export/mime.ts`): MP4 (avc1) → WebM (vp9/vp8).
A extensão do download, dos nomes do Lote e do `manifest.json` segue o mime que
venceu. Se não for MP4: *“Seu navegador exporta em WebM. Para MP4, use Chrome
ou Edge.”*

Junto do botão, no Final: `1080×1920 · 30fps · MP4 · ~18,1s`. No rascunho: spec
capada na qualidade escolhida.

409 / 507 / 503 mostram erro específico e **não** caem para rascunho (use
Recuperar / Tentar de novo).

Logo: `brand.logo`. Sem asset, o insert de logo **não** pinta o rótulo interno
(“Logo Shopee”) no vídeo.

---

## 6. Persistência

| O quê | Onde |
| --- | --- |
| JSON da composição | `localStorage` chave `editor.composition.v1` (debounce 300 ms) |
| Arquivo de vídeo | IndexedDB `editor-video` / store `files` |
| Link social (Por URL) | `source.remoteUrl` no JSON; o MP4 continua no IndexedDB |
| Cache do download no Mac | `data/import-downloads/` (sem TTL; gitignored) |
| Tema | `localStorage` `theme` |
| Handle, loop, opacityPct, fontPx e speed da marca d’água | `localStorage` `editor.watermark.v1` (globais do editor). Contrato: [`marca-dagua.md`](marca-dagua.md) |
| `watermarkEnabled` | no JSON da composição (só se `true`; omitido = off) |

F5 restaura inserts e, se o blob ainda existir, o vídeo. Import por URL:
se o blob sumiu, a URL fica no campo — **Baixar** de novo.

---

## 7. IA e legendas

Doc de operador da IA: [`ia-real.md`](ia-real.md).  
Legendas (gerar + karaoke + look compartilhado): [`legendas.md`](legendas.md).

| Peça | Detalhe |
| --- | --- |
| Gerar com IA | Whisper (se houver vídeo ≤ 25 MB) → Mini monta inserts → 1 PNG transparente |
| Gerar legendas | `POST /api/ai/captions`, Whisper `verbose_json` (words); só substitui `kind: caption` — **não apaga chips** |
| Look das legendas | `captionStyle` (Viral/Limpo) **ou** `styleRef` factory (Hormozi…). UI: bloco Visual em Legendas |
| PNG | `gpt-image-1.5`, **1024×1536**, alpha; escala 0,7 no canvas |
| Ganchos do lote | até 4 frases, **acrescenta** na lista |
| Rotas | `POST /api/ai/generate`, `POST /api/ai/hooks`, `POST /api/ai/captions` |
| Chave | `OPENAI_API_KEY` em `.env.local` (não `OPENAI_ADMIN_KEY`, nunca `NEXT_PUBLIC_*`) |

Sem chave: 503. Gerar estrutura substitui chips/texto/PNG (Ctrl+Z desfaz) e **preserva legendas**. PNG falhou: chips entram.

---

## 8. Testes

```bash
pnpm test
```

Roda `node --experimental-strip-types --test` nos arquivos listados em
`package.json` (`lib/*.test.ts`, `lib/compose/*.test.ts`, `lib/export/*.test.ts`,
`lib/import/*.test.ts`, `remotion/*.test.ts`, `render-server/*.test.ts`,
`lib/timeline-clip.test.ts`).

No Windows neste share SMB, preferir o binário direto
(`node --experimental-strip-types --test …`) em vez de `pnpm test` se o pnpm
travar. Não usar `pnpm add` aqui — quebra o virtual-store. Muxer e deps novas:
instalar **no Mac**, path `/Volumes/HD 1Tb/...`.

---

## 9. Docs desta pasta

| Doc | Conteúdo |
| --- | --- |
| [`proximo.md`](proximo.md) | Handoff: o que falta para a próxima conversa |
| [`fontes.md`](fontes.md) | 16 famílias, picker com preview, pesos, canvas e Remotion (**no ar**) |
| [`inserts-ui.md`](inserts-ui.md) | Fases 1–2 da UI de inserts (**no ar**) |
| [`novo-projeto.md`](novo-projeto.md) | Novo projeto (cabeçalho) e Limpar inserts (Origem) |
| [`enquadramento.md`](enquadramento.md) | Pan/zoom do MP4 no preview (CapCut); `source.transform` |
| [`marca-dagua.md`](marca-dagua.md) | Marca d’água nossa (`@handle`, Loop, Opac./Tam./Vel.); não é `source.watermarked` |
| [`remotion-export.md`](remotion-export.md) | Final Remotion (:4014), CapCut, poll do túnel, rascunho, deploy (**v1.1.11**) |
| [`changelog-2026-08-28.md`](changelog-2026-08-28.md) | Final estável no túnel + modal de nome CapCut (**no ar**) |
| [`changelog-2026-08-22.md`](changelog-2026-08-22.md) | Legendas — painel global; fontes; enquadramento CapCut; marca Opac./Tam./Vel. |
| [`changelog-2026-08-21.md`](changelog-2026-08-21.md) | Fases 1–2, Origem, checklist, handles, Novo projeto (**no ar**) |
| [`changelog-2026-08-20.md`](changelog-2026-08-20.md) | Legendas compartilhadas + export Final no ar |
| [`changelog-2026-08-19.md`](changelog-2026-08-19.md) | Undo + IA real no ar |
| [`changelog-2026-08-18.md`](changelog-2026-08-18.md) | Gestos, chips no canvas, timeline |
| [`ia-real.md`](ia-real.md) | Gerar com IA, ganchos, Whisper, PNG 1024×1536 |
| [`legendas.md`](legendas.md) | Gerar legendas, karaoke, Viral/Limpo, `captionStyle` |
| [`preview-overlays.md`](preview-overlays.md) | Arraste/resize no preview; chips no canvas; coords 1080×1920 |
| [`superpowers/specs/2026-08-22-marca-dagua-design.md`](superpowers/specs/2026-08-22-marca-dagua-design.md) | Spec handle/Loop/toggle (**no ar**) |
| [`superpowers/specs/2026-08-22-marca-dagua-controles-design.md`](superpowers/specs/2026-08-22-marca-dagua-controles-design.md) | Spec Opac./Tam./Vel. (**no ar**) |
| [`superpowers/specs/2026-08-21-source-transform-design.md`](superpowers/specs/2026-08-21-source-transform-design.md) | Spec 2026-08-21 (**substituída**; âncora 50/50) |
| [`timeline-clip.md`](timeline-clip.md) | Entrada/saída/move/Delete na timeline |
| [`import-social-url.md`](import-social-url.md) | Baixar vídeo por URL |
| [`import-social-platforms.md`](import-social-platforms.md) | Allowlist e engines (yt-dlp / Shopee) |
| [`montador-textos-inserts.md`](montador-textos-inserts.md) | Motor de overlays no Studio (origem) |
| [`superpowers/specs/2026-08-20-remotion-render-design.md`](superpowers/specs/2026-08-20-remotion-render-design.md) | Spec da migração Remotion (fases 0–4) |
| [`superpowers/specs/2026-08-19-legendas-automaticas-design.md`](superpowers/specs/2026-08-19-legendas-automaticas-design.md) | Legendas automáticas (Whisper words, Viral/Limpo) |
| [`superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md`](superpowers/specs/2026-08-20-legendas-estilo-compartilhado-design.md) | Look compartilhado + cores das legendas |
| [`superpowers/plans/2026-08-19-legendas-automaticas.md`](superpowers/plans/2026-08-19-legendas-automaticas.md) | Plano da fatia A (gerar + karaoke) |
| [`superpowers/plans/2026-08-20-legendas-estilo-compartilhado.md`](superpowers/plans/2026-08-20-legendas-estilo-compartilhado.md) | Plano do look compartilhado (histórico) |
| `superpowers/specs/` | Specs de design (Onda 1, export, overlays kind, import) |

Publicar: `../deploy.md`.

---

## 10. Fora do recorte atual

Lista viva do que falta, para retomar em outra conversa: [`proximo.md`](proximo.md).
