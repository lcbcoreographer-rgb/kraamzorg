import "server-only";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { RepositorioSincronizacao } from "./repositorio";
import { RepositorioSincronizacaoAssistencial } from "./repositorio-assistencial";
import { RepositorioSincronizacaoMemoria } from "./repositorio-memoria";

/**
 * O repositório que `POST /api/sync` usa (P39 e P40): registro assistencial
 * e alerta clínico gravam no banco pelo schema api, com a sessão de quem
 * enviou (papel, AAL e família atribuída conferidos por dentro das funções).
 * As outras entidades da fila (visita, consulta pré-natal, áudio) ainda não
 * têm gravação no banco: na demonstração ficam no repositório de memória do
 * P12; fora dela, recusam com uma frase clara (a rota já fica fechada em
 * produção pela mesma razão, ver `vitrineLiberada`).
 */
const MEMORIA_DA_DEMONSTRACAO = new RepositorioSincronizacaoMemoria();

export async function repositorioDaRequisicao(): Promise<RepositorioSincronizacao> {
  const { assistencial } = await obterRepositorios();
  return new RepositorioSincronizacaoAssistencial(
    assistencial,
    modoDados() === "demonstracao" ? MEMORIA_DA_DEMONSTRACAO : null,
  );
}
