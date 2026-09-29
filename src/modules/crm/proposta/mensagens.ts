import { codigoVenda, ErroRepositorio } from "@/lib/dados/erros";

/**
 * Frases para as recusas de api.salvar_proposta, api.aprovar_desconto e
 * api.gerar_link_formulario_contrato (0018_venda.sql, "venda:<código>").
 */
const FRASES: Record<string, string> = {
  oportunidade_inexistente:
    "Essa proposta não está mais disponível. Atualize a tela.",
  proposta_fechada:
    "O contrato desta família já seguiu adiante. A proposta não muda mais por aqui.",
  estagio_nao_permite_proposta:
    "A proposta começa depois da qualificação ou da conversa de orientação. Confira o estágio no pipeline.",
  familia_em_estado_sensivel:
    "Esta família está em estado sensível ou pediu para não ser contatada. Nada comercial segue por agora.",
  sem_gestante:
    "Falta a gestante no cadastro da família. Cadastre na ficha e volte à proposta.",
  pacote_fora_de_vigencia:
    "Esse pacote não tem versão vigente hoje. Escolha outro ou fale com a diretoria.",
  condicao_inativa: "Essa condição saiu da tabela. Escolha outra.",
  desconto_duplo:
    "A condição escolhida já é um desconto. Tire o desconto à parte ou troque a condição.",
  desconto_invalido: "O desconto vai de 0 a 100%. Confira o número.",
  desconto_sem_motivo:
    "Desconto fora da tabela precisa de motivo. Escreva em uma linha por que ele foi dado.",
  parcelas_fora_da_condicao:
    "Esse número de parcelas passa do que o pacote e a condição permitem.",
  para_quem_invalido: "Escolha se a família paga ou se é um presente.",
  presente_sem_pagador:
    "Para presente, diga quem vai pagar: escolha a pessoa ou escreva o nome.",
  pagador_invalido:
    "Essa pessoa não é desta família. Escolha outra ou escreva o nome.",
  pagador_igual_gestante:
    "No presente, quem paga é outra pessoa. Escolha quem vai dar o presente.",
  template_sem_versao:
    "O modelo de contrato ainda não tem versão cadastrada. Avise a diretoria; nada foi salvo.",
  nada_a_aprovar:
    "Esta proposta não tem desconto nem condição que peça aprovação.",
  sem_proposta: "Salve a proposta antes de gerar o link do formulário.",
  formulario_ja_recebido:
    "A família já mandou os dados. O próximo passo é o contrato.",
  estagio_nao_permite_formulario:
    "O formulário sai depois da proposta salva. Confira o estágio no pipeline.",
  desconto_sem_aprovacao:
    "Esta proposta tem desconto ou condição que pede a aprovação da diretoria antes do link.",
  validade_sem_parametro:
    "A validade do link ainda não está nos parâmetros. Avise a diretoria; nenhum link foi gerado.",
};

export function fraseErroProposta(erro: unknown, acao: string): string {
  const codigo = codigoVenda(erro);
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "O banco recusou: a proposta pede o seu papel comercial ou da diretoria e o código do aplicativo (MFA).";
    }
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}
