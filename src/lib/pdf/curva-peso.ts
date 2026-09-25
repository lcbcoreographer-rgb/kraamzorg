/**
 * Curva de peso da evolução neonatal (PRD 9.5, PRD 22.3 item K-11): perda
 * percentual, menor peso, ganho absoluto e ganho médio diário com uma casa
 * decimal, a partir do menor peso registrado (não necessariamente o peso da
 * alta, achado de `docs/analise-evolucoes.md`, seção 4). O dia do
 * nascimento conta como dia 0 (K-11, decisão desta sessão).
 *
 * Só calcula: julgamento clínico sobre a curva (por exemplo "discrepância
 * com o comportamento do bebê") é texto livre da enfermeira, fora daqui.
 */
import type { DataIso, OrigemPesagem, Pesagem } from "./tipos";

const DIA_EM_MS = 24 * 60 * 60 * 1000;

function paraDataUtc(data: DataIso): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new RangeError(
      `curva-peso: data fora do formato aaaa-mm-dd ("${data}")`,
    );
  }
  const tempo = Date.parse(`${data}T00:00:00Z`);
  if (Number.isNaN(tempo)) {
    throw new RangeError(`curva-peso: data inválida ("${data}")`);
  }
  return tempo;
}

/**
 * Dia de vida do bebê numa data: nascimento é dia 0 (K-11). Nunca negativo
 * em uso normal, mas a conta é feita mesmo para uma data anterior ao
 * nascimento (dado corrompido do lado de quem chama, não decisão de
 * formatar em silêncio como as demais funções deste pacote).
 */
export function calcularDiaDeVida(
  dataNascimento: DataIso,
  data: DataIso,
): number {
  const diferencaDias =
    (paraDataUtc(data) - paraDataUtc(dataNascimento)) / DIA_EM_MS;
  return Math.round(diferencaDias);
}

function arredondarUmaCasa(valor: number): number {
  const arredondado = Math.round(valor * 10) / 10;
  return arredondado === 0 ? 0 : arredondado; // evita "-0"
}

export interface PontoPeso {
  data: DataIso;
  pesoG: number;
  origem: OrigemPesagem | "nascimento";
  diaVida: number;
}

export interface CurvaPeso {
  pesoNascimentoG: number;
  menorPesoG: number;
  dataMenorPeso: DataIso;
  diaVidaMenorPeso: number;
  perdaPercentual: number; // sempre >= 0, uma casa decimal
  pesoFinalG: number;
  dataPesoFinal: DataIso;
  diaVidaPesoFinal: number;
  ganhoAbsolutoG: number; // desde o menor peso até a última pesagem, pode ser negativo se o bebê seguiu perdendo
  diasEntreMenorEFinal: number;
  ganhoMedioDiarioGDia: number; // uma casa decimal
  recuperouPesoNascimento: boolean;
  pontos: PontoPeso[]; // ordenados por data, peso de nascimento incluído como dia 0
}

/**
 * @param pesoNascimentoG `bebe.peso_nascimento_g`.
 * @param dataNascimento `bebe.data_nascimento`.
 * @param pesagens pesagens domiciliares e de alta/pediatra registradas no período; não precisa incluir o peso de nascimento, que entra como o primeiro ponto (dia 0).
 */
export function calcularCurvaPeso(
  pesoNascimentoG: number,
  dataNascimento: DataIso,
  pesagens: Pesagem[],
): CurvaPeso {
  if (!Number.isFinite(pesoNascimentoG) || pesoNascimentoG <= 0) {
    throw new RangeError(
      `calcularCurvaPeso: peso de nascimento inválido (${String(pesoNascimentoG)})`,
    );
  }
  for (const pesagem of pesagens) {
    if (!Number.isFinite(pesagem.pesoG) || pesagem.pesoG <= 0) {
      throw new RangeError(
        `calcularCurvaPeso: peso inválido na pesagem de ${pesagem.data} (${String(pesagem.pesoG)})`,
      );
    }
  }

  const pontosSemOrdenar: PontoPeso[] = [
    {
      data: dataNascimento,
      pesoG: pesoNascimentoG,
      origem: "nascimento",
      diaVida: 0,
    },
    ...pesagens.map((pesagem) => ({
      data: pesagem.data,
      pesoG: pesagem.pesoG,
      origem: pesagem.origem,
      diaVida: calcularDiaDeVida(dataNascimento, pesagem.data),
    })),
  ];
  const pontos = pontosSemOrdenar.sort((a, b) =>
    a.data < b.data ? -1 : a.data > b.data ? 1 : a.diaVida - b.diaVida,
  );

  const menorPonto = pontos.reduce((menor, atual) =>
    atual.pesoG < menor.pesoG ? atual : menor,
  );
  const pontoFinal = pontos[pontos.length - 1]!;

  const perdaPercentual = arredondarUmaCasa(
    Math.max(0, ((pesoNascimentoG - menorPonto.pesoG) / pesoNascimentoG) * 100),
  );

  const diasEntreMenorEFinal = Math.max(
    0,
    pontoFinal.diaVida - menorPonto.diaVida,
  );
  const ganhoAbsolutoG = pontoFinal.pesoG - menorPonto.pesoG;
  const ganhoMedioDiarioGDia =
    diasEntreMenorEFinal === 0
      ? 0
      : arredondarUmaCasa(ganhoAbsolutoG / diasEntreMenorEFinal);

  return {
    pesoNascimentoG,
    menorPesoG: menorPonto.pesoG,
    dataMenorPeso: menorPonto.data,
    diaVidaMenorPeso: menorPonto.diaVida,
    perdaPercentual,
    pesoFinalG: pontoFinal.pesoG,
    dataPesoFinal: pontoFinal.data,
    diaVidaPesoFinal: pontoFinal.diaVida,
    ganhoAbsolutoG,
    diasEntreMenorEFinal,
    ganhoMedioDiarioGDia,
    recuperouPesoNascimento: pontoFinal.pesoG >= pesoNascimentoG,
    pontos,
  };
}

/** Classificação estrutural da curva (peso final contra peso de nascimento), usada pela validação de coerência da conclusão. Não é a "interpretação" clínica: só o sinal da conta. */
export function classificarEvolucaoPeso(
  curva: CurvaPeso,
): "progressivo" | "estavel" | "perda" {
  if (curva.pesoFinalG > curva.pesoNascimentoG) return "progressivo";
  if (curva.pesoFinalG < curva.pesoNascimentoG) return "perda";
  return "estavel";
}
