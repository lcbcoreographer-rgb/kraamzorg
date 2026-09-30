import "server-only";
import type { Json } from "@/lib/db/types";
import type {
  ClassificacaoNps,
  EstagioPosVenda,
  EventoHistorico,
  ListaOcorrencias,
  ListaPosVenda,
  OcorrenciaDetalhe,
  OcorrenciaRepositorio,
  OcorrenciaResumo,
  PosVendaItem,
  PosVendaRepositorio,
  PrioridadeOcorrencia,
  ResultadoLinkPesquisa,
  StatusOcorrencia,
  TipoOcorrencia,
} from "../tipos-ocorrencia";
import { rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Ocorrências e pós-venda na real (P42): funções do schema api da
 * 0024_evolucao_ocorrencia_nf.sql. Coordenação e diretoria, AAL2; a enfermeira
 * responsável lê e atualiza a ocorrência não privada dela. Tudo conferido por
 * dentro de cada função.
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
const numeroOuNulo = (v: Json | undefined): number | null =>
  typeof v === "number" ? v : null;
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const boolOuNulo = (v: Json | undefined): boolean | null =>
  typeof v === "boolean" ? v : null;

function resumoDoBanco(x: Registro): OcorrenciaResumo {
  return {
    id: String(x.id),
    familiaId: texto(x.familia_id),
    familiaNome: texto(x.familia_nome),
    profissionalId: texto(x.profissional_id),
    profissionalNome: texto(x.profissional_nome),
    tipo: (texto(x.tipo) ?? "outro") as TipoOcorrencia,
    prioridade: (texto(x.prioridade) ?? "normal") as PrioridadeOcorrencia,
    privada: x.privada === true,
    titulo: String(x.titulo ?? ""),
    status: (texto(x.status) ?? "aberta") as StatusOcorrencia,
    responsavelId: texto(x.responsavel_id),
    responsavelNome: texto(x.responsavel_nome),
    slaVenceEm: texto(x.sla_vence_em),
    vencida: x.vencida === true,
    criadoEm: texto(x.criado_em) ?? "",
    versao: numero(x.versao) || 1,
  };
}

export function listaOcorrenciasDoBanco(valor: Json): ListaOcorrencias {
  const r = objeto(valor);
  const res = objeto(r.resumo);
  return {
    resumo: {
      abertas: numero(res.abertas),
      vencidas: numero(res.vencidas),
      privadas: numero(res.privadas),
    },
    ocorrencias: lista(r.ocorrencias).map((o) => resumoDoBanco(objeto(o))),
  };
}

export function detalheOcorrenciaDoBanco(valor: Json): OcorrenciaDetalhe {
  const x = objeto(valor);
  return {
    ...resumoDoBanco(x),
    descricao: String(x.descricao ?? ""),
    historico: lista(x.historico).map((h): EventoHistorico => {
      const e = objeto(h);
      return {
        em: texto(e.em) ?? "",
        por: texto(e.por),
        acao: texto(e.acao) ?? "",
        ...(texto(e.de) ? { de: texto(e.de)! } : {}),
        ...(texto(e.para) ? { para: texto(e.para)! } : {}),
        ...(texto(e.nota) ? { nota: texto(e.nota)! } : {}),
        ...(texto(e.prioridade) ? { prioridade: texto(e.prioridade)! } : {}),
        ...(typeof e.privada === "boolean" ? { privada: e.privada } : {}),
        ...(texto(e.origem) ? { origem: texto(e.origem)! } : {}),
      };
    }),
    resolvidaEm: texto(x.resolvida_em),
    podeGerir: x.pode_gerir === true,
  };
}

export function listaPosVendaDoBanco(valor: Json): ListaPosVenda {
  const r = objeto(valor);
  const res = objeto(r.resumo);
  return {
    resumo: {
      aguardandoEnvio: numero(res.aguardando_envio),
      aguardandoResposta: numero(res.aguardando_resposta),
      respondidas: numero(res.respondidas),
      promotores: numero(res.promotores),
      neutros: numero(res.neutros),
      detratores: numero(res.detratores),
      nps: numeroOuNulo(res.nps),
    },
    itens: lista(r.itens).map((i): PosVendaItem => {
      const x = objeto(i);
      const bloqueio = texto(x.bloqueio);
      return {
        id: String(x.id),
        acompanhamentoId: String(x.acompanhamento_id),
        familiaId: String(x.familia_id),
        familiaNome: String(x.familia_nome ?? ""),
        estagio: (texto(x.estagio) ?? "protocolo_ultimo_dia_concluido") as EstagioPosVenda,
        nps: numeroOuNulo(x.nps),
        classificacao: texto(x.classificacao) as ClassificacaoNps | null,
        depoimentoAutorizado: boolOuNulo(x.depoimento_autorizado),
        autorizacaoImagem: boolOuNulo(x.autorizacao_imagem),
        pesquisaEnviadaEm: texto(x.pesquisa_enviada_em),
        pesquisaRespondidaEm: texto(x.pesquisa_respondida_em),
        pesquisaExpiraEm: texto(x.pesquisa_expira_em),
        linkAtivo: x.link_ativo === true,
        bloqueio: bloqueio === "freio" || bloqueio === "nao_contatar" ? bloqueio : null,
        podeGerarLink: x.pode_gerar_link === true,
        acaoExecutadaEm: texto(x.acao_executada_em),
        criadoEm: texto(x.criado_em) ?? "",
      };
    }),
  };
}

export function linkDoBanco(valor: Json): ResultadoLinkPesquisa {
  const x = objeto(valor);
  if (x.bloqueado === true) {
    return { bloqueado: true, motivo: texto(x.motivo) ?? "familia_em_estado_sensivel" };
  }
  return {
    bloqueado: false,
    token: String(x.token),
    expiraEm: String(x.expira_em),
    texto: texto(x.texto),
  };
}

export function criarOcorrenciaSupabase(
  contexto: ContextoSupabase,
): OcorrenciaRepositorio {
  const chamar = (funcao: string, args: Record<string, unknown>) =>
    rpcPendente(contexto.cliente, funcao, args);
  return {
    async listar(situacao, familiaId) {
      return listaOcorrenciasDoBanco(
        await chamar("ocorrencias", {
          p_situacao: situacao,
          p_familia_id: familiaId ?? null,
        }),
      );
    },
    async obter(ocorrenciaId) {
      return detalheOcorrenciaDoBanco(
        await chamar("ocorrencia", { p_ocorrencia_id: ocorrenciaId }),
      );
    },
    async responsaveis() {
      return lista(await chamar("responsaveis_ocorrencia", {})).map((p) => {
        const x = objeto(p);
        return { id: String(x.id), nome: String(x.nome ?? "") };
      });
    },
    async registrar(pedido) {
      const r = objeto(
        await chamar("registrar_ocorrencia", {
          p_familia_id: pedido.familiaId,
          p_profissional_id: pedido.profissionalId,
          p_tipo: pedido.tipo,
          p_prioridade: pedido.prioridade,
          p_privada: pedido.privada,
          p_titulo: pedido.titulo,
          p_descricao: pedido.descricao,
          p_responsavel_id: pedido.responsavelId,
        }),
      );
      return { id: String(r.id), privada: r.privada === true };
    },
    async atualizar(pedido) {
      const r = objeto(
        await chamar("atualizar_ocorrencia", {
          p_ocorrencia_id: pedido.ocorrenciaId,
          p_status: pedido.status ?? null,
          p_responsavel_id: pedido.responsavelId ?? null,
          p_prioridade: pedido.prioridade ?? null,
          p_privada: pedido.privada ?? null,
          p_nota: pedido.nota ?? null,
          p_versao_base: pedido.versaoBase ?? null,
        }),
      );
      return {
        id: String(r.id),
        status: (texto(r.status) ?? "aberta") as StatusOcorrencia,
        versao: numero(r.versao) || 1,
      };
    },
  };
}

export function criarPosVendaSupabase(
  contexto: ContextoSupabase,
): PosVendaRepositorio {
  const chamar = (funcao: string, args: Record<string, unknown>) =>
    rpcPendente(contexto.cliente, funcao, args);
  return {
    async listar(situacao) {
      return listaPosVendaDoBanco(await chamar("pos_vendas", { p_situacao: situacao }));
    },
    async gerarLink(posVendaId) {
      return linkDoBanco(await chamar("gerar_link_pesquisa", { p_pos_venda_id: posVendaId }));
    },
    async marcarEnviada(posVendaId) {
      await chamar("marcar_pesquisa_enviada", { p_pos_venda_id: posVendaId });
    },
    async avancar(posVendaId) {
      const r = objeto(await chamar("avancar_pos_venda", { p_pos_venda_id: posVendaId }));
      return { estagio: (texto(r.estagio) ?? "arquivado") as EstagioPosVenda };
    },
  };
}
