import { CATALOGO_REGRAS } from "./catalogo";
import { avaliarCondicao, obterValorPorCaminho } from "./condicao";
import type {
  DadosCondicao,
  EntradaAvaliacaoCampo,
  EntradaAvaliacaoRegistro,
  RegraAlerta,
  ResultadoAlerta,
} from "./tipos";

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
  };
}

function avaliarRegra(
  regra: RegraAlerta,
  dados: DadosCondicao,
): ResultadoAlerta | null {
  if (!regra.ativa || !regra.condicao || !regra.campo) return null;
  if (!avaliarCondicao(regra.condicao, dados)) return null;
  const valorObservado = obterValorPorCaminho(dados.registro, regra.campo);
  return paraResultado(regra, valorObservado);
}

/**
 * Avalia o momento em que um campo do checklist é salvo (PRD 9.3: "O motor
 * avalia no momento em que a enfermeira salva o campo, ainda offline").
 * Só considera regras ativas cujo `campo` é exatamente o campo salvo agora;
 * regras de série (PU-08) e de curva de peso (RN-13) recebem a série já
 * pronta em `entrada.serieAnterior`, nunca buscam histórico sozinhas.
 */
export function avaliarCampo(
  entrada: EntradaAvaliacaoCampo,
): ResultadoAlerta[] {
  const catalogo = entrada.catalogo ?? CATALOGO_REGRAS;
  const dados: DadosCondicao = {
    registro: entrada.registro,
    serieAnterior: entrada.serieAnterior,
    contexto: entrada.contexto,
  };
  const resultados: ResultadoAlerta[] = [];
  for (const regra of catalogo) {
    if (regra.campo !== entrada.campo) continue;
    const resultado = avaliarRegra(regra, dados);
    if (resultado) resultados.push(resultado);
  }
  return resultados;
}

/**
 * Reavaliação completa de uma visita (PRD 9.3: "Na sincronização, o
 * servidor reavalia"), contra todas as regras ativas do catálogo, não só a
 * do último campo salvo. Mesmo código, mesma pureza; quem chama decide se
 * roda no aparelho ou no servidor.
 */
export function avaliarRegistro(
  entrada: EntradaAvaliacaoRegistro,
): ResultadoAlerta[] {
  const catalogo = entrada.catalogo ?? CATALOGO_REGRAS;
  const dados: DadosCondicao = {
    registro: entrada.registro,
    serieAnterior: entrada.serieAnterior,
    contexto: entrada.contexto,
  };
  const resultados: ResultadoAlerta[] = [];
  for (const regra of catalogo) {
    const resultado = avaliarRegra(regra, dados);
    if (resultado) resultados.push(resultado);
  }
  return resultados;
}
