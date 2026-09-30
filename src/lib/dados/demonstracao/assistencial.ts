import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import { conferirAssinatura } from "@/lib/checklist/assinatura";
import {
  bebesDoFormulario,
  dadosParaRespostas,
  pendenciasDoRegistro,
} from "@/lib/checklist/registro";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  AlertaClinicoResumo,
  AlertaDaVisita,
  AssistencialRepositorio,
  ChecklistVisita,
  RegistroAnterior,
  RegistroAssinado,
  SituacaoAlertas,
} from "../tipos-assistencial";
import {
  alertasIniciais,
  BEBES_DEMO,
  DEFINICAO_DOC2,
  DEFINICAO_DOC4,
  FAMILIAS_DEMO,
  MEDICOS_DEMO,
  parametrosDemo,
  PROFISSIONAL_ENFERMEIRA,
  PROFISSIONAL_OUTRA,
  regrasDoDoc3,
  registrosIniciais,
  VERSAO_INSTRUMENTO,
  VISITAS_DEMO,
  type AlertaDemoAssistencial,
  type LojaAssistencial,
  type VisitaDemoAssistencial,
} from "./assistencial-fixtures";

/**
 * Checklist e alertas no modo demonstração (P39 e P40): as mesmas regras de
 * 0023_checklist_alertas.sql sobre uma loja em memória. A prova de
 * permissão e de append-only continua sendo o pgTAP (023); aqui o recorte
 * por papel é o mesmo, simplificado, para as telas e o e2e rodarem sem
 * Supabase. Mesmas recusas, com o mesmo código `checklist:<código>` na
 * mensagem, para a tela tratar as duas implementações do mesmo jeito.
 */

export interface ContextoDemonstracaoAssistencial {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

const CHAVE_GLOBAL = "__kraamzorgLojaAssistencial";

function criarLoja(): LojaAssistencial {
  const bebes = BEBES_DEMO();
  const visitas = VISITAS_DEMO();
  return {
    familias: FAMILIAS_DEMO(),
    bebes,
    visitas,
    registros: registrosIniciais(visitas, bebes),
    alertas: alertasIniciais(),
    medicos: MEDICOS_DEMO(),
    tarefas: [],
    audios: [],
    ocorrenciasPrivadas: [],
    avisosCoordenacao: [],
    regras: regrasDoDoc3(),
    parametros: parametrosDemo(),
  };
}

/** Loja do processo (sobrevive à recarga de módulo do `next dev`). */
export function obterLojaAssistencial(): LojaAssistencial {
  garantirDemonstracaoPermitida();
  const g = globalThis as unknown as Record<string, LojaAssistencial>;
  g[CHAVE_GLOBAL] ??= criarLoja();
  return g[CHAVE_GLOBAL]!;
}

/** Só para teste: volta a loja ao começo. */
export function reiniciarLojaAssistencial(): void {
  const g = globalThis as unknown as Record<string, LojaAssistencial>;
  g[CHAVE_GLOBAL] = criarLoja();
}

function recusa(codigo: string, detalhe = ""): ErroRepositorio {
  return new ErroRepositorio(
    "recusado",
    `checklist:${codigo} ${detalhe}`.trim(),
  );
}

function novoId(): string {
  return crypto.randomUUID();
}

export function criarAssistencialDemonstracao(
  contexto: ContextoDemonstracaoAssistencial,
): AssistencialRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const loja = () => obterLojaAssistencial();

