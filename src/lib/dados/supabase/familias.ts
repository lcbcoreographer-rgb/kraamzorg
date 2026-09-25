import "server-only";
import type { FamiliasRepositorio } from "../repositorios";
import type {
  CartaoOportunidade,
  EstagioP1,
  EstagioP2,
  FiltroFamilias,
  FiltroPipeline,
  NumeroPipeline,
  PedidoTransicao,
  ResumoFamilia,
} from "../tipos";
import { exigir, limparBusca, type ContextoSupabase } from "./comum";

/**
 * Colunas de `familia` que todo papel com leitura recebe. Nunca `select *`:
 * origem, UTM, indicação e histórico sensível estão fora do grant de
 * leitura (ADR 0002) e um `*` faria o PostgREST recusar a consulta inteira.
 */
export const COLUNAS_FAMILIA =
  "id, nome_exibicao, bairro, dpp, data_nascimento, data_alta, data_inicio_efetivo, gemelar, primeira_gestacao, estado_sensivel, estado_sensivel_em, nao_contatar, regiao_id, cidade:cidade_id ( nome, uf )" as const;

const SELECT_CARTAO = `
  id, familia_id, pipeline, estagio_p1, estagio_p2, classificacao, score,
  responsavel_id, proximo_contato_em, pdf_enviado_em, motivo_perda, atualizado_em,
  familia:familia_id!inner ( ${COLUNAS_FAMILIA}, mesclada_em_id )
` as const;

type LinhaCartao = {
  id: string;
  familia_id: string;
  pipeline: number;
  estagio_p1: EstagioP1 | null;
  estagio_p2: EstagioP2 | null;
  classificacao: CartaoOportunidade["classificacao"];
  score: number | null;
  responsavel_id: string | null;
  proximo_contato_em: string | null;
  pdf_enviado_em: string | null;
  motivo_perda: CartaoOportunidade["motivoPerda"];
  atualizado_em: string;
  familia: LinhaFamilia;
};

export type LinhaFamilia = {
  id: string;
  nome_exibicao: string;
  bairro: string | null;
  dpp: string | null;
  data_nascimento: string | null;
  data_alta: string | null;
  data_inicio_efetivo: string | null;
  gemelar: boolean;
  primeira_gestacao: boolean | null;
  estado_sensivel: ResumoFamilia["estadoSensivel"];
  estado_sensivel_em: string | null;
  nao_contatar: boolean;
  regiao_id: string | null;
  cidade: { nome: string; uf: string } | null;
};

export function resumoDaLinha(linha: LinhaFamilia): ResumoFamilia {
  return {
    id: linha.id,
    nome: linha.nome_exibicao,
    bairro: linha.bairro,
    cidade: linha.cidade?.nome ?? null,
    uf: linha.cidade?.uf ?? null,
    dpp: linha.dpp,
    dataNascimento: linha.data_nascimento,
    estadoSensivel: linha.estado_sensivel,
    naoContatar: linha.nao_contatar,
    gemelar: linha.gemelar,
  };
}

export function cartaoDaLinha(linha: LinhaCartao, comTransferencia: Set<string>): CartaoOportunidade {
  return {
    oportunidadeId: linha.id,
    familiaId: linha.familia_id,
    nomeFamilia: linha.familia.nome_exibicao,
    pipeline: linha.pipeline === 2 ? 2 : 1,
    estagioP1: linha.estagio_p1,
    estagioP2: linha.estagio_p2,
    classificacao: linha.classificacao,
    score: linha.score,
    responsavelId: linha.responsavel_id,
    dpp: linha.familia.dpp,
    dataNascimento: linha.familia.data_nascimento,
    cidade: linha.familia.cidade?.nome ?? null,
    uf: linha.familia.cidade?.uf ?? null,
    bairro: linha.familia.bairro,
    estadoSensivel: linha.familia.estado_sensivel,
    proximoContatoEm: linha.proximo_contato_em,
    pdfEnviadoEm: linha.pdf_enviado_em,
    motivoPerda: linha.motivo_perda,
    atualizadoEm: linha.atualizado_em,
    transferenciaAberta: comTransferencia.has(linha.familia_id),
  };
}

export async function familiasComTransferenciaAberta(
  { cliente }: ContextoSupabase,
  familiaIds: string[],
): Promise<Set<string>> {
  if (familiaIds.length === 0) return new Set();
  const linhas = exigir(
    await cliente
      .from("handoff")
      .select("familia_id")
      .in("familia_id", familiaIds)
      .in("status", ["aberto", "assumido"]),
    "handoff abertos",
  );
  return new Set(linhas.map((l) => l.familia_id).filter((id): id is string => Boolean(id)));
}

export function criarFamiliasSupabase(contexto: ContextoSupabase): FamiliasRepositorio {
  const { cliente } = contexto;

  return {
    async listarPipeline(filtro: FiltroPipeline) {
      let consulta = cliente
        .from("oportunidade")
        .select(SELECT_CARTAO)
        .eq("pipeline", filtro.pipeline)
        .is("familia.mesclada_em_id", null)
        .order("atualizado_em", { ascending: false });

      if (filtro.estagio) {
        consulta =
          filtro.pipeline === 1
            ? consulta.eq("estagio_p1", filtro.estagio as EstagioP1)
            : consulta.eq("estagio_p2", filtro.estagio as EstagioP2);
      }
      if (filtro.regiaoId) consulta = consulta.eq("familia.regiao_id", filtro.regiaoId);
      if (filtro.responsavelId) consulta = consulta.eq("responsavel_id", filtro.responsavelId);
      if (filtro.classificacao) consulta = consulta.eq("classificacao", filtro.classificacao);
      if (filtro.busca && limparBusca(filtro.busca)) {
        consulta = consulta.ilike("familia.nome_exibicao", `%${limparBusca(filtro.busca)}%`);
      }

      const linhas = exigir(await consulta, "pipeline") as unknown as LinhaCartao[];
      const abertas = await familiasComTransferenciaAberta(
        contexto,
        linhas.map((l) => l.familia_id),
      );
      return linhas.map((linha) => cartaoDaLinha(linha, abertas));
    },

    async contarPorEstagio(pipeline: NumeroPipeline) {
      const linhas = exigir(
        await cliente
          .from("oportunidade")
          .select("estagio_p1, estagio_p2")
          .eq("pipeline", pipeline),
        "contagem por estágio",
      );
      const contagem: Partial<Record<EstagioP1 | EstagioP2, number>> = {};
      for (const linha of linhas) {
        const estagio = pipeline === 1 ? linha.estagio_p1 : linha.estagio_p2;
        if (estagio) contagem[estagio] = (contagem[estagio] ?? 0) + 1;
      }
      return contagem;
    },

    async listarFamilias(filtro: FiltroFamilias = {}) {
      let consulta = cliente
        .from("familia")
        .select(COLUNAS_FAMILIA)
        .is("mesclada_em_id", null)
        .order("nome_exibicao")
        .limit(filtro.limite ?? 200);
      if (filtro.busca && limparBusca(filtro.busca)) {
        consulta = consulta.ilike("nome_exibicao", `%${limparBusca(filtro.busca)}%`);
      }
      const linhas = exigir(await consulta, "famílias") as unknown as LinhaFamilia[];
      return linhas.map(resumoDaLinha);
    },

    async transicionar(pedido: PedidoTransicao) {
      return exigir(
        await cliente.schema("api").rpc("transicionar", {
          maquina: pedido.maquina,
          entidade_id: pedido.entidadeId,
          para: pedido.para,
          motivo: pedido.motivo,
        }),
        "api.transicionar",
      );
    },
  };
}
