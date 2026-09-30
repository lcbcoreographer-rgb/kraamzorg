import {
  codigoDominio,
  ehConflitoDeVersao,
  ErroRepositorio,
} from "@/lib/dados/erros";

/**
 * Frases para as recusas das funções de nota fiscal (0024, "nota:<código>") e
 * para as falhas do provedor. Erro diz o que aconteceu e o que fazer (PRD
 * 20.3, voz.md 2). Nenhuma frase carrega nome, CPF ou telefone.
 */
const JA_EMITIDA = "Esta nota já foi emitida. Atualize a tela.";
const EM_ANDAMENTO =
  "Já existe uma emissão em andamento para esta nota. Espere alguns minutos e consulte o provedor.";
const CANCELADA = "Esta nota foi cancelada e não muda mais.";

const FRASES: Record<string, string> = {
  emitida_nao_emite: JA_EMITIDA,
  processando_nao_emite: EM_ANDAMENTO,
  cancelada_nao_emite: CANCELADA,
  emitida_nao_aceita_manual: JA_EMITIDA,
  processando_nao_aceita_manual: EM_ANDAMENTO,
  cancelada_nao_aceita_manual: CANCELADA,
  cancelada: CANCELADA,
  cobranca_nao_paga:
    "A cobrança desta nota ainda não foi paga. A nota só sai depois do pagamento confirmado.",
  data_invalida:
    "A data da nota não pode ser futura nem anterior a 2020. Confira no portal do provedor.",
  estado_invalido: "Esse estado de nota não existe. Atualize a tela.",
  fora_do_processamento:
    "Esta nota não está em processamento. Atualize a tela para ver o estado atual.",
  inexistente:
    "Esta nota não está mais disponível. Volte à lista e abra de novo.",
  ja_emitida: JA_EMITIDA,
  ja_processando: EM_ANDAMENTO,
  sem_arquivo: "Esta nota não tem esse arquivo guardado.",
  sem_numero: "Escreva o número da nota, como aparece no portal do provedor.",
  servico_sem_cadastro:
    "O código e a descrição do serviço ainda não estão cadastrados. Peça à diretoria para preencher em Configurações; nada foi emitido.",
  situacao_invalida: "Esse filtro não existe. Escolha outro.",
  tipo_invalido: "Esse tipo de arquivo não existe. Use PDF ou XML.",
  tomador_sem_cpf:
    "Falta o CPF de quem paga no cadastro do contrato. Peça o CPF à família e cadastre; a nota só sai depois disso.",
};

const FRASE_SEM_PERMISSAO =
  "O seu papel não permite esta etapa. As notas são do financeiro e da diretoria.";

export const FRASE_CONFLITO_NOTA =
  "Outra pessoa alterou esta nota enquanto você editava. Atualize a tela para ver o estado atual.";

export function fraseErroNota(erro: unknown, acao: string): string {
  if (ehConflitoDeVersao(erro)) return FRASE_CONFLITO_NOTA;
  const codigo = codigoDominio(erro, "nota");
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") return FRASE_SEM_PERMISSAO;
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${acao} agora. Nada foi alterado; tente de novo em instantes.`;
}

export const FRASE_PROVEDOR_NAO_CONFIGURADO =
  "O provedor de notas ainda não foi configurado neste ambiente. Nada foi emitido: emita no portal do provedor e registre o número aqui.";
