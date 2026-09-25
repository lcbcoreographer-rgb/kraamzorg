import type { SinalManual } from "./tipos";

/**
 * Seletor dos sinais do DOC 3 que não têm campo no checklist (PRD 9.3, K-07):
 * "cefaleia com alteração visual, dor torácica, convulsão, sangue nas
 * fezes, entre outros". A lista abaixo é o texto do DOC 3 (9.3), mas o
 * PRD marca a própria ideia do seletor como `[clínico: validar o seletor]`
 * e o capítulo 22.3 mantém K-07 em aberto com a Edilaine: por isso todo
 * item nasce com `pendenteAprovacaoClinica: true` (CLAUDE.md, "Clínico":
 * entra parametrizado e desligado até aprovação). A tela que usar este
 * catálogo decide como tratar o sinalizador antes de mostrar o seletor.
 */

const CONDUTA_PUERPERA_IMEDIATO =
  "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.";
const CONDUTA_RN_IMEDIATO =
  "Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.";
const CONDUTA_AM_IMEDIATO =
  "Suspender procedimentos eletivos (laser) e acionar supervisão médica.";

function criarSinal(
  dados: Omit<SinalManual, "pendenteAprovacaoClinica">,
): SinalManual {
  return { ...dados, pendenteAprovacaoClinica: true };
}

export const SINAIS_SEM_CAMPO: SinalManual[] = [
  criarSinal({
    codigo: "PU-05",
    grupo: "puerpera",
    descricao: "Cefaleia intensa associada a alteração visual",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "PU-06",
    grupo: "puerpera",
    descricao: "Falta de ar, dor torácica",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "PU-07",
    grupo: "puerpera",
    descricao: "Mal-estar importante ou prostração",
    severidade: "imediato",
    conduta: CONDUTA_PUERPERA_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "RN-02",
    grupo: "recem_nascido",
    descricao: "Cianose ou palidez acentuada",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "RN-05",
    grupo: "recem_nascido",
    descricao: "Sangue nas fezes",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "RN-06",
    grupo: "recem_nascido",
    descricao: "Convulsão",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "RN-09",
    grupo: "recem_nascido",
    descricao: "Recusa alimentar completa",
    severidade: "imediato",
    conduta: CONDUTA_RN_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "RN-11",
    grupo: "recem_nascido",
    descricao: "Oligúria concentrada",
    severidade: "prioritario",
    conduta: "Comunicar supervisão médica no mesmo dia e seguir orientação.",
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "RN-12",
    grupo: "recem_nascido",
    descricao: "Vômitos frequentes",
    severidade: "prioritario",
    conduta: "Comunicar supervisão médica no mesmo dia e seguir orientação.",
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "AM-01",
    grupo: "amamentacao",
    descricao: "Mastite com sinais sistêmicos",
    severidade: "imediato",
    conduta: CONDUTA_AM_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "AM-02",
    grupo: "amamentacao",
    descricao: "Dor intensa associada a febre",
    severidade: "imediato",
    conduta: CONDUTA_AM_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
  criarSinal({
    codigo: "AM-03",
    grupo: "amamentacao",
    descricao: "Abscesso suspeito",
    severidade: "imediato",
    conduta: CONDUTA_AM_IMEDIATO,
    exigeOcorrenciaPrivada: false,
  }),
];

/** Busca um sinal manual pelo código do DOC 3 (ex.: "RN-06"). */
export function buscarSinalManual(codigo: string): SinalManual | undefined {
  return SINAIS_SEM_CAMPO.find((sinal) => sinal.codigo === codigo);
}
