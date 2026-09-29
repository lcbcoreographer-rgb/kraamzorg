import { codigoVenda, ErroRepositorio } from "@/lib/dados/erros";

/**
 * Frases para as recusas das funções de sessão de venda (0018_venda.sql,
 * "venda:<código>"). Cada uma diz o que aconteceu e o que fazer
 * (voz.md, seção 5), sem jargão de banco.
 */
const FRASES: Record<string, string> = {
  dados_obrigatorios:
    "Faltou a data, a hora ou quem conduz. Preencha e tente de novo.",
  data_no_passado:
    "Esse horário já passou. Escolha uma data a partir de agora.",
  link_obrigatorio:
    "Cole o link da reunião. A família recebe esse link no lembrete da véspera.",
  link_invalido:
    "Esse link não parece de reunião. Cole o endereço completo, começando com https://.",
  condutor_invalido:
    "Escolha quem conduz a conversa entre as pessoas da lista.",
  familia_inexistente:
    "Essa família não está mais disponível. Atualize a tela.",
  familia_em_estado_sensivel:
    "Esta família está em estado sensível. A conversa de venda fica parada até a coordenação liberar.",
  familia_nao_contatar:
    "Esta família pediu para não ser contatada. Nada foi marcado.",
  sessao_ja_agendada:
    "Esta família já tem uma conversa marcada. Abra a conversa marcada para remarcar.",
  estagio_nao_permite_sessao:
    "A oportunidade desta família está num estágio que não recebe conversa de orientação. Confira no pipeline.",
  transferencia_invalida:
    "Essa transferência não é um pedido de conversa desta família. Abra a partir da fila de transferências.",
  sessao_inexistente:
    "Essa conversa não está mais disponível. Atualize a tela.",
  sessao_nao_agendada:
    "Essa conversa já teve um desfecho registrado. Atualize a tela para ver como ficou.",
  sessao_ainda_nao_aconteceu:
    "A conversa ainda não aconteceu. Registre como foi depois do horário marcado.",
  desfecho_invalido: "Escolha como foi a conversa entre as opções.",
  sessao_sem_gravacao:
    "Conversa cancelada ou remarcada não recebe gravação. Use a conversa que aconteceu.",
  termo_sem_versao:
    "O termo de gravação ainda não tem versão aprovada. Avise a diretoria; nada foi gravado.",
  sem_consentimento:
    "Sem o consentimento da família, a transcrição não pode ser guardada.",
  transcricao_longa:
    "A transcrição passou do tamanho que o sistema guarda. Tire as partes que não são da conversa e tente de novo.",
  sem_transcricao: "Cole a transcrição antes de gerar ou salvar o resumo.",
  resumo_invalido:
    "O resumo veio num formato que o sistema não guarda. Revise os itens e salve de novo.",
  so_quem_conduziu:
    "A gravação desta conversa fica só com quem conduziu e com a diretoria.",
};

export function fraseErroSessao(erro: unknown, acao: string): string {
  const codigo = codigoVenda(erro);
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "O banco recusou: confira o seu papel e, se precisar, o código do aplicativo (MFA), e tente de novo.";
    }
    if (erro.codigo === "nao_encontrado") {
      return "Esse registro não está mais disponível. Atualize a tela.";
    }
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}
