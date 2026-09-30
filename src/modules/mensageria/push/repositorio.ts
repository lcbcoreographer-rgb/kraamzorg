import "server-only";
import { ErroRepositorio } from "@/lib/dados/erros";
import { modoDados } from "@/lib/dados/modo";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";

/**
 * Inscrição de Web Push da pessoa logada (P11 item 4), guardada em
 * `inscricao_push` (0025) só por `api.registrar_inscricao_push` e
 * `api.remover_inscricao_push`, que checam papel e AAL dentro do banco. A
 * tabela não tem `select` para o app.
 *
 * Demonstração: memória do processo, só para a tela e a rota rodarem sem
 * banco. Nada disto guarda nome de pessoa: endpoint e chaves são do aparelho.
 */
export interface InscricaoPush {
  endpoint: string;
  chaves: { p256dh: string; auth: string };
}

export interface RepositorioInscricaoPush {
  registrar(usuarioId: string, inscricao: InscricaoPush): Promise<void>;
  remover(usuarioId: string, endpoint: string): Promise<void>;
}

interface LojaDemo {
  porEndpoint: Map<string, { usuarioId: string; inscricao: InscricaoPush }>;
}

const CHAVE_GLOBAL = "__kraamzorgInscricoesPushDemo";

function lojaDemo(): LojaDemo {
  const g = globalThis as unknown as Record<string, LojaDemo | undefined>;
  g[CHAVE_GLOBAL] ??= { porEndpoint: new Map() };
  return g[CHAVE_GLOBAL];
}

/** Só para testes e para a página de demonstração. */
export function inscricoesDemonstracao(usuarioId?: string): InscricaoPush[] {
  return [...lojaDemo().porEndpoint.values()]
    .filter((x) => !usuarioId || x.usuarioId === usuarioId)
    .map((x) => x.inscricao);
}

export function reiniciarInscricoesDemonstracao(): void {
  lojaDemo().porEndpoint.clear();
}

const demonstracao: RepositorioInscricaoPush = {
  async registrar(usuarioId, inscricao) {
    lojaDemo().porEndpoint.set(inscricao.endpoint, { usuarioId, inscricao });
  },
  async remover(usuarioId, endpoint) {
    const atual = lojaDemo().porEndpoint.get(endpoint);
    if (atual?.usuarioId === usuarioId) lojaDemo().porEndpoint.delete(endpoint);
  },
};

const supabase: RepositorioInscricaoPush = {
  async registrar(_usuarioId, inscricao) {
    const cliente = await criarClienteServidor();
    const { error } = await cliente
      .schema("api")
      .rpc("registrar_inscricao_push", {
        p_endpoint: inscricao.endpoint,
        p_chaves: inscricao.chaves,
      });
    if (error) {
      throw new ErroRepositorio(
        error.code === "42501" ? "sem_permissao" : "desconhecido",
        "Não foi possível guardar o aviso deste aparelho.",
      );
    }
  },
  async remover(_usuarioId, endpoint) {
    const cliente = await criarClienteServidor();
    const { error } = await cliente
      .schema("api")
      .rpc("remover_inscricao_push", {
        p_endpoint: endpoint,
      });
    if (error) {
      throw new ErroRepositorio(
        error.code === "42501" ? "sem_permissao" : "desconhecido",
        "Não foi possível tirar o aviso deste aparelho.",
      );
    }
  },
};

export function obterRepositorioInscricaoPush(): RepositorioInscricaoPush {
  return modoDados() === "demonstracao" ? demonstracao : supabase;
}
