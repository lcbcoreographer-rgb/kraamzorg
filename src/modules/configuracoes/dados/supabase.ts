import "server-only";
import { ErroRepositorio } from "@/lib/dados/erros";
import type { Tables } from "@/lib/db/types";
import { exigir, type ContextoSupabase } from "@/lib/dados/supabase/comum";
import type { ConfiguracoesModuloRepositorio } from "./repositorio";
import type {
  Cidade,
  CondicaoComercial,
  MensagemModeloDetalhe,
  Pacote,
  RegiaoDetalhe,
  ReguaFaixaDetalhe,
  TermoAlerta,
  VersaoPacote,
} from "./tipos";

interface RespostaLinha<T> {
  data: T | null;
  error: { code?: string; message?: string } | null;
}

/**
 * `exigir()` (de `@/lib/dados/supabase/comum`) infere mal o tipo de uma
 * resposta de linha única (`.maybeSingle()`): o parâmetro de tipo some
 * (`never`) porque a resposta do PostgREST é uma união discriminada, e a
 * inferência automática não junta os dois ramos. Aqui o tipo é dado à mão
 * (`T`), o que evita a inferência, e a ausência de linha vira erro
 * explícito, nunca `null` silencioso onde a tela espera um registro que
 * acabou de gravar.
 */
function exigirLinha<T>(resposta: RespostaLinha<T>, contexto: string): T {
  const linha = exigir<T | null>(resposta, contexto);
  if (linha === null) {
    throw new ErroRepositorio(
      "desconhecido",
      `${contexto}: o banco não devolveu a linha esperada`,
    );
  }
  return linha;
}

/**
 * Implementação Supabase do módulo de Configurações (P13). Leitura e
 * escrita direta nas tabelas de configuração (`parametro`, `pacote`,
 * `pacote_versao`, `regiao`, `cidade`, `condicao_comercial`,
 * `mensagem_modelo`, `termo_alerta`, `regua_faixa`), todas com RLS que já
 * restringe por papel (migration 0007): a defesa é o banco, este código só
 * chama a coluna certa. O histórico do parâmetro vem de `api.log_auditoria`
 * (função existente, migration 0007), porque a tabela `log_auditoria` não
 * tem select direto para ninguém (PRD 13).
 */
