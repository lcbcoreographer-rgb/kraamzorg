import { enviarLotePorFetch, type EnviarLote } from "./motor";
import type {
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";

const TEMPO_MAXIMO_MS = 30_000;

async function enviarPrenatal(
  itens: ItemSincronizacaoEntrada[],
): Promise<ResultadoItemSincronizacao[]> {
  const resposta = await fetch("/api/sync/prenatal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itens }),
    signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
  });
  if (!resposta.ok) {
    throw new Error(`POST /api/sync/prenatal respondeu ${resposta.status}`);
  }
  const corpo = (await resposta.json()) as {
    resultados: ResultadoItemSincronizacao[];
  };
  return corpo.resultados;
}

/**
 * Envio da fila usado pelas telas: cada entidade sobe pela rota que tem
 * repositório de verdade. `consulta_prenatal` (P35) vai para
 * `/api/sync/prenatal`; o resto continua em `/api/sync` (P12). Um destino
 * fora do ar não derruba o outro: os itens dele voltam como "erro" e a fila
 * tenta de novo com a espera crescente.
 */
export const enviarLoteDoApp: EnviarLote = async (itens) => {
  const prenatal = itens.filter((i) => i.entidade === "consulta_prenatal");
  const outros = itens.filter((i) => i.entidade !== "consulta_prenatal");

  const [rPrenatal, rOutros] = await Promise.allSettled([
    prenatal.length > 0 ? enviarPrenatal(prenatal) : Promise.resolve([]),
    outros.length > 0
      ? enviarLotePorFetch(outros).then((r) => r.resultados)
      : Promise.resolve([]),
  ]);

  const falha = (
    grupo: ItemSincronizacaoEntrada[],
  ): ResultadoItemSincronizacao[] =>
    grupo.map((i) => ({
      id: i.id,
      status: "erro" as const,
      erro: "sem conexão com o servidor",
    }));

  return {
    resultados: [
      ...(rPrenatal.status === "fulfilled" ? rPrenatal.value : falha(prenatal)),
      ...(rOutros.status === "fulfilled" ? rOutros.value : falha(outros)),
    ],
  };
};
