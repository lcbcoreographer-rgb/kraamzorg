import type { Papel } from "@/lib/auth/papeis";
import type { Json } from "@/lib/db/types";
import {
  calcularIdadeGestacional,
  hojeBrasilia,
} from "@/modules/crm/pipeline/idade-gestacional";
import { kraamzorgDoBanco, modeloDoBanco } from "../mapeamento-contrato";
import type { CobrancaRepositorio, ContratoRepositorio } from "../repositorios";
import type {
  Assinante,
  CobrancaDetalhe,
  CobrancaDoContrato,
  DadosLinkPagamento,
  DadosParaContrato,
  EtapaContrato,
  LinhaCobranca,
  ReservaEnvioContrato,
  SituacaoCobranca,
  SituacaoContrato,
} from "../tipos-contrato";
import { PACOTES, VERSOES_PACOTE } from "./fixtures";
import { garantirDemonstracaoPermitida } from "../modo";
import { obterLoja } from "./loja";
import { PARAMETROS_CONTRATO } from "./contrato-fixtures";
import {
  contaDe,
  criarTarefa,
  diaBrasilia,
  evento,
  freioPermite,
  obterLojaVenda,
  oportunidadeAberta,
  recusar,
  semPermissao,
  transicionar,
  type CobrancaDemo,
  type ContextoVendaDemonstracao,
  type ContratoDemo,
  type LojaVenda,
} from "./venda";
import { DETALHES_PACOTE } from "./venda-fixtures";
import type { LojaDemonstracao } from "./loja";

/**
 * Contrato e cobrança no modo demonstração (P31 e P32): as mesmas regras de
 * 0019_contrato_cobranca.sql sobre a loja em memória da venda. A prova de
 * permissão e de idempotência continua sendo o pgTAP (019); aqui o recorte é
 * o mesmo, simplificado, para as telas e o e2e rodarem sem Supabase.
 *
 * Sem Autentique nem InfinitePay de verdade: a assinatura e o pagamento
 * entram por `simularAssinaturaDemonstracao` e `simularPagamentoDemonstracao`,
 * que só existem neste modo e passam pelo mesmo caminho do webhook.
 */

const DIA = 24 * 60 * 60 * 1000;
const RE_DOC = /^[A-Za-z0-9_-]{8,100}$/;
const RE_SHA = /^[0-9a-f]{64}$/;

function param(chave: string): Record<string, Json> {
  const valor = PARAMETROS_CONTRATO[chave];
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, Json>)
    : {};
}

function numeroParam(chave: string, campo: string): number | null {
  const v = param(chave)[campo];
  return typeof v === "number" ? v : null;
}

function caminhoPdf(contratoId: string, assinado: boolean): string {
  return `contratos/${contratoId}${assinado ? "-assinado" : ""}.pdf`;
}

function mascararEmail(email: string | null | undefined): string | null {
  if (!email || !/^[^@]+@[^@]+$/.test(email)) return null;
  return email.replace(/^(.).*(@.*)$/, "$1***$2");
}

function contratoVivo(lv: LojaVenda, familiaId: string): ContratoDemo | null {
  const vivos = lv.contratos
    .filter(
      (k) =>
        k.familiaId === familiaId &&
        k.status !== "cancelado" &&
        k.status !== "distrato",
    )
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return vivos[0] ?? null;
}

function formularioRecebido(k: ContratoDemo): boolean {
  return k.tokenHash === null && k.expiraEm !== null;
}

function etapaDe(k: ContratoDemo | null, agora = Date.now()): EtapaContrato {
  if (!k) return "sem_proposta";
  if (k.status === "rascunho") return "sem_formulario";
  if (k.status === "aguardando_dados") {
    if (k.tokenHash !== null) {
      return k.expiraEm && Date.parse(k.expiraEm) > agora
        ? "aguardando_dados"
        : "formulario_vencido";
    }
    return "pronto_para_gerar";
  }
  if (k.status === "gerado") {
    return k.enviadoEm && !k.autentiqueDocId ? "envio_em_andamento" : "gerado";
  }
  if (k.status === "enviado") return "aguardando_assinatura";
  if (k.status === "assinado") return "assinado";
  return k.status as EtapaContrato;
}

function sensivel(l: LojaDemonstracao, familiaId: string): boolean {
  const f = l.familias.find((x) => x.id === familiaId);
  return Boolean(
    f &&
    (f.estadoSensivel === "bloqueio_total" ||
      f.estadoSensivel === "encerrado_sensivel" ||
      f.naoContatar),
  );
}

