import "server-only";
import type { Json } from "@/lib/db/types";
import type { EquipeRepositorio } from "../repositorios";
import type {
  AgendaPeriodo,
  BloqueioAgenda,
  CelulaEscala,
  CodigoConflito,
  ConflitoAgenda,
  DiaEscala,
  DocumentoProfissional,
  EquipeVisao,
  EscalaSemana,
  EstadoProfissional,
  FamiliaEmCurso,
  ProfissionalEquipe,
  ResultadoCascata,
  ResultadoReagendarVisita,
  TurnoVisita,
  VisitaAgenda,
} from "../tipos-equipe";
import { exigir, type ContextoSupabase } from "./comum";

/**
 * Equipe, agenda e escalas na real (P37): tudo pelas funções do schema api
 * da 0022_agenda_portal.sql, com a sessão do usuário (papel e AAL2
 * conferidos por dentro de cada função). Os mapeamentos de banco para tela
 * ficam exportados para o teste sem banco.
 */

type Registro = Record<string, Json | undefined>;

export function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
export const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
export const numero = (v: Json | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0) || 0;
export const numeroOuNulo = (v: Json | undefined): number | null =>
  typeof v === "number" ? v : null;
export const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const textos = (v: Json | undefined): string[] =>
  lista(v).filter((i): i is string => typeof i === "string");

/** "08:00:00" do banco vira "08:00". */
export function horaDoBanco(v: Json | undefined): string | null {
  const t = texto(v);
  return t ? t.slice(0, 5) : null;
}

const CODIGOS_CONFLITO: readonly CodigoConflito[] = [
  "profissional_inativa",
  "bloqueio",
  "limite_visitas_dia",
  "periodo_diferente_do_d1",
  "sobreposicao",
];

export function conflitosDoBanco(valor: Json | undefined): ConflitoAgenda[] {
  return lista(valor).flatMap((item) => {
    const c = objeto(item);
    const codigo = texto(c.codigo) as CodigoConflito | null;
    if (!codigo || !CODIGOS_CONFLITO.includes(codigo)) return [];
    const saida: ConflitoAgenda = { codigo };
    if (typeof c.limite === "number") saida.limite = c.limite;
    if (typeof c.quantas === "number") saida.quantas = c.quantas;
    const turno = texto(c.turno);
    if (turno) saida.turno = turno;
    const referencia = texto(c.referencia);
    if (referencia) saida.referencia = referencia;
    const visitaId = texto(c.visita_id);
    if (visitaId) saida.visitaId = visitaId;
    return [saida];
  });
}

function documentoDoBanco(valor: Json): DocumentoProfissional {
  const d = objeto(valor);
  return {
    id: String(d.id),
    tipo: String(d.tipo ?? ""),
    numero: texto(d.numero),
    validade: texto(d.validade),
    situacao: (texto(d.situacao) ?? "sem_validade") as DocumentoProfissional["situacao"],
  };
}

function bloqueioDoBanco(valor: Json): BloqueioAgenda {
  const b = objeto(valor);
  return {
    id: String(b.id),
    inicio: String(b.inicio),
    fim: String(b.fim),
    motivo: String(b.motivo ?? ""),
  };
}

function familiaEmCursoDoBanco(valor: Json): FamiliaEmCurso {
  const f = objeto(valor);
  return {
    familiaId: String(f.familia_id),
    nomeExibicao: String(f.nome_exibicao ?? ""),
    papel: (texto(f.papel) ?? "titular") as FamiliaEmCurso["papel"],
    acompanhamentoId: String(f.acompanhamento_id),
    estado: (texto(f.estado) ?? "ativo") as FamiliaEmCurso["estado"],
    diasContratados: numero(f.dias_contratados),
    diaAtual: numeroOuNulo(f.dia_atual),
    dpp: texto(f.dpp),
    dataNascimento: texto(f.data_nascimento),
  };
}

export function profissionalDoBanco(valor: Json): ProfissionalEquipe {
  const p = objeto(valor);
  return {
    id: String(p.id),
    nome: String(p.nome ?? ""),
    funcao: String(p.funcao ?? ""),
    atendeVisitas: p.atende_visitas !== false,
    conselho: texto(p.conselho),
    conselhoUf: texto(p.conselho_uf),
    conselhoNumero: texto(p.conselho_numero),
    telefoneE164: texto(p.telefone_e164),
    regioes: textos(p.regioes),
    vinculo: (texto(p.vinculo) ?? "a_definir") as ProfissionalEquipe["vinculo"],
    valorHoraCentavos: numeroOuNulo(p.valor_hora_centavos),
    adicionalDeslocamentoCentavos: numero(p.adicional_deslocamento_centavos),
    ativa: p.ativa === true,
    temUsuario: p.tem_usuario === true,
    usuarioId: texto(p.usuario_id),
    status: (texto(p.status) as EstadoProfissional | null) ?? null,
    visitasNoDia: numero(p.visitas_no_dia),
    semana: lista(p.semana).map((d) => {
      const x = objeto(d);
      return {
        dia: String(x.dia),
        status: (texto(x.status) ?? "livre") as EstadoProfissional,
      };
    }),
    familias: lista(p.familias).map(familiaEmCursoDoBanco),
    ofertasPendentes: numero(p.ofertas_pendentes),
    documentos: lista(p.documentos).map(documentoDoBanco),
    bloqueios: lista(p.bloqueios).map(bloqueioDoBanco),
  };
}

