import {
  codigoDominio,
  ehConflitoDeVersao,
  ErroRepositorio,
} from "@/lib/dados/erros";

/**
 * Frases para as recusas das funções da evolução (0024, "evolucao:<código>")
 * e para as falhas do envio por e-mail. Erro diz o que aconteceu e o que
 * fazer (PRD 20.3, voz.md 2). Nenhuma frase carrega nome de paciente.
 */
const FRASES: Record<string, string> = {
  acompanhamento_inexistente:
    "Esse acompanhamento não está mais disponível. Volte à lista e abra de novo.",
  bebe_de_outra_familia:
    "Esse bebê não pertence a esta família. Volte à lista e abra o documento de novo.",
  bebe_por_tipo:
    "O documento e o bebê não combinam: o puerperal não tem bebê e o neonatal tem um. Volte à lista e abra de novo.",
  caminho_invalido:
    "O arquivo do PDF saiu com um nome fora do padrão. Nada foi enviado; tente de novo.",
  com_erros:
    "O documento ainda tem pontos a corrigir. Ajuste os campos marcados e salve antes de seguir.",
  contato_medico_pendente:
    "A família ainda não tem médico com e-mail ou telefone no cadastro. Cadastre o contato na ficha da família; o documento só segue depois disso.",
  conteudo_invalido:
    "O documento não foi salvo porque o conteúdo veio incompleto. Atualize a tela e tente de novo.",
  erros_invalidos:
    "O documento não foi salvo porque a lista de pontos a corrigir veio incompleta. Atualize a tela e tente de novo.",
  em_revisao:
    "Este documento está com a coordenação para revisão. Por enquanto só a coordenação edita.",
  fora_da_revisao:
    "Este documento não está mais em revisão. Atualize a tela para ver o estado atual.",
  fora_do_rascunho:
    "Este documento já saiu do rascunho. Atualize a tela para ver o estado atual.",
  inexistente:
    "Este documento não está mais disponível. Volte à lista e abra de novo.",
  ja_aprovada:
    "Este documento já foi aprovado e não muda mais. Se algo estiver errado, fale com a diretoria.",
  motivo_curto:
    "Escreva o recado para a enfermeira em pelo menos 5 letras, para ela saber o que ajustar.",
  nao_aprovada:
    "Este documento ainda não foi aprovado. Aprove antes de enviar ao médico.",
  sem_destinatario:
    "Nenhum médico com e-mail recebeu o documento. Confira o cadastro de médicos da família.",
  sem_email_do_medico:
    "O médico dessa especialidade não tem e-mail cadastrado. Cadastre o e-mail na ficha da família e aprove de novo.",
  sem_pdf:
    "O PDF ainda não foi gerado. Ele sai quando a coordenação aprova e o envio termina.",
  sem_profissional:
    "Falta a profissional responsável por este acompanhamento. Defina quem atende antes de seguir.",
  situacao_invalida: "Esse filtro não existe. Escolha outro.",
  tipo_invalido:
    "Esse tipo de documento não existe. Volte à lista e abra de novo.",
};

const FRASE_SEM_PERMISSAO =
  "O seu papel não permite esta etapa. Fale com a coordenação se precisar dela.";

export const FRASE_CONFLITO_VERSAO =
  "Outra pessoa alterou este documento enquanto você editava. Atualize a tela para ver a versão mais recente antes de salvar.";

export function fraseErroEvolucao(erro: unknown, acao: string): string {
  if (ehConflitoDeVersao(erro)) return FRASE_CONFLITO_VERSAO;
  const codigo = codigoDominio(erro, "evolucao");
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") return FRASE_SEM_PERMISSAO;
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}

/** Motivos do envio por e-mail que a tela mostra ao lado do botão de reenviar. */
export const FRASES_ENVIO = {
  sem_conteudo:
    "O conteúdo do documento não está pronto. Volte ao documento, corrija os pontos marcados e aprove de novo.",
  sem_destinatario:
    "Nenhum médico com e-mail foi encontrado para este documento. Cadastre o e-mail na ficha da família e reenvie.",
  sem_configuracao:
    "Faltam a coordenação e o canal de contato no cadastro do e-mail da evolução. Peça à diretoria para preencher em Configurações e reenvie.",
  sem_texto_email:
    "Falta o texto do e-mail no cadastro de mensagens. Peça à diretoria para conferir em Configurações e reenvie.",
  pdf: "O PDF não pôde ser gerado com este conteúdo. Volte ao documento, confira os campos e aprove de novo.",
  armazenamento:
    "O PDF foi gerado, mas não foi guardado. Nada foi enviado; tente de novo em instantes.",
  nao_configurado:
    "A conexão com o serviço de e-mail ainda não foi configurada neste ambiente. Nada foi enviado.",
  dado_pessoal:
    "O assunto ou o nome do anexo tinha dado de paciente e o envio foi barrado. Avise a equipe técnica; nada foi enviado.",
  falha_email:
    "O serviço de e-mail não aceitou o envio. Nada chegou ao médico; reenvie em alguns minutos.",
} as const;

export type CodigoFalhaEnvio = keyof typeof FRASES_ENVIO;