function situacaoCobranca(c: CobrancaDemo): SituacaoCobranca {
  if (c.status === "aberta" && c.vencimento < diaBrasilia(new Date())) {
    return "vencida";
  }
  return c.status;
}

function versaoDoContrato(k: ContratoDemo) {
  const versao = VERSOES_PACOTE.find((v) => v.versaoId === k.pacoteVersaoId);
  const pacote = PACOTES.find((p) => p.pacoteId === versao?.pacoteId);
  return { versao, pacote };
}

function textoOuNulo(v: Json | undefined): string | null {
  return typeof v === "string" ? v : null;
}

// --- Efeitos compartilhados (o webhook e a simulação passam por aqui) -----------------

/** privado.cobranca_gerar: uma cobrança com o total; idempotente; P2 cobranca_gerada. */
function criarCobranca(
  l: LojaDemonstracao,
  lv: LojaVenda,
  k: ContratoDemo,
): CobrancaDemo {
  if (k.status !== "assinado") recusar("contrato_nao_assinado");
  const existente = lv.cobrancas.find(
    (c) => c.contratoId === k.id && c.status !== "cancelada",
  );
  if (existente) return existente;
  const dias = numeroParam("cobranca", "vencimento_dias");
  if (dias === null || dias < 0) recusar("cobranca_sem_parametro");
  const conta = contaDe({ ...k, parcelas: 1 });
  const c: CobrancaDemo = {
    id: crypto.randomUUID(),
    contratoId: k.id,
    familiaId: k.familiaId,
    parcela: 1,
    valorCentavos: conta.totalCentavos,
    vencimento: diaBrasilia(new Date(Date.now() + dias * DIA)),
    status: "aberta",
    linkPagamento: null,
    invoiceSlug: null,
    metodo: null,
    parcelasCartao: null,
    valorPagoCentavos: null,
    comprovante: null,
    pagoEm: null,
    notaStatus: null,
    notaNumero: null,
    criadoEm: new Date().toISOString(),
  };
  lv.cobrancas.push(c);
  const o = oportunidadeAberta(l, k.familiaId);
  if (o?.estagioP2 === "assinado")
    transicionar(l, o.id, "p2", "cobranca_gerada");
  evento(l, k.familiaId, "cobranca", "Cobrança gerada", {
    contrato_id: k.id,
    cobranca_id: c.id,
    valor_centavos: c.valorCentavos,
  });
  return c;
}

/** public.contrato_registrar_assinatura: assinado, P2, evento e pos_assinatura sob o freio. */
function registrarAssinatura(
  l: LojaDemonstracao,
  lv: LojaVenda,
  k: ContratoDemo,
): { mudou: boolean; cobrancaId: string | null } {
  if (k.status === "assinado") return { mudou: false, cobrancaId: null };
  if (k.status !== "enviado") return { mudou: false, cobrancaId: null };
  k.status = "assinado";
  k.assinadoEm = new Date().toISOString();
  k.pdfPath = caminhoPdf(k.id, true);
  const o = oportunidadeAberta(l, k.familiaId);
  if (o?.estagioP2 === "aguardando_assinatura") {
    transicionar(l, o.id, "p2", "assinado");
  }
  evento(l, k.familiaId, "contrato", "Contrato assinado por todos", {
    contrato_id: k.id,
  });
  const familia = l.familias.find((f) => f.id === k.familiaId);
  if (familia && freioPermite("operacional", familia.estadoSensivel)) {
    const c = criarCobranca(l, lv, k);
    return { mudou: true, cobrancaId: c.id };
  }
  lv.notificacoes.push({
    usuarioId: null,
    titulo:
      "Contrato assinado, mas a cobrança não foi gerada sozinha: confira com a coordenação antes de cobrar",
    link: `/familias/${k.familiaId}/contrato`,
  });
  return { mudou: true, cobrancaId: null };
}

