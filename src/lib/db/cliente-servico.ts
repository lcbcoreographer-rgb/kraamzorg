import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuracaoSupabase } from "./configuracao";
import type { Database } from "./types";

/**
 * Cliente de serviço (service_role): ignora a RLS. Só no servidor
 * (`import "server-only"` quebra o build se um componente de navegador
 * importar este arquivo) e só nos usos que o PRD autoriza. Cada uso declara
 * o motivo, e a lista abaixo é a lista inteira:
 *
 * - "convite_usuario": a diretoria convida uma pessoa. Criar usuário no
 *   Supabase Auth só se faz com a chave de serviço (PRD 13, P07 item 6;
 *   0007_permissoes.sql, seção 4: o perfil nasce do raw_app_meta_data, que
 *   só o servidor grava).
 * - "sessoes_diretoria": a tela de sessões da diretoria lê o último acesso
 *   de cada pessoa no Supabase Auth (PRD 21.2, P07 item 7).
 *
 * Rotas de webhook e jobs (P18, P31, P32) acrescentam o próprio motivo aqui
 * quando chegarem. O teste src/lib/db/cliente-servico.test.ts falha se um
 * arquivo fora da lista de autorizados importar este módulo.
 */
export type MotivoClienteServico = "convite_usuario" | "sessoes_diretoria";

export function criarClienteServico(motivo: MotivoClienteServico) {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY ausente (uso: ${motivo}). ` +
        "Ela vem do cofre e só existe no servidor.",
    );
  }
  const { url } = configuracaoSupabase();
  return createClient<Database>(url, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-kz-motivo": motivo } },
  });
}
