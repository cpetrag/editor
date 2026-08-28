# Importação de vídeos sociais — documento técnico (Studio)

> **Editor de Inserts:** a implementação neste repo está em
> [`docs/import-social-url.md`](docs/import-social-url.md)
> (testado em produção em 2026-08-18). Este arquivo é a referência dos engines
> no Shopee Reviews Studio, de onde a allowlist / yt-dlp / Shopee Video foram
> portados.

**Atualizado:** 2026-08-18  
**Produto:** Shopee Reviews Studio (`gerador/`)  
**Aba UI:** **Importar** → “Baixar por link” / “Arquivos salvos”  
**Status:** em produção no Mac Mini (PM2 `shopee-reviews-studio`, porta 3009)

Documento técnico da fatia **Social**: colar URL pública de **YouTube, TikTok, Instagram, Pinterest, X (Twitter) e Shopee Video**, baixar MP4, persistir sem TTL e entregar ao Montador.

Ops / CapCut / deploy curto: [`docs/import-social-video.md`](import-social-video.md).  
Visão do Studio: [`docs/shopee-reviews-studio.md`](shopee-reviews-studio.md) §8.3a.  
Montador (destino do handoff): [`docs/montador-video-canvas.md`](montador-video-canvas.md).

---

## 1. O que é

Módulo **à parte** do Montador. O operador cola uma URL pública; o Studio valida o host, dispara um job assíncrono (um por vez), grava MP4 + metadados + thumb JPEG numa pasta durável no SSD do Mac, lista os arquivos, e opcionalmente:

- **Salvar no PC** — download autenticado do MP4 no navegador.
- **Usar no Montador** — copia para o store de captions e abre a aba Burn com o vídeo já hidratado.
- **Apagar** — remove só a pasta Importar (não mexe na cópia já enviada ao Montador).

Não há API oficial das plataformas. Há **dois engines**:

| Engine | Plataformas | Mecanismo |
|---|---|---|
| **yt-dlp** | YouTube, TikTok, Instagram, Facebook, Pinterest, X | binário no Mac; extractor da comunidade |
| **HTTP + `__NEXT_DATA__`** | Shopee Video | fetch da página de share + parse JSON Next.js + GET do MP4 com marca d’água |

Facebook também entra na allowlist (mesmo engine yt-dlp). Este documento foca nas seis plataformas pedidas; Facebook segue o mesmo contrato de YouTube/TikTok/IG/Pinterest/X.

Ferramenta **interna**. Conteúdo que exige login/cookies, playlists, boards, canais e páginas de produto Shopee estão fora de escopo.

---

## 2. Fluxo ponta a ponta

```
Operador (aba Importar, desbloqueado com STUDIO_API_SECRET)
        │  POST /api/import/download  { url }
        ▼
parseAllowedImportUrl(url)          ← allowlist de host → platform
        │
        ├─ 400 se host/URL inválidos
        └─ createJob({ status: queued, platform, sourceUrl })
                │
                ├─ tryAcquireImport(jobId)  ← mutex in-memory, 1 job
                │     └─ 429 se ocupado
                └─ setImmediate(run)
                          │
          ┌───────────────┴────────────────┐
          │ platform === "shopee-video"    │ senão
          ▼                                ▼
   downloadShopeeVideo()              runYtDlp()
   (fetch HTML → parse               (spawn yt-dlp
    __NEXT_DATA__ → GET MP4)          -f bv*+ba/b → MP4)
          │                                │
          └──────────────┬─────────────────┘
                         ▼
              {jobId}.mp4  +  {jobId}.meta.json
                         │
                    ensureThumb()  →  {jobId}.jpg   (falha ≠ erro do job)
                         │
                    job.status = "done"
                         │
UI poll GET /api/import/download/{jobId} a cada 1,5 s
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      preview       lista         Usar no Montador
   Range MP4     GET /list     POST /to-montador
                                    │
                         saveUploadFromPath (cópia, máx. 200 MB)
                                    │
                         page.js → tab burn + seedVideo { videoId, url }
```

O original **permanece** em `IMPORT_DOWNLOAD_DIR` até o operador apagar pela UI ou no disco. O handoff **copia**; não move.

---

## 3. Arquitetura e arquivos

