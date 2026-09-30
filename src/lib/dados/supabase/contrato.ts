import "server-only";
import type { Json } from "@/lib/db/types";
import type { ContratoRepositorio } from "../repositorios";
import type { EstagioP2 } from "../tipos";
import type {
  Assinante,
  CobrancaDoContrato,
  DadosParaContrato,
  EtapaContrato,
  PessoaDoContrato,
  ReservaEnvioContrato,
  SituacaoContrato,
} from "../tipos-contrato";
import {
  enderecoDoBanco,
  kraamzorgDoBanco,
  modeloDoBanco,
} from "../mapeamento-contrato";
import { contaDoBanco } from "./venda";
import { exigir, type ContextoSupabase } from "./comum";

/**
 * Contrato na real (P31): tudo pelas funções do schema api da
 * 0019_contrato_cobranca.sql, com a sessão do usuário (papel e AAL
 * conferidos por dentro de cada função). Este arquivo só traduz o jsonb do
 * banco para os tipos da tela e os argumentos da tela para o banco.
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

export function cobrancaDoContratoDoBanco(valor: Json): CobrancaDoContrato {
  const c = objeto(valor);
  return {
    id: texto(c.id),
    parcela: numero(c.parcela) || 1,
    vencimento: texto(c.vencimento) ?? "",
    status: (texto(c.status) ?? "aberta") as CobrancaDoContrato["status"],
    pagoEm: texto(c.pago_em),
    valorCentavos: typeof c.valor_centavos === "number" ? c.valor_centavos : null,
    temLink: typeof c.tem_link === "boolean" ? c.tem_link : null,
  };
}

export function situacaoDoBanco(valor: Json): SituacaoContrato {
  const r = objeto(valor);
  const f = objeto(r.familia);
  const o = r.oportunidade ? objeto(r.oportunidade) : null;
  const k = r.contrato ? objeto(r.contrato) : null;
  const m = objeto(r.modelo);
  return {
    familia: {
      id: String(f.id),
      nome: String(f.nome ?? ""),
      estadoSensivel: (texto(f.estado_sensivel) ??
        "normal") as SituacaoContrato["familia"]["estadoSensivel"],
      naoContatar: f.nao_contatar === true,
    },
    oportunidade: o
      ? {
          id: String(o.id),
          estagioP2: texto(o.estagio_p2) as EstagioP2 | null,
          paraQuem: texto(o.para_quem),
        }
      : null,
    contrato: k
      ? {
          id: String(k.id),
          status: String(k.status),
          etapa: String(k.etapa) as EtapaContrato,
          templateVersao: String(k.template_versao ?? ""),
          variante: k.variante === "presente" ? "presente" : "completa",
          conta: k.conta ? contaDoBanco(k.conta) : null,
          pdfGerado: k.pdf_gerado === true,
          formularioRecebidoEm: texto(k.formulario_recebido_em),
          enviadoEm: texto(k.enviado_em),
          assinadoEm: texto(k.assinado_em),
        }
      : null,
    assinantes: lista(r.assinantes).map((a): Assinante => {
      const x = objeto(a);
      return {
        papel: String(x.papel) as Assinante["papel"],
        nome: texto(x.nome),
        email: texto(x.email),
        temContato: x.tem_contato === true,
      };
    }),
    modelo: { versao: texto(m.versao), aprovado: m.aprovado === true },
    cobrancas: lista(r.cobrancas).map(cobrancaDoContratoDoBanco),
    podeGerar: r.pode_gerar === true,
    podeEnviar: r.pode_enviar === true,
    podeVerCobranca: r.pode_ver_cobranca === true,
    sensivel: r.sensivel === true,
  };
}

function pessoaDoBanco(valor: Json | undefined): PessoaDoContrato {
  const p = objeto(valor);
  return {
    nome: String(p.nome ?? ""),
    email: texto(p.email),
    cpf: String(p.cpf ?? ""),
    endereco: enderecoDoBanco(p.endereco),
    dataNascimento: texto(p.data_nascimento),
  };
}

export function dadosParaContratoDoBanco(valor: Json): DadosParaContrato {
  const r = objeto(valor);
  const k = objeto(r.contrato);
  const pa = objeto(r.pacote);
  const f = objeto(r.familia);
  const t = r.testemunha ? objeto(r.testemunha) : null;
  const contratante = pessoaDoBanco(r.contratante);
  return {
    contrato: {
      id: String(k.id),
      variante: k.variante === "presente" ? "presente" : "completa",
      conta: contaDoBanco(k.conta),
      parcelasMaxSemJuros: numero(k.parcelas_max_sem_juros) || 1,
    },
    pacote: {
      nome: String(pa.nome ?? ""),
      linha: texto(pa.linha),
      dias: numero(pa.dias),
      gemelar: pa.gemelar === true,
      horasPorVisita: numero(pa.horas_por_visita),
    },
    familia: {
      id: String(f.id),
      enderecoAtendimento: f.endereco_atendimento
        ? enderecoDoBanco(f.endereco_atendimento)
        : null,
    },
    contratante: {
      ...contratante,
      dataNascimento: contratante.dataNascimento ?? "",
    },
    pagador: r.pagador ? pessoaDoBanco(r.pagador) : null,
    testemunha: t
      ? { nome: String(t.nome ?? ""), email: texto(t.email) }
      : null,
    modelo: modeloDoBanco(r.modelo),
    kraamzorg: kraamzorgDoBanco(r.kraamzorg),
  };
}

export function reservaDoBanco(valor: Json): ReservaEnvioContrato {
  const r = objeto(valor);
  const g = objeto(r.gestante);
  const t = r.testemunha ? objeto(r.testemunha) : null;
  const kz = objeto(r.kraamzorg);
  return {
    contratoId: String(r.contrato_id),
    pdfPath: String(r.pdf_path),
    nomeDocumento: String(r.nome_documento ?? ""),
    modeloVersao: texto(r.modelo_versao),
    modeloAprovado: r.modelo_aprovado === true,
    gestante: {
      nome: String(g.nome ?? ""),
      email: texto(g.email),
      telefone: texto(g.telefone),
    },
    testemunha: t
      ? {
          nome: String(t.nome ?? ""),
          email: texto(t.email),
          telefone: texto(t.telefone),
        }
      : null,
    kraamzorg: {
      nome: String(kz.nome ?? ""),
      email: String(kz.email ?? ""),
    },
  };
}

export function criarContratoSupabase(
  contexto: ContextoSupabase,
): ContratoRepositorio {
  const api = () => contexto.cliente.schema("api");

  return {
    async obterSituacao(familiaId) {
      return situacaoDoBanco(
        exigir(
          await api().rpc("contrato_situacao", { familia_id: familiaId }),
          "api.contrato_situacao",
        ),
      );
    },

    async dadosParaContrato(contratoId) {
      return dadosParaContratoDoBanco(
        exigir(
          await api().rpc("dados_para_contrato", { contrato_id: contratoId }),
          "api.dados_para_contrato",
        ),
      );
    },

    async registrarGerado(contratoId, pdfPath, pdfSha256) {
      exigir(
        await api().rpc("registrar_contrato_gerado", {
          contrato_id: contratoId,
          pdf_path: pdfPath,
          pdf_sha256: pdfSha256,
        }),
        "api.registrar_contrato_gerado",
      );
    },

    async reservarEnvio(contratoId) {
      return reservaDoBanco(
        exigir(
          await api().rpc("reservar_envio_contrato", {
            contrato_id: contratoId,
          }),
          "api.reservar_envio_contrato",
        ),
      );
    },

    async concluirEnvio(contratoId, documentoId) {
      exigir(
        await api().rpc("concluir_envio_contrato", {
          contrato_id: contratoId,
          autentique_doc_id: documentoId,
        }),
        "api.concluir_envio_contrato",
      );
    },

    async liberarEnvio(contratoId) {
      exigir(
        await api().rpc("liberar_envio_contrato", { contrato_id: contratoId }),
        "api.liberar_envio_contrato",
      );
    },
  };
}