/** privado.cobranca_confirmar: única baixa; idempotente; P2, nota pendente e tarefas. */
function confirmarPagamento(
  l: LojaDemonstracao,
  lv: LojaVenda,
  c: CobrancaDemo,
  dados: {
    valorPagoCentavos: number | null;
    parcelas: number | null;
    metodo: string;
    comprovante: string | null;
    via: "webhook" | "manual";
  },
): { mudou: boolean; motivo?: string; prenatalUrgente?: boolean } {
  if (c.status === "paga") return { mudou: false, motivo: "ja_paga" };
  if (c.status === "cancelada" || c.status === "estornada") {
    lv.notificacoes.push({
      usuarioId: null,
      titulo: `Chegou um pagamento em cobrança ${c.status === "cancelada" ? "cancelada" : "estornada"}: confira antes de baixar`,
      link: `/cobrancas/${c.id}`,
    });
    return { mudou: false, motivo: "cobranca_encerrada" };
  }
  if (
    dados.valorPagoCentavos === null ||
    dados.valorPagoCentavos < c.valorCentavos
  ) {
    lv.notificacoes.push({
      usuarioId: null,
      titulo:
        "Chegou um pagamento abaixo do valor da cobrança: confira antes de baixar",
      link: `/cobrancas/${c.id}`,
    });
    return { mudou: false, motivo: "valor_divergente" };
  }
  c.status = "paga";
  c.valorPagoCentavos = dados.valorPagoCentavos;
  c.parcelasCartao = dados.parcelas;
  c.metodo = dados.metodo;
  c.comprovante = dados.comprovante;
  c.pagoEm = new Date().toISOString();
  c.notaStatus = "pendente";
  evento(l, c.familiaId, "cobranca", "Pagamento confirmado", {
    cobranca_id: c.id,
    valor_pago_centavos: c.valorPagoCentavos,
    via: dados.via,
  });

  const o = oportunidadeAberta(l, c.familiaId);
  if (o?.estagioP2 !== "cobranca_gerada") return { mudou: true };
  transicionar(l, o.id, "p2", "pagamento_confirmado");

  const familia = l.familias.find((f) => f.id === c.familiaId);
  const limite = numeroParam("cobranca", "prenatal_urgente_semanas");
  const ig =
    familia && !familia.dataNascimento && limite !== null
      ? calcularIdadeGestacional(familia.dpp, hojeBrasilia())
      : null;
  const urgente = Boolean(ig && limite !== null && ig.semanas >= limite);

  criarTarefa(l, {
    familiaId: c.familiaId,
    tipo: "outro",
    titulo: `Avisar a ${familia?.nome ?? "família"} que o pagamento foi confirmado`,
    responsavelId: o.responsavelId,
    venceEm: new Date().toISOString(),
    chaveMensagem: urgente
      ? "pagamento_confirmado_34s"
      : "pagamento_confirmado",
    variaveis: { semanas: String(ig?.semanas ?? "") },
    categoria: "operacional",
    extra: { acao: "pagamento_confirmado", cobranca_id: c.id },
    prioridade: urgente ? "alta" : "normal",
    papelResponsavel: o.responsavelId ? null : "comercial",
  });

  if (urgente && familia) {
    l.tarefas.push({
      id: crypto.randomUUID(),
      tipo: "agendar_prenatal",
      titulo: `Marcar o pré-natal online com urgência: ${familia.nome}`,
      prioridade: "maxima",
      status: "aberta",
      venceEm: new Date().toISOString(),
      familiaId: familia.id,
      responsavelId: null,
      papelResponsavel: "coordenacao",
      payload: {
        acao: "prenatal_urgente",
        semanas: ig?.semanas ?? 0,
        categoria: "interna",
        cobranca_id: c.id,
      },
      criadoEm: new Date().toISOString(),
    });
    lv.notificacoes.push({
      usuarioId: null,
      titulo: `Pagamento confirmado com ${ig?.semanas} semanas: marcar o pré-natal online agora`,
      link: `/familias/${familia.id}`,
    });
  }
  return { mudou: true, prenatalUrgente: urgente };
}

/** privado.cobranca_gravar_link: só https, um link por cobrança, tarefa link_pagamento. */
function gravarLink(
  l: LojaDemonstracao,
  lv: LojaVenda,
  c: CobrancaDemo,
  url: string,
  slug: string | null,
) {
  void lv;
  if (!/^https:\/\/\S+$/.test(url) || url.length > 500)
    recusar("link_invalido");
  if (c.status !== "aberta") recusar("cobranca_nao_aberta");
  if (c.linkPagamento) {
    if (c.linkPagamento === url) return;
    recusar("link_ja_gerado");
  }
  c.linkPagamento = url;
  c.invoiceSlug = slug;
  const o = oportunidadeAberta(l, c.familiaId);
  criarTarefa(l, {
    familiaId: c.familiaId,
    tipo: "outro",
    titulo: `Enviar o link de pagamento para a ${l.familias.find((f) => f.id === c.familiaId)?.nome ?? "família"}`,
    responsavelId: o?.responsavelId ?? null,
    venceEm: new Date().toISOString(),
    chaveMensagem: "link_pagamento",
    variaveis: { link: url },
    categoria: "operacional",
    extra: {
      acao: "link_pagamento",
      cobranca_id: c.id,
      contrato_id: c.contratoId,
    },
    prioridade: "alta",
    papelResponsavel: o?.responsavelId ? null : "comercial",
  });
  evento(l, c.familiaId, "cobranca", "Link de pagamento gerado", {
    cobranca_id: c.id,
  });
}

