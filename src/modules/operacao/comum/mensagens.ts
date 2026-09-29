import { codigoOperacao, ErroRepositorio } from "@/lib/dados/erros";

/**
 * Frases para as recusas das funções de operação (0021_prenatal_nascimento.sql,
 * "operacao:<código>"). Cada uma diz o que aconteceu e o que fazer
 * (voz.md, seção 5), sem jargão de banco e sem nome de família.
 */
const FRASES: Record<string, string> = {
  dados_obrigatorios:
    "Faltou um dado. Preencha o que está marcado e tente de novo.",
  data_no_passado:
    "Esse horário já passou. Escolha uma data a partir de agora.",
  condutor_invalido:
    "Escolha quem conduz a consulta entre as pessoas da coordenação.",
  familia_inexistente:
    "Essa família não está mais disponível. Atualize a tela.",
  familia_em_estado_sensivel:
    "Esta família está em estado sensível. Nada é marcado nem oferecido até a coordenação liberar.",
  sem_consulta:
    "Esta família ainda não tem consulta pré-natal. Ela nasce quando o pagamento é confirmado.",
  consulta_ja_realizada:
    "A entrevista desta família já foi concluída. Abra a entrevista para ver as respostas.",
  consulta_encerrada:
    "Esta consulta foi encerrada e não recebe mais respostas.",
  instrumento_nao_aprovado:
    "A ficha da entrevista ainda não tem versão aprovada pela Edilaine. Nada foi aberto; avise a coordenação clínica.",
  campo_inexistente:
    "Esse campo não existe na ficha aprovada. Atualize a tela e tente de novo.",
  campo_automatico:
    "Esse campo é preenchido pelo sistema e não recebe resposta digitada.",
  campo_por_bebe: "Esse campo é por bebê e não cabe nesta entrevista.",
  periodo_invalido: "Escolha o período entre manhã e tarde.",
  valor_grande_demais:
    "A resposta passou do tamanho que o sistema guarda. Encurte o texto e tente de novo.",
  motivo_obrigatorio: "Escreva o motivo. Ele fica no histórico com o seu nome.",
  progresso_invalido: "Não deu para guardar em que etapa você parou.",
  obrigatorios_faltando:
    "Ainda faltam respostas obrigatórias. A lista está no fim da entrevista.",
  papel_ocupado:
    "Esse papel já tem uma enfermeira. Espere a resposta dela ou use a atribuição direta.",
  mesma_profissional:
    "Essa enfermeira já está nesta família. Escolha outra para o outro papel.",
  profissional_invalida:
    "Essa enfermeira não está disponível para a escala. Escolha outra.",
  sem_contrato:
    "Esta família ainda não tem o pagamento confirmado. Isso só se registra depois do pagamento.",
  sem_acompanhamento:
    "Esta família ainda não tem acompanhamento aberto. Confira o contrato e o pagamento.",
  oferta_inexistente: "Essa oferta não está mais disponível. Atualize a tela.",
  oferta_ja_respondida:
    "Essa oferta já foi respondida. Atualize a tela para ver como ficou.",
  parametro_ausente:
    "Falta uma configuração da operação. Avise a diretoria; nada foi alterado.",
  bebes_invalidos:
    "Confira os dados do bebê: peso em gramas maior que zero, sexo e tipo de parto entre as opções.",
  data_no_futuro:
    "Nascimento e alta são fatos: a data não pode ser depois de hoje.",
  previsao_antes_do_nascimento:
    "A previsão de alta não pode ser antes do nascimento.",
  nascimento_ja_registrado:
    "O nascimento desta família já foi registrado com outra data. Para corrigir, fale com a diretoria.",
  sem_nascimento: "Registre o nascimento antes da alta.",
  alta_ja_registrada:
    "A alta desta família já foi registrada com outra data. Para corrigir, fale com a diretoria.",
  alta_antes_do_nascimento: "A alta não pode ser antes do nascimento.",
  primeira_visita_antes_da_alta:
    "O primeiro dia das visitas não pode ser antes da alta.",
};

export function fraseErroOperacao(erro: unknown, acao: string): string {
  const codigo = codigoOperacao(erro);
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
