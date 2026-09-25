# src/lib/messaging

Interface `Mensageiro` com três implementações do enum `modo_mensageria`: `manual` (link
`wa.me` com texto pré-preenchido, o padrão para a família), `uazapi` (conversa iniciada
pela família e grupos internos, `track_source: "kraamzorg-app"`) e `cloud_api` (assinatura
pronta, implementação real no P18b). Nenhum módulo fora daqui monta URL de WhatsApp ou
fala com a UAZAPI direto (CLAUDE.md).

Toda chamada a `enviar()` recebe um `VerificadorFreio` de fora (não importa `src/lib/dados`
para não inverter a dependência): a implementação de verdade, que chama
`api.pode_enviar_mensagem` por RPC, mora em `src/modules/mensageria` (P18, ver o README de
lá). Mensagem à família sem passar por essa checagem não existe neste módulo.

`enviar()` nunca lança por causa do freio ou de falha de rede: devolve
`{ ok: false, motivo }`, porque "não deu para enviar agora" é resultado esperado da tela,
não bug. Só lança `ErroMensageiro` quando o canal está mal configurado por programação
(`cloud_api` antes do P18b, ou um uso indevido do canal manual para grupo).

`uazapi` lê `UAZAPI_BASE_URL` e `UAZAPI_TOKEN` do ambiente; sem as duas, `enviar()` devolve
falha em vez de tentar a rede. Essas duas variáveis ainda não estão em `.env.example`
(arquivo da raiz, fora da pasta deste módulo) — precisam ser acrescentadas lá por quem
mantém esse arquivo.
