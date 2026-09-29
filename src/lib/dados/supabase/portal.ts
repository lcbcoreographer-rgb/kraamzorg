import "server-only";
import type { Json } from "@/lib/db/types";
import type {
  ConflitoSincronizacao,
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "@/lib/sync/tipos";
import { ErroRepositorio } from "../erros";
import type { PortalRepositorio } from "../repositorios";
import type {
  EnderecoAtendimento,
  EstadoProfissional,
  FamiliaPortal,
  FichaAssistencialPortal,
  PerfilPortal,
  PortalHoje,
  TurnoVisita,
  VisitaPortal,
} from "../tipos-equipe";
import { exigir, type ContextoSupabase } from "./comum";
import {
  horaDoBanco,
  lista,
  numero,
  objeto,
  texto,
} from "./equipe";

/**
 * Portal da enfermeira na real (P38): as funções do schema api da
 * 0022_agenda_portal.sql, com a sessão da própria enfermeira. As funções
 * gravam a leitura no log e devolvem só o que a enfermeira pode ver, sem
 * dado comercial. Os mapeamentos ficam exportados para o teste sem banco.
 */

function enderecoDoBanco(valor: Json | undefined): EnderecoAtendimento | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const e = valor as Record<string, Json | undefined>;
  return {
    logradouro: texto(e.logradouro),
    numero: texto(e.numero),
    complemento: texto(e.complemento),
    bairro: texto(e.bairro),
    cep: texto(e.cep),
    referencia: texto(e.referencia),
  };
}

export function visitaPortalDoBanco(valor: Json): VisitaPortal {
  const v = objeto(valor);
  return {
    visitaId: String(v.visita_id),
    acompanhamentoId: String(v.acompanhamento_id),
    familiaId: String(v.familia_id),
    nomeExibicao: String(v.nome_exibicao ?? ""),
    bairro: texto(v.bairro),
    endereco: enderecoDoBanco(v.endereco_atendimento),
    cidade: texto(v.cidade),
    uf: texto(v.uf),
    diaNumero: numero(v.dia_numero),
    diasContratados: numero(v.dias_contratados),
    data: String(v.data),
    horaPrevista: horaDoBanco(v.hora_prevista),
    horasPorVisita: numero(v.horas_por_visita),
    turno: texto(v.turno) as TurnoVisita | null,
    estado: (texto(v.estado) ?? "agendada") as VisitaPortal["estado"],
    checkinEm: texto(v.checkin_em),
    checkoutEm: texto(v.checkout_em),
    versao: numero(v.versao) || 1,
    papel: texto(v.papel) as VisitaPortal["papel"],
    estadoSensivel: (texto(v.estado_sensivel) ?? "normal") as VisitaPortal["estadoSensivel"],
    gemelar: v.gemelar === true,
    contatoNome: texto(v.contato_nome),
    contatoTelefone: texto(v.contato_telefone),
  };
}

export function portalHojeDoBanco(valor: Json): PortalHoje {
  const h = objeto(valor);
  const pr = objeto(h.profissional);
  return {
    dia: String(h.dia),
    profissionalId: String(pr.id),
    profissionalNome: String(pr.nome ?? ""),
    status: (texto(h.status) ?? "livre") as EstadoProfissional,
    visitas: lista(h.visitas).map(visitaPortalDoBanco),
    fichasPendentes: lista(h.fichas_pendentes).map((item) => {
      const f = objeto(item);
      return {
        visitaId: String(f.visita_id),
        familiaId: String(f.familia_id),
        nomeExibicao: String(f.nome_exibicao ?? ""),
        diaNumero: numero(f.dia_numero),
        diasContratados: numero(f.dias_contratados),
        data: String(f.data),
        estado: (texto(f.estado) ?? "concluida") as VisitaPortal["estado"],
      };
    }),
  };
}

