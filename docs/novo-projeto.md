# Novo projeto e Limpar inserts

**Atualizado:** 2026-08-22  
**Produto:** Editor de Inserts (`editor.macmini-capture.cc`, porta 4013)  
**Status:** em produção (PM2 `editor-video`). Spec:
[`superpowers/specs/2026-08-21-novo-projeto-design.md`](superpowers/specs/2026-08-21-novo-projeto-design.md).

Dois botões para sair do anúncio atual **sem** limpar o site nem F5. Schema
continua **v4**. Não é a Fase 3 de [`inserts-ui.md`](inserts-ui.md).

---

## 1. O que o operador vê

### Novo projeto (cabeçalho)

À direita de **Configuração de Inserts**. Sempre visível na aba Editor.
Desabilitado durante o export.

1. Clique em **Novo projeto**.
2. Em até 6 s clique em **Confirmar** (ou **Cancelar**). Sem Dialog.
3. Some o vídeo, inserts e legendas. O card Origem volta a colar URL / enviar
   arquivo. Mensagem: **Projeto novo**.
4. **Não** dá para desfazer. F5 **não** reabre o anúncio anterior nem os
   inserts de exemplo do primeiro load.

Ficam: presets **meus**, a lista de URLs recentes e o handle/loop +
Opac./Tam./Vel. da marca d’água (`editor.watermark.v1`; [`marca-dagua.md`](marca-dagua.md)). O checkbox **Marca**
nasce desligado (composição nova, sem `watermarkEnabled`). A pasta
`data/import-downloads/` no Mac **não** é apagada.

### Limpar inserts (Origem)

No card **Vídeo de fundo**, abaixo de **Trocar**. Só com vídeo pronto.
Desabilitado se não houver inserts. Abaixo vem **Resetar enquadramento**
([`enquadramento.md`](enquadramento.md)) — não apaga inserts.

O MP4 continua. Some texto, chips, PNGs e legendas; o look das legendas volta
ao padrão. Toast **Inserts apagados** + **Desfazer**. Ctrl+Z / Ctrl+Y também.

**Trocar** continua só mudando o MP4 e **mantendo** a arte. **Limpar inserts**
e **Trocar** MP4 **não** mexem em handle/loop nem em Opac./Tam./Vel.

---

## 2. Persistência

| Onde | Novo projeto | Limpar inserts |
| --- | --- | --- |
| JSON (`localStorage`) | `createDefaultComposition()` gravado **na hora** (não espera o debounce de 300 ms) | `inserts = []` + `captionStyle` default; `source` intacto |
| IndexedDB `files` | apaga MP4 + PNGs deste projeto | **não** apaga (o undo precisa dos blobs) |
| IndexedDB `presets` | fica | fica |
| URLs recentes | fica | fica |
| Histórico undo | zera | um passo |
| Handle/loop + Opac./Tam./Vel. (`editor.watermark.v1`) | **mantém** | **não** mexe |
| `watermarkEnabled` | some (composição nova, omitido = off) | permanece (é do projeto) |

Hydrate sem JSON ainda pode mostrar `SEED_INSERTS` no **primeiro** load da
máquina. Depois de Novo projeto o JSON vazio está gravado — F5 não volta o seed.

Funções: `lib/project-reset.ts` (`newProjectComposition`, `clearInsertsArt`,
`projectFileIds`).

---

## 3. Testes e publicar

```bash
node --experimental-strip-types --test lib/project-reset.test.ts lib/project-store.test.ts
```

UI: smoke no navegador (sem teste de pixel). Publicar: [`../deploy.md`](../deploy.md) §2 + hard refresh (Ctrl+F5). `editor-render` **não** precisa reiniciar nesta fatia.
