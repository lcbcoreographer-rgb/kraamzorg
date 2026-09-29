import { codigoEquipe, ErroRepositorio } from "@/lib/dados/erros";
import type {
  ConflitoAgenda,
  EstadoCelulaEscala,
  EstadoProfissional,
  EstadoVisita,
  ResumoEquipe,
  SituacaoDocumento,
  TurnoVisita,
  VinculoProfissional,
} from "@/lib/dados/tipos-equipe";

/**
 * Textos da equipe, da agenda e do portal (P37 e P38), no tom da interface
 * (PRD 20.3, docs/design/voz.md): frases completas, o que aconteceu e o que
 * fazer, sem travessão e sem jargão. Nenhum limite mora aqui: o número de
 * visitas por dia, os dias de aviso e as faixas de hora chegam do banco.
 */

export const ROTULO_ESTADO: Record<EstadoProfissional, string> = {
  em_visita: "Em visita",
  em_atendimento: "Em atendimento",
  reservada: "Reservada",
  backup: "Backup",
  oferta_pendente: "Oferta pendente",
  folga: "Folga",
  livre: "Livre",
};

/** Uma frase curta que diz o que o estado quer dizer (leitor de tela e dica). */
export const EXPLICACAO_ESTADO: Record<EstadoProfissional, string> = {
  em_visita: "Chegou na casa da família e ainda não saiu.",
  em_atendimento: "Titular de uma família em acompanhamento nesta semana.",
  reservada:
    "Titular de uma família que ainda espera o bebê nascer, com a janela da DPP nesta semana.",
  backup: "Cobre uma família na janela da DPP.",
  oferta_pendente: "Tem uma oferta de família esperando resposta.",
  folga: "Agenda bloqueada no dia.",
  livre: "Nada marcado nem reservado.",
};

export const ROTULO_CELULA: Record<EstadoCelulaEscala, string> = {
  visita: "Visita",
  folga: "Folga",
  reservada: "Reservada",
  backup: "Backup",
  oferta: "Oferta",
  livre: "Livre",
};

export const ROTULO_TURNO: Record<TurnoVisita, string> = {
  manha: "manhã",
  tarde: "tarde",
};

/** "de manhã" e "à tarde", para frases. */
export const TURNO_EM_FRASE: Record<TurnoVisita, string> = {
  manha: "de manhã",
  tarde: "à tarde",
};

export const ROTULO_FUNCAO: Record<string, string> = {
  enfermeira_obstetrica: "Enfermeira obstetra",
  enfermeira_neonatal: "Enfermeira neonatal",
  coordenacao: "Coordenação",
};

export const ROTULO_VINCULO: Record<VinculoProfissional, string> = {
  clt: "CLT",
  pj: "PJ",
  mei: "MEI",
  autonoma: "Autônoma",
  socia: "Sócia",
  a_definir: "A definir",
};

export const ROTULO_ESTADO_VISITA: Record<EstadoVisita, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  a_caminho: "A caminho",
  iniciada: "Em visita",
  concluida: "Concluída",
  ficha_pendente: "Ficha pendente",
  ficha_entregue: "Ficha entregue",
  encerrada: "Encerrada",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
  nao_realizada_familia: "Não realizada, pela família",
  nao_realizada_profissional: "Não realizada, pela profissional",
};

export const ROTULO_SITUACAO_DOCUMENTO: Record<SituacaoDocumento, string> = {
  vencido: "Vencido",
  vencendo: "Vence em breve",
  em_dia: "Em dia",
  sem_validade: "Sem validade",
};

/** "3 em visita agora, 1 livre, 2 reservadas para esta semana, 1 oferta sem resposta há 18 h." */
export function fraseSinteseEquipe(resumo: ResumoEquipe): string {
  const partes: string[] = [];
  const n = (valor: number, singular: string, plural = singular) =>
    `${valor} ${valor === 1 ? singular : plural}`;

  if (resumo.emVisita > 0) partes.push(`${resumo.emVisita} em visita agora`);
  if (resumo.emAtendimento > 0)
    partes.push(`${resumo.emAtendimento} em atendimento`);
  if (resumo.livre > 0) partes.push(n(resumo.livre, "livre", "livres"));
  if (resumo.reservada > 0) {
    partes.push(
      `${n(resumo.reservada, "reservada", "reservadas")} para esta semana`,
    );
  }
  if (resumo.backup > 0) partes.push(`${resumo.backup} de backup`);
  if (resumo.folga > 0) partes.push(`${resumo.folga} de folga`);
  if (resumo.ofertaPendente > 0) {
    const horas = resumo.ofertaMaisAntigaHoras;
    const espera =
      horas === null
        ? ""
        : horas >= 48
          ? ` há ${Math.floor(horas / 24)} dias`
          : ` há ${horas} h`;
    partes.push(
      `${n(resumo.ofertaPendente, "oferta sem resposta", "ofertas sem resposta")}${espera}`,
    );
  }

  if (partes.length === 0) return "Nenhuma enfermeira ativa na equipe ainda.";
  return `${partes.join(", ")}.`;
}