export function criarConfiguracoesModuloSupabase({
  cliente,
  usuarioId,
}: ContextoSupabase): ConfiguracoesModuloRepositorio {
  return {
    // --- Parâmetros ---------------------------------------------------------
    async atualizarParametro(chave, valor) {
      exigir(
        await cliente
          .from("parametro")
          .update({ valor, atualizado_por: usuarioId })
          .eq("chave", chave)
          .select("chave")
          .maybeSingle(),
        `parâmetro ${chave}`,
      );
    },

    async criarParametro(chave, valor, descricao) {
      exigir(
        await cliente
          .from("parametro")
          .insert({ chave, valor, descricao, atualizado_por: usuarioId }),
        `criar parâmetro ${chave}`,
      );
    },

    async historicoParametro(chave) {
      const linhas = exigir(
        await cliente.schema("api").rpc("log_auditoria", {
          entidade: "parametro",
          entidade_id: chave,
          limite: 50,
        }),
        `histórico do parâmetro ${chave}`,
      );
      return linhas.map((l) => ({
        id: l.id,
        valorAntes: l.valor_antes,
        valorDepois: l.valor_depois,
        usuarioId: l.usuario_id,
        criadoEm: l.criado_em,
      }));
    },

    // --- Pacotes e versões ---------------------------------------------------
    async listarPacotesComVersoes() {
      const pacotes = exigir(
        await cliente
          .from("pacote")
          .select("id, nome, linha, dias, gemelar, pagina_pdf, ordem, ativo")
          .order("ordem"),
        "pacotes",
      );
      const versoes = exigir(
        await cliente
          .from("pacote_versao")
          .select(
            "id, pacote_id, valor_centavos, horas_por_visita, parcelas_max_sem_juros, destaque, vigencia_inicio, vigencia_fim, inclui, nao_inclui",
          )
          .order("vigencia_inicio", { ascending: false }),
        "versões de pacote",
      );
      return pacotes.map((p): PacoteVersoesLinha => ({
        id: p.id,
        nome: p.nome,
        linha: p.linha,
        dias: p.dias,
        gemelar: p.gemelar,
        paginaPdf: p.pagina_pdf,
        ordem: p.ordem,
        ativo: p.ativo,
        versoes: versoes
          .filter((v) => v.pacote_id === p.id)
          .map((v): VersaoPacote => ({
            id: v.id,
            pacoteId: v.pacote_id,
            valorCentavos: v.valor_centavos,
            horasPorVisita: v.horas_por_visita,
            parcelasMaxSemJuros: v.parcelas_max_sem_juros,
            destaque: v.destaque,
            vigenciaInicio: v.vigencia_inicio,
            vigenciaFim: v.vigencia_fim,
            inclui: v.inclui ?? [],
            naoInclui: v.nao_inclui ?? [],
          })),
      }));
    },

    async criarPacote(pedido) {
      const pacote = exigirLinha<
        Pick<
          Tables<"pacote">,
          | "id"
          | "nome"
          | "linha"
          | "dias"
          | "gemelar"
          | "pagina_pdf"
          | "ordem"
          | "ativo"
        >
      >(
        await cliente
          .from("pacote")
          .insert({
            nome: pedido.nome,
            linha: pedido.linha,
            dias: pedido.dias,
            gemelar: pedido.gemelar,
            pagina_pdf: pedido.paginaPdf,
            criado_por: usuarioId,
          })
          .select("id, nome, linha, dias, gemelar, pagina_pdf, ordem, ativo")
          .maybeSingle(),
        "criar pacote",
      );
      exigir(
        await cliente.from("pacote_versao").insert({
          pacote_id: pacote.id,
          valor_centavos: pedido.valorCentavos,
          horas_por_visita: pedido.horasPorVisita,
          parcelas_max_sem_juros: pedido.parcelasMaxSemJuros,
          vigencia_inicio: pedido.vigenciaInicio,
          inclui: pedido.inclui,
          nao_inclui: pedido.naoInclui,
          criado_por: usuarioId,
        }),
        "criar versão inicial do pacote",
      );
      return {
        id: pacote.id,
        nome: pacote.nome,
        linha: pacote.linha,
        dias: pacote.dias,
        gemelar: pacote.gemelar,
        paginaPdf: pacote.pagina_pdf,
        ordem: pacote.ordem,
        ativo: pacote.ativo,
      };
    },

    async criarVersaoPacote(pedido) {
      const vigente = exigir<Pick<
        Tables<"pacote_versao">,
        "id" | "vigencia_inicio"
      > | null>(
        await cliente
          .from("pacote_versao")
          .select("id, vigencia_inicio")
          .eq("pacote_id", pedido.pacoteId)
          .is("vigencia_fim", null)
          .maybeSingle(),
        "versão vigente do pacote",
      );
      if (vigente) {
        const diaAnterior = new Date(`${pedido.vigenciaInicio}T00:00:00Z`);
        diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
        const fim = diaAnterior.toISOString().slice(0, 10);
        if (fim < vigente.vigencia_inicio) {
          throw new ErroRepositorio(
            "recusado",
            "a nova vigência precisa começar depois do início da versão atual",
          );
        }
        // Fecha a versão vigente; ela nunca é editada de outro jeito (PRD
        // 13, aceite do P13): contratos antigos continuam com este id.
        exigir(
          await cliente
            .from("pacote_versao")
            .update({ vigencia_fim: fim })
            .eq("id", vigente.id),
          "fechar a versão anterior",
        );
      }
      const nova = exigirLinha<
        Pick<
          Tables<"pacote_versao">,
          | "id"
          | "pacote_id"
          | "valor_centavos"
          | "horas_por_visita"
          | "parcelas_max_sem_juros"
          | "destaque"
          | "vigencia_inicio"
          | "vigencia_fim"
          | "inclui"
          | "nao_inclui"
        >
      >(
        await cliente
          .from("pacote_versao")
          .insert({
            pacote_id: pedido.pacoteId,
            valor_centavos: pedido.valorCentavos,
            horas_por_visita: pedido.horasPorVisita,
            parcelas_max_sem_juros: pedido.parcelasMaxSemJuros,
            destaque: pedido.destaque,
            vigencia_inicio: pedido.vigenciaInicio,
            inclui: pedido.inclui,
            nao_inclui: pedido.naoInclui,
            criado_por: usuarioId,
          })
          .select(
            "id, pacote_id, valor_centavos, horas_por_visita, parcelas_max_sem_juros, destaque, vigencia_inicio, vigencia_fim, inclui, nao_inclui",
          )
          .maybeSingle(),
        "criar nova versão de preço",
      );
      return {
        id: nova.id,
        pacoteId: nova.pacote_id,
        valorCentavos: nova.valor_centavos,
        horasPorVisita: nova.horas_por_visita,
        parcelasMaxSemJuros: nova.parcelas_max_sem_juros,
        destaque: nova.destaque,
        vigenciaInicio: nova.vigencia_inicio,
        vigenciaFim: nova.vigencia_fim,
        inclui: nova.inclui ?? [],
        naoInclui: nova.nao_inclui ?? [],
      };
    },

    async ativarPacote(pacoteId, ativo) {
      exigir(
        await cliente.from("pacote").update({ ativo }).eq("id", pacoteId),
        "ativar ou desativar pacote",
      );
    },

    // --- Regiões e localidades -------------------------------------------------
    async listarRegioesDetalhe() {
      const linhas = exigir(
        await cliente
          .from("regiao")
          .select(
            "id, nome, praca, taxa_deslocamento_centavos, limite_familias_semana, ativa",
          )
          .order("nome"),
        "regiões",
      );
      return linhas.map((r): RegiaoDetalhe => ({
        id: r.id,
        nome: r.nome,
        praca: r.praca,
        taxaDeslocamentoCentavos: r.taxa_deslocamento_centavos,
        limiteFamiliasSemana: r.limite_familias_semana,
        ativa: r.ativa,
      }));
    },

    async criarRegiao(dados) {
      const r = exigirLinha<
        Pick<
          Tables<"regiao">,
          | "id"
          | "nome"
          | "praca"
          | "taxa_deslocamento_centavos"
          | "limite_familias_semana"
          | "ativa"
        >
      >(
        await cliente
          .from("regiao")
          .insert({
            nome: dados.nome,
            praca: dados.praca,
            taxa_deslocamento_centavos: dados.taxaDeslocamentoCentavos,
            limite_familias_semana: dados.limiteFamiliasSemana,
            ativa: dados.ativa,
            criado_por: usuarioId,
          })
          .select(
            "id, nome, praca, taxa_deslocamento_centavos, limite_familias_semana, ativa",
          )
          .maybeSingle(),
        "criar região",
      );
      return {
        id: r.id,
        nome: r.nome,
        praca: r.praca,
        taxaDeslocamentoCentavos: r.taxa_deslocamento_centavos,
        limiteFamiliasSemana: r.limite_familias_semana,
        ativa: r.ativa,
      };
    },

    async atualizarRegiao(id, dados) {
      exigir(
        await cliente
          .from("regiao")
          .update({
            ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
            ...(dados.praca !== undefined ? { praca: dados.praca } : {}),
            ...(dados.taxaDeslocamentoCentavos !== undefined
              ? { taxa_deslocamento_centavos: dados.taxaDeslocamentoCentavos }
              : {}),
            ...(dados.limiteFamiliasSemana !== undefined
              ? { limite_familias_semana: dados.limiteFamiliasSemana }
              : {}),
            ...(dados.ativa !== undefined ? { ativa: dados.ativa } : {}),
          })
          .eq("id", id),
        "atualizar região",
      );
    },

    async listarCidades() {
      const linhas = exigir(
        await cliente
          .from("cidade")
          .select(
            "id, nome, uf, regiao_id, atendida, requer_confirmacao, taxa_deslocamento_centavos, aliases, observacao",
          )
          .order("nome"),
        "cidades",
      );
      return linhas.map((c): Cidade => ({
        id: c.id,
        nome: c.nome,
        uf: c.uf,
        regiaoId: c.regiao_id,
        atendida: c.atendida,
        requerConfirmacao: c.requer_confirmacao,
        taxaDeslocamentoCentavos: c.taxa_deslocamento_centavos,
        aliases: c.aliases,
        observacao: c.observacao,
      }));
    },

    async criarCidade(dados) {
      const c = exigirLinha<
        Pick<
          Tables<"cidade">,
          | "id"
          | "nome"
          | "uf"
          | "regiao_id"
          | "atendida"
          | "requer_confirmacao"
          | "taxa_deslocamento_centavos"
          | "aliases"
          | "observacao"
        >
      >(
        await cliente
          .from("cidade")
          .insert({
            nome: dados.nome,
            uf: dados.uf,
            regiao_id: dados.regiaoId,
            atendida: dados.atendida,
            requer_confirmacao: dados.requerConfirmacao,
            taxa_deslocamento_centavos: dados.taxaDeslocamentoCentavos,
            aliases: dados.aliases,
            observacao: dados.observacao,
            criado_por: usuarioId,
          })
          .select(
            "id, nome, uf, regiao_id, atendida, requer_confirmacao, taxa_deslocamento_centavos, aliases, observacao",
          )
          .maybeSingle(),
        "criar cidade",
      );
      return {
        id: c.id,
        nome: c.nome,
        uf: c.uf,
        regiaoId: c.regiao_id,
        atendida: c.atendida,
        requerConfirmacao: c.requer_confirmacao,
        taxaDeslocamentoCentavos: c.taxa_deslocamento_centavos,
        aliases: c.aliases,
        observacao: c.observacao,
      };
    },

    async atualizarCidade(id, dados) {
      exigir(
        await cliente
          .from("cidade")
          .update({
            ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
            ...(dados.uf !== undefined ? { uf: dados.uf } : {}),
            ...(dados.regiaoId !== undefined
              ? { regiao_id: dados.regiaoId }
              : {}),
            ...(dados.atendida !== undefined
              ? { atendida: dados.atendida }
              : {}),
            ...(dados.requerConfirmacao !== undefined
              ? { requer_confirmacao: dados.requerConfirmacao }
              : {}),
            ...(dados.taxaDeslocamentoCentavos !== undefined
              ? { taxa_deslocamento_centavos: dados.taxaDeslocamentoCentavos }
              : {}),
            ...(dados.aliases !== undefined ? { aliases: dados.aliases } : {}),
            ...(dados.observacao !== undefined
              ? { observacao: dados.observacao }
              : {}),
          })
          .eq("id", id),
        "atualizar cidade",
      );
    },

    // --- Condições comerciais --------------------------------------------------
    async listarCondicoesComerciais() {
      const linhas = exigir(
        await cliente
          .from("condicao_comercial")
          .select("id, nome, tipo, valor, requer_aprovacao, ativa, observacao")
          .order("nome"),
        "condições comerciais",
      );
      return linhas.map((c): CondicaoComercial => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo as CondicaoComercial["tipo"],
        valor: c.valor,
        requerAprovacao: c.requer_aprovacao,
        ativa: c.ativa,
        observacao: c.observacao,
      }));
    },

    async criarCondicaoComercial(dados) {
      const c = exigirLinha<
        Pick<
          Tables<"condicao_comercial">,
          | "id"
          | "nome"
          | "tipo"
          | "valor"
          | "requer_aprovacao"
          | "ativa"
          | "observacao"
        >
      >(
        await cliente
          .from("condicao_comercial")
          .insert({
            nome: dados.nome,
            tipo: dados.tipo,
            valor: dados.valor,
            requer_aprovacao: dados.requerAprovacao,
            ativa: dados.ativa,
            observacao: dados.observacao,
            criado_por: usuarioId,
          })
          .select("id, nome, tipo, valor, requer_aprovacao, ativa, observacao")
          .maybeSingle(),
        "criar condição comercial",
      );
      return {
        id: c.id,
        nome: c.nome,
        tipo: c.tipo as CondicaoComercial["tipo"],
        valor: c.valor,
        requerAprovacao: c.requer_aprovacao,
        ativa: c.ativa,
        observacao: c.observacao,
      };
    },

    async atualizarCondicaoComercial(id, dados) {
      exigir(
        await cliente
          .from("condicao_comercial")
          .update({
            ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
            ...(dados.tipo !== undefined ? { tipo: dados.tipo } : {}),
            ...(dados.valor !== undefined ? { valor: dados.valor } : {}),
            ...(dados.requerAprovacao !== undefined
              ? { requer_aprovacao: dados.requerAprovacao }
              : {}),
            ...(dados.ativa !== undefined ? { ativa: dados.ativa } : {}),
            ...(dados.observacao !== undefined
              ? { observacao: dados.observacao }
              : {}),
          })
          .eq("id", id),
        "atualizar condição comercial",
      );
    },

    // --- Mensagens ---------------------------------------------------------------
    async listarMensagensDetalhe() {
      const linhas = exigir(
        await cliente
          .from("mensagem_modelo")
          .select(
            "chave, canal, destinatario, texto, variaveis, status, aprovado_por, aprovado_em, atualizado_em",
          )
          .order("chave"),
        "mensagens",
      );
      return linhas.map((m): MensagemModeloDetalhe => ({
        chave: m.chave,
        canal: m.canal,
        destinatario: m.destinatario,
        texto: m.texto,
        variaveis: m.variaveis,
        status: m.status,
        aprovadoEm: m.aprovado_em,
        aprovadoPor: m.aprovado_por,
        atualizadoEm: m.atualizado_em,
      }));
    },

    async salvarRascunhoMensagem(chave, dados) {
      exigir(
        await cliente.from("mensagem_modelo").upsert(
          {
            chave,
            canal: dados.canal,
            destinatario: dados.destinatario,
            texto: dados.texto,
            variaveis: dados.variaveis,
            status: "rascunho",
            aprovado_por: null,
            aprovado_em: null,
          },
          { onConflict: "chave" },
        ),
        `salvar rascunho da mensagem ${chave}`,
      );
    },

    async aprovarMensagem(chave) {
      exigir(
        await cliente
          .from("mensagem_modelo")
          .update({
            status: "aprovado",
            aprovado_por: usuarioId,
            aprovado_em: new Date().toISOString(),
          })
          .eq("chave", chave),
        `aprovar mensagem ${chave}`,
      );
    },

    async arquivarMensagem(chave) {
      exigir(
        await cliente
          .from("mensagem_modelo")
          .update({ status: "arquivado" })
          .eq("chave", chave),
        `arquivar mensagem ${chave}`,
      );
    },

    // --- Termos de alerta ----------------------------------------------------------
    async listarTermosAlerta() {
      const linhas = exigir(
        await cliente
          .from("termo_alerta")
          .select("id, termo, acao, mensagem_chave, ativo")
          .order("termo"),
        "termos de alerta",
      );
      return linhas.map((t): TermoAlerta => ({
        id: t.id,
        termo: t.termo,
        acao: t.acao,
        mensagemChave: t.mensagem_chave,
        ativo: t.ativo,
      }));
    },

    async criarTermoAlerta(dados) {
      const t = exigirLinha<
        Pick<
          Tables<"termo_alerta">,
          "id" | "termo" | "acao" | "mensagem_chave" | "ativo"
        >
      >(
        await cliente
          .from("termo_alerta")
          .insert({
            termo: dados.termo,
            acao: dados.acao,
            mensagem_chave: dados.mensagemChave,
            ativo: dados.ativo,
            criado_por: usuarioId,
          })
          .select("id, termo, acao, mensagem_chave, ativo")
          .maybeSingle(),
        "criar termo de alerta",
      );
      return {
        id: t.id,
        termo: t.termo,
        acao: t.acao,
        mensagemChave: t.mensagem_chave,
        ativo: t.ativo,
      };
    },

    async atualizarTermoAlerta(id, dados) {
      exigir(
        await cliente
          .from("termo_alerta")
          .update({
            ...(dados.termo !== undefined ? { termo: dados.termo } : {}),
            ...(dados.acao !== undefined ? { acao: dados.acao } : {}),
            ...(dados.mensagemChave !== undefined
              ? { mensagem_chave: dados.mensagemChave }
              : {}),
            ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
          })
          .eq("id", id),
        "atualizar termo de alerta",
      );
    },

    // --- Faixas da régua -----------------------------------------------------------
    async listarFaixasRegua() {
      const linhas = exigir(
        await cliente
          .from("regua_faixa")
          .select(
            "id, ordem, semana_min, semana_max, objetivo, gatilho_comercial, mensagem_chave",
          )
          .order("ordem"),
        "faixas da régua",
      );
      return linhas.map((f): ReguaFaixaDetalhe => ({
        id: f.id,
        ordem: f.ordem,
        semanaMin: f.semana_min,
        semanaMax: f.semana_max,
        objetivo: f.objetivo,
        gatilhoComercial: f.gatilho_comercial,
        mensagemChave: f.mensagem_chave,
      }));
    },

    async atualizarFaixaRegua(id, dados) {
      exigir(
        await cliente
          .from("regua_faixa")
          .update({
            ...(dados.semanaMin !== undefined
              ? { semana_min: dados.semanaMin }
              : {}),
            ...(dados.semanaMax !== undefined
              ? { semana_max: dados.semanaMax }
              : {}),
            ...(dados.objetivo !== undefined
              ? { objetivo: dados.objetivo }
              : {}),
            ...(dados.gatilhoComercial !== undefined
              ? { gatilho_comercial: dados.gatilhoComercial }
              : {}),
            ...(dados.mensagemChave !== undefined
              ? { mensagem_chave: dados.mensagemChave }
              : {}),
          })
          .eq("id", id),
        "atualizar faixa da régua",
      );
    },
  };
}

interface PacoteVersoesLinha extends Pacote {
  versoes: VersaoPacote[];
}
