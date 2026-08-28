# Marca d’água (texto / @handle)

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** em produção (`editor-video` :4013 + `editor-render` :4014).  
**Schema:** `Composition.version` **4** (só `watermarkEnabled?`; **não** bumpa).

Não confundir com `source.watermarked` (flag da Shopee no MP4 importado). Esta marca é **nossa**, pintada no canvas 1080×1920 por cima dos inserts.

Specs: [`superpowers/specs/2026-08-22-marca-dagua-design.md`](superpowers/specs/2026-08-22-marca-dagua-design.md) (handle / Loop / toggle) e [`superpowers/specs/2026-08-22-marca-dagua-controles-design.md`](superpowers/specs/2026-08-22-marca-dagua-controles-design.md) (Opac. / Tam. / Vel.). Card Origem: [`enquadramento.md`](enquadramento.md). Novo projeto: [`novo-projeto.md`](novo-projeto.md).

---

## 1. O que o operador vê

Duas linhas no card **Vídeo de fundo**, coluna do nome, nos dois estados (vídeo pronto e dashed vazio). Sem card extra, sem parágrafo de ajuda.

```
[Marca]  [@loja        ]  [Parado | Loop]
Opac. [22] %    Tam. [42]    Vel. [1] ×
```

| Controle | Onde vive | Papel |
| --- | --- | --- |
| **Marca** | composição (`watermarkEnabled`) | Liga a pintura **neste** vídeo. Desabilitado sem origem reproduzível. |
| Handle | `editor.watermark.v1` | Texto global. Placeholder `@minhaloja`. Máx. 40. Vazio = não pinta, mesmo com Marca ligada. |
| **Parado \| Loop** | `editor.watermark.v1` | Loop = ping-pong nas bordas. Parado = canto inferior direito (margem 48 px). |
| **Opac.** | `editor.watermark.v1` | 8–50 % (default **22**). Inteiro. |
| **Tam.** | `editor.watermark.v1` | 24–80 px no quadro 1080 (default **42**). Inteiro. |
| **Vel.** | `editor.watermark.v1` | 0,25–3 × (default **1**, passo 0,25). `1` = bounce 90 / 110 px/s. **Desabilitada** em Parado; o número fica no storage. |

Novo projeto **não** zera handle / Loop / números. Só o checkbox nasce desligado. Limpar inserts e Trocar MP4 **não** mexem nas prefs globais; o toggle permanece (é do projeto).

Undo **só** o checkbox. Digitar handle ou números **não** empilha histórico.

Clique em checkbox, input ou segmento **não** seleciona o Vídeo.

A marca **não** entra na timeline, no hit-test nem na lista de Inserts. Clique atravessa para o insert / fundo. Fica por cima de chips, PNG, textos e legendas; por baixo do chrome de seleção e do overlay Feed/Safe (CSS, nunca no MP4).

---

## 2. Números (Opac. / Tam. / Vel.)

Três `<input type="number">`. Sem slider, sem degraus S/M/L.

Enquanto digita:

- String vazia **não** grava `NaN`.
- `onChange` só commita se o número for finito **e** estiver em `[min, max]` — dá para digitar `22` sem o `2` virar `8`.
- No blur: vazio / inválido restaura o valor persistido. Finito fora da faixa (ou `1.1` de velocidade) commita; o parent clampa e o campo mostra o valor canônico (`3` → `8`, `1.1` → `1`).

`prefers-reduced-motion` **não** para o Loop (é conteúdo do MP4).

---

## 3. Persistência

Chave `editor.watermark.v1` (ao lado de `editor.composition.v1`):

```ts
{ text, loop, opacityPct, fontPx, speed }
```

JSON antigo `{ text, loop }` continua válido: números viram **22 / 42 / 1**. Lixo / ausente → default completo. Falha ao gravar → `console.warn`; a memória segue.

`watermarkEnabled?: boolean` no JSON da composição. Omitido = off. Serialize omite se `false`.

O Mac do Remotion **não** lê `localStorage`. Preview, rascunho e Final recebem um snapshot `WatermarkPaint` só se Marca estiver ligada **e** o texto (já trimado) não for vazio:

```ts
{ text, loop, opacityPct, fontPx, speed }
```

Sanitize no `render-server`: `text` / `loop` inválidos ou texto vazio → omite **todo** o `watermark` (o job não cai). Campo visual lixo (`opacityPct: "x"`) → default **22 / 42 / 1**, **mantém** a marca.

---

## 4. Pintura

`drawWatermark` no fim de `drawPlayInserts` (depois das legendas). Quadro sempre 1080×1920; export 720 escala junto.

| Item | Contrato |
| --- | --- |
| Fonte | Geist 800, branco, sem contorno. Fonte atrasada → `sans-serif` (pinta mesmo assim) |
| Alpha | `opacityPct / 100` |
| Bounce | `watermarkCenter(t, frame, box, loop, speed)`. `speed` default 1. `t = 0` = canto estático, qualquer speed |
| Parado | ignora `speed` na posição |
| Paint parcial | só `text` + `loop` pinta com defaults visuais |

---

## 5. Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/watermark.ts` | tipos, clamp, ping-pong, `drawWatermark` |
| `lib/watermark-store.ts` | load/save `editor.watermark.v1` |
| `lib/composition.ts` | parse/serialize `watermarkEnabled` |
| `lib/composition-history.ts` | undo só o toggle |
| `components/background-source-card.tsx` | `WatermarkRow` (duas linhas) |
| `components/control-panel.tsx` | default `DEFAULT_WATERMARK_PREFS` |
| `remotion/types.ts` | `RenderProps.watermark` no snapshot |
| `render-server/props.ts` | sanitize (visual lixo não dropa a marca) |

`draw-play`, compositor, encoder e `InsertRenderer` só encaminham `WatermarkPaint`.

Testes: `node --experimental-strip-types --test lib/watermark.test.ts lib/watermark-store.test.ts remotion/types.test.ts render-server/props.test.ts`

Publicar: [`../deploy.md`](../deploy.md) §2 + `pm2 restart editor-render` ([`remotion-export.md`](remotion-export.md) §3) + hard refresh (Ctrl+F5).

---

## 6. Fora

- PNG / logo / cor / tile
- Slider; velocidade X e Y separadas
- Aviso no checklist de export
- Marca na capa / thumb
- Remover a watermark da Shopee
- Bump de schema, encoder novo, Fase 3