export function familiasPortalDoBanco(valor: Json): FamiliaPortal[] {
  return lista(valor).map((item) => {
    const f = objeto(item);
    const a = f.acompanhamento ? objeto(f.acompanhamento) : null;
    return {
      familiaId: String(f.familia_id),
      nomeExibicao: String(f.nome_exibicao ?? ""),
      bairro: texto(f.bairro),
      cidade: texto(f.cidade),
      uf: texto(f.uf),
      dpp: texto(f.dpp),
      dataNascimento: texto(f.data_nascimento),
      dataAlta: texto(f.data_alta),
      dataInicioEfetivo: texto(f.data_inicio_efetivo),
      gemelar: f.gemelar === true,
      estadoSensivel: (texto(f.estado_sensivel) ?? "normal") as FamiliaPortal["estadoSensivel"],
      papel: (texto(f.papel) ?? "titular") as FamiliaPortal["papel"],
      acompanhamento: a
        ? {
            id: String(a.id),
            estado: (texto(a.estado) ?? "ativo") as NonNullable<FamiliaPortal["acompanhamento"]>["estado"],
            diasContratados: numero(a.dias_contratados),
            periodo: texto(a.periodo) as NonNullable<FamiliaPortal["acompanhamento"]>["periodo"],
            inicioEfetivo: texto(a.inicio_efetivo),
            encerramento: texto(a.encerramento),
          }
        : null,
      visitas: lista(f.visitas).map((vi) => {
        const v = objeto(vi);
        return {
          visitaId: String(v.visita_id),
          diaNumero: numero(v.dia_numero),
          data: String(v.data),
          horaPrevista: horaDoBanco(v.hora_prevista),
          estado: (texto(v.estado) ?? "agendada") as VisitaPortal["estado"],
          checkinEm: texto(v.checkin_em),
          checkoutEm: texto(v.checkout_em),
        };
      }),
    };
  });
}

export function fichaAssistencialDoBanco(valor: Json): FichaAssistencialPortal {
  const r = objeto(valor);
  const f = objeto(r.familia);
  return {
    familia: {
      id: String(f.id),
      nomeExibicao: String(f.nome_exibicao ?? ""),
      bairro: texto(f.bairro),
      endereco: enderecoDoBanco(f.endereco_atendimento),
      cidade: texto(f.cidade),
      uf: texto(f.uf),
      dpp: texto(f.dpp),
      idadeGestacional: texto(f.idade_gestacional),
      dataNascimento: texto(f.data_nascimento),
      dataAlta: texto(f.data_alta),
      dataInicioEfetivo: texto(f.data_inicio_efetivo),
      gemelar: f.gemelar === true,
      estadoSensivel: (texto(f.estado_sensivel) ?? "normal") as FichaAssistencialPortal["familia"]["estadoSensivel"],
    },
    pessoas: lista(r.pessoas).map((item) => {
      const p = objeto(item);
      return {
        id: String(p.id),
        papel: String(p.papel ?? ""),
        nome: String(p.nome ?? ""),
        telefoneE164: texto(p.telefone_e164),
        email: texto(p.email),
        contatoPrincipal: p.contato_principal === true,
      };
    }),
    bebes: lista(r.bebes).map((item) => {
      const b = objeto(item);
      return {
        id: String(b.id),
        ordem: numero(b.ordem),
        nome: texto(b.nome),
        sexo: texto(b.sexo),
        dataNascimento: texto(b.data_nascimento),
        pesoNascimentoG: typeof b.peso_nascimento_g === "number" ? b.peso_nascimento_g : null,
        pesoAltaG: typeof b.peso_alta_g === "number" ? b.peso_alta_g : null,
        tipoParto: texto(b.tipo_parto),
      };
    }),
    medicos: lista(r.medicos).map((item) => {
      const m = objeto(item);
      return {
        id: String(m.id),
        especialidade: String(m.especialidade ?? ""),
        nome: String(m.nome ?? ""),
        telefoneE164: texto(m.telefone_e164),
        hospital: texto(m.hospital),
      };
    }),
  };
}

export function perfilPortalDoBanco(valor: Json): PerfilPortal {
  const r = objeto(valor);
  const p = objeto(r.profissional);
  return {
    profissional: {
      id: String(p.id),
      nome: String(p.nome ?? ""),
      funcao: String(p.funcao ?? ""),
      conselho: texto(p.conselho),
      conselhoUf: texto(p.conselho_uf),
      conselhoNumero: texto(p.conselho_numero),
      telefoneE164: texto(p.telefone_e164),
      regioes: lista(p.regioes).filter((x): x is string => typeof x === "string"),
    },
    status: (texto(r.status) ?? "livre") as EstadoProfissional,
    documentos: lista(r.documentos).map((item) => {
      const d = objeto(item);
      return {
        id: String(d.id),
        tipo: String(d.tipo ?? ""),
        numero: texto(d.numero),
        validade: texto(d.validade),
        situacao: (texto(d.situacao) ?? "sem_validade") as PerfilPortal["documentos"][number]["situacao"],
      };
    }),
    bloqueios: lista(r.bloqueios).map((item) => {
      const b = objeto(item);
      return { id: String(b.id), inicio: String(b.inicio), fim: String(b.fim) };
    }),
  };
}

