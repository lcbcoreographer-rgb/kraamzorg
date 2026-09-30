import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import {
  dataEmBrasilia,
  diferencaEmDias,
  eDataValida,
  hojeEmBrasilia,
  horaCurta,
  inicioDaSemana,
  somarDias,
} from "@/lib/agenda/datas";
import {
  acompanhamentoTerminou,
  conferirHorarioDoRegistro,
  conflitosVisita,
  situacaoDocumento,
  statusProfissional,
  turnoDaVisita,
  visitaMovivel,
  visitaOcupaAgenda,
  type AcompanhamentoRegra,
  type BloqueioRegra,
  type DesignacaoRegra,
  type VisitaRegra,
} from "@/lib/agenda/regras";
import { formatarIdadeGestacional } from "@/lib/formatacao";
import type {
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "@/lib/sync/tipos";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type { EquipeRepositorio, PortalRepositorio } from "../repositorios";
import type {
  AgendaPeriodo,
  BloqueioAgenda,
  CelulaEscala,
  ConflitoAgenda,
  DiaEscala,
  DocumentoProfissional,
  EquipeVisao,
  EscalaSemana,
  EstadoCelulaEscala,
  EstadoProfissional,
  FamiliaEmCurso,
  FamiliaPortal,
  FichaAssistencialPortal,
  PerfilPortal,
  PortalHoje,
  ProfissionalEquipe,
  ResultadoCascata,
  ResultadoReagendarVisita,
  TurnoVisita,
  VisitaAgenda,
  VisitaDaCascata,
  VisitaPortal,
} from "../tipos-equipe";
import {
  BEBES,
  DOCUMENTO_AVISO_DIAS,
  ENDERECOS,
  MEDICOS,
  PARAMETROS_AGENDA,
  PARAMETROS_EQUIPE,
  PROFISSIONAIS,
  acompanhamentosIniciais,
  bloqueiosIniciais,
  designacoesIniciais,
  documentosIniciais,
  visitasIniciais,
  type AcompanhamentoDemo,
  type BloqueioDemo,
  type DocumentoDemo,
  type ProfissionalDemo,
  type VisitaDemo,
} from "./equipe-fixtures";
import { REGIOES } from "./fixtures";
import { obterLoja } from "./loja";

/**
 * Equipe, agenda e portal da enfermeira no modo demonstração (P37 e P38):
 * as mesmas regras de 0022_agenda_portal.sql (a conta mora em
 * src/lib/agenda/regras.ts, com os mesmos casos do pgTAP 022) sobre uma
 * loja própria e as famílias da loja da fundação. O recorte por papel é o
 * mesmo, simplificado: a prova de permissão continua sendo o pgTAP.
 */

// --- Loja própria --------------------------------------------------------------

interface DesignacaoLoja {
  id: string;
  acompanhamentoId: string;
  profissionalId: string;
  papel: "titular" | "backup";
  status: "oferecida" | "aceita" | "recusada" | "expirada" | "cancelada";
  oferecidaEm: string;
}

export interface LojaEquipe {
  criadaEm: number;
  /** O "hoje" de quando a demonstração subiu (as visitas nascem dele). */
  hojeNaCriacao: string;
  profissionais: ProfissionalDemo[];
  documentos: DocumentoDemo[];
  bloqueios: BloqueioDemo[];
  acompanhamentos: AcompanhamentoDemo[];
  designacoes: DesignacaoLoja[];
  visitas: VisitaDemo[];
  notificacoes: { usuarioId: string; titulo: string; link: string }[];
  processados: Record<string, ResultadoItemSincronizacao>;
  proximo: number;
}

const CHAVE_GLOBAL = "__kraamzorgLojaEquipe";

export function criarLojaEquipe(agora = Date.now()): LojaEquipe {
  const hoje = hojeEmBrasilia(new Date(agora));
  return {
    criadaEm: agora,
    hojeNaCriacao: hoje,
    profissionais: structuredClone(PROFISSIONAIS),
    documentos: documentosIniciais(hoje),
    bloqueios: bloqueiosIniciais(hoje),
    acompanhamentos: acompanhamentosIniciais(hoje),
    designacoes: designacoesIniciais().map((d) => ({
      id: d.id,
      acompanhamentoId: d.acompanhamentoId,
      profissionalId: d.profissionalId,
      papel: d.papel,
      status: d.status,
      oferecidaEm: new Date(
        agora - d.oferecidaHaMinutos * 60_000,
      ).toISOString(),
    })),
    visitas: visitasIniciais(hoje),
    notificacoes: [],
    processados: {},
    proximo: 1,
  };
}

export function obterLojaEquipe(): LojaEquipe {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<
    string,
    LojaEquipe | undefined
  >;
  global[CHAVE_GLOBAL] ??= criarLojaEquipe();
  return global[CHAVE_GLOBAL];
}

/** Só para testes: volta ao estado das fixtures. */
export function reiniciarLojaEquipe(agora?: number): LojaEquipe {
  const global = globalThis as unknown as Record<
    string,
    LojaEquipe | undefined
  >;
  global[CHAVE_GLOBAL] = criarLojaEquipe(agora);
  return global[CHAVE_GLOBAL];
}

// --- Auxiliares ------------------------------------------------------------------

function recusar(codigo: string, detalhe = ""): never {
  throw new ErroRepositorio(
    "recusado",
    `demonstração: equipe:${codigo} ${detalhe}`.trim(),
  );
}

function semPermissao(motivo: string): never {
  throw new ErroRepositorio("sem_permissao", `demonstração: ${motivo}`);
}

const proximoId = (l: LojaEquipe, grupo: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${(1000 + l.proximo++).toString().padStart(12, "0")}`;

function familiaDe(familiaId: string) {
  return obterLoja().familias.find((f) => f.id === familiaId);
}

function regraAcompanhamentos(l: LojaEquipe): AcompanhamentoRegra[] {
  return l.acompanhamentos.map((a) => {
    const familia = familiaDe(a.familiaId);
    return {
      id: a.id,
      periodo: a.periodo,
      horasPorVisita: a.horasPorVisita,
      estado: a.estado,
      familiaDpp: familia?.dpp ?? null,
      familiaDataNascimento: familia?.dataNascimento ?? null,
    };
  });
}

function regraVisitas(l: LojaEquipe): VisitaRegra[] {
  return l.visitas.map((v) => ({
    id: v.id,
    acompanhamentoId: v.acompanhamentoId,
    profissionalId: v.profissionalId,
    diaNumero: v.diaNumero,
    data: v.data,
    horaPrevista: v.horaPrevista,
    estado: v.estado,
    checkinEm: v.checkinEm,
    checkoutEm: v.checkoutEm,
  }));
}

function regraDesignacoes(l: LojaEquipe): DesignacaoRegra[] {
  return l.designacoes.map((d) => ({
    profissionalId: d.profissionalId,
    acompanhamentoId: d.acompanhamentoId,
    papel: d.papel,
    status: d.status,
  }));
}

function regraBloqueios(l: LojaEquipe): BloqueioRegra[] {
  return l.bloqueios.map((b) => ({
    profissionalId: b.profissionalId,
    inicio: b.inicio,
    fim: b.fim,
  }));
}

function statusDe(
  l: LojaEquipe,
  profissionalId: string,
  dia: string,
  hoje: string,
): EstadoProfissional {
  return statusProfissional(
    { profissionalId, dia, hoje },
    regraVisitas(l),
    regraDesignacoes(l),
    regraAcompanhamentos(l),
    regraBloqueios(l),
    PARAMETROS_AGENDA,
  );
}

function diaAtual(
  l: LojaEquipe,
  acompanhamentoId: string,
  dia: string,
): number | null {
  const numeros = l.visitas
    .filter(
      (v) =>
        v.acompanhamentoId === acompanhamentoId &&
        v.data <= dia &&
        [
          "iniciada",
          "concluida",
          "ficha_pendente",
          "ficha_entregue",
          "encerrada",
        ].includes(v.estado),
    )
    .map((v) => v.diaNumero);
  return numeros.length > 0 ? Math.max(...numeros) : null;
}

function conflitosDe(
  l: LojaEquipe,
  entrada: {
    profissionalId: string;
    data: string;
    horaPrevista: string | null;
    acompanhamentoId: string;
    visitaId?: string | null;
  },
): ConflitoAgenda[] {
  const prof = l.profissionais.find((p) => p.id === entrada.profissionalId);
  return conflitosVisita(
    { ...entrada, profissionalAtiva: prof?.ativa ?? false },
    regraVisitas(l),
    regraBloqueios(l),
    regraAcompanhamentos(l),
    PARAMETROS_AGENDA,
  );
}

function avisar(l: LojaEquipe, profissionalIds: string[]) {
  for (const id of new Set(profissionalIds)) {
    const usuarioId = l.profissionais.find((p) => p.id === id)?.usuarioId;
    if (usuarioId) {
      l.notificacoes.push({
        usuarioId,
        titulo: "visita_reagendada",
        link: "/hoje",
      });
    }
  }
}

function registrarEventoVisita(familiaId: string, titulo: string) {
  const loja = obterLoja();
  loja.eventos.push({
    id: loja.proximoEvento++,
    familiaId,
    tipo: "estagio",
    titulo,
    restrito: true,
    criadoEm: new Date().toISOString(),
    dados: {},
  });
}

export interface ContextoEquipeDemonstracao {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

function criarContexto(contexto: ContextoEquipeDemonstracao) {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const bloqueadoPorMfa = () =>
    exigeMfa(contexto.papeis) && contexto.aal !== "aal2";
  return { tem, bloqueadoPorMfa };
}

// --- Equipe (P37) -------------------------------------------------------------------

export function criarEquipeDemonstracao(
  contexto: ContextoEquipeDemonstracao,
): EquipeRepositorio {
  const { tem, bloqueadoPorMfa } = criarContexto(contexto);

  function exigirCoordenacao(): LojaEquipe {
    if (
      !contexto.usuarioId ||
      bloqueadoPorMfa() ||
      !tem("coordenacao", "diretoria")
    ) {
      semPermissao("equipe é da coordenação e da diretoria");
    }
    return obterLojaEquipe();
  }

  function paraProfissionalEquipe(
    l: LojaEquipe,
    p: ProfissionalDemo,
    dia: string,
    hoje: string,
    semanaInicio: string,
  ): ProfissionalEquipe {
    const familias: FamiliaEmCurso[] = l.designacoes
      .filter((d) => d.profissionalId === p.id && d.status === "aceita")
      .flatMap((d) => {
        const a = l.acompanhamentos.find((x) => x.id === d.acompanhamentoId);
        const f = a ? familiaDe(a.familiaId) : undefined;
        if (!a || !f || acompanhamentoTerminou(a.estado)) return [];
        return [
          {
            familiaId: f.id,
            nomeExibicao: f.nome,
            papel: d.papel,
            acompanhamentoId: a.id,
            estado: a.estado as FamiliaEmCurso["estado"],
            diasContratados: a.diasContratados,
            diaAtual: diaAtual(l, a.id, dia),
            dpp: f.dpp,
            dataNascimento: f.dataNascimento,
          },
        ];
      })
      .sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"));

    const documentos: DocumentoProfissional[] = l.documentos
      .filter((d) => d.profissionalId === p.id)
      .map((d) => ({
        id: d.id,
        tipo: d.tipo,
        numero: d.numero,
        validade: d.validade,
        situacao: situacaoDocumento(d.validade, hoje, DOCUMENTO_AVISO_DIAS),
      }))
      .sort(
        (a, b) =>
          (a.validade ?? "9999-12-31").localeCompare(
            b.validade ?? "9999-12-31",
          ) || a.tipo.localeCompare(b.tipo, "pt-BR"),
      );

    const bloqueios: BloqueioAgenda[] = l.bloqueios
      .filter((b) => b.profissionalId === p.id && b.fim >= hoje)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map((b) => ({
        id: b.id,
        inicio: b.inicio,
        fim: b.fim,
        motivo: b.motivo,
      }));

    return {
      id: p.id,
      nome: p.nome,
      funcao: p.funcao,
      atendeVisitas: p.funcao !== "coordenacao",
      conselho: p.conselhoNumero ? "COREN" : null,
      conselhoUf: p.conselhoUf,
      conselhoNumero: p.conselhoNumero,
      telefoneE164: p.telefoneE164,
      regioes: [...p.regioes],
      vinculo: p.vinculo,
      valorHoraCentavos: p.valorHoraCentavos,
      adicionalDeslocamentoCentavos: p.adicionalDeslocamentoCentavos,
      ativa: p.ativa,
      temUsuario: p.usuarioId !== null,
      usuarioId: p.usuarioId,
      status: p.ativa ? statusDe(l, p.id, dia, hoje) : null,
      visitasNoDia: l.visitas.filter(
        (v) =>
          v.profissionalId === p.id &&
          v.data === dia &&
          visitaOcupaAgenda(v.estado),
      ).length,
      semana: p.ativa
        ? Array.from({ length: 7 }, (_, i) => {
            const d = somarDias(semanaInicio, i);
            return { dia: d, status: statusDe(l, p.id, d, hoje) };
          })
        : [],
      familias,
      ofertasPendentes: l.designacoes.filter(
        (d) => d.profissionalId === p.id && d.status === "oferecida",
      ).length,
      documentos,
      bloqueios,
    };
  }

  return {
    async obterEquipe(filtro = {}): Promise<EquipeVisao> {
      const l = exigirCoordenacao();
      const hoje = hojeEmBrasilia();
      const dia = filtro.dia ?? hoje;
      const semanaInicio = inicioDaSemana(dia);
      const doRecorte = l.profissionais.filter(
        (p) =>
          (p.ativa || filtro.incluirInativas === true) &&
          (!filtro.regiaoId || p.regioes.includes(filtro.regiaoId)),
      );
      const profissionais = doRecorte
        .map((p) => paraProfissionalEquipe(l, p, dia, hoje, semanaInicio))
        .sort(
          (a, b) =>
            a.nome.toLowerCase().localeCompare(b.nome.toLowerCase(), "pt-BR") ||
            a.id.localeCompare(b.id),
        );

      const conta = (estado: EstadoProfissional) =>
        profissionais.filter(
          (p) => p.ativa && p.atendeVisitas && p.status === estado,
        ).length;
      const ofertas = l.designacoes.filter((d) => {
        const prof = l.profissionais.find((p) => p.id === d.profissionalId);
        return (
          d.status === "oferecida" &&
          prof?.ativa &&
          (!filtro.regiaoId || prof.regioes.includes(filtro.regiaoId))
        );
      });
      const maisAntiga = ofertas.length
        ? Math.floor(
            (Date.now() -
              Math.min(...ofertas.map((d) => Date.parse(d.oferecidaEm)))) /
              3_600_000,
          )
        : null;
      const tipos = PARAMETROS_EQUIPE.documento_profissional_tipos;

      return {
        dia,
        hoje,
        semanaInicio,
        documentoAvisoDias: DOCUMENTO_AVISO_DIAS,
        limiteVisitasDia: PARAMETROS_AGENDA.visitasPorDia,
        documentoTipos: Array.isArray(tipos)
          ? tipos.filter((t): t is string => typeof t === "string")
          : [],
        resumo: {
          emVisita: conta("em_visita"),
          emAtendimento: conta("em_atendimento"),
          reservada: conta("reservada"),
          backup: conta("backup"),
          ofertaPendente: conta("oferta_pendente"),
          folga: conta("folga"),
          livre: conta("livre"),
          ofertaMaisAntigaHoras: maisAntiga,
        },
        profissionais,
      };
    },

    async obterEscala(filtro = {}): Promise<EscalaSemana> {
      if (
        !contexto.usuarioId ||
        bloqueadoPorMfa() ||
        !tem("enfermeira", "coordenacao", "diretoria")
      ) {
        semPermissao("escala");
      }
      const l = obterLojaEquipe();
      const todas = tem("coordenacao", "diretoria");
      const hoje = hojeEmBrasilia();
      const inicio = inicioDaSemana(filtro.semana ?? hoje);
      const p = PARAMETROS_AGENDA;
      const visitas = regraVisitas(l);
      const acomps = regraAcompanhamentos(l);

      const linhas = l.profissionais
        .filter(
          (pr) =>
            pr.ativa &&
            pr.funcao !== "coordenacao" &&
            (todas
              ? !filtro.regiaoId || pr.regioes.includes(filtro.regiaoId)
              : pr.usuarioId === contexto.usuarioId),
        )
        .sort((a, b) =>
          a.nome.toLowerCase().localeCompare(b.nome.toLowerCase(), "pt-BR"),
        )
        .map((pr) => {
          const dias: DiaEscala[] = Array.from({ length: 7 }, (_, i) => {
            const dia = somarDias(inicio, i);
            const folga = l.bloqueios.some(
              (b) =>
                b.profissionalId === pr.id && dia >= b.inicio && dia <= b.fim,
            );
            const doDia = visitas.filter(
              (v) =>
                v.profissionalId === pr.id &&
                v.data === dia &&
                visitaOcupaAgenda(v.estado),
            );
            let semTurno = doDia.length;
            const celula = (turno: TurnoVisita): CelulaEscala => {
              const nesteTurno = doDia.filter(
                (v) =>
                  turnoDaVisita(
                    v.horaPrevista,
                    acomps.find((a) => a.id === v.acompanhamentoId)?.periodo ??
                      null,
                    p,
                  ) === turno,
              );
              semTurno -= nesteTurno.length;
              const cabe = (acompanhamentoId: string) => {
                const periodo =
                  acomps.find((a) => a.id === acompanhamentoId)?.periodo ??
                  null;
                return (turnoDaVisita(null, periodo, p) ?? turno) === turno;
              };
              const naJanela = (acompanhamentoId: string) => {
                const dpp =
                  acomps.find((a) => a.id === acompanhamentoId)?.familiaDpp ??
                  null;
                return (
                  dpp !== null &&
                  dia >= somarDias(dpp, -p.janelaDpp.antes) &&
                  dia <= somarDias(dpp, p.janelaDpp.depois)
                );
              };
              let estado: EstadoCelulaEscala;
              if (nesteTurno.length > 0) estado = "visita";
              else if (folga) estado = "folga";
              else if (
                l.designacoes.some((d) => {
                  const a = acomps.find((x) => x.id === d.acompanhamentoId);
                  return (
                    d.profissionalId === pr.id &&
                    d.papel === "titular" &&
                    d.status === "aceita" &&
                    a?.estado === "aguardando" &&
                    a.familiaDataNascimento === null &&
                    naJanela(d.acompanhamentoId) &&
                    cabe(d.acompanhamentoId)
                  );
                })
              )
                estado = "reservada";
              else if (
                l.designacoes.some((d) => {
                  const a = acomps.find((x) => x.id === d.acompanhamentoId);
                  return (
                    d.profissionalId === pr.id &&
                    d.papel === "backup" &&
                    d.status === "aceita" &&
                    a !== undefined &&
                    !acompanhamentoTerminou(a.estado) &&
                    naJanela(d.acompanhamentoId) &&
                    cabe(d.acompanhamentoId)
                  );
                })
              )
                estado = "backup";
              else if (
                l.designacoes.some(
                  (d) =>
                    d.profissionalId === pr.id &&
                    d.status === "oferecida" &&
                    naJanela(d.acompanhamentoId) &&
                    cabe(d.acompanhamentoId),
                )
              )
                estado = "oferta";
              else estado = "livre";
              return {
                estado,
                visitas: nesteTurno.length,
                conflito:
                  nesteTurno.length > 1 || (nesteTurno.length > 0 && folga),
              };
            };
            const manha = celula("manha");
            const tarde = celula("tarde");
            return {
              dia,
              manha,
              tarde,
              visitas: doDia.length,
              semTurno,
              sobrecarga: doDia.length > p.visitasPorDia,
              folga,
            };
          });
          return { profissionalId: pr.id, nome: pr.nome, dias };
        });

      return {
        semanaInicio: inicio,
        limiteVisitasDia: p.visitasPorDia,
        profissionais: linhas,
      };
    },

    async obterAgenda(filtro): Promise<AgendaPeriodo> {
      const l = exigirCoordenacao();
      if (!filtro.desde || !filtro.ate || filtro.ate < filtro.desde)
        recusar("periodo_invalido");
      if (diferencaEmDias(filtro.desde, filtro.ate) > 62)
        recusar("periodo_longo");
      const visitas: VisitaAgenda[] = l.visitas
        .filter(
          (v) =>
            v.data >= filtro.desde &&
            v.data <= filtro.ate &&
            (!filtro.profissionalId ||
              v.profissionalId === filtro.profissionalId),
        )
        .map((v) => {
          const a = l.acompanhamentos.find((x) => x.id === v.acompanhamentoId);
          const f = a ? familiaDe(a.familiaId) : undefined;
          const pr = l.profissionais.find((x) => x.id === v.profissionalId);
          if (!a || !f || !pr) throw new Error("visita de demonstração órfã");
          return {
            visitaId: v.id,
            acompanhamentoId: a.id,
            familiaId: f.id,
            nomeExibicao: f.nome,
            bairro: f.bairro,
            cidade: f.cidade.nome,
            diaNumero: v.diaNumero,
            diasContratados: a.diasContratados,
            data: v.data,
            horaPrevista: horaCurta(v.horaPrevista),
            horasPorVisita: a.horasPorVisita,
            turno: turnoDaVisita(v.horaPrevista, a.periodo, PARAMETROS_AGENDA),
            estado: v.estado,
            profissionalId: pr.id,
            profissionalNome: pr.nome,
            movivel: visitaMovivel(v.estado),
            conflitos: visitaOcupaAgenda(v.estado)
              ? conflitosDe(l, {
                  profissionalId: pr.id,
                  data: v.data,
                  horaPrevista: v.horaPrevista,
                  acompanhamentoId: a.id,
                  visitaId: v.id,
                })
              : [],
          };
        })
        .sort(
          (a, b) =>
            a.data.localeCompare(b.data) ||
            (a.horaPrevista ?? "99:99").localeCompare(
              b.horaPrevista ?? "99:99",
            ) ||
            a.profissionalNome.localeCompare(b.profissionalNome, "pt-BR"),
        );
      return {
        desde: filtro.desde,
        ate: filtro.ate,
        limiteVisitasDia: PARAMETROS_AGENDA.visitasPorDia,
        visitas,
      };
    },

    async reagendarVisita(pedido): Promise<ResultadoReagendarVisita> {
      const l = exigirCoordenacao();
      if (!pedido.visitaId || !pedido.data)
        recusar("dados_obrigatorios", "visita_id e data");
      const visita = l.visitas.find((v) => v.id === pedido.visitaId);
      if (!visita) recusar("visita_inexistente");
      if (!visitaMovivel(visita.estado))
        recusar("visita_nao_movivel", visita.estado);
      const a = l.acompanhamentos.find((x) => x.id === visita.acompanhamentoId);
      if (!a) recusar("visita_inexistente");
      const hora = pedido.horaPrevista
        ? pedido.horaPrevista
        : visita.horaPrevista;
      const profissionalId = pedido.profissionalId || visita.profissionalId;
      if (
        profissionalId !== visita.profissionalId &&
        !l.designacoes.some(
          (d) =>
            d.acompanhamentoId === a.id &&
            d.profissionalId === profissionalId &&
            d.status === "aceita",
        )
      ) {
        recusar("sem_designacao");
      }
      const conflitos = conflitosDe(l, {
        profissionalId,
        data: pedido.data,
        horaPrevista: hora,
        acompanhamentoId: a.id,
        visitaId: visita.id,
      });
      if (pedido.simular) return { simulado: true, conflitos };

      const motivo = pedido.motivo?.trim() || null;
      if (conflitos.length > 0) {
        if (!pedido.forcar)
          recusar("conflito", conflitos.map((c) => c.codigo).join(","));
        if (!motivo) recusar("motivo_obrigatorio");
      }
      const antes = visita.profissionalId;
      visita.data = pedido.data;
      visita.horaPrevista = hora;
      visita.profissionalId = profissionalId;
      visita.estado = "agendada";
      visita.versao += 1;
      avisar(l, [profissionalId, antes]);
      registrarEventoVisita(a.familiaId, "Visita reagendada");
      return { simulado: false, conflitos };
    },

    async reagendarCascata(pedido): Promise<ResultadoCascata> {
      const l = exigirCoordenacao();
      const a = l.acompanhamentos.find((x) => x.id === pedido.acompanhamentoId);
      if (!pedido.acompanhamentoId || !pedido.novaDataInicio) {
        recusar("dados_obrigatorios", "acompanhamento_id e nova_data_inicio");
      }
      if (!a) recusar("acompanhamento_inexistente");
      const moviveis = l.visitas.filter(
        (v) => v.acompanhamentoId === a.id && visitaMovivel(v.estado),
      );
      if (moviveis.length === 0) recusar("nada_a_reagendar");
      const primeira = moviveis.reduce(
        (m, v) => (v.data < m ? v.data : m),
        moviveis[0]!.data,
      );
      const delta = diferencaEmDias(primeira, pedido.novaDataInicio);
      const motivo = pedido.motivo?.trim() || null;
      const ordem = [...moviveis].sort((x, y) =>
        delta >= 0 ? y.diaNumero - x.diaNumero : x.diaNumero - y.diaNumero,
      );

      const resultado: VisitaDaCascata[] = [];
      let total = 0;
      const planos: { visita: VisitaDemo; para: string }[] = [];
      for (const v of ordem) {
        const para = somarDias(v.data, delta);
        const conflitos = conflitosDe(l, {
          profissionalId: v.profissionalId,
          data: para,
          horaPrevista: v.horaPrevista,
          acompanhamentoId: a.id,
          visitaId: v.id,
        });
        total += conflitos.length;
        resultado.push({
          visitaId: v.id,
          diaNumero: v.diaNumero,
          de: v.data,
          para,
          horaPrevista: horaCurta(v.horaPrevista),
          profissionalId: v.profissionalId,
          conflitos,
        });
        if (!pedido.simular && delta !== 0) {
          if (conflitos.length > 0) {
            if (!pedido.forcar) recusar("conflito", `dia ${v.diaNumero}`);
            if (!motivo) recusar("motivo_obrigatorio");
          }
          planos.push({ visita: v, para });
        }
      }
      // só grava depois de conferir tudo: a recusa não deixa meia cascata
      for (const { visita, para } of planos) {
        visita.data = para;
        visita.estado = "agendada";
        visita.versao += 1;
      }
      if (!pedido.simular && delta !== 0) {
        avisar(
          l,
          moviveis.map((v) => v.profissionalId),
        );
        registrarEventoVisita(a.familiaId, "Visitas reagendadas em cascata");
      }
      return {
        simulado: pedido.simular === true,
        deslocamentoDias: delta,
        conflitosTotal: total,
        visitas: resultado.sort((x, y) => x.diaNumero - y.diaNumero),
      };
    },

    async salvarProfissional(pedido) {
      const l = exigirCoordenacao();
      const nome = pedido.nome.trim();
      if (!nome || nome.length > 120) recusar("nome_obrigatorio");
      if (
        ![
          "enfermeira_obstetrica",
          "enfermeira_neonatal",
          "coordenacao",
        ].includes(pedido.funcao)
      ) {
        recusar("funcao_invalida");
      }
      const tel = pedido.telefoneE164?.trim() || null;
      if (tel && !/^\+[1-9][0-9]{7,14}$/.test(tel))
        recusar("telefone_invalido");
      const numero = pedido.conselhoNumero?.trim() || null;
      const uf = pedido.conselhoUf?.trim().toUpperCase() || null;
      if ((numero === null) !== (uf === null)) recusar("conselho_incompleto");
      if (uf && !/^[A-Z]{2}$/.test(uf)) recusar("conselho_incompleto", "uf");
      const regioes = pedido.regioes ?? [];
      if (regioes.some((r) => !REGIOES.some((x) => x.id === r)))
        recusar("regiao_inexistente");
      if (
        (pedido.valorHoraCentavos ?? 0) < 0 ||
        (pedido.adicionalDeslocamentoCentavos ?? 0) < 0
      ) {
        recusar("valor_invalido");
      }
      if (
        pedido.usuarioId &&
        l.profissionais.some(
          (p) => p.usuarioId === pedido.usuarioId && p.id !== pedido.id,
        )
      ) {
        recusar("usuario_ja_vinculado");
      }
      const existente = pedido.id
        ? l.profissionais.find((p) => p.id === pedido.id)
        : undefined;
      const campos = {
        usuarioId: pedido.usuarioId ?? null,
        nome,
        funcao: pedido.funcao,
        conselhoUf: uf,
        conselhoNumero: numero,
        telefoneE164: tel,
        regioes: [...regioes],
        vinculo: pedido.vinculo,
        valorHoraCentavos: pedido.valorHoraCentavos ?? null,
        adicionalDeslocamentoCentavos:
          pedido.adicionalDeslocamentoCentavos ?? 0,
        ativa: pedido.ativa,
      };
      if (existente) {
        Object.assign(existente, campos);
        return { id: existente.id, nova: false };
      }
      const nova: ProfissionalDemo = { id: proximoId(l, 30), ...campos };
      l.profissionais.push(nova);
      return { id: nova.id, nova: true };
    },

    async salvarDocumento(pedido) {
      const l = exigirCoordenacao();
      const tipo = pedido.tipo.trim();
      if (!tipo || tipo.length > 80) recusar("tipo_obrigatorio");
      if (!l.profissionais.some((p) => p.id === pedido.profissionalId))
        recusar("profissional_inexistente");
      const existente = pedido.id
        ? l.documentos.find((d) => d.id === pedido.id)
        : undefined;
      if (existente) {
        if (existente.profissionalId !== pedido.profissionalId)
          recusar("documento_inexistente");
        existente.tipo = tipo;
        existente.numero = pedido.numero?.trim() || null;
        existente.validade = pedido.validade || null;
        return { id: existente.id };
      }
      const novo: DocumentoDemo = {
        id: pedido.id ?? proximoId(l, 34),
        profissionalId: pedido.profissionalId,
        tipo,
        numero: pedido.numero?.trim() || null,
        validade: pedido.validade || null,
      };
      l.documentos.push(novo);
      return { id: novo.id };
    },

    async salvarBloqueio(pedido) {
      const l = exigirCoordenacao();
      if (
        !pedido.inicio ||
        !pedido.fim ||
        !eDataValida(pedido.inicio) ||
        !eDataValida(pedido.fim) ||
        pedido.fim < pedido.inicio
      ) {
        recusar("periodo_invalido");
      }
      const motivo = pedido.motivo.trim();
      if (!motivo || motivo.length > 200) recusar("motivo_obrigatorio");
      if (!l.profissionais.some((p) => p.id === pedido.profissionalId))
        recusar("profissional_inexistente");
      const existente = pedido.id
        ? l.bloqueios.find((b) => b.id === pedido.id)
        : undefined;
      let id: string;
      if (existente) {
        if (existente.profissionalId !== pedido.profissionalId)
          recusar("bloqueio_inexistente");
        Object.assign(existente, {
          inicio: pedido.inicio,
          fim: pedido.fim,
          motivo,
        });
        id = existente.id;
      } else {
        id = pedido.id ?? proximoId(l, 35);
        l.bloqueios.push({
          id,
          profissionalId: pedido.profissionalId,
          inicio: pedido.inicio,
          fim: pedido.fim,
          motivo,
        });
      }
      const visitasAfetadas = l.visitas
        .filter(
          (v) =>
            v.profissionalId === pedido.profissionalId &&
            v.data >= pedido.inicio &&
            v.data <= pedido.fim &&
            visitaOcupaAgenda(v.estado) &&
            visitaMovivel(v.estado),
        )
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((v) => ({ visitaId: v.id, data: v.data, diaNumero: v.diaNumero }));
      return { id, visitasAfetadas };
    },

    async removerBloqueio(bloqueioId) {
      const l = exigirCoordenacao();
      const indice = l.bloqueios.findIndex((b) => b.id === bloqueioId);
      if (indice < 0) recusar("bloqueio_inexistente");
      l.bloqueios.splice(indice, 1);
    },
  };
}

// --- Portal da enfermeira (P38) ---------------------------------------------------

export function criarPortalDemonstracao(
  contexto: ContextoEquipeDemonstracao,
): PortalRepositorio {
  const { bloqueadoPorMfa, tem } = criarContexto(contexto);

  function exigirEnfermeira(): { l: LojaEquipe; pr: ProfissionalDemo } {
    if (!contexto.usuarioId || bloqueadoPorMfa() || !tem("enfermeira")) {
      semPermissao("o portal é da enfermeira");
    }
    const l = obterLojaEquipe();
    const pr = l.profissionais.find(
      (p) => p.usuarioId === contexto.usuarioId && p.ativa,
    );
    if (!pr) recusar("sem_profissional");
    return { l, pr };
  }

  /** Famílias atribuídas: designação aceita, acompanhamento não terminado ou terminado há pouco. */
  function acompanhamentosAtribuidos(
    l: LojaEquipe,
    pr: ProfissionalDemo,
  ): AcompanhamentoDemo[] {
    const prazo = Number(
      PARAMETROS_EQUIPE.acesso_enfermeira_pos_encerramento_dias ?? 0,
    );
    const hoje = hojeEmBrasilia();
    return l.acompanhamentos.filter((a) => {
      const aceita = l.designacoes.some(
        (d) =>
          d.acompanhamentoId === a.id &&
          d.profissionalId === pr.id &&
          d.status === "aceita",
      );
      if (!aceita) return false;
      if (!acompanhamentoTerminou(a.estado)) return true;
      return (
        a.encerramento !== null &&
        diferencaEmDias(a.encerramento, hoje) <= prazo
      );
    });
  }

  const idsFamilia = (l: LojaEquipe, pr: ProfissionalDemo) =>
    new Set(acompanhamentosAtribuidos(l, pr).map((a) => a.familiaId));

  function contato(familiaId: string) {
    const pessoas = obterLoja()
      .pessoas.filter((p) => p.familiaId === familiaId)
      .sort(
        (a, b) =>
          Number(b.contatoPrincipal) - Number(a.contatoPrincipal) ||
          Number(b.papel === "mae") - Number(a.papel === "mae"),
      );
    const p = pessoas[0];
    return { nome: p?.nome ?? null, telefone: p?.telefoneE164 ?? null };
  }

  function visitaDoPortal(
    l: LojaEquipe,
    pr: ProfissionalDemo,
    visitaId: string,
  ): VisitaDemo {
    const v = l.visitas.find((x) => x.id === visitaId);
    const a = v
      ? l.acompanhamentos.find((x) => x.id === v.acompanhamentoId)
      : undefined;
    if (
      !v ||
      !a ||
      v.profissionalId !== pr.id ||
      !idsFamilia(l, pr).has(a.familiaId)
    ) {
      semPermissao("visita não atribuída a esta profissional");
    }
    return v;
  }

  function horario(v: VisitaDemo, quando: string): Date {
    const instante = new Date(quando);
    if (Number.isNaN(instante.getTime())) recusar("hora_no_futuro");
    const erro = conferirHorarioDoRegistro(
      instante,
      new Date(),
      v.data,
      dataEmBrasilia(instante) ?? "",
      PARAMETROS_AGENDA,
    );
    if (erro) recusar(erro.codigo);
    return instante;
  }

  return {
    async obterHoje(dia): Promise<PortalHoje> {
      const { l, pr } = exigirEnfermeira();
      const hoje = hojeEmBrasilia();
      const alvo = dia ?? hoje;
      const familias = idsFamilia(l, pr);
      const visitas: VisitaPortal[] = l.visitas
        .filter((v) => {
          const a = l.acompanhamentos.find((x) => x.id === v.acompanhamentoId);
          return (
            v.profissionalId === pr.id &&
            v.data === alvo &&
            visitaOcupaAgenda(v.estado) &&
            a !== undefined &&
            familias.has(a.familiaId)
          );
        })
        .sort(
          (a, b) =>
            (a.horaPrevista ?? "99:99").localeCompare(
              b.horaPrevista ?? "99:99",
            ) || a.id.localeCompare(b.id),
        )
        .map((v) => {
          const a = l.acompanhamentos.find((x) => x.id === v.acompanhamentoId)!;
          const f = familiaDe(a.familiaId)!;
          const c = contato(f.id);
          const designacao = l.designacoes.find(
            (d) =>
              d.acompanhamentoId === a.id &&
              d.profissionalId === pr.id &&
              d.status === "aceita",
          );
          return {
            visitaId: v.id,
            acompanhamentoId: a.id,
            familiaId: f.id,
            nomeExibicao: f.nome,
            bairro: f.bairro,
            endereco: ENDERECOS[f.id] ?? null,
            cidade: f.cidade.nome,
            uf: f.cidade.uf,
            diaNumero: v.diaNumero,
            diasContratados: a.diasContratados,
            data: v.data,
            horaPrevista: horaCurta(v.horaPrevista),
            horasPorVisita: a.horasPorVisita,
            turno: turnoDaVisita(v.horaPrevista, a.periodo, PARAMETROS_AGENDA),
            estado: v.estado,
            checkinEm: v.checkinEm,
            checkoutEm: v.checkoutEm,
            versao: v.versao,
            papel: designacao?.papel ?? null,
            estadoSensivel: f.estadoSensivel,
            gemelar: f.gemelar,
            contatoNome: c.nome,
            contatoTelefone: c.telefone,
          };
        });

      const fichasPendentes = l.visitas
        .filter((v) => {
          const a = l.acompanhamentos.find((x) => x.id === v.acompanhamentoId);
          return (
            v.profissionalId === pr.id &&
            (v.estado === "concluida" || v.estado === "ficha_pendente") &&
            a !== undefined &&
            familias.has(a.familiaId)
          );
        })
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((v) => {
          const a = l.acompanhamentos.find((x) => x.id === v.acompanhamentoId)!;
          const f = familiaDe(a.familiaId)!;
          return {
            visitaId: v.id,
            familiaId: f.id,
            nomeExibicao: f.nome,
            diaNumero: v.diaNumero,
            diasContratados: a.diasContratados,
            data: v.data,
            estado: v.estado,
          };
        });

      return {
        dia: alvo,
        profissionalId: pr.id,
        profissionalNome: pr.nome,
        status: statusDe(l, pr.id, alvo, hoje),
        visitas,
        fichasPendentes,
      };
    },

    async listarFamilias(): Promise<FamiliaPortal[]> {
      const { l, pr } = exigirEnfermeira();
      const porFamilia = new Map<string, AcompanhamentoDemo>();
      for (const a of acompanhamentosAtribuidos(l, pr))
        porFamilia.set(a.familiaId, a);
      return [...porFamilia.values()]
        .map((a): FamiliaPortal => {
          const f = familiaDe(a.familiaId)!;
          const designacao = l.designacoes
            .filter(
              (d) =>
                d.acompanhamentoId === a.id &&
                d.profissionalId === pr.id &&
                d.status === "aceita",
            )
            .sort(
              (x, y) =>
                Number(y.papel === "titular") - Number(x.papel === "titular"),
            )[0];
          return {
            familiaId: f.id,
            nomeExibicao: f.nome,
            bairro: f.bairro,
            cidade: f.cidade.nome,
            uf: f.cidade.uf,
            dpp: f.dpp,
            dataNascimento: f.dataNascimento,
            dataAlta: f.dataAlta,
            dataInicioEfetivo: f.dataInicioEfetivo,
            gemelar: f.gemelar,
            estadoSensivel: f.estadoSensivel,
            papel: designacao?.papel ?? "titular",
            acompanhamento: {
              id: a.id,
              estado: a.estado as NonNullable<
                FamiliaPortal["acompanhamento"]
              >["estado"],
              diasContratados: a.diasContratados,
              periodo: a.periodo,
              inicioEfetivo: a.inicioEfetivo,
              encerramento: a.encerramento,
            },
            visitas: l.visitas
              .filter((v) => v.acompanhamentoId === a.id)
              .sort((x, y) => x.diaNumero - y.diaNumero)
              .map((v) => ({
                visitaId: v.id,
                diaNumero: v.diaNumero,
                data: v.data,
                horaPrevista: horaCurta(v.horaPrevista),
                estado: v.estado,
                checkinEm: v.checkinEm,
                checkoutEm: v.checkoutEm,
              })),
          };
        })
        .sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"));
    },

    async obterFichaAssistencial(
      familiaId,
    ): Promise<FichaAssistencialPortal | null> {
      const { l, pr } = exigirEnfermeira();
      if (!idsFamilia(l, pr).has(familiaId)) return null;
      const f = familiaDe(familiaId);
      if (!f) return null;
      const hoje = hojeEmBrasilia();
      let idadeGestacional: string | null = null;
      if (f.dpp && !f.dataNascimento) {
        const dias = diferencaEmDias(somarDias(f.dpp, -280), hoje);
        if (dias >= 0 && dias <= 44 * 7) {
          idadeGestacional = formatarIdadeGestacional(
            Math.trunc(dias / 7),
            dias % 7,
          );
        }
      }
      return {
        familia: {
          id: f.id,
          nomeExibicao: f.nome,
          bairro: f.bairro,
          endereco: ENDERECOS[f.id] ?? null,
          cidade: f.cidade.nome,
          uf: f.cidade.uf,
          dpp: f.dpp,
          idadeGestacional,
          dataNascimento: f.dataNascimento,
          dataAlta: f.dataAlta,
          dataInicioEfetivo: f.dataInicioEfetivo,
          gemelar: f.gemelar,
          estadoSensivel: f.estadoSensivel,
        },
        pessoas: obterLoja()
          .pessoas.filter((p) => p.familiaId === f.id)
          .sort(
            (a, b) => Number(b.contatoPrincipal) - Number(a.contatoPrincipal),
          )
          .map((p) => ({
            id: p.id,
            papel: p.papel,
            nome: p.nome,
            telefoneE164: p.telefoneE164,
            email: p.email,
            contatoPrincipal: p.contatoPrincipal,
          })),
        bebes: (BEBES[f.id] ?? []).map((b) => ({
          id: b.id,
          ordem: b.ordem,
          nome: b.nome,
          sexo: b.sexo,
          dataNascimento: f.dataNascimento,
          pesoNascimentoG: b.pesoNascimentoG,
          pesoAltaG: b.pesoAltaG,
          tipoParto: b.tipoParto,
        })),
        medicos: (MEDICOS[f.id] ?? []).map((m) => ({ ...m })),
      };
    },

    async obterPerfil(): Promise<PerfilPortal> {
      const { l, pr } = exigirEnfermeira();
      const hoje = hojeEmBrasilia();
      return {
        profissional: {
          id: pr.id,
          nome: pr.nome,
          funcao: pr.funcao,
          conselho: pr.conselhoNumero ? "COREN" : null,
          conselhoUf: pr.conselhoUf,
          conselhoNumero: pr.conselhoNumero,
          telefoneE164: pr.telefoneE164,
          regioes: [...pr.regioes],
        },
        status: statusDe(l, pr.id, hoje, hoje),
        documentos: l.documentos
          .filter((d) => d.profissionalId === pr.id)
          .map((d) => ({
            id: d.id,
            tipo: d.tipo,
            numero: d.numero,
            validade: d.validade,
            situacao: situacaoDocumento(d.validade, hoje, DOCUMENTO_AVISO_DIAS),
          }))
          .sort((a, b) =>
            (a.validade ?? "9999").localeCompare(b.validade ?? "9999"),
          ),
        bloqueios: l.bloqueios
          .filter((b) => b.profissionalId === pr.id && b.fim >= hoje)
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
          .map((b) => ({ id: b.id, inicio: b.inicio, fim: b.fim })),
      };
    },

    async estadoDaVisita(visitaId) {
      const { l, pr } = exigirEnfermeira();
      const v = l.visitas.find((x) => x.id === visitaId);
      if (!v || v.profissionalId !== pr.id) return null;
      return {
        visitaId: v.id,
        versao: v.versao,
        estado: v.estado,
        checkinEm: v.checkinEm,
        checkoutEm: v.checkoutEm,
      };
    },

    async registrarChegadaSincronizada(visitaId, quando) {
      const { l, pr } = exigirEnfermeira();
      const v = visitaDoPortal(l, pr, visitaId);
      if (v.checkinEm !== null) return { versao: v.versao };
      if (!["agendada", "confirmada", "a_caminho"].includes(v.estado)) {
        recusar("estado_nao_permite_chegada", v.estado);
      }
      const instante = horario(v, quando);
      v.checkinEm = instante.toISOString();
      v.estado = "iniciada";
      v.versao += 1;
      return { versao: v.versao };
    },

    async registrarSaidaSincronizada(visitaId, quando) {
      const { l, pr } = exigirEnfermeira();
      const v = visitaDoPortal(l, pr, visitaId);
      if (v.checkoutEm !== null) return { versao: v.versao };
      if (v.checkinEm === null || v.estado !== "iniciada") {
        recusar("saida_sem_chegada", v.estado);
      }
      const instante = horario(v, quando);
      if (instante.getTime() < Date.parse(v.checkinEm))
        recusar("saida_antes_da_chegada");
      v.checkoutEm = instante.toISOString();
      v.estado = "ficha_pendente";
      v.versao += 1;
      return { versao: v.versao };
    },

    async resultadoProcessado(itemId) {
      exigirEnfermeira();
      return obterLojaEquipe().processados[itemId] ?? null;
    },

    async guardarProcessado(item: ItemSincronizacaoEntrada, resultado) {
      exigirEnfermeira();
      obterLojaEquipe().processados[item.id] = resultado;
    },
  };
}
