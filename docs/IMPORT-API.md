# Importar projeto no editor

O sistema de UGC abre o editor já com o vídeo e, se quiser, o produto da Shopee. O editor baixa o vídeo, cria um projeto e devolve a URL. A prova social fica disponível no botão **Montar prova** — ela não entra sozinha na timeline.

`POST /api/projects/import`

```json
{
  "videoUrl": "https://www.tiktok.com/@loja/video/123",
  "shopeeUrl": "https://shopee.com.br/Short-de-trico-i.123.456",
  "voiceUrl": "https://cdn.exemplo.com/locucao.mp3",
  "captions": [{ "text": "olha esse short", "start": 0.2, "end": 1.4 }]
}
```

- `videoUrl` é obrigatório e segue a mesma lista de hosts de `POST /api/import/download`.
- `shopeeUrl` importa o produto (`POST /api/shopee/product`) e preenche nome, nota, vendidos e avaliações. Preço continua fora.
- `voiceUrl` cria a faixa de Locução e deixa o áudio original mudo. Se o vídeo já trouxer a locução, omita este campo.
- `captions` vira a faixa de legenda.

Resposta:

```json
{ "editorUrl": "https://editor.macmini-capture.cc/?project=abc", "projectId": "abc" }
```

Também dá para abrir o editor direto com `?shopee=<link do produto>`.

```bash
curl -s -X POST https://editor.macmini-capture.cc/api/projects/import \
  -H "content-type: application/json" \
  -d '{"videoUrl":"https://www.tiktok.com/@loja/video/123","shopeeUrl":"https://shopee.com.br/product/123/456"}'
```

Produto avulso, com cache de 24 h (`refresh: true` ignora o cache):

```bash
curl -s -X POST https://editor.macmini-capture.cc/api/shopee/product \
  -H "content-type: application/json" \
  -d '{"url":"https://shopee.com.br/product/123/456"}'
```
