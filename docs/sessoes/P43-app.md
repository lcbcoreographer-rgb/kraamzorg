# P43 · Nota fiscal de serviço (telas, banco e emissão)

Data: 30/09/2026
Branch: `worktree-wf_ee6c2935-920-6` (worktree isolado, criado a partir de `claude/kraamzorg-delivery-review-6kzd8q`). Migration `0024_evolucao_ocorrencia_nf.sql` (seção 6), teste `supabase/tests/024_evolucao_ocorrencia_nf.sql`.

Esta sessão é a onda B do P43: o lado do banco e a interface, sobre o adaptador `src/lib/integracoes/nfse` que a sessão anterior entregou (`docs/sessoes/P31-P32-P43-integracoes.md`, que não mudou).

## Feito

### Banco

1. `nota_fiscal` ganha tentativas, última tentativa, marca `manual`, `edicao` e restrições: emitida exige número e data, erro exige motivo, caminhos de PDF e XML só `notas/<id>.pdf` e `.xml`.
2. Funções `api`: `notas_fiscais`, `nota_fiscal`, `dados_emissao_nota`, `iniciar_emissao_nota`, `registrar_resultado_nota`, `registrar_nota_manual`, `arquivo_da_nota`. Financeiro e diretoria, AAL2. `dados_emissao_nota` devolve o CPF completo de quem paga e grava a leitura no log; o detalhe da nota só diz se o tomador tem CPF.
3. **Tomador é quem paga** (C-10): o contratante ou o pagador do contrato, nunca a gestante por padrão. Serviço (`05266`, "Cuidado domiciliar pós-parto") lido de `parametro.nfse_servico`; sem o cadastro a emissão recusa.
4. Emissão automática depois do pagamento: `public.nota_para_emissao_automatica` e `public.nota_registrar_resultado`, só `service_role`. Com `parametro.nfse_emissao.automatica` falso (padrão) devolve `emitir = false`; com dado do tomador incompleto deixa a nota em erro com o motivo, sem silêncio.
5. Uma emissão em andamento há menos de dez minutos não aceita outra; estado só muda por `privado.nota_registrar`; a cobrança da venda enxerga o número e o P2 anda para `nota_fiscal_emitida`.

### Aplicação

1. `/notas` (substitui a tela em construção): resumo em frase, filtros, lista com erro primeiro. `/notas/[id]`: estado, motivo do erro, emissão pelo provedor e emissão manual assistida.
2. **Erro mostra o motivo e permite reenviar**: nota com erro exibe o motivo do provedor e, com a emissão automática ligada, o botão "Reenviar a nota". O reenvio usa o id da cobrança como chave de idempotência, então nunca emite duas notas. A nota nunca fica presa em "em processamento": exceção do adaptador, falha de rede e resposta sem número viram erro registrado.
3. **Emissão manual assistida** (T-05, enquanto o provedor não sai da homologação): "Ver os dados para emitir" mostra tomador, CPF, endereço, valor e serviço para copiar (CPF só sob pedido, leitura no log); "Registrar a nota emitida" grava número, data, provedor e, opcionalmente, o PDF e o XML no storage privado (`notas/<id>.pdf|xml`), conferidos pelo conteúdo do arquivo, não pela extensão.
4. `src/lib/integracoes/nfse/emissao.ts`: o caminho comum da tela e do servidor (emitir, guardar os arquivos do provedor só de https público, registrar). `emitirNotaAutomatica` e o gancho no webhook da InfinitePay: depois da baixa que mudou a cobrança e da resposta ao webhook (`after`), melhor esforço; falha nunca muda a resposta.
5. `obterEmissorNfse()`: demonstração usa um provedor de mentira (com uma falha combinável, só na demonstração); fora dela exige `NFSE_PROVEDOR_BASE_URL` e `NFSE_PROVEDOR_API_KEY`, senão a emissão pelo provedor não sai e a tela aponta a emissão manual.
6. Rotas `/notas/[id]/arquivo/pdf|xml` com URL assinada de 60 segundos, sem cache, nome pelo id da nota.

## Ficou de fora (e por quê)

- Provedor real: depende de a contadora indicar o provedor e emitir o certificado A1 (T-05). O adaptador tem os campos `[conferir]` do corpo da requisição; a homologação com o provedor escolhido é o próximo passo.
- Cancelamento pela tela: o adaptador tem `cancelar`, mas cancelar nota depende da regra fiscal que a contadora define.
- Emissão automática depois da baixa manual de Pix: a baixa manual (P32) deixa a nota pendente e o financeiro emite daqui. O gancho automático é o webhook da InfinitePay.
- Reemissão em lote e e-mail da nota ao tomador.

## Decisões tomadas

1. Com a emissão manual ligada (padrão), a tela não oferece o botão do provedor; o financeiro segue o caminho assistido. O botão "Reenviar a nota" só existe com `automatica` verdadeiro.
2. Arquivos do provedor só entram se forem PDF ou XML de verdade, até 4 MB, de URL https fora de endereço interno; se falharem, a nota vale pelo número e a tela avisa que o arquivo não foi guardado.
3. Repositório `notas` dentro de `obterRepositorios()` (sessão do usuário, RLS); o servidor usa o cliente de serviço só no webhook e só para as duas funções `public.nota_*`.

## Pendências novas

- [confirmar] Contadora: provedor (padrão nacional a partir de 01/11/2026), certificado A1, código de serviço do padrão nacional, e se `automatica` liga em homologação.
- [confirmar] Leonardo: quando trocar `parametro.nfse_emissao.automatica` para verdadeiro.
- [confirmar] Bucket `documentos` em produção: aceitar `application/xml`.

## Como testar

```sh
pnpm vitest run src/modules/financeiro src/lib/integracoes src/app/api/webhooks
supabase/sem-docker/scripts/testar.sh
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=3410 pnpm e2e:evolucao-ocorrencia-nf
```

Roteiro manual (demonstração):

1. Financeiro: `/notas`, "Com erro", Família Teste Jade: o motivo do provedor aparece.
2. Na seção "Só na demonstração": "Ligar a emissão automática", "Simular falha na próxima emissão", "Reenviar a nota": a frase mostra o motivo e "toque em Reenviar". Reenvie de novo: "Nota emitida, número D...".
3. Família Teste Íris: "Ver os dados para emitir", preencha o número e a data, anexe um PDF e "Registrar a nota emitida".

## Aceite do prompt

- Erro mostra o motivo e permite reenviar: `notas.test.ts`, `emissao.test.ts`, `route.nota.test.ts` e `nota.spec.ts`.
