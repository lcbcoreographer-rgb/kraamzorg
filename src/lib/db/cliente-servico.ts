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
 * - "webhook_autentique": a rota `/api/webhooks/autentique/[segredo]` marca
 *   o contrato como assinado depois de reconsultar o documento pela API
 *   (P31). Roda sem sessão de usuário (chamada da Autentique), por isso
 *   precisa da chave de serviço.
 * - "webhook_infinitepay": a rota `/api/webhooks/infinitepay` baixa a
 *   cobrança depois de confirmar com `payment_check` (P32). Mesmo motivo:
 *   sem sessão de usuário.
 *
 * - "formulario_contrato": o formulário seguro público `/formulario/[token]`
 *   (P30) abre e recebe os dados do contrato sem usuário logado. O servidor
 *   confere o Turnstile e chama só public.formulario_contrato_abrir e
 *   public.formulario_contrato_enviar (0018), que validam o token de uso
 *   único e o limite de tentativas por dentro; é o único papel com execute
 *   nas duas (src/lib/dados/supabase/formulario.ts).
 *
 * - "pesquisa_publica": a pesquisa pública `/pesquisa/[token]` (P42) abre e
 *   recebe as respostas sem usuário logado. O servidor confere o limite de
 *   tentativas e chama só public.pesquisa_abrir e public.pesquisa_enviar
 *   (0024), que validam o token de uso único, a validade e o freio por
 *   dentro; é o único papel com execute nelas
 *   (src/lib/dados/supabase/pesquisa.ts).
 *
 * - "armazenamento_privado": grava e lê o PDF do contrato e o comprovante da
 *   baixa manual no bucket privado `documentos` (P31 e P32,
 *   src/lib/armazenamento/supabase.ts), sempre depois de a rota ou a ação
 *   conferir papel e AAL2 do usuário. Quem abre o arquivo recebe URL
 *   assinada de 60 segundos.
 *
 * - "webhook_whatsapp": a rota `/api/webhooks/whatsapp` grava o estado de
 *   entrega (enviada, entregue, lida, falhou) que a Cloud API devolve
 *   (P18b), só depois de conferir a assinatura X-Hub-Signature-256. Chama
 *   só public.mensagem_registrar_status e public.saude_registrar_webhook.
 * - "saude_sistema": a rota `/api/saude` lê datas e contagens do recálculo,
 *   do cron, dos webhooks e das falhas por public.saude_sistema (P14).
 * - "push_servidor": o envio de Web Push lê as inscrições dos aparelhos por
 *   public.inscricoes_push e apaga as expiradas (P11).
 *
 * Rotas de webhook e jobs futuros (P18) acrescentam o próprio motivo aqui
 * quando chegarem. O teste src/lib/db/cliente-servico.test.ts falha se um
 * arquivo fora da lista de autorizados importar este módulo.
 */
export type MotivoClienteServico =
  | "convite_usuario"
  | "sessoes_diretoria"
  | "webhook_autentique"
  | "webhook_infinitepay"
  | "formulario_contrato"
  | "pesquisa_publica"
  | "armazenamento_privado"
  | "webhook_whatsapp"
  | "saude_sistema"
  | "push_servidor";

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