```
gerador/
├── components/import/ImportTab.js          UI (URL, poll, lista, ações)
├── app/page.js                             glue: seed Montador / Meta
├── lib/import/
│   ├── allowlist.js                        hosts → platform
│   ├── ytdlp.js                            spawn yt-dlp + proxy
│   ├── shopeeVideo.js                      engine Shopee Video
│   ├── queue.js                            mutex 1-job (in-memory)
│   ├── store.js                            ids, meta, lista, jobs, delete
│   ├── paths.js                            IMPORT_DOWNLOAD_DIR (sem TTL)
│   ├── thumb.js                            ffmpeg 1 frame JPEG
│   └── __tests__/                          allowlist, ytdlp, store, queue, shopee, thumb
└── app/api/import/
    ├── download/route.js                   POST inicia job
    ├── download/[id]/route.js              GET status
    ├── list/route.js                       GET arquivos (+ backfill thumb)
    ├── media/[id]/route.js                 GET|HEAD Range + DELETE
    ├── thumb/[id]/route.js                 GET JPEG
    ├── delete/route.js                     POST lote
    ├── to-montador/route.js                POST copia → captions
    └── to-meta/route.js                    POST copia → store Meta (UI Social não expõe)
```

Consumidores secundários do **mesmo store + mesma fila**:

| Consumidor | Path | O que faz |
|---|---|---|
| Descobrir (TikHub) | `lib/tiktok/downloadQueue.js`, `components/discover/useDiscoverDownload.js` | baixa TikTok via `runYtDlp` no store Importar; dedupe por URL/`videoId` |
| TikTok (legado) | `app/api/tiktok/download/route.js` | mesmo `enqueueDownload` |

A fila é **global**: um download da aba Importar bloqueia Descobrir e vice-versa (`429` / retry 1,5 s).

---

## 4. Allowlist

Arquivo: `gerador/lib/import/allowlist.js`.  
Função: `parseAllowedImportUrl(raw) → { ok, platform, href, host } | { ok: false, error }`.

Regras:

1. `new URL(trim)` — senão `"URL inválida"`.
2. Protocolo só `http:` ou `https:`.
3. Hostname (sem ponto final) casa **exatamente** com um regex da tabela abaixo. Path **não** é filtrado na allowlist (Shopee produto em `shopee.com.br` já cai fora porque o host não está na lista).
4. Host fora da lista → `"host não permitido (só YouTube, TikTok, Instagram, Facebook, Pinterest, X, Shopee Video)"`.

### 4.1. Tabela de hosts

| Platform (meta) | Regex de hostname | Exemplos aceitos |
|---|---|---|
| `youtube` | `^(www\.|m\.)?youtube\.com$` | `youtube.com/watch?v=…`, `www.youtube.com/shorts/…`, `m.youtube.com/…` |
| `youtube` | `^youtu\.be$` | `youtu.be/{id}` |
| `tiktok` | `^(www\.|vm\.|m\.)?tiktok\.com$` | `tiktok.com/@user/video/{id}`, `vm.tiktok.com/…`, `m.tiktok.com/…` |
| `instagram` | `^(www\.)?instagram.com$` | `instagram.com/reel/…`, `instagram.com/p/…` |
| `pinterest` | `^([a-z0-9-]+\.)?pinterest.com$` | `br.pinterest.com/pin/…`, `www.pinterest.com/pin/…`, `pinterest.com/pin/…` |
| `pinterest` | `^pin\.it$` | `pin.it/{code}` (short link; yt-dlp resolve) |
| `x` | `^(www\.)?x.com$` | `x.com/{user}/status/{id}` |
| `x` | `^(www\.)?twitter.com$` | `twitter.com/{user}/status/{id}` |
| `shopee-video` | `^(br\.)?shp\.ee$` | `br.shp.ee/…`, `shp.ee/…` |
| `shopee-video` | `^sv\.shopee.com\.br$` | `sv.shopee.com.br/share-video/{postId}` |
| `facebook` | `^(www\.|m\.|web\.)?facebook.com$` / `^fb\.watch$` | watch / reel (mesmo pipeline yt-dlp) |

O que **não** passa (testes em `lib/import/__tests__/allowlist.test.mjs`):

- `shopee.com.br/product/…` e `www.shopee.com.br/…` (produto, live, afiliado).
- `evil-pinterest.com` (não é subdomínio real de `pinterest.com`).
- Qualquer host fora da tabela.
- URL malformada / protocolo diferente de http(s).

