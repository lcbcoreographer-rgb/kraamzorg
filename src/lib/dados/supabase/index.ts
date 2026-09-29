import "server-only";
import type { Repositorios } from "../repositorios";
import { criarAgenteSupabase } from "./agente";
import type { ContextoSupabase } from "./comum";
import { criarCobrancaSupabase } from "./cobranca";
import { criarConfiguracoesSupabase } from "./configuracoes";
import { criarContratoSupabase } from "./contrato";
import { criarFamiliasSupabase } from "./familias";
import { criarFichaSupabase } from "./ficha";
import { criarTarefasSupabase } from "./tarefas";
import { criarUsuariosSupabase } from "./usuarios";
import { criarVendaSupabase } from "./venda";

export type { ContextoSupabase } from "./comum";

/** Implementação real: Supabase com a sessão do usuário (RLS) e o schema api. */
export function criarRepositoriosSupabase(
  contexto: ContextoSupabase,
): Repositorios {
  return {
    familias: criarFamiliasSupabase(contexto),
    ficha: criarFichaSupabase(contexto),
    tarefas: criarTarefasSupabase(contexto),
    configuracoes: criarConfiguracoesSupabase(contexto),
    agente: criarAgenteSupabase(contexto),
    usuarios: criarUsuariosSupabase(contexto),
    venda: criarVendaSupabase(contexto),
    contratos: criarContratoSupabase(contexto),
    cobrancas: criarCobrancaSupabase(contexto),
  };
}
