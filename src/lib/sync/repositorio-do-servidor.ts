import "server-only";
import { vitrineLiberada } from "@/lib/ambiente";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { RepositorioSincronizacao } from "./repositorio";
import { RepositorioSincronizacaoAssistencial } from "./repositorio-assistencial";
import { RepositorioSincronizacaoComposto } from "./repositorio-composto";
import { RepositorioSincronizacaoMemoria } from "./repositorio-memoria";
import { RepositorioSincronizacaoVisita } from "./repositorio-visita";

/**
 * O repositório que `POST /api/sync` usa, com a sessão de quem enviou (papel,
 * AAL e família atribuída conferidos por dentro das funções do schema api):
 *
 * - `registro_atendimento` e `alerta_clinico` (P39 e P40) gravam pelo
 *   repositório assistencial;
 * - `visita` (chegada e saída, P38) grava pelo portal da enfermeira;
 * - o resto (pré-natal, áudio) só existe na memória de processo, fora de
 *   produção (`vitrineLiberada()`), para a demonstração do motor. Um deploy
 *   serverless pode reiniciar esse módulo a qualquer chamada; em produção a
 *   rota já recusa essas entidades antes de chegar aqui.
 */
const MEMORIA_DE_PROCESSO = new RepositorioSincronizacaoMemoria();

export async function repositorioDaRequisicao(): Promise<RepositorioSincronizacao> {
  const { portal, assistencial } = await obterRepositorios();
  const visita = new RepositorioSincronizacaoComposto(
    new RepositorioSincronizacaoVisita(portal),
    ["visita"],
    vitrineLiberada() ? MEMORIA_DE_PROCESSO : null,
  );
  return new RepositorioSincronizacaoAssistencial(assistencial, visita);
}