export function fraseConflito(conflito: ConflitoAgenda): string {
  switch (conflito.codigo) {
    case "limite_visitas_dia":
      return `Passa do limite do dia: ficariam ${conflito.quantas ?? "mais"} visitas e o máximo é ${conflito.limite ?? "o combinado"}.`;
    case "periodo_diferente_do_d1": {
      const referencia = conflito.referencia as TurnoVisita | undefined;
      const turno = conflito.turno as TurnoVisita | undefined;
      if (referencia && turno) {
        return `O período muda: a família é atendida ${TURNO_EM_FRASE[referencia]} e esta visita ficaria ${TURNO_EM_FRASE[turno]}.`;
      }
      return "O período muda em relação ao do primeiro dia da família.";
    }
    case "bloqueio":
      return "A agenda da enfermeira está bloqueada neste dia.";
    case "sobreposicao":
      return "Choca com outra visita da enfermeira no mesmo horário.";
    case "profissional_inativa":
      return "Esta enfermeira está inativa e não recebe visitas.";
  }
}

const FRASES_RECUSA: Record<string, string> = {
  conflito:
    "Há conflito na agenda. Confira os avisos, escreva o motivo e confirme para salvar mesmo assim.",
  motivo_obrigatorio: "Escreva o motivo para salvar com o conflito.",
  visita_nao_movivel:
    "Esta visita já começou ou foi encerrada e não muda mais de dia.",
  visita_inexistente: "Não achamos esta visita. Volte à agenda e abra de novo.",
  sem_designacao:
    "Esta enfermeira ainda não aceitou esta família. Ofereça a família a ela antes de passar a visita.",
  nada_a_reagendar: "Não há visita pendente para mudar neste acompanhamento.",
  acompanhamento_inexistente: "Não achamos este acompanhamento.",
  dados_obrigatorios: "Falta um dado. Preencha o dia e tente de novo.",
  periodo_invalido: "Confira as datas: o fim não pode vir antes do começo.",
  periodo_longo: "O período é grande demais. Escolha até dois meses.",
  nome_obrigatorio: "Escreva o nome da profissional.",
  funcao_invalida: "Escolha a função da profissional.",
  telefone_invalido:
    "Confira o telefone: use o formato com DDD, por exemplo +5511900000000.",
  conselho_incompleto:
    "Preencha o estado e o número do conselho, ou deixe os dois em branco.",
  regiao_inexistente:
    "Uma das regiões escolhidas não existe mais. Escolha de novo.",
  valor_invalido: "O valor não pode ser negativo.",
  vinculo_obrigatorio: "Escolha o vínculo da profissional.",
  usuario_ja_vinculado: "Esta pessoa já está ligada a outra profissional.",
  usuario_inexistente: "Não achamos esta pessoa entre os acessos.",
  tipo_obrigatorio: "Escreva o tipo do documento.",
  profissional_inexistente: "Não achamos esta profissional.",
  documento_inexistente: "Não achamos este documento.",
  bloqueio_inexistente: "Este bloqueio já foi removido.",
  sem_profissional:
    "Seu acesso ainda não está ligado a uma profissional ativa. Fale com a coordenação.",
  hora_no_futuro:
    "A hora ficou à frente do relógio. Confira a hora do aparelho e tente de novo.",
  hora_muito_antiga:
    "Passou tempo demais desde essa hora para registrar sozinho. Fale com a coordenação.",
  fora_do_dia_da_visita:
    "Esta hora não é do dia da visita. Fale com a coordenação para ajustar o dia.",
  estado_nao_permite_chegada:
    "Esta visita não está em um estado que aceite a chegada. Fale com a coordenação.",
  saida_sem_chegada: "Registre a chegada antes da saída.",
  saida_antes_da_chegada: "A saída não pode ser antes da chegada.",
};

/**
 * Frase para a pessoa quando uma ação da equipe, da agenda ou do portal
 * falha: o que aconteceu e o que fazer. `acao` completa "Não foi possível
 * ..." nos erros que não têm frase própria.
 */
export function fraseErroEquipe(erro: unknown, acao: string): string {
  const codigo = codigoEquipe(erro);
  if (codigo && FRASES_RECUSA[codigo]) return FRASES_RECUSA[codigo];
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "Você não tem permissão para isto. Fale com a diretoria.";
    }
    if (erro.codigo === "indisponivel") {
      return "Sem conexão com o sistema agora. Nada foi alterado; tente de novo em instantes.";
    }
  }
  return `Não foi possível ${acao}. Nada foi alterado; tente de novo.`;
}
