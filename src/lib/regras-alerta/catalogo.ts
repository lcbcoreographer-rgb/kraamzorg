import type { Condicao, FonteRegra, RegraAlerta, Severidade } from "./tipos";

/**
 * Catálogo padrão: o Apêndice B do PRD ligado aos campos do DOC 2.
 *
 * Regra de ativação (CLAUDE.md, "Clínico", e tarefa da sessão): só entra
 * ativa a linha cuja "Situação" no Apêndice B diz "Fonte: DOC 3" (texto
 * vigente, PRD 9.3/K-06). Linha com fonte "v4.0" (a v4.0 do PRD, citada só
 * quando o DOC 3 não detalha o corte, como RN-10) ou marcada `[clínico]`
 * entra parametrizada e desligada até a aprovação da Edilaine (`fonte:
 * "v4"` ou `"clinico"`, `ativa: false`). `criarRegra` deriva `ativa` de
 * `fonte` para as duas nunca desalinharem.
 *
 * PU-04 tem dois vínculos porque o Apêndice B liga o mesmo código do DOC 3
 * a dois campos diferentes (cesárea sem sinais de infecção, fonte DOC 3; e
 * episiotomia ou laceração com alteração, [clínico]): o `id` do vínculo é
 * único, `codigo` é o mesmo (PU-04) nos dois.
 */

const CONDUTA_PUERPERA_IMEDIATO =
  "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.";
const CONDUTA_PUERPERA_PRIORITARIO =
  "Comunicar supervisão médica e seguir orientação.";

const CONDUTA_SM_IMEDIATO =
  "Não deixar a puérpera sozinha, acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.";
const CONDUTA_SM_PRIORITARIO = "Comunicar supervisão médica e registrar.";

const CONDUTA_RN_IMEDIATO =
  "Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.";
// PRD 9.3 não repete uma frase de conduta específica para os códigos
// prioritários do recém-nascido (RN-10 a RN-13); usa-se a conduta genérica
// da tabela de severidade (9.3, "Prioritário").
const CONDUTA_RN_PRIORITARIO =
  "Comunicar supervisão médica no mesmo dia e seguir orientação.";

// AM-01 a AM-03 (imediato) não têm campo no checklist: entram em
// `sinais.ts`, que declara sua própria conduta. Aqui só as prioritárias.
const CONDUTA_AM_PRIORITARIO =
  "Comunicar supervisão médica e avaliar consultoria especializada.";

function criarRegra(dados: {
  id: string;
  codigo: string;
  grupo: RegraAlerta["grupo"];
  descricao: string;
  severidade: Severidade;
  conduta: string;
  campo: string | null;
  condicao: Condicao | null;
  fonte: FonteRegra;
  nota?: string;
}): RegraAlerta {
  // Só a fonte "doc3" (texto vigente do DOC 3, PRD 9.3/K-06) nasce ativa.
  // "v4" (v4.0, citada quando o DOC 3 não detalha o corte) e "clinico"
  // ([clínico] no Apêndice B) entram parametrizadas e desligadas até a
  // aprovação da Edilaine (CLAUDE.md, "Clínico").
  return { ...dados, ativa: dados.fonte === "doc3" };
}

