import "server-only";
import { hojeEmBrasilia, somarDias } from "@/lib/agenda/datas";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { Regiao } from "@/lib/dados/tipos";
import type {
  AgendaPeriodo,
  EquipeVisao,
  EscalaSemana,
  LinhaEscala,
  ProfissionalEquipe,
  VisitaAgenda,
} from "@/lib/dados/tipos-equipe";
import type { SessaoVenda } from "@/lib/dados/tipos-venda";

/**
 * Dados das telas de equipe, escala e agenda (P37). Tudo passa pelo
 * EquipeRepositorio (api.* no Supabase, loja em memória na demonstração); o
 * estado da profissional vem sempre calculado do banco.
 */

export interface EquipeTela {
  visao: EquipeVisao;
  escala: EscalaSemana;
  regioes: Regiao[];
  /** Linha da escala por profissional, para o cartão mostrar a semana em turnos. */
  linhasPorProfissional: Map<string, LinhaEscala>;
}

export async function carregarEquipe(filtro: {
  regiaoId?: string | null;
  incluirInativas?: boolean;
}): Promise<EquipeTela> {
  const { equipe, configuracoes } = await obterRepositorios();
  const [visao, escala, regioes] = await Promise.all([
    equipe.obterEquipe({
      regiaoId: filtro.regiaoId,
      incluirInativas: filtro.incluirInativas,
    }),
    equipe.obterEscala({ regiaoId: filtro.regiaoId }),
    configuracoes.listarRegioes().catch(() => [] as Regiao[]),
  ]);
  return {
    visao,
    escala,
    regioes: regioes.filter((r) => r.ativa),
    linhasPorProfissional: new Map(
      escala.profissionais.map((l) => [l.profissionalId, l]),
    ),
  };
}

export interface EscalaTela {
  escala: EscalaSemana;
  regioes: Regiao[];
}

export async function carregarEscala(filtro: {
  semana?: string | null;
  regiaoId?: string | null;
}): Promise<EscalaTela> {
  const { equipe, configuracoes } = await obterRepositorios();
  const [escala, regioes] = await Promise.all([
    equipe.obterEscala(filtro),
    configuracoes.listarRegioes().catch(() => [] as Regiao[]),
  ]);
  return { escala, regioes: regioes.filter((r) => r.ativa) };
}

export interface DetalheProfissional {
  visao: EquipeVisao;
  profissional: ProfissionalEquipe;
  linhaEscala: LinhaEscala | null;
  regioes: Regiao[];
}

/** null quando a profissional não existe (ou a coordenação não a vê). */
export async function carregarProfissional(
  id: string,
): Promise<DetalheProfissional | null> {
  const { equipe, configuracoes } = await obterRepositorios();
  const [visao, escala, regioes] = await Promise.all([
    equipe.obterEquipe({ incluirInativas: true }),
    equipe.obterEscala({}),
    configuracoes.listarRegioes().catch(() => [] as Regiao[]),
  ]);
  const profissional = visao.profissionais.find((p) => p.id === id);
  if (!profissional) return null;
  return {
    visao,
    profissional,
    linhaEscala:
      escala.profissionais.find((l) => l.profissionalId === id) ?? null,
    regioes: regioes.filter((r) => r.ativa),
  };
}

/** Todas as regiões, para o cadastro (inclui as sem data). */
export async function listarRegioesParaCadastro(): Promise<Regiao[]> {
  const { configuracoes } = await obterRepositorios();
  return (await configuracoes.listarRegioes()).filter((r) => r.ativa);
}

export interface AgendaTela {
  agenda: AgendaPeriodo;
  sessoesDeVenda: SessaoVenda[];
  profissionais: { id: string; nome: string }[];
}

export async function carregarAgenda(filtro: {
  desde: string;
  ate: string;
  profissionalId?: string | null;
}): Promise<AgendaTela> {
  const { equipe, venda } = await obterRepositorios();
  const [agenda, visao] = await Promise.all([
    equipe.obterAgenda(filtro),
    equipe.obterEquipe({}),
  ]);
  // As conversas de orientação entram na agenda da coordenação e da
  // diretoria como compromissos (PRD 13): só as que ainda vão acontecer.
  const sessoesDeVenda = await venda
    .listarSessoes({
      desde: `${filtro.desde}T00:00:00-03:00`,
      ate: `${filtro.ate}T23:59:59-03:00`,
    })
    .then((s) => s.filter((x) => x.status === "agendada"))
    .catch(() => [] as SessaoVenda[]);
  return {
    agenda,
    sessoesDeVenda: filtro.profissionalId ? [] : sessoesDeVenda,
    profissionais: visao.profissionais
      .filter((p) => p.atendeVisitas)
      .map((p) => ({ id: p.id, nome: p.nome })),
  };
}

// --- Reagendar uma visita e a cascata de uma família -------------------------------

/** A janela em que as telas de reagendar procuram a visita (a agenda aceita até 62 dias). */
function janelaDeBusca(hoje: string) {
  return { desde: somarDias(hoje, -30), ate: somarDias(hoje, 31) };
}

export interface DadosVisita {
  visita: VisitaAgenda;
  /** Quem já aceitou esta família e pode receber a visita. */
  profissionais: { id: string; nome: string }[];
  hoje: string;
}

/** null quando a visita não está na janela de busca ou não existe. */
export async function carregarVisita(
  visitaId: string,
): Promise<DadosVisita | null> {
  const { equipe } = await obterRepositorios();
  const hoje = hojeEmBrasilia();
  const [agenda, visao] = await Promise.all([
    equipe.obterAgenda(janelaDeBusca(hoje)),
    equipe.obterEquipe({}),
  ]);
  const visita = agenda.visitas.find((v) => v.visitaId === visitaId);
  if (!visita) return null;
  const profissionais = visao.profissionais
    .filter(
      (p) =>
        p.ativa &&
        p.familias.some((f) => f.acompanhamentoId === visita.acompanhamentoId),
    )
    .map((p) => ({ id: p.id, nome: p.nome }));
  if (!profissionais.some((p) => p.id === visita.profissionalId)) {
    profissionais.unshift({
      id: visita.profissionalId,
      nome: visita.profissionalNome,
    });
  }
  return { visita, profissionais, hoje };
}

export interface DadosCascata {
  nomeFamilia: string;
  visitas: VisitaAgenda[];
  /** Data da primeira visita que ainda não começou; null sem visita a mover. */
  primeiraDataPendente: string | null;
  hoje: string;
}

export async function carregarCascata(
  acompanhamentoId: string,
): Promise<DadosCascata | null> {
  const { equipe } = await obterRepositorios();
  const hoje = hojeEmBrasilia();
  const agenda = await equipe.obterAgenda(janelaDeBusca(hoje));
  const visitas = agenda.visitas
    .filter((v) => v.acompanhamentoId === acompanhamentoId)
    .sort((a, b) => a.diaNumero - b.diaNumero);
  if (visitas.length === 0) return null;
  const pendentes = visitas.filter((v) => v.movivel).map((v) => v.data);
  return {
    nomeFamilia: visitas[0]!.nomeExibicao,
    visitas,
    primeiraDataPendente:
      pendentes.length > 0 ? pendentes.reduce((m, d) => (d < m ? d : m)) : null,
    hoje,
  };
}
