/**
 * Microcopy da pesquisa pública (P42; voz.md 3). O que a família lê como
 * conversa (abertura, agradecimento, link vencido, limite) vem pronto do
 * banco (`mensagem_modelo` pesquisa_*, em rascunho até a aprovação). Aqui
 * ficam só o título da aba, a frase de reserva quando o texto aprovado não
 * chegou e os avisos de digitação e de conexão.
 */
export const TITULO_PAGINA_PESQUISA = "Como foi para vocês · Kraamzorg Brasil";

export const PESQUISA_SEM_TEXTOS =
  "Esta pesquisa ainda não está pronta. Fale com a Kraamzorg pelo WhatsApp.";

export const ERROS_PESQUISA = {
  obrigatorio: "Falta responder esta pergunta.",
  invalido: "Confira esta resposta e escolha de novo.",
  verificacao:
    "Ainda estamos confirmando que é uma pessoa. Espere um instante e toque em Enviar de novo.",
  verificacaoIndisponivel:
    "Não deu para confirmar a verificação de segurança agora. Recarregue a página e tente de novo.",
  conexao:
    "A conexão caiu. O que você respondeu continua aqui; quando voltar, toque em Enviar de novo.",
  envio:
    "Não conseguimos receber agora. O que você respondeu continua aqui; toque em Enviar de novo em alguns instantes.",
} as const;

export const ROTULO_SIM = "Sim";
export const ROTULO_NAO = "Não";