A allowlist **não** garante que o conteúdo seja vídeo. Pin só com imagem, tweet só texto, post IG só foto: o engine falha e a UI mostra o erro do job.

---

## 5. Engine yt-dlp (YouTube, TikTok, Instagram, Pinterest, X)

Arquivo: `gerador/lib/import/ytdlp.js`.

### 5.1. Contrato de qualidade

Args gerados por `buildYtDlpArgs`:

```
yt-dlp
  --no-playlist
  -f bv*+ba/b
  --merge-output-format mp4
  -o {destSemExt}.%(ext)s
  --print after_move:%(filepath)s
  --print before_dl:%(title)s
  --no-progress
  [--proxy {IMPORT_PROXY}]
  -- {url}
```

Significado de `-f bv*+ba/b`:

- `bv*+ba` — melhor stream de vídeo + melhor stream de áudio (merge via ffmpeg).
- `/b` — fallback para o melhor arquivo único se o merge não existir.
- `--merge-output-format mp4` — remux para MP4 (H.264 + AAC quando o extractor entregar isso).
- `--no-playlist` — uma URL = um vídeo (playlist YouTube não baixa o canal).

Não há escolha de resolução na UI. “Melhor qualidade prática” = o que o extractor do yt-dlp expõe naquele momento.

### 5.2. Execução

- Binário: `YTDLP_PATH` ou `yt-dlp` no PATH do PM2. Produção: `/opt/homebrew/bin/yt-dlp`.
- Timeout: **15 minutos** (`SIGKILL` no filho).
- Stderr truncado nas últimas 8 linhas, máximo 500 chars — é a mensagem que chega na UI.
- Título: primeira linha de stdout que não parece path de arquivo, cortada em 200 chars.
- Se o arquivo saiu com outra extensão, o código **renomeia** para `{jobId}.mp4`.
- `ffmpeg` precisa estar no PATH do PM2 para o merge (o mesmo binário do Montador/captions).

### 5.3. Proxy

`importProxy()`:

| `IMPORT_PROXY` | Efeito |
|---|---|
| *(vazio / não setado)* | default de código = `socks5://127.0.0.1:8080` |
| URL (`socks5://…`, `http://…`) | passa `--proxy` ao yt-dlp |
| `direct` / `off` / `none` | sem proxy |

**Produção atual (2026-07-27+):** `IMPORT_PROXY=direct`. YouTube via SOCKS da Hostinger dava timeout; saída residencial do Mac Mini funciona. TikTok/IG às vezes precisam do residencial Uberlândia via VPS — nesse caso voltar o SOCKS e `pm2 restart --update-env`.

Shopee Video **não** herda esse proxy (ver §6.4).

### 5.4. Comportamento por plataforma (yt-dlp)

Não há adapter por rede. A `platform` no meta vem só do hostname. O extractor interno do yt-dlp é quem resolve CDN, formato e geo.

#### YouTube (`youtube`)

| Item | Detalhe |
|---|---|
| URLs | watch, Shorts, `youtu.be`, `m.youtube.com` |
| Qualidade | ladder completa na maioria dos vídeos públicos; merge `bv*+ba` costuma entregar 1080p+ |
| Playlist / canal | `--no-playlist` — só o item da URL |
| Login / idade | falha (cookies fora de escopo) |
| Smoke | 2026-07-27: Short/vídeo curto → MP4 na pasta durável |

#### TikTok (`tiktok`)

| Item | Detalhe |
|---|---|
| URLs | canônica `@user/video/{id}`, short `vm.tiktok.com`, mobile `m.tiktok.com` |
| Qualidade | um MP4 (watermark da plataforma em muitos casos — depende do extractor) |
| Dedup extra | Descobrir reusa o store e recusa 409 se a mesma URL/`videoId` já existe (`findExistingImport`) |
| Fragilidade | extractors TikTok quebram com frequência — mitigação: atualizar o binário `yt-dlp` |
| Segundo caminho | `POST /api/tiktok/download` e Descobrir chamam `enqueueDownload` → **mesmo** `runYtDlp` + `writeMeta(platform: "tiktok")` |

Ids TikTok na aba Descobrir são numéricos longos (`isValidVideoId` em `lib/tiktok/urls.js`). Na aba Importar o id do arquivo é o job hex 24, independente do id da rede.

#### Instagram (`instagram`)

