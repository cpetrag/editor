# Migração de render: MediaRecorder → Remotion

Spec de implementação para o **Editor de Inserts**. Executar **uma fase por vez**.
Não iniciar a fase seguinte antes dos critérios de aceitação da atual passarem.

**Status (2026-08-20):** Fases **0–3 no ar**. Fase **4 (lote) não começou**.  
**Como ficou (operador + arquivos + deploy):** [`docs/remotion-export.md`](../../remotion-export.md).

Desvios em relação a este texto (as-built):

- Não existe botão “Baixar props.json” (foi removido).
- `video.src` no render **não** é `file://`. O servidor serve `GET /media/:jobId` em http — o `OffthreadVideo` recusa `file://`.
- `isRenderSafeVideoSrc` rejeita `file:` e `blob:`.
- Depois do MP4 pronto: `showSaveFilePicker` (Chrome/Edge) ou Downloads.
- A barra de progresso mapeia render (até ~85%), download (até ~97%) e save (100%). `stage: done` no SSE **não** é o fim do export no PC.
- O processo `:4014` está no PM2 como `editor-render` (`127.0.0.1`, `pm2 save` no dump do Mini).

---

## Contexto

| Item | Valor |
|---|---|
| App | Editor de Inserts (Next.js, React) — `editor.macmini-capture.cc` |
| Já em uso | `@remotion/player` no preview |
| Export atual | MediaRecorder capturando o preview em tempo real (~25s p/ vídeo de 18s) |
| Alvo do render | Mac mini M4 — 4 P-cores + 6 E-cores, 16 GB RAM, Node v24, arm64 |
| Formato | 9:16, 1080×1920, 30fps |
| Duração típica | 18–30s, raramente 60s |
| Concorrência | **1 render por vez, sem fila** |
| Concurrency interna | `3` (subir para `4` apenas com Docker Desktop parado) |

### Objetivo

Substituir o export por render frame-a-frame determinístico, **sem reescrever o renderer de inserts** — o mesmo componente React que desenha o preview passa a desenhar o export.

### Não-objetivos

- Não mexer no schema de estilo/presets de insert (trilha separada).
- Não remover o MediaRecorder — ele vira **modo rascunho**.
- Não implementar fila, workers distribuídos ou Lambda.

---

## Fase 0 — Extrair a `<Composition>` pura

O preview hoje está acoplado ao estado do editor. Precisa virar um componente que é **função pura de `(frame, inputProps)`**.

### Arquivos

```
remotion/
  index.ts              # registerRoot
  Root.tsx              # <Composition id="Short" .../>
  Short.tsx             # composição raiz (fundo + inserts)
  InsertRenderer.tsx    # 1 insert -> DOM (reaproveitar o do preview)
  types.ts              # contrato de inputProps
```

### Contrato de `inputProps`

```ts
export type RenderProps = {
  video: { src: string; durationInSeconds: number };
  audio?: { src: string; volume: number };
  fps: number;                       // 30
  width: number;                     // 1080
  height: number;                    // 1920
  inserts: Insert[];
};

export type Insert = {
  id: string;
  type: string;                      // os 10 tipos existentes
  text: string;
  startInSeconds: number;
  endInSeconds: number;
  style: Record<string, unknown>;    // opaco nesta fase — não refatorar
  words?: { text: string; start: number; end: number }[];  // word-level (Whisper)
};
```

**Regra:** `inputProps` é a **única** fonte de verdade da composição. Nada de IndexedDB, `localStorage`, contexto do editor ou props derivadas de estado externo.

### Duração dinâmica

Vídeos variam de 18s a 60s. Usar `calculateMetadata` em vez de `durationInFrames` fixo:

```tsx
<Composition
  id="Short"
  component={Short}
  width={1080}
  height={1920}
  fps={30}
  defaultProps={defaultRenderProps}
  calculateMetadata={({ props }) => ({
    durationInFrames: Math.ceil(props.video.durationInSeconds * props.fps),
    fps: props.fps,
  })}
/>
```

### ⚠️ Armadilhas — o que quebra no render mas "funciona" no preview

O render tira **um screenshot por frame, com o tempo setado manualmente**. Qualquer animação que dependa de tempo real de parede não existe:

| ❌ Não usar | ✅ Usar |
|---|---|
| `transition:` do CSS | `interpolate()` / `spring()` |
| `@keyframes` / `animation:` | `interpolate()` sobre `useCurrentFrame()` |
| `requestAnimationFrame` | `useCurrentFrame()` |
| `setTimeout` / `setInterval` | derivar do frame |
| `Date.now()` / `Math.random()` | valores determinísticos vindos de props |
| `useState` + `useEffect` p/ animar | função pura do frame |
| `<video>` nativo | `<OffthreadVideo>` do `remotion` |
| `useEffect` p/ carregar fonte | `@remotion/google-fonts` + `delayRender()` |

Esta tabela é o núcleo da Fase 0. Se algum insert animar hoje via CSS `transition`, ele vai renderizar **congelado no estado inicial** — sem erro, sem aviso.

### Fonte do vídeo de fundo

Hoje o vídeo é um `File` local do navegador viram `blob:` URL. **`blob:` não existe fora daquela aba** — não funciona no CLI nem no servidor.

Nesta fase, aceitar em `video.src`:
- caminho absoluto local (para o CLI)
- URL http(s) (para o servidor)

Manter o `blob:` **apenas** no caminho do preview.

### Fontes

```ts
import { loadFont } from '@remotion/google-fonts/BebasNeue';
const { fontFamily } = loadFont();
```

Para fontes locais, `staticFile()` + `delayRender()`/`continueRender()`. Fonte que carrega tarde = primeiros frames com fallback, silenciosamente.

### Critérios de aceitação — Fase 0

1. `npx remotion studio` abre e reproduz a composição com `defaultProps`.
2. Arrastar a timeline do Studio para qualquer frame mostra o estado correto **sem reproduzir** (prova de determinismo).
3. O `<Player>` do editor renderiza o **mesmo** componente `Short`, alimentado pelas mesmas props.
4. `grep` no diretório `remotion/` não encontra: `Date.now`, `Math.random`, `requestAnimationFrame`, `setTimeout`, `transition:`, `@keyframes`.
5. Preview e Studio, no mesmo frame, são visualmente idênticos.

---

## Fase 1 — Render pelo CLI (validação)

Objetivo: **medir o tempo real no M4** antes de construir servidor.

```bash
npm i @remotion/cli @remotion/renderer @remotion/bundler remotion
```

`remotion.config.ts`:
```ts
import { Config } from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(3);
Config.setChromiumOpenGlRenderer('angle');   // mais estável no macOS
Config.setCrf(18);
```

Exportar do editor um `props.json` no formato `RenderProps` (botão temporário "Baixar props" serve), e:

```bash
npx remotion render remotion/index.ts Short out/video.mp4 \
  --props=./props.json \
  --concurrency=3 \
  --log=verbose
```

### Medir e anotar

- tempo total com `concurrency=3` e `=4`
- tempo com Docker Desktop parado vs rodando
- pico de RAM (`Activity Monitor` ou `top`) — **se aparecer swap durante o render, baixar concurrency**
- comparar o MP4 com o export do MediaRecorder: nitidez do texto, sincronia do áudio, animações completas

### Critérios de aceitação — Fase 1

1. MP4 gerado, reproduz, áudio sincronizado.
2. Todas as animações de insert aparecem completas (nenhuma congelada).
3. Tempos anotados. **Este número decide se a Fase 2 vale.**

---

## Fase 2 — Servidor de render no Mac mini

Projeto Node separado (não é parte do Next.js).

### Arquitetura

Processo longo, **bundle quente**:

```ts
// boot — UMA vez
const serveUrl = await bundle({ entryPoint: './remotion/index.ts' });

// por render
const composition = await selectComposition({ serveUrl, id: 'Short', inputProps });
await renderMedia({
  composition, serveUrl, inputProps,
  codec: 'h264',
  outputLocation: `./tmp/${jobId}.mp4`,
  concurrency: 3,
  chromiumOptions: { gl: 'angle' },
  crf: 18,
  onProgress: ({ progress }) => emit(jobId, progress),
});
```

