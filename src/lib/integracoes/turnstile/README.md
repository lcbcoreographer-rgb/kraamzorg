Cloudflare Turnstile dos formulários públicos (P30, PRD 21.3).

- `cliente.ts`: `configuracaoTurnstile()` diz qual site key vai ao navegador
  e qual segredo o servidor usa; `verificarTurnstile(token, ip)` confere o
  token com a Cloudflare antes de aceitar o envio.
- Desenvolvimento sem chaves: valem as chaves de teste públicas da
  Cloudflare (sempre passa), verificadas sem rede.
- Produção: sem chave, ou com chave de teste, nenhum envio passa.
- O IP só serve de sinal para a Cloudflare; nunca é gravado nem logado aqui.