| Item | Detalhe |
|---|---|
| URLs | `/reel/{code}/`, `/p/{code}/` (post com vídeo) |
| Host | só `instagram.com` e `www.instagram.com` — **não** `instagr.am` |
| Qualidade | reel/post público; carrossel/foto-only falha no extractor |
| Login | reels de conta privada / login wall → erro yt-dlp |
| Fragilidade | alta (igual TikTok); atualizar yt-dlp |

#### Pinterest (`pinterest`)

| Item | Detalhe |
|---|---|
| URLs | pin individual `*.pinterest.com/pin/{id}/` e short `pin.it/{code}` |
| Qualidade | só pin **com vídeo**; pin só imagem → yt-dlp falha (esperado) |
| Fora | board, perfil, busca |
| Smoke | 2026-07-28: `br.pinterest.com/pin/…` → MP4 ~1,2 MB com `IMPORT_PROXY=direct` |

#### X / Twitter (`x`)

| Item | Detalhe |
|---|---|
| URLs | `x.com/{user}/status/{id}` e `twitter.com/…` |
| Qualidade | tweet com vídeo nativo; GIF/foto-only falha |
| Login / paywall | tweets restritos falham |
| Platform no meta | sempre `"x"` (mesmo vindo de `twitter.com`) |

---

## 6. Engine Shopee Video (sem yt-dlp)

Arquivo: `gerador/lib/import/shopeeVideo.js`.  
Spec: `docs/superpowers/specs/2026-08-02-import-shopee-video-design.md`.

Branch em `POST /api/import/download`: se `platform === "shopee-video"` chama `downloadShopeeVideo`; senão `runYtDlp`.

### 6.1. Por que não yt-dlp

A página pública de share é Next.js. O MP4 **não** está num player padrão que o yt-dlp extraia de forma estável. O JSON hidratado (`__NEXT_DATA__`) já traz `watermarkVideoUrl`. Fetch + parse é mais previsível e não depende de extractor.

Não há Playwright, sessão Shopee nem API autenticada.

### 6.2. Pipeline

```
share URL (br.shp.ee | shp.ee | sv.shopee.com.br/share-video/…)
        │
        ▼  GET  UA = iPhone Safari 16, redirect: follow
   HTML da resposta
        │
        ├─ contém __NEXT_DATA__?  ──sim──► parse
        │
        └─ não (típico de short link)
              resolveShareVideoUrl(finalUrl, html)
                1. query `redir` se for sv.shopee.com.br/share-video/…
                2. senão CONFIG.httpUrl no HTML (unescape \/ e \u0026)
              GET na URL resolvida
              parse __NEXT_DATA__
        │
        ▼
extractMediaInfo
  props.pageProps.mediaInfo.video.watermarkVideoUrl   ← obrigatório
  caption, hashtagContent, duration, watermarkCoverUrl
  userInfo.videoUserName
  count.likeCount / commentCount
  pageProps.query.postId  →  canonicalUrl
        │
        ▼  GET watermarkVideoUrl  (mesmo UA)
   Buffer → {jobId}.mp4
```

User-Agent fixo:

```
Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)
AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile Safari/604.1
```

### 6.3. Qualidade e marca d’água

Inspecionado em produção (2026-08-02) em `mediaInfo.video`:

| Campo | Presente? |
|---|---|
| `watermarkVideoUrl` | **sim** — único MP4 público |
| `watermarkCoverUrl` / `watermarkShareImageUrl` | sim (capa; **não** usamos como thumb — thumb vem do ffmpeg) |
| URL sem marca d’água / ladder 720–1080 / HLS | **não** |

Consequências:

- Não há escolha de resolução.
- A marca d’água Shopee é **inseparável** dessa fonte.
- Meta grava `watermarked: true`.
- Remoção de watermark não é suportada (ToS / outra fatia de produto).

### 6.4. Proxy Shopee

`SHOPEE_VIDEO_PROXY` — default **vazio = direto**. **Não** herda `IMPORT_PROXY`.

Se a variável estiver setada, o download **falha** com `"SHOPEE_VIDEO_PROXY configurado mas agente de proxy indisponível"` (agente Node ainda não plugado). Deixar vazio em produção.

### 6.5. Batch (só lib)

`downloadMany(urls, { delayMs = 800, destDir })` existe para scripts futuros. A rota HTTP aceita **somente** `{ url }` (um link). Sem batch na UI.