// --- Simulações (só demonstração) ---------------------------------------------------------

/**
 * Faz o que o webhook da Autentique faria depois de reconsultar o documento:
 * contrato assinado, P2, cobrança sob o freio. Devolve o id da cobrança para
 * a tela pedir o link, como a rota de webhook faz.
 */
export function simularAssinaturaDemonstracao(contratoId: string): {
  mudou: boolean;
  cobrancaId: string | null;
} {
  garantirDemonstracaoPermitida();
  const l = obterLoja();
  const lv = obterLojaVenda();
  const k = lv.contratos.find((x) => x.id === contratoId);
  if (!k) recusar("contrato_inexistente");
  if (k.status !== "enviado") recusar("contrato_nao_enviado");
  const resultado = registrarAssinatura(l, lv, k);
  // Como a rota do webhook: depois de assinar, pede o link da cobrança. O
  // link de demonstração respeita o mesmo limite de parcelas do pacote.
  if (resultado.cobrancaId) {
    const c = lv.cobrancas.find((x) => x.id === resultado.cobrancaId);
    const max = versaoDoContrato(k).versao?.parcelasMaxSemJuros ?? 1;
    if (c && k.parcelas <= max) {
      gravarLink(
        l,
        lv,
        c,
        `https://pay.exemplo.invalid/demo/${c.id}`,
        `demo-${c.id.slice(0, 8)}`,
      );
    } else if (c) {
      lv.notificacoes.push({
        usuarioId: null,
        titulo:
          "Parcelamento acima do limite do link de pagamento: combine a cobrança à mão",
        link: `/cobrancas/${c.id}`,
      });
    }
  }
  return resultado;
}

/** Faz o que o webhook da InfinitePay faria depois do payment_check. */
export function simularPagamentoDemonstracao(cobrancaId: string): {
  mudou: boolean;
  motivo?: string;
} {
  garantirDemonstracaoPermitida();
  const l = obterLoja();
  const lv = obterLojaVenda();
  const c = lv.cobrancas.find((x) => x.id === cobrancaId);
  if (!c) recusar("cobranca_inexistente");
  const k = lv.contratos.find((x) => x.id === c.contratoId);
  const dados = k
    ? {
        valorPagoCentavos: c.valorCentavos,
        parcelas: k.parcelas,
        metodo: k.parcelas > 1 ? "credit_card" : "pix",
        comprovante: `https://recibo.exemplo.invalid/demo-${c.id.slice(0, 8)}`,
        via: "webhook" as const,
      }
    : null;
  if (!dados) recusar("contrato_inexistente");
  return confirmarPagamento(l, lv, c, dados);
}

/** Só para a tela de demonstração e os testes: as cobranças de um contrato. */
export function cobrancaDoContratoDemonstracao(
  contratoId: string,
): string | null {
  garantirDemonstracaoPermitida();
  return (
    obterLojaVenda().cobrancas.find(
      (c) => c.contratoId === contratoId && c.status !== "cancelada",
    )?.id ?? null
  );
}

// --- Repositório de contrato --------------------------------------------------------------

