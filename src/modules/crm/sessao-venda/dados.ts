import "server-only";
import type { Papel } from "@/lib/auth/papeis";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio, codigoVenda } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  Condutor,
  GravacaoSessao,
  SessaoVenda,
  TransferenciaReuniao,
} from "@/lib/dados/tipos-venda";
import type { Transferencia } from "@/lib/dados/tipos";
import { aplicarTexto } from "@/lib/messaging/aplicar-texto";
import { obterFichaTela } from "../ficha/dados";
import type { FichaTela } from "../ficha/tipos";
import { resumoIaLigado } from "./ia";

/**
 * Dados das telas de sessão de venda (P29). Tudo passa pelo
 * VendaRepositorio (api.* no Supabase, loja em memória na demonstração);
 * a regra de quem vê a gravação mora no banco (api.sessao_venda_gravacao
 * recusa quem não conduziu e não é diretoria, e registra a leitura), e a
 * tela só não oferece o que o papel não vai conseguir abrir.
 */

export function temPapel(sessao: SessaoUsuario, ...papeis: Papel[]) {
  return papeis.some((papel) => sessao.papeis.includes(papel));
}

/** Quem marca, remarca e registra o desfecho (PRD 13: comercial e diretoria). */
export function podeConduzirAgenda(sessao: SessaoUsuario): boolean {
  return temPapel(sessao, "comercial", "diretoria");
}

/**
 * [v4.3, D-20] Quem registra que a reunião aconteceu ou que a família não
 * veio: a Edilaine (coordenação) e a diretoria. O registro passa a conversa
 * ao Leonardo (humano_comercial).
 */
export function podeRegistrarReuniao(sessao: SessaoUsuario): boolean {
  return temPapel(sessao, "coordenacao", "diretoria");
}

/** Cancelar vale só para reunião marcada pela equipe (a da Isadora vive no calendário). */
export function podeCancelarReuniao(
  sessao: SessaoUsuario,
  reuniao: Pick<SessaoVenda, "agendadaPor">,
): boolean {
  return (
    reuniao.agendadaPor === "humano" &&
    temPapel(sessao, "comercial", "coordenacao", "diretoria")
  );
}

export async function listarSessoesTela(): Promise<SessaoVenda[]> {
  const { venda } = await obterRepositorios();
  return venda.listarSessoes();
}

export async function obterSessaoTela(
  sessaoId: string,
): Promise<SessaoVenda | null> {
  const { venda } = await obterRepositorios();
  const [sessao] = await venda.listarSessoes({ sessaoId });
  return sessao ?? null;
}

/** Pedidos de conversa da Isadora (transferências "reuniao" abertas). */
export async function listarPedidosDeConversa(): Promise<Transferencia[]> {
  const { agente } = await obterRepositorios();
  const abertas = await agente.listarTransferencias({
    status: ["aberto", "assumido"],
  });
  return abertas.filter((t) => t.motivo === "reuniao" && t.familiaId);
}

export interface DadosAgendar {
  familia: FichaTela;
  transferencia: TransferenciaReuniao | null;
  condutores: Condutor[];
  /** Conversa já marcada para a família (a tela oferece abrir e remarcar). */
  marcada: SessaoVenda | null;
}

export async function obterDadosAgendar(pedido: {
  transferenciaId?: string | null;
  familiaId?: string | null;
}): Promise<DadosAgendar | null> {
  const { venda } = await obterRepositorios();
  const transferencia = pedido.transferenciaId
    ? await venda.obterTransferenciaReuniao(pedido.transferenciaId)
    : null;
  const familiaId = transferencia?.familiaId ?? pedido.familiaId ?? null;
  if (!familiaId) return null;

  const [familia, condutores, sessoes] = await Promise.all([
    obterFichaTela(familiaId),
    venda.listarCondutores(),
    venda.listarSessoes({ familiaId }),
  ]);
  if (!familia) return null;
  return {
    familia,
    transferencia,
    condutores,
    marcada: sessoes.find((s) => s.status === "agendada") ?? null,
  };
}

export async function listarCondutoresTela(): Promise<Condutor[]> {
  const { venda } = await obterRepositorios();
  return venda.listarCondutores();
}

export type LeituraGravacao =
  | { situacao: "ok"; gravacao: GravacaoSessao | null }
  | { situacao: "fechada" }
  | { situacao: "mfa" };

/**
 * A gravação só é pedida ao banco por quem pode vê-la (quem conduziu ou a
 * diretoria) e em AAL2; cada leitura fica registrada lá. Para os demais,
 * nada é lido: a tela diz de quem é a gravação.
 */
export async function lerGravacaoTela(
  sessao: SessaoVenda,
  usuario: SessaoUsuario,
): Promise<LeituraGravacao> {
  if (!sessao.podeVerGravacao) return { situacao: "fechada" };
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  try {
    const { venda } = await obterRepositorios();
    return { situacao: "ok", gravacao: await venda.obterGravacao(sessao.id) };
  } catch (erro) {
    // Já em AAL2: a recusa do banco aqui é de quem não conduziu (0007,
    // api.sessao_venda_gravacao, 42501) ou da regra da venda.
    if (
      codigoVenda(erro) === "so_quem_conduziu" ||
      (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao")
    ) {
      return { situacao: "fechada" };
    }
    throw erro;
  }
}

/** Texto do termo de gravação (mensagem_modelo sessao_termo_gravacao). */
export async function obterTermoGravacao(): Promise<string | null> {
  const { configuracoes } = await obterRepositorios();
  const modelo = await configuracoes
    .obterMensagemModelo("sessao_termo_gravacao")
    .catch(() => null);
  return modelo ? aplicarTexto(modelo.texto, null, {}) : null;
}

export { resumoIaLigado };