### 6.6. Fora de escopo Shopee

- Página de produto, live, afiliado (`shopee.com.br/…`).
- Vídeo sem marca d’água.
- Preço / link de produto (não vêm no `__NEXT_DATA__` do share).
- Cookies / login Shopee.
- Headless browser.

---

## 7. Fila, jobs e IDs

### 7.1. Mutex

`gerador/lib/import/queue.js` — estado **in-memory** do processo Node:

```
tryAcquireImport(jobId) → { ok } | { ok: false, currentJobId }
releaseImport()
getImportQueue() → { busy, currentJobId }
```

- Um download por vez em todo o Studio.
- Segundo `POST /download` → job marcado `error: "fila ocupada"` + HTTP **429** `{ error: "download em andamento", currentJobId }`.
- Restart do PM2 zera o mutex (jobs `.json` no disco podem ficar `running` órfãos — a UI trata como falha no poll se o processo morreu).

O mesmo mutex é compartilhado com `lib/tiktok/downloadQueue.js` (`pumpQueue` espera 1,5 s e retenta).

### 7.2. Identidade

| Conceito | Formato | Onde |
|---|---|---|
| `jobId` / `importId` | 24 hex (`crypto.randomBytes(12)`) | nome do MP4, meta, job, thumb |
| Validação | `/^[a-f0-9]{24}$/i` | `store.validId` — path traversal impossível via id |
| Job persistido | `{IMPORT_DOWNLOAD_DIR}/.jobs/{jobId}.json` | status para o poll |
| Asset | `{IMPORT_DOWNLOAD_DIR}/{jobId}.mp4` | o id do job **é** o id do arquivo |

Estados do job (`createJob` / `updateJob`):

| `status` | Significado |
|---|---|
| `queued` | criado, ainda não acquired |
| `running` | yt-dlp / Shopee em andamento |
| `done` | MP4 + meta gravados; thumb best-effort |
| `error` | mensagem em `error`; MP4 parcial é apagado |

UI considera ativos: `queued` e `running`. Poll a cada **1500 ms** em `GET /api/import/download/[id]`.

---

## 8. Persistência

`paths.js` — **intencional: sem TTL, sem `cleanupExpired`**. Teste em `store.test.mjs` garante que essas funções não existem.

### 8.1. Diretório

| Variável | Default | Produção (SSD) |
|---|---|---|
| `IMPORT_DOWNLOAD_DIR` | `<cwd>/data/import-downloads` | `/Users/cpetrag/vibecoding/shopee-reviews-studio/gerador/data/import-downloads` |

Subpasta `.jobs/` para JSON de job.

### 8.2. Arquivos por id

| Arquivo | Função |
|---|---|
| `{id}.mp4` | vídeo |
| `{id}.meta.json` | metadados |
| `{id}.jpg` | thumb ffmpeg (~360 px de largura) |

### 8.3. Schema do meta (`writeMeta`)

Campos comuns (todas as plataformas):

```json
{
  "title": "string ≤ 200",
  "platform": "youtube | tiktok | instagram | pinterest | x | shopee-video | facebook",
  "sourceUrl": "URL normalizada (href do parse)",
  "createdAt": 1720000000000,
  "bytes": 1234567
}
```

Extras **somente Shopee Video**:

```json
{
  "postId": "…",
  "author": "videoUserName",
  "likes": 0,
  "comments": 0,
  "hashtags": ["…"],
  "durationMs": 15000,
  "coverUrl": "https://…watermarkCover…",
  "canonicalUrl": "https://sv.shopee.com.br/share-video/{postId}",
  "watermarked": true
}
```

TikTok via Descobrir pode gravar também `videoId` (id numérico da rede) no meta.

### 8.4. Shape da lista (`GET /api/import/list`)

Ordenação: `mtimeMs` desc. Limite default: 100.

```json
{
  "items": [
    {
      "id": "aabbccddeeff001122334455",
      "title": "…",
      "platform": "youtube",
      "sourceUrl": "https://…",
      "createdAt": 1720000000000,
      "date": 1720000000000,
      "bytes": 1234567,
      "mtimeMs": 1720000000000,
      "hasThumb": true,
      "thumbUrl": "/api/import/thumb/{id}"
    }
  ],
  "source": "social"
}
```

`thumbUrl` é `null` se o JPEG não existir (após backfill de até 20 itens por request).

