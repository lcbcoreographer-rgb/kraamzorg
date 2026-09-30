import "server-only";
import type { Json } from "@/lib/db/types";
import type { CobrancaRepositorio } from "../repositorios";
import type {
  CobrancaDetalhe,
  DadosLinkPagamento,
  LinhaCobranca,
  ListaCobrancas,
  SituacaoCobranca,
} from "../tipos-contrato";
import { exigir, type ContextoSupabase } from "./comum";

/**
 * Cobrança na real (P32): funções do schema api da
 * 0019_contrato_cobranca.sql. Financeiro e diretoria, AAL2, conferidos por
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

export function listaCobrancasDoBanco(valor: Json): ListaCobrancas {
  const r = objeto(valor);
  const res = objeto(r.resumo);
  return {
    resumo: {
      abertas: numero(res.abertas),
      vencidas: numero(res.vencidas),
      pagas: numero(res.pagas),
      aReceberCentavos: numero(res.a_receber_centavos),
      recebidoCentavos: numero(res.recebido_centavos),
    },
    cobrancas: lista(r.cobrancas).map((c): LinhaCobranca => {
      const x = objeto(c);
      return {
        id: String(x.id),
        contratoId: String(x.contrato_id),
        familiaId: String(x.familia_id),
        familiaNome: String(x.familia_nome ?? ""),
        parcela: numero(x.parcela) || 1,
        valorCentavos: numero(x.valor_centavos),
        vencimento: texto(x.vencimento) ?? "",
        situacao: (texto(x.situacao) ?? "aberta") as SituacaoCobranca,
        pagoEm: texto(x.pago_em),
        valorPagoCentavos: numeroOuNulo(x.valor_pago_centavos),
        metodo: texto(x.capture_method),
        parcelasCartao: numeroOuNulo(x.parcelas_cartao),
        temLink: x.tem_link === true,
        notaStatus: texto(x.nota_status),
      };
    }),
  };
}

export function detalheDoBanco(valor: Json): CobrancaDetalhe {
  const x = objeto(valor);
  const nota = x.nota ? objeto(x.nota) : null;
  const comprovante = texto(x.comprovante);
  return {
    id: String(x.id),
    contratoId: String(x.contrato_id),
    contratoStatus: String(x.contrato_status ?? ""),
    familiaId: String(x.familia_id),
    familiaNome: String(x.familia_nome ?? ""),
    pagadorNome: texto(x.pagador_nome),
    parcela: numero(x.parcela) || 1,
    valorCentavos: numero(x.valor_centavos),
    vencimento: texto(x.vencimento) ?? "",
    situacao: (texto(x.situacao) ?? "aberta") as SituacaoCobranca,
    pagoEm: texto(x.pago_em),
    valorPagoCentavos: numeroOuNulo(x.valor_pago_centavos),
    metodo: texto(x.capture_method),
    parcelasCartao: numeroOuNulo(x.parcelas_cartao),
    parcelasContrato: numero(x.parcelas_contrato) || 1,
    parcelasMax: numeroOuNulo(x.parcelas_max),
    acimaDoLimite: x.acima_do_limite === true,
    linkPagamento: texto(x.link_pagamento),
    comprovante:
      comprovante === "arquivo" || comprovante === "recibo" ? comprovante : null,
    reciboUrl: texto(x.recibo_url),
    comprovantePath: texto(x.comprovante_path),
    nota: nota
      ? { status: String(nota.status ?? ""), numero: texto(nota.numero) }
      : null,
    podeGerarLink: x.pode_gerar_link === true,
    podeBaixarManual: x.pode_baixar_manual === true,
    comprovanteMaxBytes: numeroOuNulo(x.comprovante_max_bytes),
  };
}

export function dadosLinkDoBanco(valor: Json): DadosLinkPagamento {
  const x = objeto(valor);
  const c = objeto(x.cliente);
  return {
    cobrancaId: String(x.cobranca_id),
    contratoId: String(x.contrato_id),
    familiaId: String(x.familia_id),
    valorCentavos: numero(x.valor_centavos),
    parcelas: numero(x.parcelas) || 1,
    parcelasMax: numero(x.parcelas_max) || 1,
    acimaDoLimite: x.acima_do_limite === true,
    descricao: texto(x.descricao) ?? "",
    cliente: {
      nome: String(c.nome ?? ""),
      email: texto(c.email),
      telefone: texto(c.telefone),
    },
  };
}

export function criarCobrancaSupabase(
  contexto: ContextoSupabase,
): CobrancaRepositorio {
  const api = () => contexto.cliente.schema("api");

  return {
    async listar(situacao) {
      return listaCobrancasDoBanco(
        exigir(
          await api().rpc("cobrancas", { situacao: situacao ?? undefined }),
          "api.cobrancas",
        ),
      );
    },

    async obter(cobrancaId) {
      return detalheDoBanco(
        exigir(
          await api().rpc("cobranca", { cobranca_id: cobrancaId }),
          "api.cobranca",
        ),
      );
    },

    async gerarDoContrato(contratoId) {
      const r = objeto(
        exigir(
          await api().rpc("gerar_cobranca", { contrato_id: contratoId }),
          "api.gerar_cobranca",
        ),
      );
      return String(r.cobranca_id);
    },

    async dadosLinkPagamento(cobrancaId) {
      return dadosLinkDoBanco(
        exigir(
          await api().rpc("dados_link_pagamento", {
            cobranca_id: cobrancaId,
          }),
          "api.dados_link_pagamento",
        ),
      );
    },

    async registrarLink(cobrancaId, url, slug) {
      exigir(
        await api().rpc("registrar_link_pagamento", {
          cobranca_id: cobrancaId,
          url,
          slug: slug ?? undefined,
        }),
        "api.registrar_link_pagamento",
      );
    },

    async baixarManual(pedido) {
      exigir(
        await api().rpc("baixar_cobranca_manual", {
          cobranca_id: pedido.cobrancaId,
          valor_pago_centavos: pedido.valorPagoCentavos,
          comprovante_path: pedido.comprovantePath,
          motivo: pedido.motivo,
        }),
        "api.baixar_cobranca_manual",
      );
    },
  };
}
