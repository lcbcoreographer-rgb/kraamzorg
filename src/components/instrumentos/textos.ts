/**
 * Microcopy do gerador de formulário (DESIGN.md seção 7, PRD 20.3). Só texto
 * de interface para a equipe; nenhum texto clínico mora aqui: rótulo,
 * opção e ajuda de cada campo vêm da definição do instrumento aprovado.
 * Sem travessão e sem meia-risca.
 */
export const textosFormulario = {
  sim: "Sim",
  nao: "Não",
  obrigatorio: "(obrigatório)",
  detalhe: "Detalhe",
  voltar: "Voltar",
  proximaEtapa: "Próxima etapa",
  concluir: "Concluir",
  etapa: (atual: number, total: number) => `Etapa ${atual} de ${total}`,
  listaDeEtapas: "Etapas do formulário",
  faltaParaConcluir: "Falta responder para concluir:",
  tudoRespondido: "Todos os obrigatórios foram respondidos.",
  irPara: (rotulo: string) => `Ir para ${rotulo}`,
  semBebe:
    "Nenhum bebê registrado neste acompanhamento. O bloco aparece quando o nascimento for registrado.",
  abasBebes: "Bebês",
  numeroInvalido: "Confira o número digitado. Use só algarismos e vírgula.",
  foraDaFaixa: "Valor fora da faixa esperada. Confira e digite de novo.",
  ordemEscolhida: (itens: string[]) =>
    itens.length > 0
      ? `Ordem escolhida: ${itens.join(", ")}.`
      : "Toque na ordem de preferência.",
  voltarAoValor: "Informar o contato",
  automatico: {
    login: "Vem do login de quem preenche.",
    assinatura: "Preenchido na assinatura do registro.",
    idade_gestacional_calculada:
      "Calculada da data provável do parto. Não é gravada.",
  },
  sincronizacao: {
    local: "Salvo no aparelho",
    enviando: (n: number) =>
      n === 1 ? "Enviando 1 resposta" : `Enviando ${n} respostas`,
    sincronizado: (hora: string) => `Sincronizado ${hora}`,
    erro: "Não enviou. O registro está salvo no aparelho.",
    semSinal:
      "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar.",
    tentarAgora: "Tentar agora",
  },
} as const;