### 8.5. Handoff vs original

| Local | TTL | Quem apaga |
|---|---|---|
| `IMPORT_DOWNLOAD_DIR` | **nenhum** | operador (UI Apagar ou Finder/SSH) |
| `data/captions/uploads` (após to-montador) | ~6 h | limpeza do store de captions |
| Store Meta (após to-meta) | store Meta | — |

`saveUploadFromPath` recusa arquivo **> 200 MB**. O MP4 pode existir na pasta Importar acima desse teto; o handoff ao Montador é que falha.

---

## 9. Thumb

`gerador/lib/import/thumb.js` — `ffmpeg` (`ffmpegBin()` de `lib/captions/ffmpeg.js`):

1. Seek **1 s**, 1 frame, `scale=360:-1`, JPEG `-q:v 5`.
2. Se falhar (vídeo mais curto), tenta seek **0 s**.
3. Falha de thumb **não** marca o job como erro; a linha da lista mostra placeholder 48×64 escuro.

Backfill: `GET /api/import/list` chama `backfillMissingThumbs(items, { max: 20 })` para MP4s antigos sem JPG. Não sobrescreve JPG existente.

`GET /api/import/thumb/[id]` — JPEG, `cache-control: private, max-age=3600`, auth obrigatória.

---

## 10. APIs

Auth em **todas**: `requireAiAuth` (`gerador/lib/ai/auth.js`).

- Cookie `studio_ai` = SHA-256 de `studio-ai:{STUDIO_API_SECRET}`, ou
- Header `X-Studio-Secret` (smoke/curl).
- Secret ausente → **422**. Credencial errada → **401**.

Runtime: `"nodejs"` (não Edge) — precisa de `fs`, `spawn`, streams.

### 10.1. Catálogo Social

| Método | Rota | Body / query | Sucesso | Erros |
|---|---|---|---|---|
| `POST` | `/api/import/download` | `{ url }` | `{ jobId, status: "running" }` | 400 URL/host; 429 fila |
| `GET` | `/api/import/download/[id]` | — | objeto job | 404 |
| `GET` | `/api/import/list` | (sem `source` = social) | `{ items, source: "social" }` | — |
| `GET` | `/api/import/thumb/[id]` | — | JPEG | 404 |
| `GET` \| `HEAD` | `/api/import/media/[id]` | — | MP4; **Range** → 206 | 404; 416 range inválido |
| `DELETE` | `/api/import/media/[id]` | — | `{ ok, id }` — apaga mp4+meta+jpg | 404 |
| `POST` | `/api/import/delete` | `{ ids: string[] }` máx. 100 | `{ deleted, failed }` | 400 |
| `POST` | `/api/import/to-montador` | `{ id }` | `{ videoId, url, bytes }` | 404; 500 (>200 MB etc.) |
| `POST` | `/api/import/to-meta` | `{ id }` | `{ videoLocalId, videoId, bytes, url }` | 404; 500 |

A UI Social **não** mostra “Enviar pra Meta”; o botão existe só na subaba CapCut. A rota `to-meta` aceita id Social se chamada direto.

### 10.2. Preview com HTTP Range

`media/[id]` usa `fileWebStream` (`lib/http/fileStream.js`): aborto do cliente (seek no `<video>`) **não** vira `uncaughtException` “Controller is already closed”.

Headers: `content-type: video/mp4`, `accept-ranges: bytes`, `cache-control: private, no-store`.

### 10.3. Apagar

| Ação UI | API |
|---|---|
| Apagar 1 | `DELETE /api/import/media/[id]` |
| Apagar N | `POST /api/import/delete` `{ ids }` |

Confirmação: `window.confirm`. Soft-delete / lixeira: fora de escopo. Não remove `data/captions/uploads`.

---

## 11. UI (`ImportTab`)

Componente: `gerador/components/import/ImportTab.js`.  
Glue: `gerador/app/page.js` — `pane` `download` | `library`; `onOpenMontador` seta `composeSeed` e `tab = "burn"`.

### 11.1. Desbloqueio

Mesmo `STUDIO_API_SECRET` do Dossiê IA. Sem cookie, a aba mostra o form de unlock.

### 11.2. Baixar por link

