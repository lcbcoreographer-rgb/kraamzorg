import { obterValorPorCaminho } from "./caminho";
import {
  avaliarCondicao,
  camposDaCondicao,
  normalizarCondicao,
} from "./condicao";
import type {
  CondicaoJson,
  DadosCondicao,
  EntradaAvaliacaoCampo,
  EntradaAvaliacaoRegistro,
  GrupoAlerta,
  LinhaRegraAlerta,
  RegraAlerta,
  ResultadoAlerta,
  Severidade,
} from "./tipos";

const GRUPOS: readonly GrupoAlerta[] = [
  "puerpera",
  "saude_mental",
  "recem_nascido",
  "amamentacao",
];

const SEVERIDADES: readonly Severidade[] = [
  "imediato",
  "prioritario",
  "atencao",
  "informativo",
];

/**
 * SM imediato cria ocorrência privada com prioridade máxima (PRD 9.3,
 * "Saúde mental materna", e 6.6 `ocorrencia.privada`). Nenhum outro grupo
 * exige isso no DOC 3.
 */
export function exigeOcorrenciaPrivada(
  regra: Pick<RegraAlerta, "grupo" | "severidade">,
): boolean {
  return regra.grupo === "saude_mental" && regra.severidade === "imediato";
}

/**
 * Converte uma linha de `regra_alerta` (cache local no aparelho ou leitura
 * no servidor) em `RegraAlerta`. Recusa grupo ou severidade fora do PRD 6.6
 * com erro explícito: regra corrompida no cache precisa aparecer na carga,
 * nunca virar alerta mudo na hora de salvar o campo.
 */
export function regraDoBanco(linha: LinhaRegraAlerta): RegraAlerta {
  if (!GRUPOS.includes(linha.grupo as GrupoAlerta)) {
    throw new Error(
      `regra_alerta ${linha.id}: grupo "${linha.grupo}" fora do PRD 6.6.`,
    );
  }
  if (!SEVERIDADES.includes(linha.severidade as Severidade)) {
    throw new Error(
      `regra_alerta ${linha.id}: severidade "${linha.severidade}" fora do enum.`,
    );
  }
  return {
    id: linha.id,
    codigo: linha.id,
    grupo: linha.grupo as GrupoAlerta,
    descricao: linha.descricao,
    severidade: linha.severidade as Severidade,
    conduta: linha.conduta,
    campo: linha.campo,
    condicao: (linha.condicao ?? null) as CondicaoJson | null,
    ativa: linha.ativa,
    instrumentoVersao: linha.instrumento_versao,
  };
}

/** Problema encontrado numa regra do catálogo (para log e para a tela de configuração). */
export interface ProblemaRegra {
  regraId: string;
  motivo: string;
}

/**
 * Aponta as regras ativas que o motor não consegue avaliar: sem campo ou
 * com condição ausente ou fora dos formatos documentados. Essas regras
 * nunca disparam, então quem carrega o cache precisa saber delas.
 */
export function validarCatalogo(catalogo: RegraAlerta[]): ProblemaRegra[] {
  const problemas: ProblemaRegra[] = [];
  for (const regra of catalogo) {
    if (!regra.ativa) continue;
    if (!regra.campo) {
      problemas.push({ regraId: regra.id, motivo: "regra ativa sem campo" });
      continue;
    }
    if (!normalizarCondicao(regra.condicao)) {
      problemas.push({
        regraId: regra.id,
        motivo: "regra ativa sem condição válida",
      });
    }
  }
  return problemas;
}

function paraResultado(
  regra: RegraAlerta,
  valorObservado: unknown,
): ResultadoAlerta {
  return {
    regraId: regra.id,
    codigo: regra.codigo,
    grupo: regra.grupo,
    severidade: regra.severidade,
    descricao: regra.descricao,
    conduta: regra.conduta,
    campo: regra.campo,
    valorObservado,
    exigeOcorrenciaPrivada: exigeOcorrenciaPrivada(regra),
    fonte: regra.fonte,
    instrumentoVersao: regra.instrumentoVersao,
  };
}

/** Valor que disparou: o do campo da condição, ou o do campo da regra. */
function valorObservadoDaRegra(
  regra: RegraAlerta,
  dados: DadosCondicao,
): unknown {
  const doCampo = regra.campo
    ? obterValorPorCaminho(dados.registro, regra.campo)
    : undefined;
  if (doCampo !== undefined) return doCampo;
  const [primeiro] = camposDaCondicao(regra.condicao);
  return primeiro ? obterValorPorCaminho(dados.registro, primeiro) : undefined;
}

function avaliarRegra(
  regra: RegraAlerta,
  dados: DadosCondicao,
): ResultadoAlerta | null {
  if (!regra.ativa || !regra.condicao || !regra.campo) return null;
  if (!avaliarCondicao(regra.condicao, dados)) return null;
  return paraResultado(regra, valorObservadoDaRegra(regra, dados));
}

/**
 * A regra olha para o campo salvo agora? Vale o `campo` da regra e todos
 * os campos que a condição consulta, porque no banco o `campo` pode ser o
 * item do checklist e a condição ler um subcampo dele (seed: PU-04 tem
 * campo "2.2.ferida_operatoria" e condição em "2.2.sem_sinais_infeccao").
 */
function regraLigadaAoCampo(regra: RegraAlerta, campo: string): boolean {
  if (regra.campo === campo) return true;
  if (regra.campo && campo.startsWith(`${regra.campo}.`)) return true;
  return camposDaCondicao(regra.condicao).includes(campo);
}

function dadosDaEntrada(entrada: EntradaAvaliacaoRegistro): DadosCondicao {
  return {
    registro: entrada.registro,
    serieAnterior: entrada.serieAnterior,
    contexto: entrada.contexto,
  };
}

/**
 * Avalia o momento em que um campo do checklist é salvo (PRD 9.3: "O motor
 * avalia no momento em que a enfermeira salva o campo, ainda offline").
 * Só considera regras ativas ligadas ao campo salvo agora; regras de série
 * (PU-08) e de curva de peso (RN-13) recebem a série já pronta em
 * `entrada.serieAnterior`, nunca buscam histórico sozinhas.
 */
export function avaliarCampo(
  entrada: EntradaAvaliacaoCampo,
): ResultadoAlerta[] {
  const dados = dadosDaEntrada(entrada);
  const resultados: ResultadoAlerta[] = [];
  for (const regra of entrada.catalogo) {
    if (!regraLigadaAoCampo(regra, entrada.campo)) continue;
    const resultado = avaliarRegra(regra, dados);
    if (resultado) resultados.push(resultado);
  }
  return resultados;
}

/**
 * Reavaliação completa de uma visita (PRD 9.3: "Na sincronização, o
 * servidor reavalia"), contra todas as regras ativas do catálogo, não só a
 * do último campo salvo. Mesmo código, mesma pureza; quem chama decide se
 * roda no aparelho ou no servidor. Em gemelares, o bloco 3 é avaliado uma
 * vez por bebê, com o registro daquele bebê (o resultado não sabe de
 * `bebe_id`; quem chama grava).
 */
export function avaliarRegistro(
  entrada: EntradaAvaliacaoRegistro,
): ResultadoAlerta[] {
  const dados = dadosDaEntrada(entrada);
  const resultados: ResultadoAlerta[] = [];
  for (const regra of entrada.catalogo) {
    const resultado = avaliarRegra(regra, dados);
    if (resultado) resultados.push(resultado);
  }
  return resultados;
}