  function exigirSessao(...papeis: Papel[]): string {
    if (!contexto.usuarioId) {
      throw new ErroRepositorio("sem_permissao", "demonstração: sem sessão");
    }
    if (exigeMfa(contexto.papeis) && contexto.aal !== "aal2") {
      throw new ErroRepositorio("sem_permissao", "demonstração: exige MFA");
    }
    if (papeis.length > 0 && !tem(...papeis)) {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: papel sem acesso",
      );
    }
    return contexto.usuarioId;
  }

  const profissionalDoUsuario = () =>
    [PROFISSIONAL_ENFERMEIRA, PROFISSIONAL_OUTRA].find(
      (p) => p.usuarioId === contexto.usuarioId,
    );

  function veTudo(): boolean {
    return tem("coordenacao", "diretoria");
  }

  function visitaVisivel(visitaId: string): VisitaDemoAssistencial | null {
    const v = loja().visitas.find((x) => x.id === visitaId);
    if (!v) return null;
    if (veTudo()) return v;
    const proprio = profissionalDoUsuario();
    return proprio && proprio.id === v.profissionalId ? v : null;
  }

  function familiaVisivel(familiaId: string): boolean {
    if (veTudo()) return true;
    const proprio = profissionalDoUsuario();
    return Boolean(
      proprio &&
      loja().visitas.some(
        (v) => v.familiaId === familiaId && v.profissionalId === proprio.id,
      ),
    );
  }

  function criarAlerta(entrada: {
    visita: VisitaDemoAssistencial;
    regraId: string;
    bebeId: string | null;
    campo: string | null;
    valor: string | null;
    manual: boolean;
  }): { id: string; criado: boolean } {
    const l = loja();
    const regra = l.regras.find((r) => r.id === entrada.regraId);
    if (!regra) throw recusa("regra_inexistente", entrada.regraId);
    if (!entrada.manual && !regra.ativa) {
      throw recusa("regra_inativa", entrada.regraId);
    }
    if (
      entrada.bebeId &&
      !l.bebes.some(
        (b) =>
          b.id === entrada.bebeId && b.familiaId === entrada.visita.familiaId,
      )
    ) {
      throw recusa("bebe_de_outra_familia");
    }
    const existente = l.alertas.find(
      (a) =>
        a.visitaId === entrada.visita.id &&
        a.regraId === entrada.regraId &&
        (a.bebeId ?? "") === (entrada.bebeId ?? ""),
    );
    if (existente) return { id: existente.id, criado: false };

    const alerta: AlertaDemoAssistencial = {
      id: novoId(),
      familiaId: entrada.visita.familiaId,
      visitaId: entrada.visita.id,
      bebeId: entrada.bebeId,
      regraId: regra.id,
      severidade: regra.severidade as AlertaDemoAssistencial["severidade"],
      campo: entrada.campo ?? regra.campo,
      valorObservado: entrada.valor,
      conduta: regra.conduta,
      criadoEm: new Date().toISOString(),
      reconhecidoEm: null,
      sinalIdentificado: null,
      acionadoEm: null,
      orientacaoMedica: null,
      condutaAdotada: null,
      fechadoEm: null,
      versao: 1,
    };
    l.alertas.push(alerta);
    if (regra.severidade === "imediato" || regra.severidade === "prioritario") {
      l.avisosCoordenacao.push({
        id: novoId(),
        titulo: `alerta_clinico_${regra.severidade}`,
        regraId: regra.id,
      });
    }
    if (regra.grupo === "saude_mental" && regra.severidade === "imediato") {
      l.ocorrenciasPrivadas.push({
        id: novoId(),
        familiaId: alerta.familiaId,
        regraId: regra.id,
      });
    }
    return { id: alerta.id, criado: true };
  }

  function contatoUtilizavel(texto: string): {
    telefone: string | null;
    email: string | null;
  } {
    const email =
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(texto)?.[0] ?? null;
    const digitos = texto
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "")
      .replace(/\D/g, "");
    let telefone: string | null = null;
    if (/^55[1-9]\d{9,10}$/.test(digitos)) telefone = `+${digitos}`;
    else if (/^[1-9]\d{9,10}$/.test(digitos)) telefone = `+55${digitos}`;
    return { telefone, email };
  }

  function registrarContatosDoUltimoDia(
    familiaId: string,
    bloco: unknown,
  ): void {
    if (!bloco || typeof bloco !== "object") return;
    const l = loja();
    const faltam: string[] = [];
    for (const especialidade of ["obstetra", "pediatra"] as const) {
      const valor = (bloco as Record<string, unknown>)[
        `contato_${especialidade}`
      ];
      const texto = typeof valor === "string" ? valor.trim() : "";
      if (texto) {
        const { telefone, email } = contatoUtilizavel(texto);
        if (telefone || email) {
          if (
            !l.medicos.some(
              (m) =>
                m.familiaId === familiaId &&
                m.especialidade === especialidade &&
                (m.telefoneE164 || m.email),
            )
          ) {
            l.medicos.push({
              id: novoId(),
              familiaId,
              especialidade,
              nome: texto,
              telefoneE164: telefone,
              email,
            });
          }
          continue;
        }
      }
      if (
        !l.medicos.some(
          (m) =>
            m.familiaId === familiaId &&
            m.especialidade === especialidade &&
            (m.telefoneE164 || m.email),
        )
      ) {
        faltam.push(especialidade);
      }
    }
    if (
      faltam.length > 0 &&
      !l.tarefas.some((t) => t.familiaId === familiaId && t.status === "aberta")
    ) {
      l.tarefas.push({
        id: novoId(),
        tipo: "obter_contato_medico",
        familiaId,
        titulo: `Obter o contato do ${faltam.join(" e do ")}`,
        status: "aberta",
        criadoEm: new Date().toISOString(),
      });
    }
  }

  function alertaDaVisita(a: AlertaDemoAssistencial): AlertaDaVisita {
    return {
      id: a.id,
      regraId: a.regraId,
      bebeId: a.bebeId,
      severidade: a.severidade,
      campo: a.campo,
      valorObservado: a.valorObservado,
      conduta: a.conduta,
      reconhecidoEm: a.reconhecidoEm,
      sinalIdentificado: a.sinalIdentificado,
      acionadoEm: a.acionadoEm,
      orientacaoMedica: a.orientacaoMedica,
      condutaAdotada: a.condutaAdotada,
      fechadoEm: a.fechadoEm,
      versao: a.versao,
    };
  }

  return {
    async obterChecklist(visitaId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      const l = loja();
      const v = visitaVisivel(visitaId);
      if (!v) return null;
      const familia = l.familias.find((f) => f.id === v.familiaId)!;
      const profissional = [PROFISSIONAL_ENFERMEIRA, PROFISSIONAL_OUTRA].find(
        (p) => p.id === v.profissionalId,
      )!;
      const registro = l.registros.find((r) => r.visitaId === v.id);
      const registroAssinado: RegistroAssinado | null = registro
        ? {
            id: registro.id,
            profissionalId: registro.profissionalId,
            instrumentoVersao: registro.instrumentoVersao,
            dados: structuredClone(registro.dados),
            resumoDescritivo: registro.resumoDescritivo,
            assinadoEm: registro.assinadoEm,
            assinatura: registro.assinatura,
            adendos: registro.adendos.map((a) => ({
              id: a.id,
              motivo: a.motivo,
              conteudo: a.conteudo,
              criadoEm: a.criadoEm,
              autor: a.autor,
            })),
          }
        : null;
      const anteriores: RegistroAnterior[] = l.visitas
        .filter(
          (x) =>
            x.acompanhamentoId === v.acompanhamentoId &&
            x.diaNumero < v.diaNumero,
        )
        .sort((a, b) => b.diaNumero - a.diaNumero)
        .flatMap((x) => {
          const r = l.registros.find((reg) => reg.visitaId === x.id);
          return r
            ? [
                {
                  visitaId: x.id,
                  diaNumero: x.diaNumero,
                  data: x.data,
                  dados: structuredClone(r.dados),
                  resumoDescritivo: r.resumoDescritivo,
                },
              ]
            : [];
        });
      const checklist: ChecklistVisita = {
        visita: {
          id: v.id,
          acompanhamentoId: v.acompanhamentoId,
          profissionalId: v.profissionalId,
          diaNumero: v.diaNumero,
          data: v.data,
          horaPrevista: v.horaPrevista,
          estado: v.estado,
          checkinEm: v.checkinEm,
          checkoutEm: v.checkoutEm,
          versao: v.versao,
        },
        familia: {
          id: familia.id,
          nomeExibicao: familia.nomeExibicao,
          bairro: familia.bairro,
          estadoSensivel: familia.estadoSensivel,
          dpp: familia.dpp,
          dataNascimento: familia.dataNascimento,
          dataAlta: familia.dataAlta,
          dataInicioEfetivo: familia.dataInicioEfetivo,
          gemelar: familia.gemelar,
        },
        diasContratados: v.diasContratados,
        ultimoDia: v.diaNumero === v.diasContratados,
        profissional: {
          id: profissional.id,
          nome: profissional.nome,
          conselho: profissional.conselho,
          conselhoUf: profissional.conselhoUf,
          conselhoNumero: profissional.conselhoNumero,
        },
        instrumento: { versao: VERSAO_INSTRUMENTO, definicao: DEFINICAO_DOC2 },
        instrumentoDoc4: DEFINICAO_DOC4,
        bebes: l.bebes
          .filter((b) => b.familiaId === v.familiaId)
          .map(({ familiaId: _familiaId, ...b }) => b),
        medicos: l.medicos
          .filter((m) => m.familiaId === v.familiaId)
          .map(({ familiaId: _familiaId, ...m }) => m),
        regras: structuredClone(l.regras),
        registro: registroAssinado,
        anteriores,
        alertas: l.alertas
          .filter((a) => a.visitaId === v.id)
          .map(alertaDaVisita),
        audios: l.audios
          .filter((a) => a.visitaId === v.id)
          .map((a) => ({
            id: a.id,
            duracaoSeg: a.duracaoSeg,
            status: "pendente" as const,
            criadoEm: a.criadoEm,
            transcricao: null,
          })),
        parametros: structuredClone(l.parametros),
      };
      return checklist;
    },

    async registrarAtendimento(registro, alertas) {
      exigirSessao("enfermeira", "coordenacao");
      const l = loja();
      const v = l.visitas.find((x) => x.id === registro.visitaId);
      if (!v)
        throw new ErroRepositorio("nao_encontrado", "demonstração: visita");
      const profissional = [PROFISSIONAL_ENFERMEIRA, PROFISSIONAL_OUTRA].find(
        (p) => p.id === v.profissionalId,
      )!;
      if (profissional.usuarioId !== contexto.usuarioId) {
        throw recusa("nao_e_a_profissional_da_visita");
      }
      if (!registro.resumoDescritivo.trim()) throw recusa("resumo_obrigatorio");
      const assinaturaConfere = await conferirAssinatura(
        {
          dados: registro.dados,
          resumo: registro.resumoDescritivo,
          profissionalId: profissional.id,
          assinadoEmMs: registro.assinadoEmMs,
        },
        registro.assinatura,
      );
      if (!assinaturaConfere) throw recusa("assinatura_invalida");

      const existente = l.registros.find((r) => r.visitaId === v.id);
      if (existente) {
        if (existente.assinatura === registro.assinatura) {
          return { registroId: existente.id, jaRegistrado: true };
        }
        throw recusa("registro_divergente");
      }
      if (!["iniciada", "concluida", "ficha_pendente"].includes(v.estado)) {
        throw recusa("visita_nao_iniciada", v.estado);
      }
      if (registro.instrumentoVersao !== VERSAO_INSTRUMENTO) {
        throw recusa("instrumento_indisponivel", registro.instrumentoVersao);
      }

      const bebes = bebesDoFormulario(
        l.bebes.filter((b) => b.familiaId === v.familiaId),
      );
      const respostas = dadosParaRespostas(DEFINICAO_DOC2, registro.dados);
      respostas.blocos["resumo"] = {
        ...(respostas.blocos["resumo"] ?? {}),
        resumo_descritivo: registro.resumoDescritivo,
      };
      const pendentes = pendenciasDoRegistro({
        definicao: DEFINICAO_DOC2,
        respostas,
        bebes,
        ultimoDia: v.diaNumero === v.diasContratados,
      });
      if (pendentes.length > 0) {
        throw recusa(
          "obrigatorios_pendentes",
          pendentes
            .map((p) => `${p.bloco}.${p.campo}${p.bebe ? `#${p.bebe}` : ""}`)
            .join(","),
        );
      }

      const gravado = {
        id: novoId(),
        visitaId: v.id,
        profissionalId: profissional.id,
        instrumentoVersao: registro.instrumentoVersao,
        dados: structuredClone(registro.dados),
        resumoDescritivo: registro.resumoDescritivo,
        assinadoEm: new Date(registro.assinadoEmMs).toISOString(),
        assinatura: registro.assinatura,
        adendos: [],
      };
      l.registros.push(gravado);
      v.estado = "ficha_entregue";
      v.versao += 1;

      for (const a of alertas) {
        criarAlerta({
          visita: v,
          regraId: a.regraId,
          bebeId: a.bebeId,
          campo: a.campo,
          valor: a.valorObservado,
          manual: false,
        });
      }
      const acionamentos = registro.dados["_alertas"];
      if (Array.isArray(acionamentos)) {
        for (const ac of acionamentos as Record<string, unknown>[]) {
          const alvo = l.alertas.find(
            (a) =>
              a.visitaId === v.id &&
              a.regraId === ac.regra_id &&
              (a.bebeId ?? "") === ((ac.bebe_id as string | null) ?? "") &&
              !a.fechadoEm,
          );
          if (!alvo) continue;
          const acionadoEm =
            typeof ac.acionado_em === "string" && ac.acionado_em
              ? new Date(ac.acionado_em)
              : null;
          if (acionadoEm && acionadoEm.getTime() > Date.now() + 300_000) {
            throw recusa("acionamento_no_futuro");
          }
          alvo.reconhecidoEm ??= new Date().toISOString();
          alvo.sinalIdentificado =
            String(ac.sinal_identificado ?? "").trim() ||
            alvo.sinalIdentificado;
          alvo.acionadoEm = acionadoEm?.toISOString() ?? alvo.acionadoEm;
          alvo.orientacaoMedica =
            String(ac.orientacao_medica ?? "").trim() || alvo.orientacaoMedica;
          alvo.condutaAdotada =
            String(ac.conduta_adotada ?? "").trim() || alvo.condutaAdotada;
          alvo.versao += 1;
        }
      }
      if (v.diaNumero === v.diasContratados) {
        registrarContatosDoUltimoDia(v.familiaId, registro.dados["ultimo_dia"]);
      }
      return { registroId: gravado.id, jaRegistrado: false };
    },

    async registrarAdendo(registroId, motivo, conteudo) {
      exigirSessao("enfermeira", "coordenacao");
      const l = loja();
      const r = l.registros.find((x) => x.id === registroId);
      if (!r) throw recusa("registro_inexistente");
      if (!tem("coordenacao")) {
        const dona = [PROFISSIONAL_ENFERMEIRA, PROFISSIONAL_OUTRA].find(
          (p) => p.id === r.profissionalId,
        );
        if (dona?.usuarioId !== contexto.usuarioId) {
          throw recusa("adendo_de_outra_profissional");
        }
      }
      if (!motivo.trim()) throw recusa("adendo_sem_motivo");
      if (!conteudo.trim()) throw recusa("adendo_sem_conteudo");
      const igual = r.adendos.some(
        (a) =>
          a.autorUsuarioId === contexto.usuarioId &&
          a.motivo === motivo.trim() &&
          a.conteudo === conteudo.trim(),
      );
      if (igual) return;
      const autor =
        profissionalDoUsuario()?.nome ??
        (tem("coordenacao") ? "Coordenação" : null);
      r.adendos.push({
        id: novoId(),
        motivo: motivo.trim(),
        conteudo: conteudo.trim(),
        criadoEm: new Date().toISOString(),
        autor,
        autorUsuarioId: contexto.usuarioId!,
      });
    },

    async listarAlertas(situacao: SituacaoAlertas, familiaId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      const l = loja();
      const ordem = { imediato: 0, prioritario: 1, atencao: 2, informativo: 3 };
      return l.alertas
        .filter((a) => !familiaId || a.familiaId === familiaId)
        .filter((a) => familiaVisivel(a.familiaId))
        .filter(
          (a) =>
            situacao === "todos" ||
            (situacao === "abertos" ? !a.fechadoEm : Boolean(a.fechadoEm)),
        )
        .sort(
          (a, b) =>
            ordem[a.severidade] - ordem[b.severidade] ||
            Number(Boolean(a.fechadoEm)) - Number(Boolean(b.fechadoEm)) ||
            b.criadoEm.localeCompare(a.criadoEm),
        )
        .map((a): AlertaClinicoResumo => {
          const familia = l.familias.find((f) => f.id === a.familiaId)!;
          const regra = l.regras.find((r) => r.id === a.regraId)!;
          const visita = l.visitas.find((v) => v.id === a.visitaId);
          return {
            id: a.id,
            familiaId: a.familiaId,
            nomeFamilia: familia.nomeExibicao,
            estadoSensivel: familia.estadoSensivel,
            visitaId: a.visitaId,
            diaNumero: visita?.diaNumero ?? null,
            bebeId: a.bebeId,
            regraId: a.regraId,
            grupo: regra.grupo,
            descricao: regra.descricao,
            severidade: a.severidade,
            campo: a.campo,
            valorObservado: a.valorObservado,
            conduta: a.conduta,
            criadoEm: a.criadoEm,
            reconhecidoEm: a.reconhecidoEm,
            sinalIdentificado: a.sinalIdentificado,
            acionadoEm: a.acionadoEm,
            orientacaoMedica: a.orientacaoMedica,
            condutaAdotada: a.condutaAdotada,
            fechadoEm: a.fechadoEm,
            versao: a.versao,
          };
        });
    },

    async registrarAcionamento(pedido) {
      exigirSessao("enfermeira", "coordenacao");
      const a = loja().alertas.find((x) => x.id === pedido.alertaId);
      if (!a) throw recusa("alerta_inexistente");
      if (!familiaVisivel(a.familiaId)) throw recusa("familia_nao_atribuida");
      if (a.fechadoEm) throw recusa("alerta_fechado");
      if (pedido.versaoBase !== null && a.versao !== pedido.versaoBase) {
        throw recusa("versao_desatualizada");
      }
      if (
        pedido.acionadoEm &&
        Date.parse(pedido.acionadoEm) > Date.now() + 300_000
      ) {
        throw recusa("acionamento_no_futuro");
      }
      a.reconhecidoEm ??= new Date().toISOString();
      if (pedido.sinalIdentificado?.trim())
        a.sinalIdentificado = pedido.sinalIdentificado.trim();
      if (pedido.acionadoEm)
        a.acionadoEm = new Date(pedido.acionadoEm).toISOString();
      if (pedido.orientacaoMedica?.trim())
        a.orientacaoMedica = pedido.orientacaoMedica.trim();
      if (pedido.condutaAdotada?.trim())
        a.condutaAdotada = pedido.condutaAdotada.trim();
      a.versao += 1;
    },

    async fecharAlerta(alertaId, versaoBase) {
      exigirSessao("coordenacao");
      const a = loja().alertas.find((x) => x.id === alertaId);
      if (!a) throw recusa("alerta_inexistente");
      if (a.fechadoEm) return;
      if (versaoBase !== null && a.versao !== versaoBase) {
        throw recusa("versao_desatualizada");
      }
      const faltam = [
        ["sinal_identificado", a.sinalIdentificado],
        ["acionado_em", a.acionadoEm],
        ["orientacao_medica", a.orientacaoMedica],
        ["conduta_adotada", a.condutaAdotada],
      ]
        .filter(([, valor]) => !String(valor ?? "").trim())
        .map(([nome]) => nome);
      if (faltam.length > 0) {
        throw recusa(
          "fechamento_incompleto",
          `falta registrar: ${faltam.join(", ")}`,
        );
      }
      a.fechadoEm = new Date().toISOString();
      a.versao += 1;
    },

    async registrarAlerta(pedido) {
      exigirSessao("enfermeira", "coordenacao");
      const v = visitaVisivel(pedido.visitaId);
      if (!v) throw recusa("visita_de_outra_profissional");
      if (pedido.manual && !loja().parametros.seletorSinaisAtivo) {
        throw recusa("seletor_desligado");
      }
      return criarAlerta({
        visita: v,
        regraId: pedido.regraId,
        bebeId: pedido.bebeId,
        campo: pedido.campo,
        valor: pedido.valorObservado,
        manual: pedido.manual,
      });
    },

    async telefoneSupervisao() {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      return loja().parametros.supervisaoTelefone;
    },

    async situacaoContatoMedico(familiaId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      if (!familiaVisivel(familiaId)) {
        throw new ErroRepositorio("sem_permissao", "demonstração: família");
      }
      const l = loja();
      const tem_ = (especialidade: string) =>
        l.medicos.some(
          (m) =>
            m.familiaId === familiaId &&
            m.especialidade === especialidade &&
            (m.telefoneE164 || m.email),
        );
      const obstetra = tem_("obstetra");
      const pediatra = tem_("pediatra");
      return {
        obstetra,
        pediatra,
        tarefaAberta: l.tarefas.some(
          (t) => t.familiaId === familiaId && t.status === "aberta",
        ),
        evolucaoBloqueada: !(obstetra || pediatra),
      };
    },

    async registrarAudio(visitaId, arquivoPath, duracaoSeg) {
      exigirSessao("enfermeira", "coordenacao");
      const v = visitaVisivel(visitaId);
      if (!v) throw recusa("visita_de_outra_profissional");
      if (
        !new RegExp(`^visitas/${visitaId}/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`).test(
          arquivoPath,
        )
      ) {
        throw recusa("caminho_invalido");
      }
      const limite = loja().parametros.audio.duracaoMaxSeg;
      if (duracaoSeg !== null && duracaoSeg > limite)
        throw recusa("audio_longo");
      const audio = {
        id: novoId(),
        visitaId,
        arquivoPath,
        duracaoSeg,
        criadoEm: new Date().toISOString(),
      };
      loja().audios.push(audio);
      return { id: audio.id };
    },

    async audioParaOuvir(audioId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      const a = loja().audios.find((x) => x.id === audioId);
      if (!a) throw recusa("audio_inexistente");
      if (!visitaVisivel(a.visitaId))
        throw recusa("visita_de_outra_profissional");
      return {
        arquivoPath: a.arquivoPath,
        validadeSeg: loja().parametros.audioUrlAssinadaSegundos,
      };
    },

    async acionarFreio(familiaId) {
      exigirSessao("enfermeira", "coordenacao", "diretoria");
      if (!familiaVisivel(familiaId)) {
        throw new ErroRepositorio("nao_encontrado", "demonstração: família");
      }
      const familia = loja().familias.find((f) => f.id === familiaId);
      if (familia && familia.estadoSensivel === "normal") {
        familia.estadoSensivel = "bloqueio_total";
      }
    },
  };
}