- Placeholder: `"YouTube, TikTok, Instagram, Facebook, Pinterest, X ou Shopee Video"`.
- Enter ou botão **Baixar**.
- Callout: ferramenta interna / ToS.
- Durante o job: spinner + `status: running…`.
- Concluído: `<video controls>` com `/api/import/media/{id}` + Salvar no PC + Usar no Montador.

### 11.3. Arquivos salvos

Linha: checkbox · thumb 48×64 (9:16) · título + `platform` + data pt-BR · ações.

Ações por item: **Salvar no PC** · **Usar no Montador** · **Apagar**.  
Topo: Selecionar todos · Apagar selecionados (N) · Atualizar.

Clique na linha (fora de botões/checkbox) abre preview Range abaixo.

**Salvar no PC:** `fetch` autenticado do MP4 → blob → `<a download>` com nome sanitizado (120 chars, `.mp4`).

---

## 12. Handoff para o Montador

```
POST /api/import/to-montador { id }
  → saveUploadFromPath(mp4Path(id))     // copyFileSync, máx. 200 MB
  → { videoId, url: "/api/captions/media/{videoId}", bytes }

page.js
  setComposeSeed({ videoId, url })
  setMontadorHasVideo(true)
  setTab("burn")

ComposeTab
  useEffect: se seedVideo.videoId && seedVideo.url
    setVideoId / setVideoUrl  (mesmo estado de um upload local)
    onSeedConsumed()
```

O Montador **não** foi redesenhado para Importar: só a prop opcional `seedVideo`. Upload local de MP4 continua.

---

## 13. Relação com Descobrir / TikTok

Não é um segundo downloader. `enqueueDownload` em `lib/tiktok/downloadQueue.js`:

1. Exige URL allowlist **e** `platform === "tiktok"`.
2. Dedupe contra `listImports` (mesma `sourceUrl` ou `videoId` no path) → **409** `"Já está no macmini."`.
3. Cria job Importar + job TikTok (mesmo `jobId`).
4. `pumpQueue` espera `tryAcquireImport`, chama `runYtDlp`, `writeMeta({ platform: "tiktok", videoId })`, `ensureThumb`.
5. UI Descobrir pode chamar `POST /api/import/to-montador` com o `importId`.

Consequência operacional: baixar o mesmo TikTok pela aba Importar **ou** por Descobrir cai na mesma pasta; o segundo caminho recusa duplicata.

---

## 14. Variáveis de ambiente (Mac `.env.local`)

| Variável | Produção / notas |
|---|---|
| `STUDIO_API_SECRET` | auth de todas as rotas |
| `IMPORT_DOWNLOAD_DIR` | path absoluto no SSD |
| `YTDLP_PATH` | `/opt/homebrew/bin/yt-dlp` |
| `IMPORT_PROXY` | **`direct`** em produção. Default de código = SOCKS local |
| `SHOPEE_VIDEO_PROXY` | vazio = direto; **não** herdar `IMPORT_PROXY` |
| `FFMPEG_PATH` | opcional; senão `ffmpeg` no PATH do PM2 |

Pré-requisitos no Mac: `yt-dlp` e `ffmpeg` visíveis ao processo PM2.

---

## 15. Erros (contrato)

| Caso | Onde | Resposta |
|---|---|---|
| JSON inválido | POST download/delete/to-montador | 400 |
| URL/host inválidos | allowlist | 400 + mensagem |
| Fila ocupada | mutex | 429 |
| yt-dlp exit ≠ 0 | job | `status: error`, stderr resumido ≤ 500 |
| yt-dlp timeout (15 min) | job | `"yt-dlp timeout"` |
| `__NEXT_DATA__` ausente | job Shopee | `"__NEXT_DATA__ não encontrado (layout Shopee mudou? ou universal-link sem redir)"` |
| Sem `watermarkVideoUrl` | job Shopee | `"URL do vídeo não encontrada"` |
| HTTP share/MP4 Shopee | job | `"share page HTTP {status}"` / `"mp4 HTTP {status}"` |
| Thumb ffmpeg falhou | — | job continua `done`; placeholder na lista |
| Id inválido / MP4 sumiu | media/delete/to-montador | 404 |
| Lote: id ausente | delete | entra em `failed`; resto segue |
| MP4 > 200 MB no handoff | to-montador | 500 `"arquivo acima de 200MB"` |
| Auth | todas | 401 / 422 |

Pin Pinterest sem vídeo, tweet sem vídeo, post IG foto: caem no stderr do yt-dlp (extractor). Não há mensagem especial por plataforma.

