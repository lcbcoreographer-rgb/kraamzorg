import "server-only";
import type { Json } from "@/lib/db/types";
import type { VendaRepositorio } from "../repositorios";
import type { EstagioP1, EstagioP2, StatusHandoff } from "../tipos";
import type {
  ContaProposta,
  GravacaoSessao,
  Proposta,
  ResumoSessao,
  SessaoVenda,
} from "../tipos-venda";
import { exigir, type ContextoSupabase } from "./comum";

/**
 * Venda na real (P29 e P30): tudo pelas funções do schema api da
 * 0018_venda.sql, com a sessão do usuário (papel e AAL conferidos por
 * dentro de cada função). A única leitura direta é a transferência
 * "reuniao" e a oportunidade da família, que a RLS já recorta
 * (comercial, coordenação e diretoria).
 */

type Registro = Record<string, Json | undefined>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const numero = (v: Json | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0) || 0;
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

export function contaDoBanco(valor: Json | undefined): ContaProposta {
  const c = objeto(valor);
  return {
    valorCentavos: numero(c.valor_centavos),
    taxaCentavos: numero(c.taxa_centavos),
    descontoCentavos: numero(c.desconto_centavos),
    totalCentavos: numero(c.total_centavos),
    parcelas: numero(c.parcelas) || 1,
    parcelaCentavos: numero(c.parcela_centavos),
    primeiraParcelaCentavos: numero(c.primeira_parcela_centavos),
  };
}

export function resumoDoBanco(valor: Json | undefined): ResumoSessao | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const r = valor as Registro;
  const textos = (v: Json | undefined) =>
    lista(v).filter((i): i is string => typeof i === "string");
  return {
    duvidas: textos(r.duvidas),
    objecoes: textos(r.objecoes),
    planoInteresse: texto(r.plano_interesse),
    proximosPassos: textos(r.proximos_passos),
    origem: r.origem === "ia" ? "ia" : "pessoa",
    modelo: texto(r.modelo),
    salvoEm: texto(r.salvo_em),
  };
}

export function propostaDoBanco(valor: Json): Proposta {
  const r = objeto(valor);
  const o = objeto(r.oportunidade);
  const f = objeto(r.familia);
  const cidade = f.cidade ? objeto(f.cidade) : null;
  const k = r.contrato ? objeto(r.contrato) : null;
  const formulario = k ? objeto(k.formulario) : {};
  return {
    oportunidade: {
      id: String(o.id),
      familiaId: String(o.familia_id),
      pipeline: numero(o.pipeline) === 2 ? 2 : 1,
      estagioP1: texto(o.estagio_p1) as Proposta["oportunidade"]["estagioP1"],
      estagioP2: texto(o.estagio_p2) as Proposta["oportunidade"]["estagioP2"],
      paraQuem: texto(o.para_quem) as Proposta["oportunidade"]["paraQuem"],
      pagadorPessoaId: texto(o.pagador_pessoa_id),
      condicaoId: texto(o.condicao_id),
      descontoPct: numero(o.desconto_pct),
      planoInteressePacoteId: texto(o.plano_interesse_pacote_id),
      precisaAprovacao: o.precisa_aprovacao === true,
      descontoAprovado: o.desconto_aprovado === true,
      descontoAprovadoPorNome: texto(o.desconto_aprovado_por_nome),
    },
    familia: {
      id: String(f.id),
      nome: String(f.nome ?? ""),
      dpp: texto(f.dpp),
      dataNascimento: texto(f.data_nascimento),
      gemelar: f.gemelar === true,
      estadoSensivel: (texto(f.estado_sensivel) ??
        "normal") as Proposta["familia"]["estadoSensivel"],
      naoContatar: f.nao_contatar === true,
      cidade: cidade
        ? {
            nome: String(cidade.nome ?? ""),
            uf: String(cidade.uf ?? ""),
            atendida: cidade.atendida !== false,
            requerConfirmacao: cidade.requer_confirmacao === true,
            taxaCentavos: numero(cidade.taxa_centavos),
          }
        : null,
    },
    pessoas: lista(r.pessoas).map((p) => {
      const x = objeto(p);
      return {
        id: String(x.id),
        nome: String(x.nome ?? ""),
        papel: String(x.papel) as Proposta["pessoas"][number]["papel"],
        contatoPrincipal: x.contato_principal === true,
      };
    }),
    pacotes: lista(r.pacotes).map((p) => {
      const x = objeto(p);
      return {
        pacoteVersaoId: String(x.pacote_versao_id),
        pacoteId: String(x.pacote_id),
        nome: String(x.nome ?? ""),
        linha: texto(x.linha),
        dias: numero(x.dias),
        gemelar: x.gemelar === true,
        horasPorVisita: numero(x.horas_por_visita),
        valorCentavos: numero(x.valor_centavos),
        parcelasMaxSemJuros: numero(x.parcelas_max_sem_juros) || 1,
      };
    }),
    condicoes: lista(r.condicoes).map((c) => {
      const x = objeto(c);
      return {
        id: String(x.id),
        nome: String(x.nome ?? ""),
        tipo: String(x.tipo) as Proposta["condicoes"][number]["tipo"],
        valor: numero(x.valor),
        requerAprovacao: x.requer_aprovacao === true,
      };
    }),
    contrato: k
      ? {
          id: String(k.id),
          status: String(k.status) as NonNullable<
            Proposta["contrato"]
          >["status"],
          pacoteVersaoId: String(k.pacote_versao_id),
          contratantePessoaId: texto(k.contratante_pessoa_id),
          pagadorPessoaId: texto(k.pagador_pessoa_id),
          testemunhaPessoaId: texto(k.testemunha_pessoa_id),
          templateVersao: String(k.template_versao ?? ""),
          conta: contaDoBanco(k.conta),
          formulario: {
            situacao: (texto(formulario.situacao) ??
              "nao_enviado") as NonNullable<
              Proposta["contrato"]
            >["formulario"]["situacao"],
            expiraEm: texto(formulario.expira_em),
            recebidoEm: texto(formulario.recebido_em),
          },
        }
      : null,
    formularioValidadeHoras:
      typeof r.formulario_validade_horas === "number"
        ? r.formulario_validade_horas
        : null,
    podeEditar: r.pode_editar === true,
    podeAprovar: r.pode_aprovar === true,
  };
}

