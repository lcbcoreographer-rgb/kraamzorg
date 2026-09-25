import "server-only";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import { rpcPendente } from "@/lib/dados/supabase/comum";
import type { CategoriaAutomacao, VerificacaoFreio, VerificadorFreio } from "@/lib/messaging";

/**
 * Implementação de verdade do `VerificadorFreio` (a interface fica em
 * `src/lib/messaging`, que não conhece `src/lib/dados` de propósito). É a
 * porta de saída de toda mensagem para a família (PRD 8.2): nada sai do
 * canal manual nem do uazapi sem passar por aqui.
 *
 * Supabase: chama `api.pode_enviar_mensagem` por RPC (privado.*, PRD 8.2).
 * Essa função ainda não existe no schema `api` — 0012 a 0014 (automações e
 * agente) são de outra trilha, em andamento — então `rpcPendente`
 * (src/lib/dados/supabase/comum.ts) devolve `funcao_pendente` até a
 * migration chegar; aqui isso vira `pode: false`, nunca `true`: um freio
 * que a gente não consegue checar de verdade é tratado como fechado.
 *
 * Demonstração: sem a função do banco para chamar, aproxima a mesma matriz
 * (PRD 8.2, `privado.freio_permite`) a partir do que já está em
 * `FichaRepositorio.obterFicha` (estado sensível e `nao_contatar`). Não
 * cobre janela de horário nem o limite de uma mensagem de conteúdo por dia
 * (isso exige histórico de `mensagem`, fora do que os repositórios de
 * demonstração hoje guardam) — documentado aqui para quem for ampliar a
 * loja de demonstração depois.
 */
export function criarVerificadorFreio(): VerificadorFreio {
  return async ({ familiaId, categoria }) => {
    if (categoria === "interna") {
      // PRD 8.2: "interna" nunca fala com a família (é aviso à equipe) e
      // sempre executa, mesmo com o freio acionado.
      return { pode: true, motivo: "" };
    }
    if (!familiaId) {
      return {
        pode: false,
        motivo: "Falta saber de qual família é essa mensagem.",
      };
    }
    return modoDados() === "demonstracao"
      ? verificarPorAproximacao(familiaId, categoria)
      : verificarPorRpc(familiaId, categoria);
  };
}

async function verificarPorRpc(
  familiaId: string,
  categoria: CategoriaAutomacao,
): Promise<VerificacaoFreio> {
  try {
    const cliente = await criarClienteServidor();
    const resposta = await rpcPendente(cliente, "pode_enviar_mensagem", {
      familia_id: familiaId,
      categoria,
    });
    const registro =
      resposta && typeof resposta === "object" && !Array.isArray(resposta)
        ? (resposta as Record<string, unknown>)
        : {};
    const pode = registro.pode === true;
    const motivo = typeof registro.motivo === "string" ? registro.motivo : "";
    return {
      pode,
      motivo: pode ? "" : motivo || "O banco recusou o envio para essa família.",
    };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "funcao_pendente") {
      return {
        pode: false,
        motivo:
          "A verificação do freio ainda não está pronta no banco. Nada foi enviado.",
      };
    }
    return {
      pode: false,
      motivo: "Não deu para confirmar se pode enviar agora. Tente de novo em instantes.",
    };
  }
}

async function verificarPorAproximacao(
  familiaId: string,
  categoria: CategoriaAutomacao,
): Promise<VerificacaoFreio> {
  const { ficha } = await obterRepositorios();
  const registro = await ficha.obterFicha(familiaId);
  if (!registro) {
    return { pode: false, motivo: "Não encontrei essa família." };
  }
  const { estadoSensivel, naoContatar } = registro.familia;

  if (naoContatar) {
    return {
      pode: false,
      motivo: "Essa família pediu para não ser contatada. Nada sai por aqui.",
    };
  }
  if (estadoSensivel === "bloqueio_total" || estadoSensivel === "encerrado_sensivel") {
    return {
      pode: false,
      motivo: "O freio está acionado para essa família. Só contato humano e nominal.",
    };
  }
  if (categoria === "operacional") {
    return { pode: true, motivo: "" };
  }
  // conteudo e marketing (PRD 8.2): só em normal.
  if (estadoSensivel === "atencao") {
    return {
      pode: false,
      motivo: "Essa família está em atenção. Por enquanto, só contato operacional.",
    };
  }
  return { pode: true, motivo: "" };
}
