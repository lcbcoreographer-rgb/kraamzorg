# src/lib/messaging

Interface `Mensageiro` com três implementações do enum `modo_mensageria`: `manual` (link
`wa.me` com texto pré-preenchido, o padrão para a família), `uazapi` (conversa iniciada
pela família e grupos internos, `track_source: "kraamzorg-app"`) e `cloud_api` (API oficial
da Meta, P18b). Nenhum módulo fora daqui monta URL de WhatsApp ou
fala com a UAZAPI direto (CLAUDE.md).

Toda chamada a `enviar()` recebe um `VerificadorFreio` de fora (não importa `src/lib/dados`
para não inverter a dependência): a implementação de verdade, que chama
`api.pode_enviar_mensagem` por RPC, mora em `src/modules/mensageria` (P18, ver o README de
lá). Mensagem à família sem passar por essa checagem não existe neste módulo.

`enviar()` nunca lança por causa do freio ou de falha de rede: devolve
`{ ok: false, motivo, codigo? }`, porque "não deu para enviar agora" é resultado esperado da
tela, não bug. Só lança `ErroMensageiro` quando o canal está mal configurado por programação
(um uso indevido do canal manual para grupo).

## cloud_api (P18b)

`cloud-api.ts` fala com a Cloud API da Meta (`POST /{phone-number-id}/messages`). A regra que
importa é a janela de `parametro.whatsapp_janela_horas` (24 horas) desde a última mensagem da
família (`pedido.ultimaMensagemFamiliaEm`):

| Situação                                                          | O que sai                                                                                                          |
| :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| Dentro da janela                                                  | Texto livre (`type: "text"`), o `pedido.texto`                                                                     |
| Fora da janela, com `pedido.modelo` e modelo aprovado no cadastro | Modelo aprovado pela Meta (`type: "template"`), com as variáveis na ordem do cadastro. O `pedido.texto` é ignorado |
| Fora da janela, sem modelo indicado ou sem modelo aprovado        | Nada. Falha com `fora_da_janela_sem_modelo`. Nunca cai para o texto livre                                          |
| Sem data da última mensagem, ou sem o parâmetro da janela         | Conta como fora da janela                                                                                          |
| Aviso a grupo interno                                             | Falha com `grupo_nao_suportado`: a Cloud API não tem grupo, o aviso segue pela UAZAPI                              |

O catálogo dos modelos (`CatalogoModelos`) e a janela vêm de quem monta o adaptador
(`src/modules/mensageria/cloud-api`, que lê `api.modelo_whatsapp_aprovado` e
`api.whatsapp_janela_horas`). O texto do modelo mora só em `modelo_whatsapp` (0025) e não muda
depois de submetido. Sem credencial (`WHATSAPP_CLOUD_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`), em
desenvolvimento e homologação o envio é capturado em memória (`captura.ts`, lido em
`/api/teste/cloud-api`); em produção, falha. O webhook de status de entrega é
`/api/webhooks/whatsapp`.

`uazapi` lê `UAZAPI_BASE_URL` e `UAZAPI_TOKEN` do ambiente; sem as duas, `enviar()` devolve
falha em vez de tentar a rede (as variáveis estão em `.env.example`).