export function criarContratoDemonstracao(
  contexto: ContextoVendaDemonstracao,
): ContratoRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));

  function autorizar(papeis: Papel[]) {
    if (!contexto.usuarioId) semPermissao("sem sessão");
    if (!tem(...papeis)) semPermissao("papel sem permissão (PRD 13)");
    if (contexto.aal !== "aal2") semPermissao("esta operação exige MFA (AAL2)");
  }

  function contratoPorId(lv: LojaVenda, id: string): ContratoDemo {
    const k = lv.contratos.find((x) => x.id === id);
    if (!k) recusar("contrato_inexistente");
    return k;
  }

  const kraamzorg = () =>
    kraamzorgDoBanco(PARAMETROS_CONTRATO.contrato_kraamzorg);
  const modelo = () => modeloDoBanco(PARAMETROS_CONTRATO.contrato_modelo);

  return {
    async obterSituacao(familiaId) {
      autorizar(["comercial", "financeiro", "diretoria"]);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const familia = l.familias.find((f) => f.id === familiaId);
      if (!familia) recusar("familia_inexistente");
      const k = contratoVivo(lv, familiaId);
      const comercial = tem("comercial", "diretoria");
      const financeiro = tem("financeiro", "diretoria");
      if (!comercial && !k) {
        semPermissao("financeiro só vê família com contrato (PRD 13)");
      }
      const o = oportunidadeAberta(l, familiaId);
      const etapa = etapaDe(k);
      const emSensivel = sensivel(l, familiaId);
      const proposta = o ? lv.propostas[o.id] : undefined;
      const paraQuem = proposta?.paraQuem ?? null;
      const mae = k
        ? l.pessoas.find((p) => p.id === k.contratantePessoaId)
        : null;
      const testemunha = k?.testemunhaPessoaId
        ? l.pessoas.find((p) => p.id === k.testemunhaPessoaId)
        : null;
      const kz = kraamzorg();
      const assinantes: Assinante[] = k
        ? [
            {
              papel: "gestante",
              nome: mae?.nome ?? null,
              email: mascararEmail(mae?.email),
              temContato: Boolean(mae?.email || mae?.telefoneE164),
            },
            {
              papel: "kraamzorg",
              nome: kz.signatarioNome,
              email: mascararEmail(kz.signatarioEmail),
              temContato: kz.signatarioEmail !== "",
            },
            ...(testemunha
              ? [
                  {
                    papel: "testemunha" as const,
                    nome: testemunha.nome,
                    email: mascararEmail(testemunha.email),
                    temContato: Boolean(
                      testemunha.email || testemunha.telefoneE164,
                    ),
                  },
                ]
              : []),
          ]
        : [];
      const cobrancas: CobrancaDoContrato[] = k
        ? lv.cobrancas
            .filter((c) => c.contratoId === k.id)
            .map((c) => ({
              id: financeiro ? c.id : null,
              parcela: c.parcela,
              vencimento: c.vencimento,
              status: situacaoCobranca(c) as CobrancaDoContrato["status"],
              pagoEm: c.pagoEm,
              valorCentavos: financeiro ? c.valorCentavos : null,
              temLink: financeiro ? c.linkPagamento !== null : null,
            }))
        : [];
      const m = modelo();
      return {
        familia: {
          id: familia.id,
          nome: familia.nome,
          estadoSensivel: familia.estadoSensivel,
          naoContatar: familia.naoContatar,
        },
        oportunidade: o ? { id: o.id, estagioP2: o.estagioP2, paraQuem } : null,
        contrato: k
          ? {
              id: k.id,
              status: k.status,
              etapa,
              templateVersao: k.templateVersao,
              variante: paraQuem === "presente" ? "presente" : "completa",
              conta: comercial || financeiro ? contaDe(k) : null,
              pdfGerado: Boolean(k.pdfPath),
              formularioRecebidoEm: formularioRecebido(k) ? k.expiraEm : null,
              enviadoEm: k.enviadoEm ?? null,
              assinadoEm: k.assinadoEm ?? null,
            }
          : null,
        assinantes,
        modelo: { versao: m.versao, aprovado: m.aprovado },
        cobrancas,
        podeGerar:
          comercial &&
          !emSensivel &&
          (etapa === "pronto_para_gerar" || etapa === "gerado"),
        podeEnviar: comercial && !emSensivel && etapa === "gerado",
        podeVerCobranca: financeiro,
        sensivel: emSensivel,
      } satisfies SituacaoContrato;
    },

    async dadosParaContrato(contratoId): Promise<DadosParaContrato> {
      autorizar(["comercial", "diretoria"]);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const k = contratoPorId(lv, contratoId);
      if (
        (k.status !== "aguardando_dados" && k.status !== "gerado") ||
        !formularioRecebido(k)
      ) {
        recusar("formulario_pendente");
      }
      if (k.enviadoEm) recusar("contrato_ja_enviado");
      if (sensivel(l, k.familiaId)) recusar("familia_em_estado_sensivel");
      const mae = l.pessoas.find((p) => p.id === k.contratantePessoaId);
      const dadosMae = mae ? lv.dadosContrato[mae.id] : undefined;
      if (!mae || !mae.email || !dadosMae || !dadosMae.dataNascimento) {
        recusar("dados_incompletos");
      }
      const pagador = k.pagadorPessoaId
        ? l.pessoas.find((p) => p.id === k.pagadorPessoaId)
        : undefined;
      const dadosPagador = pagador ? lv.dadosContrato[pagador.id] : undefined;
      if (pagador && !dadosPagador) recusar("dados_incompletos");
      const testemunha = k.testemunhaPessoaId
        ? l.pessoas.find((p) => p.id === k.testemunhaPessoaId)
        : undefined;
      const o = oportunidadeAberta(l, k.familiaId);
      const paraQuem = o ? lv.propostas[o.id]?.paraQuem : null;
      const { versao, pacote } = versaoDoContrato(k);
      const detalhe = pacote ? DETALHES_PACOTE[pacote.nome] : undefined;
      const atendimento = lv.enderecoAtendimento[k.familiaId];
      return {
        contrato: {
          id: k.id,
          variante: paraQuem === "presente" ? "presente" : "completa",
          conta: contaDe(k),
          parcelasMaxSemJuros: versao?.parcelasMaxSemJuros ?? 1,
        },
        pacote: {
          nome: pacote?.nome ?? "",
          linha: detalhe?.linha ?? null,
          dias: pacote?.dias ?? 0,
          gemelar: pacote?.gemelar ?? false,
          horasPorVisita: detalhe?.horas ?? 0,
        },
        familia: {
          id: k.familiaId,
          enderecoAtendimento: atendimento ?? null,
        },
        contratante: {
          nome: mae.nome,
          email: mae.email,
          cpf: dadosMae.cpf,
          endereco: dadosMae.endereco,
          dataNascimento: dadosMae.dataNascimento,
        },
        pagador:
          pagador && dadosPagador
            ? {
                nome: pagador.nome,
                email: pagador.email,
                cpf: dadosPagador.cpf,
                endereco: dadosPagador.endereco,
              }
            : null,
        testemunha: testemunha
          ? { nome: testemunha.nome, email: testemunha.email }
          : null,
        modelo: modelo(),
        kraamzorg: kraamzorg(),
      };
    },

    async registrarGerado(contratoId, pdfPath, pdfSha256) {
      autorizar(["comercial", "diretoria"]);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const k = contratoPorId(lv, contratoId);
      if (
        (k.status !== "aguardando_dados" && k.status !== "gerado") ||
        !formularioRecebido(k)
      ) {
        recusar("formulario_pendente");
      }
      if (k.enviadoEm) recusar("contrato_ja_enviado");
      if (pdfPath !== caminhoPdf(k.id, false)) recusar("caminho_pdf_invalido");
      if (!RE_SHA.test(pdfSha256)) recusar("pdf_sem_resumo");
      const m = modelo();
      const primeira = k.status === "aguardando_dados";
      k.status = "gerado";
      k.pdfPath = pdfPath;
      k.templateVersao = m.versao;
      const o = oportunidadeAberta(l, k.familiaId);
      if (o?.estagioP2 === "ganho")
        transicionar(l, o.id, "p2", "contrato_gerado");
      evento(
        l,
        k.familiaId,
        "contrato",
        `${primeira ? "Contrato gerado" : "Contrato gerado de novo"} (modelo ${m.versao})`,
        { contrato_id: k.id, template_versao: m.versao },
      );
    },

    async reservarEnvio(contratoId): Promise<ReservaEnvioContrato> {
      autorizar(["comercial", "diretoria"]);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const k = contratoPorId(lv, contratoId);
      if (k.status !== "gerado" || !k.pdfPath) recusar("contrato_nao_gerado");
      if (k.autentiqueDocId) recusar("contrato_ja_enviado");
      if (k.enviadoEm) recusar("envio_em_andamento");
      if (sensivel(l, k.familiaId)) recusar("familia_em_estado_sensivel");
      const kz = kraamzorg();
      if (!kz.signatarioNome || !kz.signatarioEmail) {
        recusar("signatario_kraamzorg_sem_cadastro");
      }
      const g = l.pessoas.find((p) => p.id === k.contratantePessoaId);
      if (!g || (!g.email && !g.telefoneE164)) recusar("gestante_sem_contato");
      const t = k.testemunhaPessoaId
        ? l.pessoas.find((p) => p.id === k.testemunhaPessoaId)
        : undefined;
      k.enviadoEm = new Date().toISOString();
      const m = modelo();
      return {
        contratoId: k.id,
        pdfPath: k.pdfPath,
        nomeDocumento: `Contrato de cuidado domiciliar ${k.id.slice(0, 8)}`,
        modeloVersao: m.versao,
        modeloAprovado: m.aprovado,
        gestante: {
          nome: g.nome,
          email: g.email,
          telefone: g.telefoneE164 || null,
        },
        testemunha: t
          ? { nome: t.nome, email: t.email, telefone: t.telefoneE164 || null }
          : null,
        kraamzorg: { nome: kz.signatarioNome, email: kz.signatarioEmail },
      };
    },

    async concluirEnvio(contratoId, documentoId) {
      autorizar(["comercial", "diretoria"]);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const k = contratoPorId(lv, contratoId);
      if (k.status !== "gerado" || !k.enviadoEm || k.autentiqueDocId) {
        recusar("envio_nao_reservado");
      }
      if (!RE_DOC.test(documentoId)) recusar("documento_invalido");
      k.status = "enviado";
      k.autentiqueDocId = documentoId;
      k.enviadoEm = new Date().toISOString();
      const o = oportunidadeAberta(l, k.familiaId);
      if (o?.estagioP2 === "contrato_gerado") {
        transicionar(l, o.id, "p2", "aguardando_assinatura");
      }
      evento(
        l,
        k.familiaId,
        "contrato",
        "Contrato enviado para assinatura pela Autentique",
        { contrato_id: k.id },
      );
    },

    async liberarEnvio(contratoId) {
      autorizar(["comercial", "diretoria"]);
      const lv = obterLojaVenda();
      const k = contratoPorId(lv, contratoId);
      if (k.status !== "gerado" || !k.enviadoEm || k.autentiqueDocId) {
        recusar("envio_nao_reservado");
      }
      k.enviadoEm = null;
    },
  };
}

