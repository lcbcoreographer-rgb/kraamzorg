import "server-only";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { traduzirErroBanco } from "@/lib/dados/erros";
import { modoDados } from "@/lib/dados/modo";
import type { CanalNotificacao, NotificacaoInterna } from "./tipos";

/**
 * Central de notificação (PRD 6.7 e item 3 do P18). A tabela `notificacao`
 * já tem RLS pronta desde 0007_permissoes.sql (usuário dono, papel sem
 * dono definido, ou diretoria; update só de `lida_em`) — lê e marca como
 * lida direto pelo cliente de servidor, sem RPC. Quem cria a notificação é
 * o sistema (comentário da própria migration): as automações do banco
 * (P20) ou a rota `POST /api/interno/notificar` (item 4 deste prompt),
 * nunca a tela.
 *
 * Sem componente próprio montado ainda (a barra/cabeçalho é do P10,
 * `src/components/shell`, fora das pastas deste módulo): estas funções
 * ficam prontas para quem montar o sino da central importar.
 */
export async function listarNotificacoes(): Promise<NotificacaoInterna[]> {
  if (modoDados() === "demonstracao") {
    return listarNotificacoesDemonstracao();
  }
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("notificacao")
    .select("id, usuario_id, papel, prioridade, titulo, corpo, link, canais, lida_em, criado_em")
    .order("criado_em", { ascending: false })
    .limit(50);
  if (resposta.error) throw traduzirErroBanco(resposta.error, "listar notificações");
  return resposta.data.map((n) => ({
    id: n.id,
    usuarioId: n.usuario_id,
    papel: n.papel,
    prioridade: n.prioridade,
    titulo: n.titulo,
    corpo: n.corpo,
    link: n.link,
    canais: n.canais as CanalNotificacao[],
    lidaEm: n.lida_em,
    criadaEm: n.criado_em,
  }));
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  if (modoDados() === "demonstracao") {
    return marcarNotificacaoLidaDemonstracao(id);
  }
  const cliente = await criarClienteServidor();
  const resposta = await cliente
    .from("notificacao")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id);
  if (resposta.error) throw traduzirErroBanco(resposta.error, "marcar notificação como lida");
}

// --- Demonstração: sem tabela na loja da fundação (LojaDemonstracao não tem
// `notificacao`), guarda em memória própria deste módulo. -------------------

const notificacoesDemo: NotificacaoInterna[] = [];

/** Só para testes: repõe o estado da central de demonstração. */
export function reiniciarNotificacoesDemoParaTestes(): void {
  notificacoesDemo.length = 0;
}

/** Usado pela rota `/api/interno/notificar` e pelas automações de teste. */
export function registrarNotificacaoDemo(
  notificacao: Omit<NotificacaoInterna, "id" | "criadaEm" | "lidaEm">,
): NotificacaoInterna {
  const registro: NotificacaoInterna = {
    ...notificacao,
    id: crypto.randomUUID(),
    criadaEm: new Date().toISOString(),
    lidaEm: null,
  };
  notificacoesDemo.unshift(registro);
  return registro;
}

async function listarNotificacoesDemonstracao(): Promise<NotificacaoInterna[]> {
  const sessao = await obterSessao();
  if (!sessao) return [];
  return notificacoesDemo.filter(
    (n) =>
      n.usuarioId === sessao.usuarioId ||
      (n.usuarioId === null && n.papel !== null && sessao.papeis.includes(n.papel)) ||
      sessao.papeis.includes("diretoria"),
  );
}

async function marcarNotificacaoLidaDemonstracao(id: string): Promise<void> {
  const notificacao = notificacoesDemo.find((n) => n.id === id);
  if (notificacao) notificacao.lidaEm = new Date().toISOString();
}
