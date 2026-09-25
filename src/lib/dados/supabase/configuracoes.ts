import "server-only";
import { ErroRepositorio } from "../erros";
import type { ConfiguracoesRepositorio } from "../repositorios";
import type { MensagemModelo, PacoteVigente, Parametro } from "../tipos";
import { exigir, type ContextoSupabase } from "./comum";

type LinhaParametro = {
  chave: string;
  valor: Parametro["valor"];
  descricao: string | null;
  atualizado_em: string;
};

type LinhaMensagem = {
  chave: string;
  canal: MensagemModelo["canal"];
  destinatario: string;
  texto: string;
  variaveis: string[];
  status: MensagemModelo["status"];
  aprovado_em: string | null;
};

const parametroDaLinha = (p: LinhaParametro): Parametro => ({
  chave: p.chave,
  valor: p.valor,
  descricao: p.descricao,
  atualizadoEm: p.atualizado_em,
});

const mensagemDaLinha = (m: LinhaMensagem): MensagemModelo => ({
  chave: m.chave,
  canal: m.canal,
  destinatario: m.destinatario,
  texto: m.texto,
  variaveis: m.variaveis,
  status: m.status,
  aprovadoEm: m.aprovado_em,
});

const COLUNAS_MENSAGEM =
  "chave, canal, destinatario, texto, variaveis, status, aprovado_em";

export function criarConfiguracoesSupabase({
  cliente,
}: ContextoSupabase): ConfiguracoesRepositorio {
  return {
    async lerParametro(chave) {
      // A RLS de parametro hoje só deixa a diretoria ler (ADR 0002). Para os
      // outros papéis a linha não vem e a resposta é null, sem erro.
      const linha = exigir(
        await cliente
          .from("parametro")
          .select("chave, valor, descricao, atualizado_em")
          .eq("chave", chave)
          .maybeSingle(),
        `parâmetro ${chave}`,
      );
      return linha ? parametroDaLinha(linha) : null;
    },

    async listarParametros() {
      const linhas = exigir(
        await cliente
          .from("parametro")
          .select("chave, valor, descricao, atualizado_em")
          .order("chave"),
        "parâmetros",
      );
      return linhas.map(parametroDaLinha);
    },

    async obterMensagemModelo(chave) {
      const linha = exigir(
        await cliente
          .from("mensagem_modelo")
          .select(COLUNAS_MENSAGEM)
          .eq("chave", chave)
          .maybeSingle(),
        `mensagem ${chave}`,
      );
      return linha ? mensagemDaLinha(linha) : null;
    },

    async listarMensagensModelo(filtro = {}) {
      let consulta = cliente
        .from("mensagem_modelo")
        .select(COLUNAS_MENSAGEM)
        .order("chave");
      if (filtro.destinatario)
        consulta = consulta.eq("destinatario", filtro.destinatario);
      return exigir(await consulta, "mensagens").map(mensagemDaLinha);
    },

    async listarPacotesVigentes(data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        throw new ErroRepositorio(
          "recusado",
          `data fora do formato aaaa-mm-dd: ${data}`,
        );
      }
      const linhas = exigir(
        await cliente
          .from("pacote_versao")
          .select(
            "id, valor_centavos, parcelas_max_sem_juros, vigencia_inicio, vigencia_fim, pacote:pacote_id!inner ( id, nome, dias, gemelar, ativo, ordem )",
          )
          .lte("vigencia_inicio", data)
          .or(`vigencia_fim.is.null,vigencia_fim.gte.${data}`)
          .eq("pacote.ativo", true),
        "pacotes vigentes",
      );
      return linhas
        .map((v): PacoteVigente & { ordem: number } => ({
          pacoteId: v.pacote.id,
          versaoId: v.id,
          nome: v.pacote.nome,
          dias: v.pacote.dias,
          gemelar: v.pacote.gemelar,
          valorCentavos: v.valor_centavos,
          parcelasMaxSemJuros: v.parcelas_max_sem_juros,
          vigenciaInicio: v.vigencia_inicio,
          ordem: v.pacote.ordem,
        }))
        .sort((a, b) => a.ordem - b.ordem)
        .map(({ ordem: _ordem, ...pacote }) => pacote);
    },

    async listarRegioes() {
      const linhas = exigir(
        await cliente
          .from("regiao")
          .select("id, nome, praca, taxa_deslocamento_centavos, ativa")
          .order("nome"),
        "regiões",
      );
      return linhas.map((r) => ({
        id: r.id,
        nome: r.nome,
        praca: r.praca,
        taxaDeslocamentoCentavos: r.taxa_deslocamento_centavos,
        ativa: r.ativa,
      }));
    },
  };
}
