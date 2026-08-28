# Importar por URL — sociais

**Data:** 2026-08-18  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`)  
**Status:** implementado e testado em produção (2026-08-18)  
**Ops:** [`docs/import-social-url.md`](../import-social-url.md)  
**Engines (Studio):** [`import-social-platforms.md`](../../import-social-platforms.md)

## Objetivo

A aba **Por URL** baixa um MP4 público (YouTube, TikTok, Instagram, Pinterest, X, Shopee Video) no Mac e hidrata o editor como arquivo local. O player e o export continuam no blob IndexedDB — a URL da rede social nunca vai para o `<video>`.

## O que não entrou

Biblioteca de imports, thumbs, CapCut, `to-montador`, auth do Studio, proxy SOCKS por padrão.

## Contratos

- Allowlist de host em `lib/import/allowlist.ts` (mesmos regex do Studio).
- yt-dlp: `-f bv*+ba/b`, `--merge-output-format mp4`, `--no-playlist`, timeout 15 min.
- Shopee Video: `__NEXT_DATA__` → `watermarkVideoUrl`; short link via `redir` / `CONFIG.httpUrl`.
- Um job por vez; segundo POST → 429.
- `Composition.source.remoteUrl` = link original; `fileId` = blob no IndexedDB.

## Verificação

`pnpm test` cobre allowlist, ytdlp args, shopee parse, fila e store. Smoke manual: colar link → Baixar → preview → export.