---

## 16. Testes

```bash
cd gerador
node --test lib/import/__tests__/*.test.mjs lib/captions/__tests__/saveUploadFromPath.test.mjs
```

| Arquivo | O que cobre |
|---|---|
| `allowlist.test.mjs` | YT, TikTok, IG, FB, Pinterest, X, Shopee share; rejeita produto Shopee e host estranho |
| `ytdlp-args.test.mjs` | `-f bv*+ba`, merge mp4, proxy on/off/`direct` |
| `queue.test.mjs` | segunda aquisição falha; `getImportQueue` |
| `store.test.mjs` | ids, lista, jobs, persistência, **sem TTL** |
| `thumb.test.mjs` | args ffmpeg |
| `shopeeVideo.test.mjs` | parse `__NEXT_DATA__`, `redir`, `CONFIG.httpUrl`, download com `fetchImpl` mock, `downloadMany` |
| `saveUploadFromPath.test.mjs` | cópia + teto 200 MB |

Smoke Mac (histórico):

- 2026-07-27 YouTube curto → list/media → to-montador → original intacto após restart PM2.
- 2026-07-28 Pinterest pin `br.pinterest.com`.
- 2026-08-02 Shopee share (`scripts/smoke-shopee-video.sh`, `scripts/diag-shopee-share.sh`).

---

## 17. Deploy

GitHub **não** publica. Produção = SSD + `next build` + `pm2 restart`. O script da fatia **não** faz purge da pasta de downloads.

```powershell
# Windows → Mac (preferir o script do projeto)
ssh mac "bash '/Volumes/HD 1Tb/Vibecoding/Shopee Reviews/scripts/deploy-import-social-mac.sh'"
```

O script copia `lib/import`, rotas `/api/import/**`, `ImportTab`, glue do `page.js`, roda os testes unitários, `next build --webpack` e `pm2 restart shopee-reviews-studio`.

Canônico geral: [`docs/deploy.md`](deploy.md).

---

## 18. Riscos e operação

| Risco | Mitigação |
|---|---|
| Extractors yt-dlp quebram (TikTok, IG, Pinterest, X) | atualizar o binário no Mac; sem adapter próprio no código |
| Layout Next.js Shopee (`__NEXT_DATA__` / `universal-link`) muda | erro explícito + testes de parse; ajustar `shopeeVideo.js` |
| Rate limit Shopee | UA mobile; 1 URL por vez; `downloadMany` com delay só em script |
| YouTube via SOCKS timeout | `IMPORT_PROXY=direct` |
| Conteúdo privado / login | fora de escopo; job `error` |
| `ffmpeg` ausente no PATH do PM2 | thumb falha; download e apagar seguem |
| Backfill síncrono na listagem | máx. 20 thumbs/request; ok na escala atual |
| Mutex in-memory | restart PM2 no meio do job: MP4 parcial é limpo no `catch`; job JSON pode ficar `running` |
| ToS das plataformas | copy na UI; uso interno consciente |
| Marca d’água Shopee | inevitável na fonte pública; `watermarked: true` |

---

## 19. Fora de escopo (esta fatia)

- Cookies / login na UI.
- Playlist, canal, board, perfil.
- Áudio-only.
- Escolha de resolução na UI.
- Vídeo Shopee sem marca d’água / preço / link de produto.
- Batch HTTP `{ urls: [] }`.
- Biblioteca com tags, busca, favoritos.
- Trim / edição no Importar (isso é o Montador).
- Soft-delete.
- “Enviar pra Meta” na UI Social (existe na subaba CapCut).

CapCut (lista local HD→SSD, sem URL): [`docs/import-social-video.md`](import-social-video.md) §10.

---

## 20. Specs e planos

| Doc | Papel |
|---|---|
| `docs/superpowers/specs/2026-07-27-import-social-video-design.md` | design v1 (yt-dlp → Montador) |
| `docs/superpowers/plans/2026-07-27-import-social-video.md` | plano v1 |
| `docs/superpowers/specs/2026-07-28-import-thumb-delete-design.md` | thumb JPEG + apagar UI |
| `docs/superpowers/specs/2026-08-02-import-shopee-video-design.md` | Shopee Video (`__NEXT_DATA__`) |
| `docs/import-social-video.md` | ops (env, CapCut, deploy curto) |