export function equipeDoBanco(valor: Json): EquipeVisao {
  const e = objeto(valor);
  const r = objeto(e.resumo);
  return {
    dia: String(e.dia),
    hoje: String(e.hoje),
    semanaInicio: String(e.semana_inicio),
    documentoAvisoDias: numero(e.documento_aviso_dias),
    limiteVisitasDia: numero(e.limite_visitas_dia),
    documentoTipos: textos(e.documento_tipos),
    resumo: {
      emVisita: numero(r.em_visita),
      emAtendimento: numero(r.em_atendimento),
      reservada: numero(r.reservada),
      backup: numero(r.backup),
      ofertaPendente: numero(r.oferta_pendente),
      folga: numero(r.folga),
      livre: numero(r.livre),
      ofertaMaisAntigaHoras: numeroOuNulo(r.oferta_mais_antiga_horas),
    },
    profissionais: lista(e.profissionais).map(profissionalDoBanco),
  };
}

function celulaDoBanco(valor: Json | undefined): CelulaEscala {
  const c = objeto(valor);
  return {
    estado: (texto(c.estado) ?? "livre") as CelulaEscala["estado"],
    visitas: numero(c.visitas),
    conflito: c.conflito === true,
  };
}

export function escalaDoBanco(valor: Json): EscalaSemana {
  const e = objeto(valor);
  return {
    semanaInicio: String(e.semana_inicio),
    limiteVisitasDia: numero(e.limite_visitas_dia),
    profissionais: lista(e.profissionais).map((item) => {
      const p = objeto(item);
      return {
        profissionalId: String(p.profissional_id),
        nome: String(p.nome ?? ""),
        dias: lista(p.dias).map((dia): DiaEscala => {
          const d = objeto(dia);
          const turnos = objeto(d.turnos);
          return {
            dia: String(d.dia),
            manha: celulaDoBanco(turnos.manha),
            tarde: celulaDoBanco(turnos.tarde),
            visitas: numero(d.visitas),
            semTurno: numero(d.sem_turno),
            sobrecarga: d.sobrecarga === true,
            folga: d.folga === true,
          };
        }),
      };
    }),
  };
}

export function agendaDoBanco(valor: Json): AgendaPeriodo {
  const a = objeto(valor);
  return {
    desde: String(a.desde),
    ate: String(a.ate),
    limiteVisitasDia: numero(a.limite_visitas_dia),
    visitas: lista(a.visitas).map((item): VisitaAgenda => {
      const v = objeto(item);
      return {
        visitaId: String(v.visita_id),
        acompanhamentoId: String(v.acompanhamento_id),
        familiaId: String(v.familia_id),
        nomeExibicao: String(v.nome_exibicao ?? ""),
        bairro: texto(v.bairro),
        cidade: texto(v.cidade),
        diaNumero: numero(v.dia_numero),
        diasContratados: numero(v.dias_contratados),
        data: String(v.data),
        horaPrevista: horaDoBanco(v.hora_prevista),
        horasPorVisita: numero(v.horas_por_visita),
        turno: texto(v.turno) as TurnoVisita | null,
        estado: (texto(v.estado) ?? "agendada") as VisitaAgenda["estado"],
        profissionalId: String(v.profissional_id),
        profissionalNome: String(v.profissional_nome ?? ""),
        movivel: v.movivel === true,
        conflitos: conflitosDoBanco(v.conflitos),
      };
    }),
  };
}

export function resultadoVisitaDoBanco(valor: Json): ResultadoReagendarVisita {
  const r = objeto(valor);
  return { simulado: r.simulado === true, conflitos: conflitosDoBanco(r.conflitos) };
}

export function cascataDoBanco(valor: Json): ResultadoCascata {
  const r = objeto(valor);
  return {
    simulado: r.simulado === true,
    deslocamentoDias: numero(r.deslocamento_dias),
    conflitosTotal: numero(r.conflitos_total),
    visitas: lista(r.visitas).map((item) => {
      const v = objeto(item);
      return {
        visitaId: String(v.visita_id),
        diaNumero: numero(v.dia_numero),
        de: String(v.de),
        para: String(v.para),
        horaPrevista: horaDoBanco(v.hora_prevista),
        profissionalId: String(v.profissional_id),
        conflitos: conflitosDoBanco(v.conflitos),
      };
    }),
  };
}