Fazer `bundle()` no boot e reaproveitar elimina 10–20s fixos por render.

### Endpoints

| Método | Rota | Função |
|---|---|---|
| `GET` | `/health` | status, `busy`, disco livre, versão do bundle |
| `POST` | `/render` | multipart: vídeo + `props.json`. Retorna `jobId`. **409 se `busy`** |
| `GET` | `/progress/:jobId` | SSE com `{ progress: 0..1, stage }` |
| `GET` | `/download/:jobId` | o MP4 |
| `POST` | `/rebundle` | re-executa `bundle()` após deploy |

### Mutex

Um render por vez. Um booleano em memória basta — sem Redis, sem BullMQ:

```ts
let busy = false;
// POST /render:  if (busy) return res.status(409).json({ error: 'render em andamento' });
```

### Guardas obrigatórias

- **Disco:** abortar com 507 se `< 5 GB` livres. A máquina tem ~33 GB — um Lote enche rápido.
- **Limpeza:** apagar vídeo de entrada e MP4 de saída após download, ou por TTL de 1h.
- **Timeout:** matar o render acima de 10 min (60s @ 60fps deve caber em ~5 min).
- **Docker:** logar aviso no `/health` se a VM do Docker estiver de pé — ela come 4,1 GB e é o maior lever de RAM da máquina.

### Critérios de aceitação — Fase 2

1. `curl` do `/health` responde com disco e `busy`.
2. Render ponta a ponta via `curl` produz MP4 idêntico ao da Fase 1.
3. Segundo POST durante um render devolve 409 (não enfileira, não derruba).
4. SSE emite progresso monotônico até 1.
5. Após download, `tmp/` está limpo.
6. Reiniciar o servidor não deixa arquivo órfão.

---

## Fase 3 — Integrar no editor

No seletor de export, dois modos:

| Modo | Motor | Uso |
|---|---|---|
| **Rascunho** | MediaRecorder (atual) | conferir timing, 720p, offline |
| **Final** | Servidor Remotion | entrega |

Fluxo do modo Final: monta `RenderProps` → `POST /render` com o vídeo → abre SSE → barra de progresso → download.

Tratar explicitamente: **409** ("já tem render rodando"), **507** (disco), servidor offline (cair para rascunho com aviso claro).

### Critérios de aceitação — Fase 3

1. Botão dispara render e a barra reflete o progresso real.
2. 409, 507 e offline mostram mensagem específica — nunca erro genérico.
3. Modo rascunho continua funcionando com o servidor desligado.

---

## Fase 4 — Lote sequencial

Com render único, o Lote é um `for` — não uma fila:

```ts
for (const variant of manifest.variants) {
  await renderMedia({ ...base, inputProps: variant.props,
                      outputLocation: `./tmp/${jobId}/${variant.id}.mp4` });
}
```

O `serveUrl` é o mesmo para todas — bundle uma vez, renderiza N.

- Progresso em dois níveis: `variante 3/20` + progresso da variante atual
- Cancelamento entre variantes
- Saída: ZIP com os MP4 + o `manifest.json`
- **Checar disco antes de começar**: `nVariantes × ~15 MB` + margem

### Critérios de aceitação — Fase 4

1. 5 variantes geram 5 MP4 distintos e corretos.
2. Cancelar na variante 3 preserva as 2 já prontas.
3. Disco insuficiente aborta **antes** de iniciar, com mensagem clara.

---

## Referência rápida

| Sintoma | Causa provável |
|---|---|
| Animação congelada no estado inicial | CSS `transition`/`@keyframes` em vez de `interpolate` |
| Fonte errada nos primeiros frames | fonte carregada sem `delayRender()` |
| Render trava em "0%" | `delayRender()` sem `continueRender()` |
| `blob:` não encontrado | `video.src` de blob URL chegando no servidor |
| Render 3× mais lento que o esperado | swap — baixar `concurrency`, parar o Docker |
| Frames pretos onde há vídeo | `<video>` nativo em vez de `<OffthreadVideo>` |

**Licença:** livre para indivíduos e times de até 3 pessoas. A partir de 4 pessoas: Company License (Automators US$ 0,01/render, mínimo US$ 100/mês).
</user_query>