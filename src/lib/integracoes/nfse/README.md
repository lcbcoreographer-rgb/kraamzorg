Adaptador de NFS-e (PRD 14, P43): nota fiscal de serviço.

- `tipos.ts`: `AdaptadorNfse`, a interface provedor-agnóstica para o padrão
  nacional (Emissor Nacional / ADN): tomador é quem paga (C-10), estados
  espelhando `status_nota` do banco, código e descrição do serviço sempre
  vindos do cadastro ("cuidado domiciliar pós-parto", P43 item 2; texto
  nunca no código).
- `emissor-nacional.ts`: `EmissorNacionalAdaptador`, implementação com novas
  tentativas (P43 item 3: 3 tentativas por padrão, só para falha
  transitória de rede ou HTTP 5xx; erro de validação 4xx não tenta de novo
  e devolve o motivo do provedor). Toda tentativa de emissão leva o id da
  cobrança como chave de idempotência, para não emitir nota duplicada.

**[confirmar] Provedor.** O PRD 14 e o T-05 (22.1) apontam só o padrão (um
provedor com suporte ao Emissor Nacional); o provedor comercial exato ainda
depende da contadora e do certificado A1, que a Kraamzorg nunca emitiu.
`EmissorNacionalAdaptador` assume um gateway REST configurável (`baseUrl` +
`apiKey`) sobre esse padrão; os nomes de campo do corpo da requisição estão
marcados `[conferir]` no arquivo e precisam ser reconferidos contra a
documentação do provedor escolhido antes da homologação. Enquanto isso, o
P43 mantém a emissão manual assistida pela contadora (PRD 14, T-05).

Segredos só em variável de ambiente: `NFSE_PROVEDOR_BASE_URL` e
`NFSE_PROVEDOR_API_KEY` (`.env.example`).