export function criarEquipeSupabase(contexto: ContextoSupabase): EquipeRepositorio {
  const api = () => contexto.cliente.schema("api");

  return {
    async obterEquipe(filtro = {}) {
      return equipeDoBanco(
        exigir(
          await api().rpc("equipe", {
            regiao_id: filtro.regiaoId ?? undefined,
            dia: filtro.dia ?? undefined,
            incluir_inativas: filtro.incluirInativas ?? undefined,
          }),
          "api.equipe",
        ),
      );
    },

    async obterEscala(filtro = {}) {
      return escalaDoBanco(
        exigir(
          await api().rpc("escala_semanal", {
            semana: filtro.semana ?? undefined,
            regiao_id: filtro.regiaoId ?? undefined,
          }),
          "api.escala_semanal",
        ),
      );
    },

    async obterAgenda(filtro) {
      return agendaDoBanco(
        exigir(
          await api().rpc("agenda", {
            desde: filtro.desde,
            ate: filtro.ate,
            profissional_id: filtro.profissionalId ?? undefined,
          }),
          "api.agenda",
        ),
      );
    },

    async reagendarVisita(pedido) {
      return resultadoVisitaDoBanco(
        exigir(
          await api().rpc("reagendar_visita", {
            visita_id: pedido.visitaId,
            data: pedido.data,
            hora_prevista: pedido.horaPrevista || undefined,
            profissional_id: pedido.profissionalId || undefined,
            motivo: pedido.motivo || undefined,
            simular: pedido.simular ?? false,
            forcar: pedido.forcar ?? false,
          }),
          "api.reagendar_visita",
        ),
      );
    },

    async reagendarCascata(pedido) {
      return cascataDoBanco(
        exigir(
          await api().rpc("reagendar_cascata", {
            acompanhamento_id: pedido.acompanhamentoId,
            nova_data_inicio: pedido.novaDataInicio,
            motivo: pedido.motivo || undefined,
            simular: pedido.simular ?? false,
            forcar: pedido.forcar ?? false,
          }),
          "api.reagendar_cascata",
        ),
      );
    },

    async salvarProfissional(pedido) {
      const r = objeto(
        exigir(
          await api().rpc("salvar_profissional", {
            id: pedido.id ?? (null as unknown as string),
            nome: pedido.nome,
            funcao: pedido.funcao,
            conselho_uf: pedido.conselhoUf ?? (null as unknown as string),
            conselho_numero: pedido.conselhoNumero ?? (null as unknown as string),
            telefone_e164: pedido.telefoneE164 ?? (null as unknown as string),
            regioes: pedido.regioes,
            vinculo: pedido.vinculo,
            valor_hora_centavos: pedido.valorHoraCentavos ?? (null as unknown as number),
            adicional_deslocamento_centavos: pedido.adicionalDeslocamentoCentavos ?? 0,
            ativa: pedido.ativa,
            usuario_id: pedido.usuarioId ?? undefined,
          }),
          "api.salvar_profissional",
        ),
      );
      return { id: String(r.id), nova: r.nova === true };
    },

    async salvarDocumento(pedido) {
      const r = objeto(
        exigir(
          await api().rpc("salvar_documento_profissional", {
            id: pedido.id ?? (null as unknown as string),
            profissional_id: pedido.profissionalId,
            tipo: pedido.tipo,
            numero: pedido.numero ?? (null as unknown as string),
            validade: pedido.validade ?? (null as unknown as string),
          }),
          "api.salvar_documento_profissional",
        ),
      );
      return { id: String(r.id) };
    },

    async salvarBloqueio(pedido) {
      const r = objeto(
        exigir(
          await api().rpc("salvar_bloqueio_agenda", {
            id: pedido.id ?? (null as unknown as string),
            profissional_id: pedido.profissionalId,
            inicio: pedido.inicio,
            fim: pedido.fim,
            motivo: pedido.motivo,
          }),
          "api.salvar_bloqueio_agenda",
        ),
      );
      return {
        id: String(r.id),
        visitasAfetadas: lista(r.visitas_afetadas).map((item) => {
          const v = objeto(item);
          return {
            visitaId: String(v.visita_id),
            data: String(v.data),
            diaNumero: numero(v.dia_numero),
          };
        }),
      };
    },

    async removerBloqueio(bloqueioId) {
      exigir(
        await api().rpc("remover_bloqueio_agenda", { id: bloqueioId }),
        "api.remover_bloqueio_agenda",
      );
    },
  };
}
