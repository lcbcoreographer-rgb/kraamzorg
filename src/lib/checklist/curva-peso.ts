/**
 * Curva de peso do recém-nascido (PRD 9.2, P39 item 5): a partir do peso ao
 * nascer, do peso na alta e de cada peso registrado, o sistema calcula
 * perda percentual, menor peso, ganho absoluto e ganho médio diário.
 *
 * Regra observada nas evoluções reais (K-11, [clínico: confirmar]): o ganho
 * é calculado a partir do MENOR peso registrado até o último, em gramas por
 * dia, com uma casa decimal. Função pura, sem I/O: o motor de alertas
 * (RN-13) e a tela usam a mesma conta.
 */

export interface PontoDePeso {
  /** Data da pesagem (aaaa-mm-dd); nula quando o cadastro não tem a data. */
  data: string | null;
  pesoG: number;
  origem: "nascimento" | "alta" | "visita";
}

export interface CurvaPeso {
  pesoNascimentoG: number | null;
  menorPesoG: number;
  dataMenorPeso: string | null;
  ultimoPesoG: number;
  dataUltimoPeso: string | null;
  /** (nascimento - menor) / nascimento, em %, uma casa decimal; 0 se nunca perdeu. */
  perdaPercentual: number | null;
  /** Último menos menor, em gramas. */
  ganhoAbsolutoG: number;
  /** Dias entre o menor peso e o último; nulo sem as duas datas. */
  diasDesdeMenorPeso: number | null;
  /** Gramas por dia, uma casa decimal; nulo quando os dias são zero ou faltam datas. */
  ganhoMedioDiarioG: number | null;
}

export function umaCasa(numero: number): number {
  return Math.round((numero + Number.EPSILON) * 10) / 10;
}

function diasEntre(inicio: string, fim: string): number | null {
  const a = Date.parse(`${inicio.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${fim.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export interface EntradaCurvaPeso {
  pesoNascimentoG: number | null;
  dataNascimento: string | null;
  pesoAltaG: number | null;
  dataAlta: string | null;
  /** Pesos registrados nas visitas (pesagem do dia incluída). */
  pesosDasVisitas: { data: string; pesoG: number }[];
}

/**
 * Nulo quando não há nenhum peso. Empate no menor peso vale o mais antigo
 * (o início do platô); o último é o de data mais recente, e na falta de
 * data, o último da lista.
 */
export function calcularCurvaPeso(entrada: EntradaCurvaPeso): CurvaPeso | null {
  const pontos: PontoDePeso[] = [];
  if (entrada.pesoNascimentoG && entrada.pesoNascimentoG > 0) {
    pontos.push({
      data: entrada.dataNascimento,
      pesoG: entrada.pesoNascimentoG,
      origem: "nascimento",
    });
  }
  if (entrada.pesoAltaG && entrada.pesoAltaG > 0) {
    pontos.push({
      data: entrada.dataAlta,
      pesoG: entrada.pesoAltaG,
      origem: "alta",
    });
  }
  for (const visita of entrada.pesosDasVisitas) {
    if (visita.pesoG > 0) {
      pontos.push({ data: visita.data, pesoG: visita.pesoG, origem: "visita" });
    }
  }
  if (pontos.length === 0) return null;

  // Do mais antigo ao mais novo; ponto sem data fica na posição em que veio.
  const ordenados = pontos
    .map((ponto, indice) => ({ ponto, indice }))
    .sort((a, b) => {
      if (a.ponto.data && b.ponto.data && a.ponto.data !== b.ponto.data) {
        return a.ponto.data < b.ponto.data ? -1 : 1;
      }
      return a.indice - b.indice;
    })
    .map((item) => item.ponto);

  let menor = ordenados[0]!;
  for (const ponto of ordenados) {
    if (ponto.pesoG < menor.pesoG) menor = ponto;
  }
  const ultimo = ordenados.at(-1)!;

  const perda =
    entrada.pesoNascimentoG && entrada.pesoNascimentoG > 0
      ? Math.max(
          0,
          umaCasa(
            ((entrada.pesoNascimentoG - menor.pesoG) /
              entrada.pesoNascimentoG) *
              100,
          ),
        )
      : null;

  const ganho = Math.max(0, ultimo.pesoG - menor.pesoG);
  const dias =
    menor.data && ultimo.data ? diasEntre(menor.data, ultimo.data) : null;

  return {
    pesoNascimentoG: entrada.pesoNascimentoG,
    menorPesoG: menor.pesoG,
    dataMenorPeso: menor.data,
    ultimoPesoG: ultimo.pesoG,
    dataUltimoPeso: ultimo.data,
    perdaPercentual: perda,
    ganhoAbsolutoG: ganho,
    diasDesdeMenorPeso: dias,
    ganhoMedioDiarioG: dias && dias > 0 ? umaCasa(ganho / dias) : null,
  };
}
