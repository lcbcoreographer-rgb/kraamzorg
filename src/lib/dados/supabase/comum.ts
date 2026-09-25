import "server-only";
import type { ClienteServidor } from "@/lib/db/cliente-servidor";
import type { Json } from "@/lib/db/types";
import { traduzirErroBanco } from "../erros";

/** O que toda implementação Supabase recebe: o cliente com a sessão e quem é. */
export interface ContextoSupabase {
  cliente: ClienteServidor;
  /** auth.uid() da sessão; null quando não há ninguém logado. */
  usuarioId: string | null;
}

interface RespostaBanco<T> {
  data: T | null;
  error: { code?: string; message?: string } | null;
}

/** Devolve o dado ou lança ErroRepositorio com o código traduzido. */
export function exigir<T>(resposta: RespostaBanco<T>, contexto: string): T {
  if (resposta.error) throw traduzirErroBanco(resposta.error, contexto);
  return resposta.data as T;
}

/**
 * RPC a uma função do schema api que ainda não existe no banco nem em
 * types.ts (a migration é de outra trilha). Chama pelo nome, sem tipo, e
 * devolve ErroRepositorio "funcao_pendente" enquanto a função não existir.
 * Quando a migration chegar e `pnpm db:types:local` rodar, troque a chamada
 * por `cliente.schema("api").rpc(...)` tipada e apague o uso daqui.
 */
export async function rpcPendente(
  cliente: ClienteServidor,
  funcao: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const api = cliente.schema("api") as unknown as {
    rpc(
      nome: string,
      parametros: Record<string, unknown>,
    ): PromiseLike<RespostaBanco<Json>>;
  };
  return exigir(await api.rpc(funcao, args), `api.${funcao}`);
}

/** Tira do texto de busca o que quebraria o filtro do PostgREST. */
export function limparBusca(texto: string): string {
  return texto.replace(/[%,()*\\]/g, " ").trim();
}
