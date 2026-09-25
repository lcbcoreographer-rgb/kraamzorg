import { comoNumero, obterValorPorCaminho } from "./caminho";
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
  const pesoNascimentoGramas = comoNumero(
    dados.contexto?.["pesoNascimentoGramas"],
  );
  if (pesoNascimentoGramas === undefined || pesoNascimentoGramas <= 0) {
    // Sem peso ao nascer não há como calcular perda nem recuperação.
    return false;
  }

  const pesosDaSerie: number[] = [];
  const pesoAtual = comoNumero(
    obterValorPorCaminho(dados.registro, condicao.campoPeso),
  );
  if (pesoAtual !== undefined && pesoAtual > 0) pesosDaSerie.push(pesoAtual);
  for (const visita of dados.serieAnterior ?? []) {
    const peso = comoNumero(
      obterValorPorCaminho(visita.registro, condicao.campoPeso),
    );
    if (peso !== undefined && peso > 0) pesosDaSerie.push(peso);
  }
  if (pesosDaSerie.length === 0) return false;

  const menorPeso = Math.min(...pesosDaSerie);
  const percentualPerda =
    ((pesoNascimentoGramas - menorPeso) / pesoNascimentoGramas) * 100;
  if (percentualPerda > condicao.percentualPerdaMaximo) return true;

  const diaVidaAtual = comoNumero(dados.contexto?.["diaVidaAtual"]);
  if (
    diaVidaAtual !== undefined &&
    diaVidaAtual >= condicao.diaVidaLimiteRecuperacao
  ) {
    return pesoAtual !== undefined ? pesoAtual < pesoNascimentoGramas : false;
  }

  return false;
}
