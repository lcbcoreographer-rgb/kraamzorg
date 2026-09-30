import { ErroRepositorio, codigoRelacao } from "@/lib/dados/erros";

/**
 * Frases das recusas de negócio do relacionamento (0027, P47 a P51): o banco
 * manda "relacao:<código>", a tela diz o que aconteceu e o que fazer (PRD
 * 20.3). Nenhuma frase leva dado pessoal.
 */
const FRASES: Record<string, string> = {
  // P47
  codigo_invalido:
    "O código precisa ter de 3 a 12 letras maiúsculas ou números, sem espaço nem hífen.",
  codigo_em_uso: "Já existe um canal com este código. Escolha outro.",
  codigo_ja_usado:
    "Este código já saiu em links e conversas. Para não perder o histórico, deixe este canal como está e crie outro.",
  nome_invalido: "O nome está curto ou longo demais. Confira e tente de novo.",
  origem_invalida: "Escolha a origem do canal.",
  canal_inexistente: "Este canal não existe mais. Atualize a tela.",
  valor_invalido: "O valor precisa ser em reais, zero ou mais.",
  mes_invalido: "Escolha o mês do custo.",
  // P48
  pergunta_vazia: "Escreva a pergunta antes de enviar.",
  pipeline_invalido:
    "Use o pipeline 1 (entrada e qualificação) ou 2 (venda e pré-atendimento).",
  // P49
  pessoa_inexistente: "Esta pessoa não está mais no cadastro. Atualize a tela.",
  familia_mesclada: "Esta família foi unida a outra. Abra a família que ficou.",
  freio:
    "Esta família está em um momento sensível. Nenhum convite sai; o contato é feito pela pessoa da equipe.",
  papel_sem_portal:
    "O portal é para a mãe, o parceiro, o acompanhante e o responsável.",
  sem_email:
    "A pessoa não tem e-mail válido no cadastro. Peça o e-mail e tente de novo.",
  sem_contrato_assinado: "O portal abre depois da assinatura do contrato.",
  sem_acesso_ativo: "Esta pessoa não tem acesso ativo ao portal.",
  profissional_inexistente:
    "Esta profissional não está mais no cadastro. Atualize a tela.",
  foto_invalida:
    "O caminho da foto usa o código da profissional, nunca o nome.",
  // P50
  estado_invalido: "Escolha um estado da lista.",
  especialidade_invalida: "Escolha a especialidade.",
  telefone_invalido: "O telefone parece incompleto. Confira o DDD e o número.",
  email_invalido: "O e-mail parece incompleto. Confira antes de salvar.",
  parceiro_inexistente:
    "Este médico parceiro não está mais na lista. Atualize a tela.",
  titulo_invalido: "O título da tarefa precisa ter de 3 a 120 letras.",
  indicacao_invalida:
    "Informe quem indicou: um médico parceiro ou uma família, só um.",
  indicacao_ja_registrada: "Esta família já tem uma indicação registrada.",
  familia_inexistente:
    "Esta família não está mais no cadastro. Atualize a tela.",
  promotora_e_indicada: "A família não pode indicar a si mesma.",
  promotora_inexistente: "A família que indicou não está mais no cadastro.",
  // P51
  categoria_invalida: "Escolha se é manual ou protocolo.",
  conteudo_invalido:
    "O texto está vazio ou passou do limite. Confira e tente de novo.",
  resumo_obrigatorio: "Diga em uma frase o que mudou nesta versão.",
  manual_inexistente: "Este manual não está mais disponível para você.",
  versao_inexistente: "Esta versão não existe mais. Atualize a tela.",
  versao_antiga: "Há uma versão mais nova. Leia e confirme a atual.",
  manuais_invalidos: "A trilha tem um manual repetido ou que não existe mais.",
  trilha_inexistente: "Esta trilha não existe mais. Atualize a tela.",
  papel_invalido: "Escolha o papel da trilha.",
  candidata_inexistente:
    "Esta candidata não está mais no cadastro. Atualize a tela.",
  sem_contato: "Informe o telefone ou o e-mail da candidata.",
  criterio_invalido:
    "Um dos critérios não faz parte do roteiro atual. Atualize a tela.",
  pergunta_invalida:
    "Uma das perguntas não faz parte do roteiro atual. Atualize a tela.",
  nota_invalida: "A nota é um número inteiro de 1 a 5.",
  resposta_invalida: "Uma das respostas passou do limite de 2000 caracteres.",
  roteiro_ausente:
    "O roteiro de seleção não está configurado. Fale com a diretoria.",
  avaliacao_invalida:
    "A avaliação veio incompleta. Atualize a tela e tente de novo.",
};

/** Frase para a tela quando uma ação do relacionamento não deu certo. */
export function fraseErroRelacao(erro: unknown, acao: string): string {
  const codigo = codigoRelacao(erro);
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return `Seu perfil não tem acesso para ${acao}. Nada foi alterado.`;
    }
    if (erro.codigo === "indisponivel") {
      return `Sem conexão com o servidor agora. Nada foi alterado; tente ${acao} de novo em instantes.`;
    }
    if (erro.codigo === "funcao_pendente") {
      return `Esta parte ainda não está ativa neste ambiente. Nada foi alterado.`;
    }
  }
  return `Não deu para ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}

/** Resultado padrão das ações de formulário do relacionamento. */
export interface EstadoAcaoRelacao {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialRelacao: EstadoAcaoRelacao = {};

export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto
    .trim()
    .replace(/[R$\s.]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
