import type {
  CondicaoJson,
  FonteRegra,
  RegraAlerta,
  Severidade,
} from "./tipos";

/**
 * Catálogo de referência: o Apêndice B do PRD ligado aos campos do DOC 2.
 *
 * Não é a fonte das regras em produção. As regras que o motor avalia vêm de
 * `regra_alerta` (cache local no aparelho, leitura direta no servidor),
 * convertidas por `regraDoBanco`; `avaliarCampo` e `avaliarRegistro` exigem
 * o catálogo como entrada e não têm padrão escondido (CLAUDE.md: nenhum
 * limite no código). Este arquivo existe para três coisas: documentar a
 * proposta do Apêndice B num formato que o motor entende, servir de base
 * para a sessão de banco preencher as condições `[clínico]` depois da
 * aprovação, e ser conferido pelo teste contra o seed (`catalogo.test.ts`
 * lê `supabase/seed.sql` e falha se os dois divergirem).
 *
 * Por isso os caminhos de campo e o JSON das sete regras ativas são os
 * mesmos do seed (seção 7): formato curto, `"2.1.temperatura"` etc. A chave
 * definitiva nasce com a definição do DOC 2 no `instrumento` (P34); até lá
 * o caminho é provisório e só o catálogo e o seed mudam, nunca o motor.
 *
 * Regra de ativação: só a linha cuja "Situação" no Apêndice B diz "Fonte:
 * DOC 3" nasce ativa. "Fonte: v4.0" (RN-10), `[clínico]` e linha sem fonte
 * (seletor SM do bloco 7) entram desligadas até a aprovação da Edilaine
 * (P-1 item 18). `criarRegra` deriva `ativa` de `fonte`.
 */

// Conduta: mesmo texto das linhas de `regra_alerta` no seed (PRD 9.3).
const CONDUTA_PUERPERA_IMEDIATO =
  "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.";
const CONDUTA_PUERPERA_PRIORITARIO =
  "Comunicar supervisão médica e seguir orientação.";
const CONDUTA_SM_IMEDIATO =
  "Não deixar a puérpera sozinha, acionar supervisão médica imediatamente e orientar busca de atendimento emergencial. Escala para a coordenação com prioridade máxima e cria ocorrência privada.";
const CONDUTA_SM_PRIORITARIO = "Comunicar supervisão médica e registrar.";
const CONDUTA_RN_IMEDIATO =
  "Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.";
const CONDUTA_RN_PRIORITARIO =
  "Comunicar supervisão médica e seguir orientação.";
const CONDUTA_AM_PRIORITARIO =
  "Comunicar supervisão médica e avaliar consultoria especializada.";
// Linhas do Apêndice B sem código do DOC 3 (severidade `atencao`): o PRD não
// traz conduta. Texto provisório, desligado junto com a regra.
const CONDUTA_SEM_CODIGO_DOC3 =
  "Registrar e avaliar com a coordenação clínica (sem conduta no DOC 3).";

function criarRegra(dados: {
  id: string;
  codigo: string;
  grupo: RegraAlerta["grupo"];
  descricao: string;
  severidade: Severidade;
  conduta: string;
  campo: string | null;
  condicao: CondicaoJson | null;
  fonte: FonteRegra;
  nota?: string;
}): RegraAlerta {
  return { ...dados, ativa: dados.fonte === "doc3" };
}