export function criarPortalSupabase(contexto: ContextoSupabase): PortalRepositorio {
  const api = () => contexto.cliente.schema("api");

  async function lerEstado(visitaId: string) {
    const linha = exigir(
      await contexto.cliente
        .from("visita")
        .select("id, versao, estado, checkin_em, checkout_em")
        .eq("id", visitaId)
        .maybeSingle(),
      "portal: estado da visita",
    ) as unknown as {
      id: string;
      versao: number;
      estado: VisitaPortal["estado"];
      checkin_em: string | null;
      checkout_em: string | null;
    } | null;
    if (!linha) return null;
    return {
      visitaId: linha.id,
      versao: linha.versao,
      estado: linha.estado,
      checkinEm: linha.checkin_em,
      checkoutEm: linha.checkout_em,
    };
  }

  return {
    async obterHoje(dia) {
      return portalHojeDoBanco(
        exigir(await api().rpc("portal_hoje", { dia: dia ?? undefined }), "api.portal_hoje"),
      );
    },

    async listarFamilias() {
      return familiasPortalDoBanco(
        exigir(await api().rpc("portal_familias"), "api.portal_familias"),
      );
    },

    async obterFichaAssistencial(familiaId) {
      try {
        return fichaAssistencialDoBanco(
          exigir(
            await api().rpc("ficha_assistencial", { familia_id: familiaId }),
            "api.ficha_assistencial",
          ),
        );
      } catch (erro) {
        // família que não é da enfermeira: a função recusa (42501)
        if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") return null;
        throw erro;
      }
    },

    async obterPerfil() {
      return perfilPortalDoBanco(
        exigir(await api().rpc("portal_perfil"), "api.portal_perfil"),
      );
    },

    estadoDaVisita: lerEstado,

    async registrarChegadaSincronizada(visitaId, quando) {
      const r = objeto(
        exigir(
          await api().rpc("registrar_chegada", {
            visita_id: visitaId,
            quando,
            via_sincronizacao: true,
          }),
          "api.registrar_chegada",
        ),
      );
      return { versao: numero(r.versao) };
    },

    async registrarSaidaSincronizada(visitaId, quando) {
      const r = objeto(
        exigir(
          await api().rpc("registrar_saida", {
            visita_id: visitaId,
            quando,
            via_sincronizacao: true,
          }),
          "api.registrar_saida",
        ),
      );
      return { versao: numero(r.versao) };
    },

    async resultadoProcessado(itemId): Promise<ResultadoItemSincronizacao | null> {
      const r = exigir(
        await api().rpc("sincronizacao_item", { item_id: itemId }),
        "api.sincronizacao_item",
      );
      if (!r) return null;
      const item = objeto(r);
      if (item.status === "conflito") {
        return {
          id: itemId,
          status: "conflito",
          conflito: (item.conflito ?? {}) as unknown as ConflitoSincronizacao,
        };
      }
      if (item.status !== "processado") return null;
      const visitaId = texto(item.entidade_id);
      const estado = visitaId ? await lerEstado(visitaId) : null;
      return {
        id: itemId,
        status: "processado",
        versaoResultante: estado?.versao,
      };
    },

    async guardarProcessado(item: ItemSincronizacaoEntrada, resultado) {
      // Só o que é final: processado ou conflito. Erro fica de fora, para o
      // aparelho tentar de novo (pode ser queda momentânea).
      if (resultado.status === "erro") return;
      exigir(
        await api().rpc("sincronizacao_registrar", {
          item_id: item.id,
          entidade: item.entidade,
          entidade_id: item.entidadeId ?? (null as unknown as string),
          campo: item.campo ?? (null as unknown as string),
          payload: (item.payload ?? null) as Json,
          versao_base: item.versaoBase ?? (null as unknown as number),
          criado_no_cliente_em: item.criadoNoClienteEm,
          status: resultado.status,
          conflito: (resultado.conflito ?? undefined) as Json | undefined,
        }),
        "api.sincronizacao_registrar",
      );
    },
  };
}