// --- Repositório de cobrança --------------------------------------------------------------

export function criarCobrancaDemonstracao(
  contexto: ContextoVendaDemonstracao,
): CobrancaRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));

  function autorizar() {
    if (!contexto.usuarioId) semPermissao("sem sessão");
    if (!tem("financeiro", "diretoria")) {
      semPermissao("papel sem permissão (PRD 13)");
    }
    if (contexto.aal !== "aal2") semPermissao("esta operação exige MFA (AAL2)");
  }

  function cobrancaPorId(lv: LojaVenda, id: string): CobrancaDemo {
    const c = lv.cobrancas.find((x) => x.id === id);
    if (!c) recusar("cobranca_inexistente");
    return c;
  }

  function limiteDoContrato(lv: LojaVenda, k: ContratoDemo) {
    const { versao } = versaoDoContrato(k);
    const max = versao?.parcelasMaxSemJuros ?? 1;
    return { max, acima: k.parcelas > max };
  }

  function dadosLink(l: LojaDemonstracao, lv: LojaVenda, c: CobrancaDemo) {
    const k = lv.contratos.find((x) => x.id === c.contratoId);
    if (!k) recusar("contrato_inexistente");
    const { max, acima } = limiteDoContrato(lv, k);
    const pessoa = l.pessoas.find(
      (p) => p.id === (k.pagadorPessoaId ?? k.contratantePessoaId),
    );
    const dados: DadosLinkPagamento = {
      cobrancaId: c.id,
      contratoId: k.id,
      familiaId: k.familiaId,
      valorCentavos: c.valorCentavos,
      parcelas: k.parcelas,
      parcelasMax: max,
      acimaDoLimite: acima,
      descricao: textoOuNulo(param("cobranca").descricao_item) ?? "",
      cliente: {
        nome: pessoa?.nome ?? "",
        email: pessoa?.email ?? null,
        telefone: pessoa?.telefoneE164 || null,
      },
    };
    return { dados, k };
  }

  function linha(
    l: LojaDemonstracao,
    lv: LojaVenda,
    c: CobrancaDemo,
  ): LinhaCobranca {
    const familia = l.familias.find((f) => f.id === c.familiaId);
    return {
      id: c.id,
      contratoId: c.contratoId,
      familiaId: c.familiaId,
      familiaNome: familia?.nome ?? "Família",
      parcela: c.parcela,
      valorCentavos: c.valorCentavos,
      vencimento: c.vencimento,
      situacao: situacaoCobranca(c),
      pagoEm: c.pagoEm,
      valorPagoCentavos: c.valorPagoCentavos,
      metodo: c.metodo,
      parcelasCartao: c.parcelasCartao,
      temLink: c.linkPagamento !== null,
      notaStatus: c.notaStatus,
    };
  }

  return {
    async listar(situacao) {
      autorizar();
      const l = obterLoja();
      const lv = obterLojaVenda();
      const todas = lv.cobrancas.map((c) => linha(l, lv, c));
      const filtradas = todas
        .filter((c) => !situacao || c.situacao === situacao)
        .sort((a, b) => {
          const pa = a.situacao === "paga" ? 1 : 0;
          const pb = b.situacao === "paga" ? 1 : 0;
          return pa - pb || a.vencimento.localeCompare(b.vencimento);
        })
        .slice(0, 300);
      return {
        resumo: {
          abertas: todas.filter((c) => c.situacao === "aberta").length,
          vencidas: todas.filter((c) => c.situacao === "vencida").length,
          pagas: todas.filter((c) => c.situacao === "paga").length,
          aReceberCentavos: lv.cobrancas
            .filter((c) => c.status === "aberta")
            .reduce((soma, c) => soma + c.valorCentavos, 0),
          recebidoCentavos: lv.cobrancas
            .filter((c) => c.status === "paga")
            .reduce((soma, c) => soma + (c.valorPagoCentavos ?? 0), 0),
        },
        cobrancas: filtradas,
      };
    },

    async obter(cobrancaId): Promise<CobrancaDetalhe> {
      autorizar();
      const l = obterLoja();
      const lv = obterLojaVenda();
      const c = cobrancaPorId(lv, cobrancaId);
      const { dados, k } = dadosLink(l, lv, c);
      const pagador = l.pessoas.find(
        (p) => p.id === (k.pagadorPessoaId ?? k.contratantePessoaId),
      );
      const familia = l.familias.find((f) => f.id === c.familiaId);
      const aberta = c.status === "aberta";
      return {
        id: c.id,
        contratoId: k.id,
        contratoStatus: k.status,
        familiaId: c.familiaId,
        familiaNome: familia?.nome ?? "Família",
        pagadorNome: pagador?.nome ?? null,
        parcela: c.parcela,
        valorCentavos: c.valorCentavos,
        vencimento: c.vencimento,
        situacao: situacaoCobranca(c),
        pagoEm: c.pagoEm,
        valorPagoCentavos: c.valorPagoCentavos,
        metodo: c.metodo,
        parcelasCartao: c.parcelasCartao,
        parcelasContrato: k.parcelas,
        parcelasMax: dados.parcelasMax,
        acimaDoLimite: dados.acimaDoLimite,
        linkPagamento: c.linkPagamento,
        comprovante: c.comprovante
          ? c.comprovante.startsWith("comprovantes/")
            ? "arquivo"
            : "recibo"
          : null,
        reciboUrl: c.comprovante?.startsWith("https://") ? c.comprovante : null,
        comprovantePath: c.comprovante?.startsWith("comprovantes/")
          ? c.comprovante
          : null,
        nota: c.notaStatus
          ? { status: c.notaStatus, numero: c.notaNumero }
          : null,
        podeGerarLink:
          aberta &&
          c.linkPagamento === null &&
          k.status === "assinado" &&
          !dados.acimaDoLimite,
        podeBaixarManual: aberta && k.status === "assinado",
        comprovanteMaxBytes: numeroParam("cobranca", "comprovante_max_bytes"),
      };
    },

    async gerarDoContrato(contratoId) {
      autorizar();
      const l = obterLoja();
      const lv = obterLojaVenda();
      const k = lv.contratos.find((x) => x.id === contratoId);
      if (!k) recusar("contrato_inexistente");
      return criarCobranca(l, lv, k).id;
    },

    async dadosLinkPagamento(cobrancaId) {
      autorizar();
      const l = obterLoja();
      const lv = obterLojaVenda();
      const c = cobrancaPorId(lv, cobrancaId);
      if (c.status !== "aberta") recusar("cobranca_nao_aberta");
      if (c.linkPagamento) recusar("link_ja_gerado");
      const { dados, k } = dadosLink(l, lv, c);
      if (dados.acimaDoLimite) {
        recusar("parcelas_acima_do_limite", String(dados.parcelasMax));
      }
      if (k.status !== "assinado") recusar("contrato_nao_assinado");
      return dados;
    },

    async registrarLink(cobrancaId, url, slug) {
      autorizar();
      const l = obterLoja();
      const lv = obterLojaVenda();
      gravarLink(l, lv, cobrancaPorId(lv, cobrancaId), url, slug);
    },

    async baixarManual(pedido) {
      autorizar();
      const l = obterLoja();
      const lv = obterLojaVenda();
      const c = cobrancaPorId(lv, pedido.cobrancaId);
      if (c.status !== "aberta") recusar("cobranca_nao_aberta");
      const k = lv.contratos.find((x) => x.id === c.contratoId);
      if (k?.status !== "assinado") recusar("contrato_nao_assinado");
      const motivo = pedido.motivo.replace(/[\r\n[\]{}]+/g, " ").trim();
      if (motivo.length < 10) recusar("motivo_obrigatorio");
      const padrao = new RegExp(
        `^comprovantes/${c.id}-[a-z0-9]{8,32}\\.(pdf|png|jpg|jpeg)$`,
      );
      if (!padrao.test(pedido.comprovantePath)) {
        recusar("comprovante_obrigatorio");
      }
      if (pedido.valorPagoCentavos < c.valorCentavos) {
        recusar("valor_menor_que_a_cobranca");
      }
      confirmarPagamento(l, lv, c, {
        valorPagoCentavos: pedido.valorPagoCentavos,
        parcelas: null,
        metodo: "pix",
        comprovante: pedido.comprovantePath,
        via: "manual",
      });
    },
  };
}
