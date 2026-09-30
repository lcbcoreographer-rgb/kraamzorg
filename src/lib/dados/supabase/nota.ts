import "server-only";
import type { Json } from "@/lib/db/types";
import type {
  DadosEmissaoNota,
  EstadoNota,
  ListaNotas,
  NotaDetalhe,
  NotaRepositorio,
  NotaResumo,
} from "../tipos-nota";
import { rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Nota fiscal na real (P43): funções do schema api da
 * 0024_evolucao_ocorrencia_nf.sql. Financeiro e diretoria, AAL2, conferidos
 * por dentro de cada função. O CPF completo de quem paga só sai de
 * `api.dados_emissao_nota`, que grava a leitura no log.
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

function resumoDoBanco(x: Registro): NotaResumo {
  return {
    id: String(x.id),
    cobrancaId: String(x.cobranca_id),
    contratoId: String(x.contrato_id),
    familiaId: String(x.familia_id),
    familiaNome: String(x.familia_nome ?? ""),
    tomadorNome: texto(x.tomador_nome),
    parcela: numero(x.parcela) || 1,
    valorCentavos: numero(x.valor_centavos),
    pagoEm: texto(x.pago_em),
    status: (texto(x.status) ?? "pendente") as EstadoNota,
    numero: texto(x.numero),
    provider: texto(x.provider),
    erro: texto(x.erro),
    tentativas: numero(x.tentativas),
    manual: x.manual === true,
    temPdf: x.tem_pdf === true,
    temXml: x.tem_xml === true,
    emitidaEm: texto(x.emitida_em),
    criadoEm: texto(x.criado_em) ?? "",
  };
}

export function listaNotasDoBanco(valor: Json): ListaNotas {
  const r = objeto(valor);
  const res = objeto(r.resumo);
  return {
    resumo: {
      pendentes: numero(res.pendentes),
      processando: numero(res.processando),
      emitidas: numero(res.emitidas),
      comErro: numero(res.com_erro),
      canceladas: numero(res.canceladas),
    },
    notas: lista(r.notas).map((n) => resumoDoBanco(objeto(n))),
    emissaoAutomatica: r.emissao_automatica === true,
  };
}

export function detalheNotaDoBanco(valor: Json): NotaDetalhe {
  const x = objeto(valor);
  return {
    ...resumoDoBanco(x),
    tomadorTemCpf: x.tomador_tem_cpf === true,
    cobrancaSituacao: String(x.cobranca_situacao ?? ""),
    providerRef: texto(x.provider_ref),
    versao: numero(x.versao) || 1,
    codigoServico: texto(x.codigo_servico),
    descricaoServico: texto(x.descricao_servico),
    emissaoAutomatica: x.emissao_automatica === true,
    podeEmitir: x.pode_emitir === true,
    podeConsultar: x.pode_consultar === true,
  };
}

export function dadosEmissaoDoBanco(valor: Json): DadosEmissaoNota {
  const x = objeto(valor);
  const t = objeto(x.tomador);
  const e = t.endereco ? objeto(t.endereco) : null;
  return {
    notaId: String(x.nota_id),
    cobrancaId: String(x.cobranca_id),
    familiaId: String(x.familia_id),
    status: (texto(x.status) ?? "pendente") as EstadoNota,
    valorCentavos: numero(x.valor_centavos),
    codigoServico: String(x.codigo_servico ?? ""),
    descricaoServico: String(x.descricao_servico ?? ""),
    tomador: {
      nome: String(t.nome ?? ""),
      cpf: String(t.cpf ?? ""),
      email: texto(t.email),
      endereco: e
        ? {
            logradouro: String(e.logradouro ?? ""),
            numero: String(e.numero ?? ""),
            bairro: String(e.bairro ?? ""),
            cep: String(e.cep ?? ""),
            uf: String(e.uf ?? ""),
            municipioCodigoIbge: String(e.municipio_codigo_ibge ?? ""),
          }
        : null,
    },
  };
}

export function criarNotaSupabase(contexto: ContextoSupabase): NotaRepositorio {
  const chamar = (funcao: string, args: Record<string, unknown>) =>
    rpcPendente(contexto.cliente, funcao, args);
  return {
    async listar(situacao) {
      return listaNotasDoBanco(
        await chamar("notas_fiscais", { p_situacao: situacao ?? null }),
      );
    },
    async obter(notaId) {
      return detalheNotaDoBanco(await chamar("nota_fiscal", { p_nota_id: notaId }));
    },
    async dadosEmissao(notaId) {
      return dadosEmissaoDoBanco(
        await chamar("dados_emissao_nota", { p_nota_id: notaId }),
      );
    },
    async iniciarEmissao(notaId) {
      await chamar("iniciar_emissao_nota", { p_nota_id: notaId });
    },
    async registrarResultado(notaId, resultado) {
      const r = objeto(
        await chamar("registrar_resultado_nota", {
          p_nota_id: notaId,
          p_estado: resultado.estado,
          p_provider_ref: resultado.providerRef ?? null,
          p_numero: resultado.numero ?? null,
          p_pdf_path: resultado.pdfPath ?? null,
          p_xml_path: resultado.xmlPath ?? null,
          p_erro: resultado.erro ?? null,
        }),
      );
      return {
        status: (texto(r.status) ?? resultado.estado) as EstadoNota,
        mudou: r.mudou === true,
      };
    },
    async registrarManual(pedido) {
      await chamar("registrar_nota_manual", {
        p_nota_id: pedido.notaId,
        p_numero: pedido.numero,
        p_emitida_em: pedido.emitidaEm,
        p_provider: pedido.provider ?? null,
        p_pdf_path: pedido.pdfPath ?? null,
        p_xml_path: pedido.xmlPath ?? null,
      });
    },
    async caminhoArquivo(notaId, tipo) {
      const r = objeto(
        await chamar("arquivo_da_nota", { p_nota_id: notaId, p_tipo: tipo }),
      );
      return String(r.caminho);
    },
  };
}