export const CATALOGO_REGRAS: RegraAlerta[] = [
  // --- Puérpera -----------------------------------------------------------
  criarRegra({
    id: "PU-01",
    codigo: "PU-01",
    grupo: "puerpera",
    descricao: "Febre ≥ 38 °C",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "2.1.temperatura",
    condicao: { campo: "2.1.temperatura", operador: ">=", valor: 38 },
    fonte: "doc3",
  }),
  criarRegra({
    id: "PU-02",
    codigo: "PU-02",
    grupo: "puerpera",
    descricao:
      "Sangramento vaginal intenso (encharcar 1 absorvente em menos de 1 hora)",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "2.loquios",
    condicao: null,
    fonte: "clinico",
    nota: "Apêndice B: lóquios esperados = não abre um seletor de intensidade ainda sem opções aprovadas; sem condição até a Edilaine definir.",
  }),
  criarRegra({
    id: "PU-03",
    codigo: "PU-03",
    grupo: "puerpera",
    descricao: "Dor intensa, progressiva ou fora do esperado",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "2.dor",
    condicao: { campo: "2.dor", operador: ">=", valor: 7 },
    fonte: "clinico",
    nota: "K-04: corte de dor ≥ 7 e escolha entre PU-03 e PU-09 aguardam a Edilaine.",
  }),
  criarRegra({
    id: "PU-04",
    codigo: "PU-04",
    grupo: "puerpera",
    descricao:
      "Sinais de infecção em ferida operatória (calor, vermelhidão, secreção purulenta)",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    campo: "2.2.ferida_operatoria",
    condicao: {
      campo: "2.2.sem_sinais_infeccao",
      operador: "=",
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
    campo: "2.2.ferida_operatoria",
    condicao: {
      campo: "2.2.episiotomia_sem_alteracoes",
      operador: "=",
      valor: false,
    },
    fonte: "clinico",
    nota: 'Apêndice B: vínculo de PU-04 com episiotomia ou laceração ainda [clínico]. No banco vira a mesma linha PU-04 (chave id e instrumento_versao), com as duas condições num "ou", depois da aprovação.',
  }),
  criarRegra({
    id: "PU-08",
    codigo: "PU-08",
    grupo: "puerpera",
    descricao: "Febre baixa persistente (< 38 °C)",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "2.1.temperatura",
    condicao: {
      tipo: "serie",
      campo: "2.1.temperatura",
      operador: "entre",
      valorMinimo: 37.5,
      valorMaximo: 37.9,
      visitasConsecutivas: 2,
      incluirAtual: true,
    },
    fonte: "clinico",
    nota: 'Apêndice B: corte de "febre baixa persistente" (37,5 a 37,9 °C em duas visitas seguidas) ainda [clínico].',
  }),
  criarRegra({
    id: "PU-09",
    codigo: "PU-09",
    grupo: "puerpera",
    descricao: "Dor moderada não controlada",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "2.dor",
    condicao: null,
    fonte: "clinico",
    nota: "K-04: corte de dor e escolha entre PU-03 e PU-09 aguardam a Edilaine.",
  }),
  criarRegra({
    id: "PU-10",
    codigo: "PU-10",
    grupo: "puerpera",
    descricao:
      "Aumento progressivo dos lóquios (1 absorvente saturado em 3 h de uso)",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "2.loquios",
    condicao: null,
    fonte: "clinico",
    nota: "Apêndice B: mesmo seletor de intensidade dos lóquios do PU-02, ainda sem opções aprovadas.",
  }),
  criarRegra({
    id: "PU-11",
    codigo: "PU-11",
    grupo: "puerpera",
    descricao:
      "Sinais de ingurgitamento mamário patológico sem melhora com o manejo",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "2.5.ingurgitadas",
    condicao: { campo: "2.5.ingurgitadas", operador: "=", valor: true },
    fonte: "clinico",
    nota: 'Apêndice B: DOC 3 pede "sem melhora com o manejo", que o campo sozinho não representa; [clínico].',
  }),
  criarRegra({
    id: "PU-12",
    codigo: "PU-12",
    grupo: "puerpera",
    descricao: "Fissuras mamilares graves ou com sinais inflamatórios",
    severidade: "prioritario",
    conduta: CONDUTA_PUERPERA_PRIORITARIO,
    campo: "2.7.nts",
    condicao: { campo: "2.7.nts", operador: ">=", valor: 4 },
    fonte: "clinico",
    nota: "Apêndice B: corte do NTS ≥ 4 ainda [clínico].",
  }),

  // --- Saúde mental materna -------------------------------------------------
  // Bloco 7 do DOC 2: "sinais de sofrimento emocional = sim" abre o seletor
  // SM-01 a SM-07 (Apêndice B). A linha do Apêndice B não cita fonte e o
  // seed deixa as sete desligadas; aqui também. A condição usa "contem"
  // porque o seletor pode ter mais de um sinal marcado.
  criarLinhaSaudeMental(
    "SM-01",
    "Ideação suicida ou autoagressiva",
    "imediato",
  ),
  criarLinhaSaudeMental("SM-02", "Comportamento desorganizado", "imediato"),
  criarLinhaSaudeMental(
    "SM-03",
    "Desconexão importante com o bebê",
    "imediato",
  ),
  criarLinhaSaudeMental(
    "SM-04",
    "Tristeza intensa e persistente",
    "prioritario",
  ),
  criarLinhaSaudeMental("SM-05", "Ansiedade incapacitante", "prioritario"),
  criarLinhaSaudeMental("SM-06", "Choro frequente sem alívio", "prioritario"),
  criarLinhaSaudeMental(
    "SM-07",
    "Relato de incapacidade de cuidar do bebê",
    "prioritario",
  ),

  // --- Recém-nascido (avaliado uma vez por bebê) -----------------------------
  criarRegra({
    id: "RN-01",
    codigo: "RN-01",
    grupo: "recem_nascido",
    descricao: "Dificuldade respiratória",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "3.respiracao",
    condicao: {
      campo: "3.respiracao_com_esforco",
      operador: "=",
      valor: true,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-03",
    codigo: "RN-03",
    grupo: "recem_nascido",
    descricao: "Letargia importante",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "3.atividade",
    condicao: {
      campo: "3.atividade_preservada",
      operador: "=",
      valor: false,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-04",
    codigo: "RN-04",
    grupo: "recem_nascido",
    descricao: "Ausência de diurese por 4 horas ou mais",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "3.2.diurese",
    condicao: { campo: "3.2.horas_sem_diurese", operador: ">=", valor: 4 },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-07",
    codigo: "RN-07",
    grupo: "recem_nascido",
    descricao:
      "Um ou mais sinais flogísticos do coto umbilical (hiperemia, secreção purulenta ou odor fétido)",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "3.2.coto",
    condicao: {
      campo: "3.2.coto_com_sinais_flogisticos",
      operador: "=",
      valor: true,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-08",
    codigo: "RN-08",
    grupo: "recem_nascido",
    descricao: "Febre (> 38 °C) ou hipotermia (< 36 °C)",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    campo: "3.1.temperatura",
    condicao: {
      campo: "3.1.temperatura",
      operador: "fora_da_faixa",
      min: 36,
      max: 38,
    },
    fonte: "doc3",
  }),
  criarRegra({
    id: "RN-10",
    codigo: "RN-10",
    grupo: "recem_nascido",
    descricao: "Icterícia progressiva indicando fototerapia",
    severidade: "prioritario",
    conduta: CONDUTA_RN_PRIORITARIO,
    campo: "3.ictericia",
    condicao: { campo: "3.ictericia", operador: ">=", valor: 3 },
    fonte: "v4",
    nota: 'Apêndice B: corte "zona ≥ III" vem da v4.0, não do texto do DOC 3. A zona como número (0 ausente, 1 a 5) é provisória até a definição do DOC 2 no P34.',
  }),
  criarRegra({
    id: "RN-13",
    codigo: "RN-13",
    grupo: "recem_nascido",
    descricao: "Ganho ponderal insatisfatório (quando conhecido)",
    severidade: "prioritario",
    conduta: CONDUTA_RN_PRIORITARIO,
    campo: "3.1.peso",
    condicao: {
      tipo: "curva_peso",
      campoPeso: "3.1.peso",
      percentualPerdaMaximo: 10,
      diaVidaLimiteRecuperacao: 14,
    },
    fonte: "clinico",
    nota: "Apêndice B: perda acima de 10% ou sem recuperação até o D14, corte ainda [clínico: definir corte].",
  }),

  // --- Amamentação e mamas -----------------------------------------------------
  criarRegra({
    id: "AM-04",
    codigo: "AM-04",
    grupo: "amamentacao",
    descricao: "Fissuras profundas",
    severidade: "prioritario",
    conduta: CONDUTA_AM_PRIORITARIO,
    campo: "2.7.nts",
    condicao: { campo: "2.7.nts", operador: ">=", valor: 4 },
    fonte: "clinico",
    nota: "Apêndice B: corte do NTS ≥ 4 ainda [clínico].",
  }),
  criarRegra({
    id: "AM-05",
    codigo: "AM-05",
    grupo: "amamentacao",
    descricao: "Dor persistente à amamentação",
    severidade: "prioritario",
    conduta: CONDUTA_AM_PRIORITARIO,
    campo: "2.6.evn",
    condicao: { campo: "2.6.evn", operador: ">=", valor: 7 },
    fonte: "clinico",
    nota: "Apêndice B: corte do EVN ≥ 7 ainda [clínico].",
  }),
  criarRegra({
    id: "AM-06",
    codigo: "AM-06",
    grupo: "amamentacao",
    descricao: "Baixa produção percebida com impacto no RN",
    severidade: "prioritario",
    conduta: CONDUTA_AM_PRIORITARIO,
    campo: "2.12.producao",
    condicao: { campo: "2.12.producao", operador: "=", valor: "baixa" },
    fonte: "clinico",
    nota: 'Apêndice B: falta representar "quando houver impacto no RN"; ainda [clínico].',
  }),

  // --- Linhas do Apêndice B sem código do DOC 3 (atenção, [clínico]) ------------
  // Não têm linha em `regra_alerta` (o seed tem só PU-01 a AM-06), então não
  // podem gerar `alerta_clinico` (chave estrangeira) até a sessão de banco
  // decidir como guardá-las.
  criarRegra({
    id: "LATCH",
    codigo: "LATCH",
    grupo: "amamentacao",
    descricao: "LATCH ≤ 5 (sem código do DOC 3)",
    severidade: "atencao",
    conduta: CONDUTA_SEM_CODIGO_DOC3,
    campo: "2.8.latch",
    condicao: { campo: "2.8.latch", operador: "<=", valor: 5 },
    fonte: "clinico",
    nota: "K-03: corte de alerta do LATCH ainda [clínico].",
  }),
  criarRegra({
    id: "SUCCOES",
    codigo: "SUCCOES",
    grupo: "amamentacao",
    descricao: "Menos de 8 sucções por dia (sem código do DOC 3)",
    severidade: "atencao",
    conduta: CONDUTA_SEM_CODIGO_DOC3,
    campo: "2.11.succoes",
    condicao: { campo: "2.11.succoes", operador: "<", valor: 8 },
    fonte: "clinico",
    nota: "PRD 9.2: o impresso não diz onde entra o 8; [clínico].",
  }),
  criarRegra({
    id: "APOIO",
    codigo: "APOIO",
    grupo: "amamentacao",
    descricao: "Apoio percebido ao amamentar ≤ 3 (sem código do DOC 3)",
    severidade: "atencao",
    conduta: CONDUTA_SEM_CODIGO_DOC3,
    campo: "2.13.apoio",
    condicao: { campo: "2.13.apoio", operador: "<=", valor: 3 },
    fonte: "clinico",
  }),
];

function criarLinhaSaudeMental(
  codigo: string,
  descricao: string,
  severidade: Severidade,
): RegraAlerta {
  return criarRegra({
    id: codigo,
    codigo,
    grupo: "saude_mental",
    descricao,
    severidade,
    conduta:
      severidade === "imediato" ? CONDUTA_SM_IMEDIATO : CONDUTA_SM_PRIORITARIO,
    campo: "7.sofrimento_emocional",
    condicao: {
      tipo: "comparacao",
      campo: "7.sofrimento_emocional",
      operador: "contem",
      valor: codigo,
    },
    fonte: "proposta",
    nota: "Apêndice B: seletor SM-01 a SM-07 sem fonte citada; desligado até a aprovação do Apêndice B (P-1 item 18), igual ao seed.",
  });
}