export function criarVendaSupabase(
  contexto: ContextoSupabase,
): VendaRepositorio {
  const { cliente } = contexto;
  const api = () => cliente.schema("api");

  return {
    async listarCondutores() {
      const linhas = exigir(
        await api().rpc("condutores_sessao_venda"),
        "api.condutores_sessao_venda",
      );
      return (linhas ?? []).map((l) => ({ id: l.id, nome: l.nome }));
    },

    async listarSessoes(filtro = {}) {
      const linhas = exigir(
        await api().rpc("sessoes_venda", {
          desde: filtro.desde,
          ate: filtro.ate,
          da_familia: filtro.familiaId,
          da_sessao: filtro.sessaoId,
        }),
        "api.sessoes_venda",
      );
      return (linhas ?? []).map(
        (l): SessaoVenda => ({
          id: l.id,
          familiaId: l.familia_id,
          nomeFamilia: l.familia_nome,
          estadoSensivel: l.estado_sensivel,
          dpp: l.dpp,
          dataNascimento: l.data_nascimento,
          agendadaPara: l.agendada_para,
          status: l.status,
          realizadaEm: l.realizada_em,
          linkReuniao: l.link_reuniao,
          opcoesInformadas: l.opcoes_informadas,
          parceiroPresente: l.parceiro_presente,
          conduzidaPor: l.conduzida_por,
          conduzidaPorNome: l.conduzida_por_nome,
          criadoEm: l.criado_em,
          podeVerGravacao: l.pode_ver_gravacao,
          gravacaoRegistrada: l.gravacao_registrada,
        }),
      );
    },

    async obterTransferenciaReuniao(handoffId) {
      const linha = exigir(
        await cliente
          .from("handoff")
          .select(
            "id, familia_id, motivo, status, resumo, dados, familia:familia_id (nome_exibicao, dpp, estado_sensivel)",
          )
          .eq("id", handoffId)
          .eq("motivo", "reuniao")
          .maybeSingle(),
        "venda: transferência reuniao",
      ) as unknown as {
        id: string;
        familia_id: string | null;
        status: StatusHandoff;
        resumo: string;
        dados: Json;
        familia: {
          nome_exibicao: string;
          dpp: string | null;
          estado_sensivel: SessaoVenda["estadoSensivel"];
        } | null;
      } | null;
      if (!linha || !linha.familia_id || !linha.familia) return null;
      const opcoes = objeto(linha.dados).opcoes;
      return {
        id: linha.id,
        familiaId: linha.familia_id,
        nomeFamilia: linha.familia.nome_exibicao,
        dpp: linha.familia.dpp,
        estadoSensivel: linha.familia.estado_sensivel,
        status: linha.status,
        opcoes: Array.isArray(opcoes)
          ? opcoes.filter((o): o is string => typeof o === "string")
          : typeof opcoes === "string"
            ? [opcoes]
            : [],
        resumo: linha.resumo,
      };
    },

    async agendarSessao(pedido) {
      const r = objeto(
        exigir(
          await api().rpc("agendar_sessao_venda", {
            familia_id: pedido.familiaId,
            agendada_para: pedido.agendadaPara,
            conduzida_por: pedido.conduzidaPor,
            link_reuniao: pedido.linkReuniao,
            opcoes_informadas: pedido.opcoesInformadas ?? undefined,
            handoff_id: pedido.handoffId ?? undefined,
          }),
          "api.agendar_sessao_venda",
        ),
      );
      return {
        sessaoId: String(r.sessao_id),
        tarefaLembreteId: texto(r.tarefa_lembrete_id),
        estagioP1: texto(r.estagio_p1) as EstagioP1 | null,
      };
    },

    async remarcarSessao(pedido) {
      const r = objeto(
        exigir(
          await api().rpc("remarcar_sessao_venda", {
            sessao_id: pedido.sessaoId,
            agendada_para: pedido.agendadaPara,
            link_reuniao: pedido.linkReuniao ?? undefined,
            conduzida_por: pedido.conduzidaPor ?? undefined,
          }),
          "api.remarcar_sessao_venda",
        ),
      );
      return { sessaoId: String(r.sessao_id) };
    },

    async registrarDesfecho(sessaoId, desfecho, parceiroPresente) {
      const r = objeto(
        exigir(
          await api().rpc("registrar_desfecho_sessao_venda", {
            sessao_id: sessaoId,
            desfecho,
            parceiro_presente: parceiroPresente ?? undefined,
          }),
          "api.registrar_desfecho_sessao_venda",
        ),
      );
      return {
        sessaoId: String(r.sessao_id),
        status: desfecho,
        tarefaId: texto(r.tarefa_id),
        estagioP1: texto(r.estagio_p1) as EstagioP1 | null,
      };
    },

    async obterGravacao(sessaoId): Promise<GravacaoSessao | null> {
      const r = exigir(
        await api().rpc("sessao_venda_gravacao", { sessao_id: sessaoId }),
        "api.sessao_venda_gravacao",
      );
      if (!r) return null;
      const g = objeto(r);
      return {
        sessaoId,
        consentimento: g.consentimento_gravacao === true,
        consentimentoVersao: texto(g.consentimento_versao),
        consentimentoEm: texto(g.consentimento_em),
        transcricao: texto(g.transcricao),
        resumo: resumoDoBanco(g.resumo),
      };
    },

    async registrarGravacao(sessaoId, consentimento, transcricao) {
      exigir(
        await api().rpc("registrar_gravacao_sessao_venda", {
          sessao_id: sessaoId,
          consentimento,
          transcricao: transcricao ?? undefined,
        }),
        "api.registrar_gravacao_sessao_venda",
      );
    },

    async salvarResumo(sessaoId, resumo) {
      exigir(
        await api().rpc("salvar_resumo_sessao_venda", {
          sessao_id: sessaoId,
          resumo: {
            duvidas: resumo.duvidas,
            objecoes: resumo.objecoes,
            plano_interesse: resumo.planoInteresse,
            proximos_passos: resumo.proximosPassos,
            origem: resumo.origem,
            modelo: resumo.modelo,
          },
        }),
        "api.salvar_resumo_sessao_venda",
      );
    },

    async oportunidadeDaFamilia(familiaId) {
      const linhas = exigir(
        await cliente
          .from("oportunidade")
          .select("id, estagio_p2")
          .eq("familia_id", familiaId)
          .order("criado_em", { ascending: false })
          .limit(5),
        "venda: oportunidade da família",
      );
      const aberta = (linhas ?? []).find(
        (o) =>
          o.estagio_p2 === null ||
          !["perdido", "cancelado", "distrato"].includes(o.estagio_p2),
      );
      return aberta?.id ?? null;
    },

    async obterProposta(oportunidadeId) {
      return propostaDoBanco(
        exigir(
          await api().rpc("proposta", { oportunidade_id: oportunidadeId }),
          "api.proposta",
        ),
      );
    },

    async salvarProposta(pedido) {
      const r = objeto(
        exigir(
          await api().rpc("salvar_proposta", {
            oportunidade_id: pedido.oportunidadeId,
            pacote_versao_id: pedido.pacoteVersaoId,
            parcelas: pedido.parcelas,
            condicao_id: pedido.condicaoId ?? undefined,
            para_quem: pedido.paraQuem,
            pagador_pessoa_id: pedido.pagadorPessoaId ?? undefined,
            pagador_nome: pedido.pagadorNome ?? undefined,
            desconto_pct: pedido.descontoPct,
            desconto_motivo: pedido.descontoMotivo ?? undefined,
          }),
          "api.salvar_proposta",
        ),
      );
      return {
        contratoId: String(r.contrato_id),
        conta: contaDoBanco(r.conta),
        precisaAprovacao: r.precisa_aprovacao === true,
        descontoAprovado: r.desconto_aprovado === true,
      };
    },

    async aprovarDesconto(oportunidadeId) {
      exigir(
        await api().rpc("aprovar_desconto", { oportunidade_id: oportunidadeId }),
        "api.aprovar_desconto",
      );
    },

    async gerarLinkFormulario(oportunidadeId) {
      const r = objeto(
        exigir(
          await api().rpc("gerar_link_formulario_contrato", {
            oportunidade_id: oportunidadeId,
          }),
          "api.gerar_link_formulario_contrato",
        ),
      );
      return {
        token: String(r.token),
        expiraEm: String(r.expira_em),
        contratoId: String(r.contrato_id),
        tarefaId: texto(r.tarefa_id),
        estagioP2: texto(r.estagio_p2) as EstagioP2 | null,
      };
    },
  };
}
