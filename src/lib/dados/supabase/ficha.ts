import "server-only";
import type { FichaRepositorio } from "../repositorios";
import type { EstadoSensivel, Ficha, ResultadoFreio } from "../tipos";
import { exigir, type ContextoSupabase } from "./comum";
import {
  cartaoDaLinha,
  COLUNAS_FAMILIA,
  familiasComTransferenciaAberta,
  resumoDaLinha,
  type LinhaFamilia,
} from "./familias";

export function criarFichaSupabase(contexto: ContextoSupabase): FichaRepositorio {
  const { cliente } = contexto;

  async function freio(chamada: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>, nome: string): Promise<ResultadoFreio> {
    const resposta = exigir(await chamada, nome);
    return { ok: true, resposta: resposta as ResultadoFreio["resposta"] };
  }

  return {
    async obterFicha(familiaId) {
      const familia = exigir(
        await cliente.from("familia").select(COLUNAS_FAMILIA).eq("id", familiaId).maybeSingle(),
        "ficha: família",
      ) as unknown as LinhaFamilia | null;
      if (!familia) return null;

      const [pessoas, oportunidades] = await Promise.all([
        cliente
          .from("pessoa")
          .select("id, papel, nome, telefone_e164, email, contato_principal")
          .eq("familia_id", familiaId)
          .order("contato_principal", { ascending: false }),
        cliente
          .from("oportunidade")
          .select(
            "id, familia_id, pipeline, estagio_p1, estagio_p2, classificacao, score, responsavel_id, proximo_contato_em, pdf_enviado_em, motivo_perda, atualizado_em",
          )
          .eq("familia_id", familiaId)
          .order("criado_em", { ascending: false })
          .limit(1),
      ]);

      const linhasPessoas = exigir(pessoas, "ficha: pessoas");
      const linhasOportunidade = exigir(oportunidades, "ficha: oportunidade");
      const abertas = await familiasComTransferenciaAberta(contexto, [familiaId]);
      const oportunidade = linhasOportunidade[0];

      const ficha: Ficha = {
        familia: {
          ...resumoDaLinha(familia),
          dataAlta: familia.data_alta,
          dataInicioEfetivo: familia.data_inicio_efetivo,
          estadoSensivelEm: familia.estado_sensivel_em,
          primeiraGestacao: familia.primeira_gestacao,
        },
        pessoas: linhasPessoas.map((p) => ({
          id: p.id,
          papel: p.papel,
          nome: p.nome,
          telefoneE164: p.telefone_e164,
          email: p.email,
          contatoPrincipal: p.contato_principal,
        })),
        oportunidade: oportunidade ? cartaoDaLinha({ ...oportunidade, familia }, abertas) : null,
      };
      return ficha;
    },

    async linhaDoTempo(familiaId) {
      const linhas = exigir(
        await cliente
          .from("evento_familia")
          .select("id, tipo, titulo, criado_em, restrito, dados")
          .eq("familia_id", familiaId)
          .order("criado_em", { ascending: false }),
        "linha do tempo",
      );
      return linhas.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        titulo: e.titulo,
        criadoEm: e.criado_em,
        restrito: e.restrito,
        dados: e.dados,
      }));
    },

    async dadosContrato(pessoaId, completo) {
      return exigir(
        await cliente.schema("api").rpc("dados_contrato", { pessoa_id: pessoaId, completo }),
        "api.dados_contrato",
      );
    },

    acionarFreio(familiaId, estado: EstadoSensivel, motivo) {
      return freio(
        cliente.schema("api").rpc("acionar_freio", { familia_id: familiaId, estado, motivo }),
        "api.acionar_freio",
      );
    },

    desfazerFreio(familiaId) {
      return freio(
        cliente.schema("api").rpc("desfazer_freio", { familia_id: familiaId }),
        "api.desfazer_freio",
      );
    },

    justificarFreio(familiaId, motivo) {
      return freio(
        cliente.schema("api").rpc("justificar_freio", { familia_id: familiaId, motivo }),
        "api.justificar_freio",
      );
    },

    reverterFreio(familiaId, estado, justificativa) {
      return freio(
        cliente
          .schema("api")
          .rpc("reverter_freio", { familia_id: familiaId, estado, justificativa }),
        "api.reverter_freio",
      );
    },
  };
}
