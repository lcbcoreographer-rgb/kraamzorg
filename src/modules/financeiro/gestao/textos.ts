import { codigoGestao, ErroRepositorio } from "@/lib/dados/erros";
import type {
  CategoriaDespesa,
  MotivoBloqueioPagamento,
  OrigemLead,
  SituacaoExtrato,
  StatusPagamentoEquipe,
} from "@/lib/dados/tipos-gestao";

/**
 * Textos do financeiro da Fase 3 (P46). Frases completas que dizem o que
 * aconteceu e o que fazer (PRD 20.3, voz.md). Sem travessão. Nenhum valor,
 * prazo ou limite escrito aqui: tudo chega do banco.
 */

export const ROTULO_CATEGORIA: Record<CategoriaDespesa, string> = {
  equipe_assistencial: "Equipe assistencial",
  marketing_anuncios: "Marketing e anúncios",
  deslocamento: "Deslocamento",
  contabilidade: "Contabilidade",
  tecnologia: "Tecnologia",
  pro_labore: "Pró-labore",
  outros: "Outros",
};

export const ROTULO_ORIGEM: Record<OrigemLead, string> = {
  instagram_organico: "Instagram orgânico",
  meta_ads: "Anúncios da Meta",
  google: "Google",
  site: "Site",
  indicacao_medica: "Indicação médica",
  indicacao_cliente: "Indicação de cliente",
  indicacao_amigo: "Indicação de amigo",
  presente: "Presente",
  evento: "Evento",
  outro: "Outro",
  desconhecida: "Origem não informada",
};

export const ROTULO_STATUS_PAGAMENTO: Record<StatusPagamentoEquipe, string> = {
  bloqueado: "Bloqueado",
  liberado: "Liberado",
  pago: "Pago",
};

export const TEXTO_BLOQUEIO: Record<MotivoBloqueioPagamento, string> = {
  evolucao_nao_enviada:
    "Fica liberado quando todas as evoluções do acompanhamento forem enviadas aos médicos.",
  sem_valor_hora:
    "Falta o valor da hora da profissional. Preencha na ficha da equipe ou no parâmetro do pagamento.",
};

export const ROTULO_SITUACAO_EXTRATO: Record<SituacaoExtrato, string> = {
  conferida: "Conferida",
  sugerida: "Sugerida",
  sem_correspondencia: "Sem correspondência",
};

const FRASES: Record<string, string> = {
  data_futura:
    "A data ainda não chegou. Escolha hoje ou um dia que já passou, porque o DRE é por regime de caixa.",
  valor_invalido:
    "O valor precisa ser maior que zero e caber no teto de um lançamento à mão. Confira o valor e tente de novo.",
  descricao_invalida: "Escreva a descrição da despesa, com até 200 letras.",
  canal_so_no_marketing:
    "O canal só vale para despesas de marketing e anúncios. Tire o canal ou mude a categoria.",
  dados_incompletos: "Falta a data ou a categoria da despesa.",
  despesa_inexistente: "Essa despesa não existe mais. Atualize a tela.",
  despesa_removida: "Essa despesa já foi removida.",
  despesa_da_equipe:
    "Essa despesa nasceu do pagamento da equipe e não se edita nem se remove à mão.",
  motivo_invalido:
    "Escreva o motivo com pelo menos 10 letras. Ele fica registrado junto de quem removeu.",
  pagamento_inexistente: "Esse pagamento não existe mais. Atualize a tela.",
  pagamento_ja_pago: "Esse pagamento já foi registrado como pago.",
  pagamento_bloqueado:
    "Esse pagamento ainda está bloqueado. Ele é liberado quando todas as evoluções do acompanhamento forem enviadas aos médicos.",
  arquivo_invalido:
    "Não deu para ler o arquivo. Baixe o extrato de novo e tente outra vez.",
  formato_invalido: "O extrato precisa ser um arquivo OFX ou CSV.",
  extrato_vazio: "O arquivo não tem nenhum lançamento.",
  extrato_grande_demais:
    "O arquivo tem lançamentos demais para uma importação só. Baixe o extrato em períodos menores.",
  linha_invalida:
    "Uma linha do extrato está com data ou valor que não deu para ler. Confira o arquivo e tente de novo.",
  linhas_invalidas: "O extrato não veio no formato esperado.",
  parametro_ausente:
    "Falta uma configuração do financeiro. Avise a diretoria; nada foi alterado.",
  semanas_invalidas: "Escolha entre 1 e 26 semanas.",
};

/** Frase para a tela a partir do erro do repositório. `oQueTentava` completa a frase genérica. */
export function fraseErroGestao(erro: unknown, oQueTentava: string): string {
  const codigo = codigoGestao(erro);
  if (codigo && FRASES[codigo]) return FRASES[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return `Esse passo é do financeiro e da diretoria, com o código do aplicativo (MFA) confirmado. Nada foi alterado.`;
    }
    if (erro.codigo === "indisponivel") {
      return `Sem conexão com o servidor agora. Nada foi alterado; tente ${oQueTentava} de novo em instantes.`;
    }
  }
  return `Não foi possível ${oQueTentava} agora. Nada foi alterado; tente de novo em instantes.`;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export { plural };
