import "server-only";
import { ehPapel } from "@/lib/auth/papeis";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import { ErroRepositorio } from "../erros";
import type { UsuariosRepositorio } from "../repositorios";
import type { PedidoConvite, ResultadoConvite, UsuarioSistema } from "../tipos";
import { exigir, rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Usuários, convite e sessões (P07 itens 6 e 7). Leitura de perfil e papéis
 * pela RLS da diretoria. Duas coisas só o servidor faz com a chave de
 * serviço, nos motivos que cliente-servico.ts lista: criar a conta no
 * Supabase Auth (convite) e ler o último acesso de cada pessoa.
 *
 * Revogar as sessões: o supabase-js não tem método de admin que encerre as
 * sessões de outra pessoa pelo id (auth.admin.signOut pede o JWT da própria
 * pessoa, que o servidor não tem). O caminho é apagar as linhas de
 * auth.sessions do usuário, o que derruba o refresh token de todas elas; a
 * função api.revogar_sessoes(usuario_id), security definer, só diretoria em
 * AAL2 e com log, é da trilha de banco (pendência registrada no
 * docs/sessoes/P07-app.md). O access token já emitido vale até expirar
 * (jwt_expiry do Supabase Auth, 1 hora por padrão).
 */
export function criarUsuariosSupabase(
  contexto: ContextoSupabase,
): UsuariosRepositorio {
  const { cliente } = contexto;

  return {
    async listarUsuarios() {
      const [perfis, papeis] = await Promise.all([
        cliente.from("perfil").select("id, nome, email, ativo").order("nome"),
        cliente.from("usuario_papel").select("usuario_id, papel"),
      ]);
      const linhasPerfis = exigir(perfis, "perfis");
      const linhasPapeis = exigir(papeis, "papéis");

      const ultimoAcesso = new Map<string, string | null>();
      try {
        const servico = criarClienteServico("sessoes_diretoria");
        const { data, error } = await servico.auth.admin.listUsers({
          perPage: 1000,
        });
        if (!error) {
          for (const usuario of data.users)
            ultimoAcesso.set(usuario.id, usuario.last_sign_in_at ?? null);
        }
      } catch {
        // Sem a chave de serviço a tela mostra "sem registro" no último acesso.
      }

      return linhasPerfis.map((p): UsuarioSistema => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        ativo: p.ativo,
        papeis: linhasPapeis
          .filter((l) => l.usuario_id === p.id)
          .map((l) => l.papel)
          .filter(ehPapel),
        ultimoAcessoEm: ultimoAcesso.get(p.id) ?? null,
      }));
    },

    async convidarUsuario(pedido: PedidoConvite): Promise<ResultadoConvite> {
      const servico = criarClienteServico("convite_usuario");

      // 1. A conta nasce com o nome em app_metadata: o gatilho
      //    privado.criar_perfil_do_convite (0007) cria o perfil, sem papel.
      const criado = await servico.auth.admin.createUser({
        email: pedido.email,
        email_confirm: false,
        app_metadata: { nome: pedido.nome },
      });
      if (criado.error || !criado.data.user) {
        const mensagem = criado.error?.message ?? "";
        if (
          criado.error?.status === 422 ||
          /registered|exists/i.test(mensagem)
        ) {
          return { ok: false, erro: "email_em_uso" };
        }
        return { ok: false, erro: "indisponivel" };
      }
      const usuarioId = criado.data.user.id;

      // 2. Papéis: gravados pela sessão da diretoria (RLS de usuario_papel
      //    exige diretoria em AAL2), não pela chave de serviço.
      const papeis = await cliente
        .from("usuario_papel")
        .insert(
          pedido.papeis.map((papel) => ({ usuario_id: usuarioId, papel })),
        );
      if (papeis.error) {
        await servico.auth.admin.deleteUser(usuarioId);
        if (papeis.error.code === "42501")
          return { ok: false, erro: "sem_permissao" };
        throw new ErroRepositorio(
          "indisponivel",
          `convite: papéis: ${papeis.error.message}`,
        );
      }

      // 3. E-mail de convite com o link para definir a senha.
      const convite = await servico.auth.admin.inviteUserByEmail(pedido.email, {
        redirectTo: pedido.urlRetorno,
      });
      if (convite.error) return { ok: false, erro: "indisponivel" };

      return { ok: true, usuarioId };
    },

    async revogarSessoes(usuarioId) {
      await rpcPendente(cliente, "revogar_sessoes", { usuario_id: usuarioId });
    },
  };
}
