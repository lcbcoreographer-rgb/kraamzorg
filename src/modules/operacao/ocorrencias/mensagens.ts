import {
  codigoDominio,
  ehConflitoDeVersao,
  ErroRepositorio,
} from "@/lib/dados/erros";

/**
 * Frases para as recusas das funções de ocorrência, pós-venda e pesquisa
 * (0024, "ocorrencia:<código>" e "pesquisa:<código>"). Erro diz o que
 * aconteceu e o que fazer (PRD 20.3). Nenhuma frase carrega nome de paciente.
 */
const OCORRENCIA: Record<string, string> = {
  descricao_invalida:
    "Escreva a descrição com pelo menos 3 letras e no máximo 4.000 caracteres.",
  detrator_privada:
    "Esta ocorrência nasceu de uma nota baixa na pesquisa e fica privada para sempre. Só a coordenação e a diretoria a veem.",
  encerrada:
    "Esta ocorrência já foi encerrada e não muda mais. Se o assunto voltou, abra uma nova.",
  familia_inexistente:
    "Essa família não está mais disponível. Escolha outra na lista.",
  inexistente:
    "Essa ocorrência não está mais disponível. Volte à lista e abra de novo.",
  nota_longa: "A nota passou de 2.000 caracteres. Resuma e salve de novo.",
  prioridade_invalida: "Essa prioridade não existe. Escolha uma da lista.",
  profissional_inexistente:
    "Essa profissional não está mais disponível. Escolha outra ou deixe em branco.",
  resolucao_sem_nota:
    "Para resolver ou encerrar, escreva uma nota de pelo menos 10 letras dizendo o que foi feito. Ela fica no histórico.",
  responsavel_invalido:
    "Essa pessoa não pode receber ocorrências. Escolha alguém da coordenação, da diretoria ou uma enfermeira ativa.",
  sem_responsavel:
    "Defina quem cuida desta ocorrência antes de seguir para este passo.",
  situacao_invalida: "Esse filtro não existe. Escolha outro.",
  status_invalido: "Esse andamento não existe. Escolha um da lista.",
  status_para_tras:
    "A ocorrência só anda para a frente. Só a resolvida pode voltar para em acompanhamento.",
  tipo_invalido: "Esse tipo não existe. Escolha um da lista.",
  titulo_invalido:
    "Escreva um título com pelo menos 3 letras e no máximo 160 caracteres.",
};

const PESQUISA: Record<string, string> = {
  automacao_desligada:
    "A automação da pesquisa está desligada. Ligue em Configurações antes de gerar o link.",
  fora_da_fase:
    "Este acompanhamento não está na fase da pesquisa. Atualize a tela.",
  inexistente:
    "Este item do pós-venda não está mais disponível. Atualize a tela.",
  nao_contatar:
    "Esta família pediu para não ser contatada. A pesquisa não sai; o contato, se houver, é da coordenação, pelo nome.",
  sem_link:
    "A pesquisa ainda não tem link. Gere o link antes de marcar como enviada.",
  sem_proximo_passo:
    "Não há próximo passo para este item agora. Atualize a tela.",
  situacao_invalida: "Esse filtro não existe. Escolha outro.",
};

const FRASE_SEM_PERMISSAO =
  "O seu papel não permite esta etapa. Fale com a coordenação se precisar dela.";
export const FRASE_CONFLITO_OCORRENCIA =
  "Outra pessoa alterou esta ocorrência enquanto você editava. Atualize a tela para ver a versão mais recente antes de salvar.";

function frase(
  tabela: Record<string, string>,
  dominio: string,
  erro: unknown,
  acao: string,
): string {
  if (ehConflitoDeVersao(erro)) return FRASE_CONFLITO_OCORRENCIA;
  const codigo = codigoDominio(erro, dominio);
  if (codigo && tabela[codigo]) return tabela[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") return FRASE_SEM_PERMISSAO;
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}

export const fraseErroOcorrencia = (erro: unknown, acao: string) =>
  frase(OCORRENCIA, "ocorrencia", erro, acao);

export const fraseErroPesquisa = (erro: unknown, acao: string) =>
  frase(PESQUISA, "pesquisa", erro, acao);

/** O freio segurou o link da pesquisa: o motivo vem do banco como código. */
export function fraseBloqueioPesquisa(motivo: string): string {
  if (motivo === "familia_em_estado_sensivel") {
    return "Esta família está em estado sensível. A pesquisa não sai por aqui; o contato, se houver, é da coordenação, pelo nome.";
  }
  return "O freio segurou a pesquisa desta família. Nada foi gerado; a coordenação decide o contato.";
}