export const CATALOGO_REGRAS: RegraAlerta[] = [
  // --- Puérpera -----------------------------------------------------------
  criarRegra({
    id: "PU-01-temperatura",
    codigo: "PU-01",
    grupo: "puerpera",
    descricao: "Febre ≥ 38 °C",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "secao_2_1.temperatura_c",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_1.temperatura_c",
      operador: "maior_igual",
      valor: 38,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "PU-03-dor",
    codigo: "PU-03",
    grupo: "puerpera",
    descricao: "Dor intensa, progressiva ou fora do esperado",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "secao_2.dor_intensidade",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2.dor_intensidade",
      operador: "maior_igual",
      valor: 7,
    },
    fonte: "clinico",
    nota: "K-04: corte de dor ≥ 7 e escolha entre PU-03 e PU-09 aguardam a Edilaine.",
  }),
  criarRegra({
    id: "PU-09-dor",
    codigo: "PU-09",
    grupo: "puerpera",
    descricao: "Dor moderada não controlada",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "secao_2.dor_intensidade",
    condicao: null,
    fonte: "clinico",
    nota: "K-04: corte de dor e escolha entre PU-03 e PU-09 aguardam a Edilaine.",
  }),
  criarRegra({
    id: "PU-02-locios",
    codigo: "PU-02",
    grupo: "puerpera",
    descricao:
      "Sangramento vaginal intenso (encharcar 1 absorvente em menos de 1 hora)",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "secao_2.locios_intensidade",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2.locios_intensidade",
      operador: "igual",
      valor: "encharcando_1h",
    },
    fonte: "clinico",
    nota: "Apêndice B: seletor de intensidade dos lóquios ainda [clínico].",
  }),
  criarRegra({
    id: "PU-10-locios",
    codigo: "PU-10",
    grupo: "puerpera",
    descricao:
      "Aumento progressivo dos lóquios (1 absorvente saturado em 3 h de uso)",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "secao_2.locios_intensidade",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2.locios_intensidade",
      operador: "igual",
      valor: "saturando_3h",
    },
    fonte: "clinico",
    nota: "Apêndice B: seletor de intensidade dos lóquios ainda [clínico].",
  }),
  criarRegra({
    id: "PU-08-temperatura-persistente",
    codigo: "PU-08",
    grupo: "puerpera",
    descricao: "Febre baixa persistente (< 38 °C)",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "secao_2_1.temperatura_c",
    condicao: {
      tipo: "serie",
      campo: "secao_2_1.temperatura_c",
      operador: "entre",
      valorMinimo: 37.5,
      valorMaximo: 37.9,
      visitasConsecutivas: 2,
      incluirAtual: true,
    },
    fonte: "clinico",
    nota: 'Apêndice B: corte de "febre baixa persistente" (37,5 a 37,9 °C, duas visitas) ainda [clínico].',
  }),
  criarRegra({
    id: "PU-04-cesarea",
    codigo: "PU-04",
    grupo: "puerpera",
    descricao:
      "Sinais de infecção em ferida operatória (calor, vermelhidão, secreção purulenta)",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "secao_2_2.cesarea_sem_sinais_infeccao",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_2.cesarea_sem_sinais_infeccao",
      operador: "igual",
      valor: false,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "PU-04-episiotomia",
    codigo: "PU-04",
    grupo: "puerpera",
    descricao: "Episiotomia ou laceração com alteração",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "secao_2_2.episiotomia_laceracao_alteracao",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_2.episiotomia_laceracao_alteracao",
      operador: "igual",
      valor: true,
    },
    fonte: "clinico",
    nota: "Apêndice B: vínculo com episiotomia/laceração ainda [clínico].",
  }),
  criarRegra({
    id: "PU-11-ingurgitamento",
    codigo: "PU-11",
    grupo: "puerpera",
    descricao:
      "Sinais de ingurgitamento mamário patológico sem melhora com o manejo (hiperemia, dor intensa, febre, sem sucesso na drenagem de alívio)",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "secao_2_5.ingurgitadas",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_5.ingurgitadas",
      operador: "igual",
      valor: true,
    },
    fonte: "clinico",
    nota: 'Apêndice B: DOC 3 pede "sem melhora com o manejo", ainda não representado no campo; [clínico].',
  }),
  criarRegra({
    id: "PU-12-nts",
    codigo: "PU-12",
    grupo: "puerpera",
    descricao: "Fissuras mamilares graves ou com sinais inflamatórios",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "secao_2_7.nts",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_7.nts",
      operador: "maior_igual",
      valor: 4,
    },
    fonte: "clinico",
    nota: "Apêndice B: corte do NTS ≥ 4 ainda [clínico].",
  }),

  // --- Saúde mental materna -------------------------------------------------
  // PRD 9.3 documenta os sete códigos por completo (texto do DOC 3, sem
  // marca [clínico] no Apêndice B); o campo "7" só abre o seletor SM-01 a
  // SM-07, quem escolhe o código é a enfermeira. As linhas abaixo entram
  // ativas porque não há corte numérico pendente, só a escolha no seletor.
  ...criarLinhaSaudeMental(
    "SM-01",
    "Ideação suicida ou autoagressiva",
    "imediato",
  ),
  ...criarLinhaSaudeMental("SM-02", "Comportamento desorganizado", "imediato"),
  ...criarLinhaSaudeMental(
    "SM-03",
    "Desconexão importante com o bebê",
    "imediato",
  ),
  ...criarLinhaSaudeMental(
    "SM-04",
    "Tristeza intensa e persistente",
    "prioritario",
  ),
  ...criarLinhaSaudeMental("SM-05", "Ansiedade incapacitante", "prioritario"),
  ...criarLinhaSaudeMental(
    "SM-06",
    "Choro frequente sem alívio",
    "prioritario",
  ),
  ...criarLinhaSaudeMental(
    "SM-07",
    "Relato de incapacidade de cuidar do bebê",
    "prioritario",
  ),

  // --- Recém-nascido ---------------------------------------------------------
  criarRegra({
    id: "RN-01-respiracao",
    codigo: "RN-01",
    grupo: "recem_nascido",
    descricao: "Dificuldade respiratória",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "secao_3.respiracao_com_esforco",
    condicao: {
      tipo: "comparacao",
      campo: "secao_3.respiracao_com_esforco",
      operador: "igual",
      valor: true,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-03-atividade",
    codigo: "RN-03",
    grupo: "recem_nascido",
    descricao: "Letargia importante",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "secao_3.atividade_preservada",
    condicao: {
      tipo: "comparacao",
      campo: "secao_3.atividade_preservada",
      operador: "igual",
      valor: false,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-08-temperatura",
    codigo: "RN-08",
    grupo: "recem_nascido",
    descricao: "Febre (> 38 °C) ou hipotermia (< 36 °C)",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "secao_3_1.temperatura_rn_c",
    condicao: {
      tipo: "ou",
      condicoes: [
        {
          tipo: "comparacao",
          campo: "secao_3_1.temperatura_rn_c",
          operador: "maior",
          valor: 38,
        },
        {
          tipo: "comparacao",
          campo: "secao_3_1.temperatura_rn_c",
          operador: "menor",
          valor: 36,
        },
      ],
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-04-diurese",
    codigo: "RN-04",
    grupo: "recem_nascido",
    descricao: "Ausência de diurese por 4 horas ou mais",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "secao_3_2.diurese_ausente_horas",
    condicao: {
      tipo: "comparacao",
      campo: "secao_3_2.diurese_ausente_horas",
      operador: "maior_igual",
      valor: 4,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-07-coto",
    codigo: "RN-07",
    grupo: "recem_nascido",
    descricao:
      "Um ou mais sinais flogísticos do coto umbilical (hiperemia, secreção purulenta ou odor fétido)",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "secao_3_2.coto_sinais_flogisticos",
    condicao: {
      tipo: "comparacao",
      campo: "secao_3_2.coto_sinais_flogisticos",
      operador: "igual",
      valor: true,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-10-ictericia",
    codigo: "RN-10",
    grupo: "recem_nascido",
    descricao: "Icterícia progressiva indicando fototerapia",
    severidade: "prioritario",
    conduta: CONDUTA_RN_PRIORITARIO,
    campo: "secao_3.ictericia_zona_kramer",
    condicao: {
      tipo: "comparacao",
      campo: "secao_3.ictericia_zona_kramer",
      operador: "maior_igual",
      valor: 3,
    },
    fonte: "v4",
    nota: 'Apêndice B: corte "zona ≥ III" vem da v4.0, não do texto do DOC 3 (9.3 só diz "progressiva"); tratado como fonte não confirmada pelo DOC 3, entra desligado até a Edilaine confirmar.',
  }),
  criarRegra({
    id: "RN-13-curva-peso",
    codigo: "RN-13",
    grupo: "recem_nascido",
    descricao: "Ganho ponderal insatisfatório (quando conhecido)",
    severidade: "prioritario",
    conduta: CONDUTA_RN_PRIORITARIO,
    campo: "secao_3_1.peso_gramas",
    condicao: {
      tipo: "curva_peso",
      campoPeso: "secao_3_1.peso_gramas",
      percentualPerdaMaximo: 10,
      diaVidaLimiteRecuperacao: 14,
    },
    fonte: "clinico",
    nota: "Apêndice B: corte de perda percentual e prazo de recuperação ainda [clínico].",
  }),

  // --- Amamentação e mamas -----------------------------------------------------
  criarRegra({
    id: "AM-05-evn",
    codigo: "AM-05",
    grupo: "amamentacao",
    descricao: "Dor persistente à amamentação",
    severidade: "prioritario",
    conduta: CONDUTA_AM_PRIORITARIO,
    campo: "secao_2_6.evn",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_6.evn",
      operador: "maior_igual",
      valor: 7,
    },
    fonte: "clinico",
    nota: "Apêndice B: corte do EVN ≥ 7 ainda [clínico].",
  }),
  criarRegra({
    id: "AM-04-nts",
    codigo: "AM-04",
    grupo: "amamentacao",
    descricao: "Fissuras profundas",
    severidade: "prioritario",
    conduta: CONDUTA_AM_PRIORITARIO,
    campo: "secao_2_7.nts",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_7.nts",
      operador: "maior_igual",
      valor: 4,
    },
    fonte: "clinico",
    nota: "Apêndice B: corte do NTS ≥ 4 ainda [clínico].",
  }),
  criarRegra({
    id: "AM-06-producao",
    codigo: "AM-06",
    grupo: "amamentacao",
    descricao: "Baixa produção percebida com impacto no RN",
    severidade: "prioritario",
    conduta: CONDUTA_AM_PRIORITARIO,
    campo: "secao_2_12.producao_percebida",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_12.producao_percebida",
      operador: "igual",
      valor: "baixa",
    },
    fonte: "clinico",
    nota: "Apêndice B: falta representar 'quando houver impacto no RN'; ainda [clínico].",
  }),

  // --- Sem regra automática no DOC 3 (registro/atenção, [clínico]) --------------
  criarRegra({
    id: "K03-latch",
    codigo: "K-03-LATCH",
    grupo: "amamentacao",
    descricao:
      "LATCH ≤ 5 (sem código do DOC 3; corte proposto pelo Apêndice B)",
    severidade: "atencao",
    conduta: "Reforçar apoio à amamentação.",
    campo: "secao_2_8.latch",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_8.latch",
      operador: "menor_igual",
      valor: 5,
    },
    fonte: "clinico",
    nota: "K-03: corte de alerta do LATCH ainda [clínico].",
  }),
  criarRegra({
    id: "K-sucoes",
    codigo: "K-SUCOES",
    grupo: "amamentacao",
    descricao: "Menos de 8 sucções por dia (sem código do DOC 3)",
    severidade: "atencao",
    conduta: "Reforçar apoio à amamentação.",
    campo: "secao_2_11.sucoes_por_dia",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_11.sucoes_por_dia",
      operador: "menor",
      valor: 8,
    },
    fonte: "clinico",
  }),
  criarRegra({
    id: "K-apoio",
    codigo: "K-APOIO",
    grupo: "amamentacao",
    descricao: "Apoio percebido ≤ 3 (sem código do DOC 3)",
    severidade: "atencao",
    conduta: "Reforçar apoio à amamentação.",
    campo: "secao_2_13.apoio",
    condicao: {
      tipo: "comparacao",
      campo: "secao_2_13.apoio",
      operador: "menor_igual",
      valor: 3,
    },
    fonte: "clinico",
  }),
];

function criarLinhaSaudeMental(
  codigo: string,
  descricao: string,
  severidade: Severidade,
): RegraAlerta[] {
  return [
    criarRegra({
      id: `${codigo}-seletor`,
      codigo,
      grupo: "saude_mental",
      descricao,
      severidade,
      conduta:
        severidade === "imediato"
          ? CONDUTA_SM_IMEDIATO
          : CONDUTA_SM_PRIORITARIO,
      campo: "secao_7.sofrimento_emocional_sinal",
      condicao: {
        tipo: "comparacao",
        campo: "secao_7.sofrimento_emocional_sinal",
        operador: "igual",
        valor: codigo,
      },
      fonte: "doc3",
    }),
  ];
}
