import "server-only";
import { listarBaseConhecimento, obterUltimaIngestao } from "../repositorio";
import type { ItemBaseConhecimento, UltimaIngestao } from "../tipos";

export interface BaseConhecimentoTela {
  itens: ItemBaseConhecimento[];
  ultimaIngestao: UltimaIngestao | null;
}

/** Base de conhecimento da Isadora (P27 item 4, PRD 6.8, 11.9). */
export async function obterBaseConhecimentoTela(): Promise<BaseConhecimentoTela> {
  const [itens, ultimaIngestao] = await Promise.all([
    listarBaseConhecimento(),
    obterUltimaIngestao(),
  ]);
  return { itens, ultimaIngestao };
}
