import { obterValorPorCaminho } from "./condicao";
import type { CondicaoCurvaPeso, DadosCondicao } from "./tipos";

/**
 * RN-13, ganho ponderal insatisfatório (PRD 9.3 e Apêndice B, [clínico:
 * definir corte]). Dispara quando:
 *
 * 1. a perda em relação ao peso ao nascer, calculada a partir do MENOR peso
 *    já observado (K-11: "menor peso" é a base do cálculo, igual às
 *    evoluções), passa de `percentualPerdaMaximo`; ou
 * 2. o bebê ainda não recuperou o peso de nascimento e já chegou no dia de
 *    vida `diaVidaLimiteRecuperacao`.
 *
 * A série de pesos (visita atual + `serieAnterior`) é sempre passada como
 * entrada por quem chama; esta função não calcula peso, só interpreta a
 * curva. `contexto.pesoNascimentoGramas` e `contexto.diaVidaAtual` são
 * fatos estáticos do bebê, não campos de uma visita.
 */
export function avaliarCurvaPeso(
  condicao: CondicaoCurvaPeso,
  dados: DadosCondicao,
): boolean {
  const pesoNascimentoGramas = dados.contexto?.["pesoNascimentoGramas"];
  if (!ehNumeroFinito(pesoNascimentoGramas) || pesoNascimentoGramas <= 0) {
    // Sem peso ao nascer não há como calcular perda nem recuperação.
    return false;
  }

  const pesosDaSerie: number[] = [];
  const pesoAtual = obterValorPorCaminho(dados.registro, condicao.campoPeso);
  if (ehNumeroFinito(pesoAtual)) pesosDaSerie.push(pesoAtual);
  for (const visita of dados.serieAnterior ?? []) {
    const peso = obterValorPorCaminho(visita.registro, condicao.campoPeso);
    if (ehNumeroFinito(peso)) pesosDaSerie.push(peso);
  }
  if (pesosDaSerie.length === 0) return false;

  const menorPeso = Math.min(...pesosDaSerie);
  const percentualPerda =
    ((pesoNascimentoGramas - menorPeso) / pesoNascimentoGramas) * 100;
  if (percentualPerda > condicao.percentualPerdaMaximo) return true;

  const diaVidaAtual = dados.contexto?.["diaVidaAtual"];
  if (
    ehNumeroFinito(diaVidaAtual) &&
    diaVidaAtual >= condicao.diaVidaLimiteRecuperacao
  ) {
    return ehNumeroFinito(pesoAtual) ? pesoAtual < pesoNascimentoGramas : false;
  }

  return false;
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}
