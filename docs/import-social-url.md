# Importar vídeo por URL (sociais)

**Atualizado:** 2026-08-18  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`, porta 4013)  
**Status:** em produção no Mac Mini (PM2 `editor-video`). Testado e funcionando em 2026-08-18.

Cola um link público de **YouTube, TikTok, Instagram, Pinterest, X (Twitter) ou Shopee Video**. O Mac baixa o MP4 e o editor abre o arquivo como vídeo de fundo (mesmo caminho de um upload local).

A lógica dos engines é a do Studio (`import-social-platforms.md` / `gerador/lib/import` no Shopee Reviews). Aqui **não** há biblioteca de arquivos, thumb, CapCut nem handoff para o Montador: o destino é o canvas deste editor.

---

## 1. Fluxo

```
Operador (Por URL) cola link → Baixar
        │
        ▼
POST /api/import/download  { url }
        │
parseAllowedImportUrl → allowlist de host
        │
        ├─ 400 se host/URL inválidos
        ├─ 429 se já houver download em andamento
        └─ job (queued → running)
                │
          ┌─────┴──────────────────┐
          │ shopee-video           │ demais
          ▼                        ▼
   fetch HTML → __NEXT_DATA__   yt-dlp
   → GET watermarkVideoUrl      -f bv*+ba/b → MP4
          │                        │
          └──────────┬─────────────┘
                     ▼
              {jobId}.mp4 no disco
                     │
UI poll GET /api/import/download/{jobId} a cada 1,5 s
                     │
              status done
                     ▼
GET /api/import/media/{jobId}  → File no navegador
                     │
         IndexedDB + object URL (preview / export)
         source.remoteUrl = link original (não blob:)
```

O `<video>` **nunca** recebe a URL da rede social. YouTube/TikTok/etc. não são MP4 playable; o player só vê o blob baixado.

Handoff: cópia para IndexedDB. O MP4 no disco do Mac permanece até alguém apagar `data/import-downloads/` (sem TTL).

---

## 2. Engines

| Engine | Plataformas | Mecanismo |
|---|---|---|
| **yt-dlp** | YouTube, TikTok, Instagram, Facebook, Pinterest, X | binário no Mac; `-f bv*+ba/b`, merge MP4, `--no-playlist` |
| **HTTP + `__NEXT_DATA__`** | Shopee Video | fetch da página de share + parse Next.js + GET do MP4 com marca d’água |

Facebook entra na allowlist (mesmo yt-dlp). Conteúdo que exige login, playlists, boards, canais e página de produto Shopee (`shopee.com.br/…`) estão fora.

Código: `lib/import/` (`allowlist.ts`, `ytdlp.ts`, `shopee-video.ts`, `queue.ts`, `store.ts`). Rotas: `app/api/import/download`, `download/[id]`, `media/[id]`. UI: aba **Por URL** em `control-panel.tsx`, orquestração em `video-editor.tsx`.

---

## 3. Allowlist (hosts)

| Platform | Hosts aceitos |
|---|---|
| `youtube` | `youtube.com`, `www.`, `m.`, `youtu.be` |
| `tiktok` | `tiktok.com`, `www.`, `vm.`, `m.` |
| `instagram` | `instagram.com`, `www.` |
| `pinterest` | `*.pinterest.com`, `pin.it` |
| `x` | `x.com`, `twitter.com` |
| `shopee-video` | `br.shp.ee`, `shp.ee`, `sv.shopee.com.br` |
| `facebook` | `facebook.com`, `fb.watch` |

Pin só com imagem, tweet só texto, post IG só foto: o engine falha e a UI mostra o erro do job.

---

## 4. Fila e IDs

Um download por vez no processo Node (`tryAcquireImport`). Segundo POST → **429** `"download em andamento"`.

`jobId` = 24 hex. Estados: `queued` → `running` → `done` | `error`. Timeout yt-dlp: 15 min.

---

## 5. Persistência no editor

Depois do download, o MP4 vira `File` no cliente:

| Campo | Valor |
|---|---|
| `source.fileId` | chave IndexedDB (o blob do MP4) |
| `source.remoteUrl` | URL social original (nunca `blob:`) |
| `source.fileName` | título sanitizado + `.mp4` |
| Preview / export | `URL.createObjectURL` do blob |

F5 restaura o vídeo se o IndexedDB ainda tiver o arquivo. Se o blob sumiu, a URL permanece no campo — clicar **Baixar** de novo.

Pasta no Mac: `IMPORT_DOWNLOAD_DIR` ou `data/import-downloads/` (gitignored). Sem limpeza automática.

---

## 6. Variáveis e pré-requisitos (Mac Mini)

O `scripts/deploy-on-hd.sh` já coloca `/opt/homebrew/bin` no PATH do PM2. `yt-dlp` e `ffmpeg` são os mesmos do Studio.

| Variável | Padrão neste editor | Notas |
|---|---|---|
| `YTDLP_PATH` | `yt-dlp` no PATH | produção típica: `/opt/homebrew/bin/yt-dlp` |
| `IMPORT_PROXY` | **vazio = direto** | `direct` / `off` / `none` também desliga. URL SOCKS/HTTP liga o proxy. YouTube via SOCKS Hostinger dava timeout no Studio — não ligar sem necessidade |
| `SHOPEE_VIDEO_PROXY` | vazio = direto | se setada, o download Shopee **falha** (agente Node não plugado) |
| `IMPORT_DOWNLOAD_DIR` | `<cwd>/data/import-downloads` | path absoluto no HD se quiser outro disco |

Não é obrigatório `.env.local` com o PATH do deploy. Opcional: `YTDLP_PATH=/opt/homebrew/bin/yt-dlp` se o PM2 perder o Homebrew no restart.

---

## 7. APIs

Sem auth (ferramenta interna no tunnel). Mutex + allowlist limitam abuso.

| Método | Rota | Sucesso | Erros |
|---|---|---|---|
| `POST` | `/api/import/download` `{ url }` | `{ jobId, status: "running" }` | 400 URL/host; 429 fila |
| `GET` | `/api/import/download/[id]` | objeto job | 404 |
| `GET` | `/api/import/media/[id]` | `video/mp4` | 404 |

Poll na UI: 1500 ms até `done` ou `error`.

---

## 8. Testes

```bash
pnpm test
```

Unitários em `lib/import/*.test.ts`: allowlist, args yt-dlp, proxy, parse Shopee (`__NEXT_DATA__` / `redir` / `CONFIG.httpUrl`), fila, store (ids, jobs, **sem TTL**), nome de arquivo.

Smoke (2026-08-18): Por URL → Baixar → preview no editor → export.

---

## 9. Fora de escopo (esta fatia)

- Biblioteca “arquivos salvos”, thumb JPEG, apagar lote na UI
- Cookies / login nas plataformas
- Playlist, canal, board, perfil, produto Shopee
- Escolha de resolução; vídeo Shopee sem marca d’água
- Auth `STUDIO_API_SECRET` (existe só no Studio)

Referência completa dos engines no Studio: [`import-social-platforms.md`](../import-social-platforms.md).
