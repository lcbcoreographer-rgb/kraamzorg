import "server-only";
import { ErroRepositorio } from "@/lib/dados/erros";
import { modoDados } from "@/lib/dados/modo";
import { PREFERENCIAS_PADRAO, type PreferenciasNotificacao } from "./tipos";

/**
 * Preferências de notificação por pessoa (P18 item 3: "Preferências por
 * usuário"). O banco ainda não tem onde guardar isso, `perfil` (0002) não
 * tem coluna própria e uma tabela nova é migration, fora do que 0001 a
 * 0011 cobrem e fora do que esta sessão pode mexer (0012 a 0014 são de
 * outra trilha, em andamento). Por padrão os três canais extras (push,
 * WhatsApp interno, e-mail) vêm ligados: uma central que nasce calada não
 * avisa ninguém.
 *
 * Demonstração: guarda de verdade, em memória, só para esta tela ser
 * testável agora. Supabase: lê sempre o padrão e recusa gravar
 * (`funcao_pendente`) até existir uma coluna ou tabela real, documentado
 * aqui para quem acrescentar essa migration.
 */
export interface PreferenciasRepositorio {
  obter(usuarioId: string): Promise<PreferenciasNotificacao>;
  salvar(preferencias: PreferenciasNotificacao): Promise<void>;
}

const memoriaDemonstracao = new Map<string, PreferenciasNotificacao>();

/** Só para testes: volta a memória de demonstração ao estado vazio. */
export function reiniciarPreferenciasDemoParaTestes(): void {
  memoriaDemonstracao.clear();
}

const repositorioDemonstracao: PreferenciasRepositorio = {
  async obter(usuarioId) {
    return memoriaDemonstracao.get(usuarioId) ?? PREFERENCIAS_PADRAO(usuarioId);
  },
  async salvar(preferencias) {
    memoriaDemonstracao.set(preferencias.usuarioId, preferencias);
  },
};

const repositorioSupabase: PreferenciasRepositorio = {
  async obter(usuarioId) {
    return PREFERENCIAS_PADRAO(usuarioId);
  },
  async salvar() {
    throw new ErroRepositorio(
      "funcao_pendente",
      "preferências de notificação: falta coluna ou tabela no banco",
    );
  },
};

export function obterPreferenciasRepositorio(): PreferenciasRepositorio {
  return modoDados() === "demonstracao"
    ? repositorioDemonstracao
    : repositorioSupabase;
}
