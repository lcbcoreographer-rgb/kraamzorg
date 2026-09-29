import { createHash, randomBytes } from "node:crypto";
import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import type { Json } from "@/lib/db/types";
import { aplicarTexto, primeiroNome } from "@/lib/messaging/aplicar-texto";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  FormularioContratoRepositorio,
  VendaRepositorio,
} from "../repositorios";
import type {
  CategoriaTarefa,
  ContaProposta,
  DadosFormularioContrato,
  EnderecoFormulario,
  ParaQuem,
  Proposta,
  ResumoSessao,
  SessaoVenda,
  SituacaoFormulario,
  StatusContrato,
  StatusSessao,
  TextosFormulario,
} from "../tipos-venda";
import type {
  EstadoSensivel,
  EstagioP1,
  EstagioP2,
  TipoTarefa,
} from "../tipos";
import { PACOTES, TRANSICOES, VERSOES_PACOTE } from "./fixtures";
import { obterLoja, type LojaDemonstracao } from "./loja";
import {
  CONDICOES,
  DETALHES_PACOTE,
  GRAVACAO_GRUTA,
  MENSAGENS_VENDA,
  OPCOES_TRANSFERENCIA,
  PARAMETROS_VENDA,
  sessoesIniciais,
  TAXAS_CIDADE,
} from "./venda-fixtures";

/**
 * Venda no modo demonstração (P29 e P30): as mesmas regras de
 * 0018_venda.sql sobre a loja em memória da fundação (famílias,
 * oportunidades, pessoas, tarefas, transferências e linha do tempo) e uma
 * loja própria para o que só a venda tem (sessões, gravação, contratos,
 * dados de contrato, tentativas do formulário). A prova de permissão
 * continua sendo o pgTAP (018_venda.sql); aqui o recorte por papel é o
 * mesmo, simplificado, para as telas e o e2e rodarem sem Supabase.
 */

// --- Loja própria --------------------------------------------------------------

interface SessaoDemo {
  id: string;
  familiaId: string;
  agendadaPara: string | null;
  status: StatusSessao;
  realizadaEm: string | null;
  linkReuniao: string | null;
  opcoesInformadas: string | null;
  parceiroPresente: boolean | null;
  conduzidaPor: string | null;
  criadoEm: string;
}

interface GravacaoDemo {
  consentimento: boolean;
  consentimentoVersao: string | null;
  consentimentoEm: string | null;
  transcricao: string | null;
  resumo: ResumoSessao | null;
}

interface ContratoDemo {
  id: string;
  familiaId: string;
  pacoteVersaoId: string;
  contratantePessoaId: string | null;
  pagadorPessoaId: string | null;
  testemunhaPessoaId: string | null;
  valorCentavos: number;
  taxaCentavos: number;
  descontoCentavos: number;
  parcelas: number;
  templateVersao: string;
  tokenHash: string | null;
  expiraEm: string | null;
  status: StatusContrato;
  criadoEm: string;
}

interface PropostaDemo {
  condicaoId: string | null;
  descontoPct: number;
  descontoMotivo: string | null;
  descontoAprovadoPor: string | null;
  paraQuem: ParaQuem | null;
  pagadorPessoaId: string | null;
  planoInteressePacoteId: string | null;
}

interface DadosContratoDemo {
  cpf: string;
  dataNascimento: string | null;
  endereco: EnderecoFormulario;
}

export interface LojaVenda {
  sessoes: SessaoDemo[];
  gravacoes: Record<string, GravacaoDemo>;
  contratos: ContratoDemo[];
  propostas: Record<string, PropostaDemo>;
  dadosContrato: Record<string, DadosContratoDemo>;
  enderecoAtendimento: Record<string, EnderecoFormulario>;
  consentimentos: Record<string, { versao: string; em: string }>;
  tentativas: { origem: string; contratoId: string | null; em: number }[];
  notificacoes: { usuarioId: string | null; titulo: string; link: string }[];
  /** Execuções de lembrete_sessao registradas (dedup do motor, 0012). */
  lembretes: string[];
}

const CHAVE_GLOBAL = "__kraamzorgLojaVenda";

export function criarLojaVenda(agora = Date.now()): LojaVenda {
  const sessoes = sessoesIniciais(agora);
  return {
    sessoes,
    gravacoes: {
      [GRAVACAO_GRUTA.sessaoId]: {
        consentimento: true,
        consentimentoVersao: GRAVACAO_GRUTA.consentimentoVersao,
        consentimentoEm: sessoes[1]?.agendadaPara ?? null,
        transcricao: GRAVACAO_GRUTA.transcricao,
        resumo: null,
      },
    },
    contratos: [],
    propostas: {},
    dadosContrato: {},
    enderecoAtendimento: {},
    consentimentos: {},
    tentativas: [],
    notificacoes: [],
    lembretes: [],
  };
}

export function obterLojaVenda(): LojaVenda {
  garantirDemonstracaoPermitida();
  const global = globalThis as unknown as Record<string, LojaVenda | undefined>;
  global[CHAVE_GLOBAL] ??= criarLojaVenda();
  return global[CHAVE_GLOBAL];
}

/** Só para testes: volta ao estado das fixtures. */
export function reiniciarLojaVenda(agora?: number): LojaVenda {
  const global = globalThis as unknown as Record<string, LojaVenda | undefined>;
  global[CHAVE_GLOBAL] = criarLojaVenda(agora);
  return global[CHAVE_GLOBAL];
}

// --- Auxiliares ------------------------------------------------------------------

function recusar(codigo: string, detalhe = ""): never {
  throw new ErroRepositorio(
    "recusado",
    `demonstração: venda:${codigo} ${detalhe}`.trim(),
  );
}

function semPermissao(motivo: string): never {
  throw new ErroRepositorio("sem_permissao", `demonstração: ${motivo}`);
}

function texto(chave: string): string | null {
  return MENSAGENS_VENDA.find((m) => m.chave === chave)?.texto ?? null;
}

function numeroParametro(chave: string, campo?: string): number | null {
  const valor = PARAMETROS_VENDA[chave];
  const alvo =
    campo && valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, Json>)[campo]
      : valor;
  return typeof alvo === "number" ? alvo : null;
}

function textoParametro(chave: string, campo?: string): string | null {
  const valor = PARAMETROS_VENDA[chave];
  const alvo =
    campo && valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, Json>)[campo]
      : valor;
  return typeof alvo === "string" ? alvo : null;
}

/** Matriz do freio (privado.freio_permite, 0009). */
export function freioPermite(
  categoria: CategoriaTarefa,
  estado: EstadoSensivel,
): boolean {
  if (categoria === "interna") return true;
  if (categoria === "operacional")
    return estado === "normal" || estado === "atencao";
  return estado === "normal";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function horaBrasilia(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function diaBrasilia(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function dataHoraTexto(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" às ", ", ");
}

function linkValido(link: string | null | undefined): link is string {
  return Boolean(link && /^https:\/\/\S+$/.test(link) && link.length <= 500);
}

function contaDe(k: ContratoDemo): ContaProposta {
  const total = k.valorCentavos - k.descontoCentavos + k.taxaCentavos;
  const parcelas = Math.max(k.parcelas, 1);
  const parcela = Math.trunc(total / parcelas);
  return {
    valorCentavos: k.valorCentavos,
    taxaCentavos: k.taxaCentavos,
    descontoCentavos: k.descontoCentavos,
    totalCentavos: total,
    parcelas,
    parcelaCentavos: parcela,
    primeiraParcelaCentavos: parcela + (total - parcela * parcelas),
  };
}

function situacaoFormulario(
  k: ContratoDemo,
  agora = Date.now(),
): SituacaoFormulario {
  if (!k.tokenHash && !k.expiraEm) return "nao_enviado";
  if (!k.tokenHash) return "recebido";
  return k.expiraEm && Date.parse(k.expiraEm) > agora
    ? "aguardando"
    : "vencido";
}

function vigenteHoje() {
  const hoje = diaBrasilia(new Date());
  return VERSOES_PACOTE.filter(
    (v) =>
      v.vigenciaInicio <= hoje &&
      (v.vigenciaFim === null || v.vigenciaFim >= hoje),
  )
    .flatMap((v) => {
      const pacote = PACOTES.find((p) => p.pacoteId === v.pacoteId);
      if (!pacote) return [];
      const detalhe = DETALHES_PACOTE[pacote.nome];
      return [
        {
          pacoteVersaoId: v.versaoId,
          pacoteId: pacote.pacoteId,
          nome: pacote.nome,
          linha: detalhe?.linha ?? null,
          dias: pacote.dias,
          gemelar: pacote.gemelar,
          horasPorVisita: detalhe?.horas ?? 0,
          valorCentavos: v.valorCentavos,
          parcelasMaxSemJuros: v.parcelasMaxSemJuros,
          ordem: pacote.ordem,
        },
      ];
    })
    .sort((a, b) => a.ordem - b.ordem);
}

function oportunidadeAberta(l: LojaDemonstracao, familiaId: string) {
  return l.oportunidades.find(
    (o) =>
      o.familiaId === familiaId &&
      (o.estagioP2 === null ||
        !["perdido", "cancelado", "distrato"].includes(o.estagioP2)),
  );
}

function transicionar(
  l: LojaDemonstracao,
  oportunidadeId: string,
  maquina: "p1" | "p2",
  para: EstagioP1 | EstagioP2,
) {
  const o = l.oportunidades.find((x) => x.id === oportunidadeId);
  if (!o) recusar("oportunidade_inexistente");
  const de = maquina === "p1" ? o.estagioP1 : (o.estagioP2 ?? o.estagioP1);
  const permitida = TRANSICOES.some(
    (t) => t.maquina === maquina && t.de === de && t.para === para,
  );
  if (!permitida) {
    throw new ErroRepositorio(
      "recusado",
      `demonstração: transição ${de} para ${para} não permitida`,
    );
  }
  if (maquina === "p1") o.estagioP1 = para as EstagioP1;
  else {
    o.estagioP2 = para as EstagioP2;
    o.pipeline = 2;
  }
  evento(l, o.familiaId, "estagio", `${de} → ${para}`, {
    maquina,
    de,
    para,
  });
}

function evento(
  l: LojaDemonstracao,
  familiaId: string,
  tipo: string,
  titulo: string,
  dados: Record<string, Json> = {},
) {
  l.eventos.push({
    id: l.proximoEvento++,
    familiaId,
    tipo,
    titulo,
    restrito: false,
    criadoEm: new Date().toISOString(),
    dados,
  });
}

function contato(l: LojaDemonstracao, familiaId: string) {
  const pessoas = l.pessoas.filter((p) => p.familiaId === familiaId);
  return (
    pessoas.find((p) => p.contatoPrincipal) ??
    pessoas.find((p) => p.papel === "mae") ??
    pessoas[0] ??
    null
  );
}

function gestante(l: LojaDemonstracao, familiaId: string) {
  const maes = l.pessoas.filter(
    (p) => p.familiaId === familiaId && p.papel === "mae",
  );
  return maes.find((p) => p.contatoPrincipal) ?? maes[0] ?? null;
}

function criarTarefa(
  l: LojaDemonstracao,
  pedido: {
    familiaId: string;
    tipo: TipoTarefa;
    titulo: string;
    responsavelId: string | null;
    venceEm: string;
    chaveMensagem: string | null;
    variaveis: Record<string, string>;
    categoria: CategoriaTarefa;
    extra: Record<string, Json>;
  },
): string | null {
  const familia = l.familias.find((f) => f.id === pedido.familiaId);
  if (!familia) return null;
  if (
    familia.naoContatar ||
    !freioPermite(pedido.categoria, familia.estadoSensivel)
  ) {
    return null;
  }
  const pessoa = contato(l, familia.id);
  const modelo = pedido.chaveMensagem ? texto(pedido.chaveMensagem) : null;
  const payload: Record<string, Json> = {
    ...(pedido.chaveMensagem ? { mensagemChave: pedido.chaveMensagem } : {}),
    ...(modelo
      ? {
          textoSugerido: aplicarTexto(
            modelo,
            primeiroNome(pessoa?.nome),
            pedido.variaveis,
          ),
        }
      : {}),
    ...(pessoa?.telefoneE164 ? { telefoneE164: pessoa.telefoneE164 } : {}),
    categoria: pedido.categoria,
    ...pedido.extra,
  };
  const id = crypto.randomUUID();
  l.tarefas.push({
    id,
    tipo: pedido.tipo,
    titulo: pedido.titulo,
    prioridade: "normal",
    status: "aberta",
    venceEm: pedido.venceEm,
    familiaId: familia.id,
    responsavelId: pedido.responsavelId,
    papelResponsavel: null,
    payload,
    criadoEm: new Date().toISOString(),
  });
  return id;
}

function cancelarLembretes(l: LojaDemonstracao, sessaoId: string) {
  for (const t of l.tarefas) {
    const payload = t.payload as Record<string, Json>;
    if (
      payload?.sessao_venda_id === sessaoId &&
      payload?.mensagemChave === "lembrete_sessao" &&
      (t.status === "aberta" || t.status === "em_andamento")
    ) {
      t.status = "cancelada";
    }
  }
}

function criarLembrete(
  l: LojaDemonstracao,
  lv: LojaVenda,
  sessao: SessaoDemo,
  responsavelId: string | null,
): string | null {
  if (sessao.status !== "agendada" || !sessao.agendadaPara) return null;
  if (diaBrasilia(new Date(sessao.agendadaPara)) <= diaBrasilia(new Date())) {
    return null;
  }
  const familia = l.familias.find((f) => f.id === sessao.familiaId);
  const id = criarTarefa(l, {
    familiaId: sessao.familiaId,
    tipo: "agendar_sessao",
    titulo: `Lembrar a ${familia?.nome ?? "família"} da conversa de amanhã`,
    responsavelId,
    venceEm: new Date(
      Date.parse(sessao.agendadaPara) - 24 * 60 * 60 * 1000,
    ).toISOString(),
    chaveMensagem: "lembrete_sessao",
    variaveis: {
      hora: horaBrasilia(sessao.agendadaPara),
      link: sessao.linkReuniao ?? "",
    },
    categoria: "operacional",
    extra: { sessao_venda_id: sessao.id },
  });
  if (id) lv.lembretes.push(sessao.id);
  return id;
}

function textosFormulario(
  nome: string | null,
  variaveis: Record<string, string | number | null>,
): TextosFormulario {
  const textos: Record<string, string> = {};
  for (const m of MENSAGENS_VENDA) {
    if (m.canal !== "site" || !m.chave.startsWith("formulario_")) continue;
    textos[m.chave.slice("formulario_".length)] = aplicarTexto(
      m.texto,
      nome,
      variaveis,
    );
  }
  return textos as TextosFormulario;
}

// --- Repositório da venda (usuário logado) ------------------------------------------

export interface ContextoVendaDemonstracao {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

export function criarVendaDemonstracao(
  contexto: ContextoVendaDemonstracao,
): VendaRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));
  const bloqueadoPorMfa = () =>
    exigeMfa(contexto.papeis) && contexto.aal !== "aal2";

  /** privado.autorizar: papel, e AAL2 quando pedido ou quando o perfil exige. */
  function autorizar(papeis: Papel[], exigeAal2: boolean): string {
    if (!contexto.usuarioId) semPermissao("sem sessão");
    if (!tem(...papeis)) semPermissao("papel sem permissão (PRD 13)");
    if (contexto.aal !== "aal2" && (exigeAal2 || bloqueadoPorMfa())) {
      semPermissao("esta operação exige MFA (AAL2)");
    }
    return contexto.usuarioId;
  }

  function condutorValido(l: LojaDemonstracao, id: string | null | undefined) {
    return Boolean(
      id &&
      l.usuarios.some(
        (u) =>
          u.id === id &&
          u.ativo &&
          (u.papeis.includes("coordenacao") || u.papeis.includes("diretoria")),
      ),
    );
  }

  function sessaoTela(
    l: LojaDemonstracao,
    lv: LojaVenda,
    s: SessaoDemo,
  ): SessaoVenda {
    const familia = l.familias.find((f) => f.id === s.familiaId);
    const podeVer = tem("diretoria") || s.conduzidaPor === contexto.usuarioId;
    const gravacao = lv.gravacoes[s.id];
    return {
      id: s.id,
      familiaId: s.familiaId,
      nomeFamilia: familia?.nome ?? "Família",
      estadoSensivel: familia?.estadoSensivel ?? "normal",
      dpp: familia?.dpp ?? null,
      dataNascimento: familia?.dataNascimento ?? null,
      agendadaPara: s.agendadaPara,
      status: s.status,
      realizadaEm: s.realizadaEm,
      linkReuniao: s.linkReuniao,
      opcoesInformadas: s.opcoesInformadas,
      parceiroPresente: s.parceiroPresente,
      conduzidaPor: s.conduzidaPor,
      conduzidaPorNome:
        l.usuarios.find((u) => u.id === s.conduzidaPor)?.nome ?? null,
      criadoEm: s.criadoEm,
      podeVerGravacao: podeVer,
      gravacaoRegistrada:
        podeVer && contexto.aal === "aal2"
          ? Boolean(gravacao?.transcricao)
          : null,
    };
  }

  function sessaoParaGravacao(lv: LojaVenda, sessaoId: string): SessaoDemo {
    const sessao = lv.sessoes.find((s) => s.id === sessaoId);
    if (!sessao) recusar("sessao_inexistente");
    if (!tem("diretoria") && sessao.conduzidaPor !== contexto.usuarioId) {
      semPermissao(
        "venda:so_quem_conduziu só quem conduziu e a diretoria (PRD 13)",
      );
    }
    return sessao;
  }

  function contratoAberto(lv: LojaVenda, familiaId: string) {
    return [...lv.contratos]
      .reverse()
      .find(
        (k) =>
          k.familiaId === familiaId &&
          (k.status === "rascunho" || k.status === "aguardando_dados"),
      );
  }

  return {
    async listarCondutores() {
      autorizar(["comercial", "coordenacao", "diretoria"], false);
      return obterLoja()
        .usuarios.filter(
          (u) =>
            u.ativo &&
            (u.papeis.includes("coordenacao") ||
              u.papeis.includes("diretoria")),
        )
        .sort(
          (a, b) =>
            Number(b.papeis.includes("coordenacao")) -
              Number(a.papeis.includes("coordenacao")) ||
            a.nome.localeCompare(b.nome, "pt-BR"),
        )
        .map((u) => ({ id: u.id, nome: u.nome }));
    },

    async listarSessoes(filtro = {}) {
      autorizar(["comercial", "coordenacao", "diretoria"], false);
      const l = obterLoja();
      const lv = obterLojaVenda();
      return lv.sessoes
        .filter((s) => !filtro.familiaId || s.familiaId === filtro.familiaId)
        .filter((s) => !filtro.sessaoId || s.id === filtro.sessaoId)
        .filter((s) => !filtro.desde || (s.agendadaPara ?? "") >= filtro.desde)
        .filter((s) => !filtro.ate || (s.agendadaPara ?? "") < filtro.ate)
        .sort((a, b) =>
          (a.agendadaPara ?? "").localeCompare(b.agendadaPara ?? ""),
        )
        .map((s) => sessaoTela(l, lv, s));
    },

    async obterTransferenciaReuniao(handoffId) {
      autorizar(["comercial", "coordenacao", "diretoria"], false);
      const l = obterLoja();
      const t = l.transferencias.find((x) => x.id === handoffId);
      if (!t || t.motivo !== "reuniao" || !t.familiaId) return null;
      const familia = l.familias.find((f) => f.id === t.familiaId);
      if (!familia) return null;
      return {
        id: t.id,
        familiaId: familia.id,
        nomeFamilia: familia.nome,
        dpp: familia.dpp,
        estadoSensivel: familia.estadoSensivel,
        status: t.status,
        opcoes: OPCOES_TRANSFERENCIA[t.id] ?? [],
        resumo: t.resumo,
      };
    },

    async agendarSessao(pedido) {
      const uid = autorizar(["comercial", "diretoria"], false);
      const l = obterLoja();
      const lv = obterLojaVenda();
      if (!pedido.familiaId || !pedido.agendadaPara)
        recusar("dados_obrigatorios");
      if (Date.parse(pedido.agendadaPara) <= Date.now())
        recusar("data_no_passado");
      if (!pedido.linkReuniao?.trim()) recusar("link_obrigatorio");
      if (!linkValido(pedido.linkReuniao.trim())) recusar("link_invalido");
      if (!condutorValido(l, pedido.conduzidaPor)) recusar("condutor_invalido");
      const familia = l.familias.find((f) => f.id === pedido.familiaId);
      if (!familia) recusar("familia_inexistente");
      if (
        familia.estadoSensivel === "bloqueio_total" ||
        familia.estadoSensivel === "encerrado_sensivel"
      ) {
        recusar("familia_em_estado_sensivel");
      }
      if (familia.naoContatar) recusar("familia_nao_contatar");
      if (
        lv.sessoes.some(
          (s) => s.familiaId === familia.id && s.status === "agendada",
        )
      ) {
        recusar("sessao_ja_agendada");
      }

      const o = oportunidadeAberta(l, familia.id);
      if (o && o.estagioP2 === null) {
        if (o.estagioP1 === "qualificado" || o.estagioP1 === "nutricao") {
          transicionar(l, o.id, "p1", "sessao_venda_agendada");
        } else if (o.estagioP1 === "em_conversa_ia") {
          transicionar(l, o.id, "p1", "qualificado");
          transicionar(l, o.id, "p1", "sessao_venda_agendada");
        } else if (o.estagioP1 !== "sessao_venda_agendada") {
          recusar("estagio_nao_permite_sessao", String(o.estagioP1));
        }
      }

      let opcoes = pedido.opcoesInformadas?.trim() || null;
      if (pedido.handoffId) {
        const t = l.transferencias.find((x) => x.id === pedido.handoffId);
        if (!t || t.familiaId !== familia.id || t.motivo !== "reuniao") {
          recusar("transferencia_invalida");
        }
        opcoes ??= (OPCOES_TRANSFERENCIA[t.id] ?? []).join(" ou ") || null;
        if (t.status === "aberto" || t.status === "assumido") {
          t.status = "resolvido";
          t.assumidoPor ??= uid;
          t.assumidoEm ??= new Date().toISOString();
        }
      }

      const sessao: SessaoDemo = {
        id: crypto.randomUUID(),
        familiaId: familia.id,
        agendadaPara: new Date(pedido.agendadaPara).toISOString(),
        status: "agendada",
        realizadaEm: null,
        linkReuniao: pedido.linkReuniao.trim(),
        opcoesInformadas: opcoes,
        parceiroPresente: null,
        conduzidaPor: pedido.conduzidaPor,
        criadoEm: new Date().toISOString(),
      };
      lv.sessoes.push(sessao);
      const lembrete = criarLembrete(l, lv, sessao, o?.responsavelId ?? uid);
      evento(
        l,
        familia.id,
        "sessao",
        `Conversa de orientação marcada para ${dataHoraTexto(sessao.agendadaPara!)}`,
        { sessao_venda_id: sessao.id },
      );
      return {
        sessaoId: sessao.id,
        tarefaLembreteId: lembrete,
        estagioP1: oportunidadeAberta(l, familia.id)?.estagioP1 ?? null,
      };
    },

    async remarcarSessao(pedido) {
      const uid = autorizar(["comercial", "diretoria"], false);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const antiga = lv.sessoes.find((s) => s.id === pedido.sessaoId);
      if (!antiga) recusar("sessao_inexistente");
      if (antiga.status !== "agendada")
        recusar("sessao_nao_agendada", antiga.status);
      if (
        !pedido.agendadaPara ||
        Date.parse(pedido.agendadaPara) <= Date.now()
      ) {
        recusar("data_no_passado");
      }
      const link = pedido.linkReuniao?.trim() || antiga.linkReuniao;
      if (!linkValido(link)) recusar("link_invalido");
      const condutor = pedido.conduzidaPor || antiga.conduzidaPor;
      if (!condutorValido(l, condutor)) recusar("condutor_invalido");
      const familia = l.familias.find((f) => f.id === antiga.familiaId);
      if (
        familia &&
        (familia.estadoSensivel === "bloqueio_total" ||
          familia.estadoSensivel === "encerrado_sensivel")
      ) {
        recusar("familia_em_estado_sensivel");
      }
      antiga.status = "remarcada";
      cancelarLembretes(l, antiga.id);
      const nova: SessaoDemo = {
        ...antiga,
        id: crypto.randomUUID(),
        agendadaPara: new Date(pedido.agendadaPara).toISOString(),
        status: "agendada",
        linkReuniao: link,
        conduzidaPor: condutor,
        criadoEm: new Date().toISOString(),
      };
      lv.sessoes.push(nova);
      criarLembrete(
        l,
        lv,
        nova,
        oportunidadeAberta(l, nova.familiaId)?.responsavelId ?? uid,
      );
      evento(
        l,
        nova.familiaId,
        "sessao",
        `Conversa de orientação remarcada para ${dataHoraTexto(nova.agendadaPara!)}`,
        { sessao_venda_id: nova.id },
      );
      return { sessaoId: nova.id };
    },

    async registrarDesfecho(sessaoId, desfecho, parceiroPresente) {
      const uid = autorizar(["comercial", "diretoria"], false);
      const l = obterLoja();
      const lv = obterLojaVenda();
      if (!["realizada", "nao_compareceu", "cancelada"].includes(desfecho)) {
        recusar("desfecho_invalido");
      }
      const sessao = lv.sessoes.find((s) => s.id === sessaoId);
      if (!sessao) recusar("sessao_inexistente");
      if (sessao.status !== "agendada")
        recusar("sessao_nao_agendada", sessao.status);
      if (
        desfecho !== "cancelada" &&
        sessao.agendadaPara &&
        Date.parse(sessao.agendadaPara) > Date.now()
      ) {
        recusar("sessao_ainda_nao_aconteceu");
      }
      const familia = l.familias.find((f) => f.id === sessao.familiaId);
      const o = oportunidadeAberta(l, sessao.familiaId);
      sessao.status = desfecho;
      if (desfecho === "realizada") sessao.realizadaEm = sessao.agendadaPara;
      if (parceiroPresente !== null) sessao.parceiroPresente = parceiroPresente;
      cancelarLembretes(l, sessao.id);

      if (
        o &&
        o.estagioP2 === null &&
        o.estagioP1 === "sessao_venda_agendada"
      ) {
        if (desfecho === "realizada") {
          transicionar(l, o.id, "p1", "sessao_venda_realizada");
        } else if (
          !lv.sessoes.some(
            (s) => s.familiaId === sessao.familiaId && s.status === "agendada",
          )
        ) {
          transicionar(l, o.id, "p1", "qualificado");
        }
      }

      let tarefaId: string | null = null;
      const responsavel = o?.responsavelId ?? uid;
      if (desfecho === "realizada") {
        const horas = numeroParametro("sessao_venda_retorno_horas");
        if (horas !== null && sessao.agendadaPara) {
          tarefaId = criarTarefa(l, {
            familiaId: sessao.familiaId,
            tipo: "followup_comercial",
            titulo: `Perguntar à ${familia?.nome ?? "família"} como foi a conversa`,
            responsavelId: responsavel,
            venceEm: new Date(
              Date.parse(sessao.agendadaPara) + horas * 3_600_000,
            ).toISOString(),
            chaveMensagem: "pos_sessao_48h",
            variaveis: {},
            categoria: "conteudo",
            extra: { sessao_venda_id: sessao.id },
          });
        }
      } else if (desfecho === "nao_compareceu") {
        tarefaId = criarTarefa(l, {
          familiaId: sessao.familiaId,
          tipo: "agendar_sessao",
          titulo: `Oferecer outro horário à ${familia?.nome ?? "família"}`,
          responsavelId: responsavel,
          venceEm: new Date().toISOString(),
          chaveMensagem: "nao_compareceu",
          variaveis: {},
          categoria: "operacional",
          extra: { sessao_venda_id: sessao.id },
        });
      }
      evento(
        l,
        sessao.familiaId,
        "sessao",
        desfecho === "realizada"
          ? "Conversa de orientação realizada"
          : desfecho === "nao_compareceu"
            ? "A família não compareceu à conversa de orientação"
            : "Conversa de orientação cancelada",
        { sessao_venda_id: sessao.id, status: desfecho },
      );
      return {
        sessaoId: sessao.id,
        status: desfecho,
        tarefaId,
        estagioP1: oportunidadeAberta(l, sessao.familiaId)?.estagioP1 ?? null,
      };
    },

    async obterGravacao(sessaoId) {
      autorizar(["comercial", "coordenacao", "diretoria"], true);
      const lv = obterLojaVenda();
      sessaoParaGravacao(lv, sessaoId);
      const g = lv.gravacoes[sessaoId];
      if (!g) return null;
      return {
        sessaoId,
        consentimento: g.consentimento,
        consentimentoVersao: g.consentimentoVersao,
        consentimentoEm: g.consentimentoEm,
        transcricao: g.transcricao,
        resumo: g.resumo,
      };
    },

    async registrarGravacao(sessaoId, consentimento, transcricao) {
      autorizar(["comercial", "coordenacao", "diretoria"], true);
      const lv = obterLojaVenda();
      const sessao = sessaoParaGravacao(lv, sessaoId);
      if (sessao.status !== "agendada" && sessao.status !== "realizada") {
        recusar("sessao_sem_gravacao", sessao.status);
      }
      const texto = transcricao?.trim() || null;
      const versao = textoParametro("sessao_gravacao", "termo_versao");
      const maximo = numeroParametro(
        "sessao_gravacao",
        "transcricao_max_caracteres",
      );
      if (consentimento && !versao) recusar("termo_sem_versao");
      if (texto && !consentimento) recusar("sem_consentimento");
      if (texto && maximo !== null && texto.length > maximo)
        recusar("transcricao_longa");
      const atual = lv.gravacoes[sessaoId];
      if (!consentimento) {
        lv.gravacoes[sessaoId] = {
          consentimento: false,
          consentimentoVersao: null,
          consentimentoEm: null,
          transcricao: null,
          resumo: null,
        };
        return;
      }
      lv.gravacoes[sessaoId] = {
        consentimento: true,
        consentimentoVersao: atual?.consentimento
          ? atual.consentimentoVersao
          : versao,
        consentimentoEm: atual?.consentimento
          ? atual.consentimentoEm
          : new Date().toISOString(),
        transcricao: texto ?? atual?.transcricao ?? null,
        resumo:
          texto && texto !== atual?.transcricao
            ? null
            : (atual?.resumo ?? null),
      };
    },

    async salvarResumo(sessaoId, resumo) {
      const uid = autorizar(["comercial", "coordenacao", "diretoria"], true);
      const lv = obterLojaVenda();
      sessaoParaGravacao(lv, sessaoId);
      const g = lv.gravacoes[sessaoId];
      if (!g?.consentimento || !g.transcricao) recusar("sem_transcricao");
      const listas = [resumo.duvidas, resumo.objecoes, resumo.proximosPassos];
      if (
        listas.some(
          (lista) =>
            !Array.isArray(lista) || lista.some((i) => typeof i !== "string"),
        )
      ) {
        recusar("resumo_invalido");
      }
      g.resumo = { ...resumo, salvoEm: new Date().toISOString() };
      void uid;
    },

    async oportunidadeDaFamilia(familiaId) {
      if (
        !tem("comercial", "financeiro", "coordenacao", "diretoria") ||
        bloqueadoPorMfa()
      ) {
        return null;
      }
      return oportunidadeAberta(obterLoja(), familiaId)?.id ?? null;
    },

    async obterProposta(oportunidadeId) {
      autorizar(["comercial", "financeiro", "diretoria"], true);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const o = l.oportunidades.find((x) => x.id === oportunidadeId);
      if (!o) recusar("oportunidade_inexistente");
      if (
        tem("financeiro") &&
        !tem("comercial", "diretoria") &&
        !lv.contratos.some((k) => k.familiaId === o.familiaId)
      ) {
        semPermissao("financeiro só vê família com contrato");
      }
      const familia = l.familias.find((f) => f.id === o.familiaId)!;
      const extra = lv.propostas[o.id];
      const condicao =
        CONDICOES.find((c) => c.id === extra?.condicaoId) ?? null;
      const k = [...lv.contratos]
        .reverse()
        .find(
          (x) =>
            x.familiaId === familia.id &&
            x.status !== "cancelado" &&
            x.status !== "distrato",
        );
      const taxa = TAXAS_CIDADE[familia.cidade.id];
      const aprovador = extra?.descontoAprovadoPor
        ? (l.usuarios.find((u) => u.id === extra.descontoAprovadoPor)?.nome ??
          null)
        : null;
      const proposta: Proposta = {
        oportunidade: {
          id: o.id,
          familiaId: o.familiaId,
          pipeline: o.pipeline,
          estagioP1: o.estagioP1,
          estagioP2: o.estagioP2,
          paraQuem: extra?.paraQuem ?? null,
          pagadorPessoaId: extra?.pagadorPessoaId ?? null,
          condicaoId: extra?.condicaoId ?? null,
          descontoPct: extra?.descontoPct ?? 0,
          planoInteressePacoteId: extra?.planoInteressePacoteId ?? null,
          precisaAprovacao:
            (extra?.descontoPct ?? 0) > 0 || Boolean(condicao?.requerAprovacao),
          descontoAprovado: Boolean(extra?.descontoAprovadoPor),
          descontoAprovadoPorNome: aprovador,
        },
        familia: {
          id: familia.id,
          nome: familia.nome,
          dpp: familia.dpp,
          dataNascimento: familia.dataNascimento,
          gemelar: familia.gemelar,
          estadoSensivel: familia.estadoSensivel,
          naoContatar: familia.naoContatar,
          cidade: {
            nome: familia.cidade.nome,
            uf: familia.cidade.uf,
            atendida: taxa?.atendida ?? true,
            requerConfirmacao: taxa?.requerConfirmacao ?? false,
            taxaCentavos: taxa?.taxaCentavos ?? 0,
          },
        },
        pessoas: l.pessoas
          .filter((p) => p.familiaId === familia.id)
          .sort(
            (a, b) => Number(b.contatoPrincipal) - Number(a.contatoPrincipal),
          )
          .map((p) => ({
            id: p.id,
            nome: p.nome,
            papel: p.papel,
            contatoPrincipal: p.contatoPrincipal,
          })),
        pacotes: vigenteHoje().map(({ ordem: _ordem, ...p }) => p),
        condicoes: CONDICOES.map((c) => ({ ...c })),
        contrato: k
          ? {
              id: k.id,
              status: k.status,
              pacoteVersaoId: k.pacoteVersaoId,
              contratantePessoaId: k.contratantePessoaId,
              pagadorPessoaId: k.pagadorPessoaId,
              testemunhaPessoaId: k.testemunhaPessoaId,
              templateVersao: k.templateVersao,
              conta: contaDe(k),
              formulario: {
                situacao: situacaoFormulario(k),
                expiraEm: k.tokenHash ? k.expiraEm : null,
                recebidoEm: k.tokenHash ? null : k.expiraEm,
              },
            }
          : null,
        formularioValidadeHoras: numeroParametro(
          "formulario_contrato",
          "validade_horas",
        ),
        podeEditar: tem("comercial", "diretoria"),
        podeAprovar: tem("diretoria"),
      };
      return proposta;
    },

    async salvarProposta(pedido) {
      const uid = autorizar(["comercial", "diretoria"], true);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const o = l.oportunidades.find((x) => x.id === pedido.oportunidadeId);
      if (!o) recusar("oportunidade_inexistente");
      if (
        o.estagioP2 !== null &&
        o.estagioP2 !== "proposta_enviada" &&
        o.estagioP2 !== "em_negociacao"
      ) {
        recusar("proposta_fechada", o.estagioP2);
      }
      if (
        o.estagioP2 === null &&
        !["qualificado", "nutricao", "sessao_venda_realizada"].includes(
          o.estagioP1 ?? "",
        )
      ) {
        recusar("estagio_nao_permite_proposta", String(o.estagioP1));
      }
      const familia = l.familias.find((f) => f.id === o.familiaId)!;
      if (
        familia.estadoSensivel === "bloqueio_total" ||
        familia.estadoSensivel === "encerrado_sensivel"
      ) {
        recusar("familia_em_estado_sensivel");
      }
      const mae = gestante(l, familia.id);
      if (!mae) recusar("sem_gestante");
      const pacote = vigenteHoje().find(
        (p) => p.pacoteVersaoId === pedido.pacoteVersaoId,
      );
      if (!pacote) recusar("pacote_fora_de_vigencia");

      let pct = pedido.descontoPct ?? 0;
      let maximo = pacote.parcelasMaxSemJuros;
      const condicao = pedido.condicaoId
        ? CONDICOES.find((c) => c.id === pedido.condicaoId)
        : null;
      if (pedido.condicaoId && !condicao) recusar("condicao_inativa");
      if (condicao?.tipo === "desconto_pct") {
        if (pct > 0) recusar("desconto_duplo");
        pct = condicao.valor;
      } else if (condicao?.tipo === "parcelamento") {
        maximo = Math.max(maximo, Math.trunc(condicao.valor));
      }
      const motivo = pedido.descontoMotivo?.trim() || null;
      if (pct < 0 || pct > 100) recusar("desconto_invalido");
      if (condicao?.tipo !== "desconto_pct" && pct > 0 && !motivo)
        recusar("desconto_sem_motivo");
      if (
        !Number.isInteger(pedido.parcelas) ||
        pedido.parcelas < 1 ||
        pedido.parcelas > maximo
      ) {
        recusar("parcelas_fora_da_condicao", String(maximo));
      }
      if (!["propria", "presente", "outro"].includes(pedido.paraQuem))
        recusar("para_quem_invalido");

      let pagador: string | null = null;
      if (pedido.paraQuem === "presente") {
        if (pedido.pagadorPessoaId) {
          if (
            !l.pessoas.some(
              (p) =>
                p.id === pedido.pagadorPessoaId && p.familiaId === familia.id,
            )
          ) {
            recusar("pagador_invalido");
          }
          if (pedido.pagadorPessoaId === mae.id)
            recusar("pagador_igual_gestante");
          pagador = pedido.pagadorPessoaId;
        } else if (pedido.pagadorNome?.trim()) {
          pagador = crypto.randomUUID();
          l.pessoas.push({
            id: pagador,
            familiaId: familia.id,
            papel: "presenteador",
            nome: pedido.pagadorNome.trim(),
            telefoneE164: "",
            email: null,
            contatoPrincipal: false,
          });
        } else {
          recusar("presente_sem_pagador");
        }
      }

      const taxa = TAXAS_CIDADE[familia.cidade.id]?.taxaCentavos ?? 0;
      const desconto = Math.round((pacote.valorCentavos * pct) / 100);
      const testemunha =
        l.pessoas.find(
          (p) => p.familiaId === familia.id && p.papel === "parceiro",
        )?.id ?? null;
      const precisa = pct > 0 || Boolean(condicao?.requerAprovacao);
      const anterior = lv.propostas[o.id];
      let k = contratoAberto(lv, familia.id);
      const mudou =
        (anterior?.condicaoId ?? null) !== (pedido.condicaoId ?? null) ||
        (anterior?.descontoPct ?? 0) !==
          (condicao?.tipo === "desconto_pct" ? 0 : pct) ||
        (anterior?.planoInteressePacoteId ?? null) !== pacote.pacoteId ||
        (k !== undefined &&
          (k.parcelas !== pedido.parcelas ||
            k.pacoteVersaoId !== pacote.pacoteVersaoId));

      lv.propostas[o.id] = {
        condicaoId: pedido.condicaoId ?? null,
        descontoPct: condicao?.tipo === "desconto_pct" ? 0 : pct,
        descontoMotivo: pct > 0 ? (motivo ?? condicao?.nome ?? null) : null,
        descontoAprovadoPor:
          !precisa || mudou ? null : (anterior?.descontoAprovadoPor ?? null),
        paraQuem: pedido.paraQuem,
        pagadorPessoaId: pagador,
        planoInteressePacoteId: pacote.pacoteId,
      };

      if (!k) {
        const template = textoParametro("contrato_template_versao");
        if (!template) recusar("template_sem_versao");
        k = {
          id: crypto.randomUUID(),
          familiaId: familia.id,
          pacoteVersaoId: pacote.pacoteVersaoId,
          contratantePessoaId: mae.id,
          pagadorPessoaId: pagador,
          testemunhaPessoaId: testemunha,
          valorCentavos: pacote.valorCentavos,
          taxaCentavos: taxa,
          descontoCentavos: desconto,
          parcelas: pedido.parcelas,
          templateVersao: template,
          tokenHash: null,
          expiraEm: null,
          status: "rascunho",
          criadoEm: new Date().toISOString(),
        };
        lv.contratos.push(k);
      } else {
        Object.assign(k, {
          pacoteVersaoId: pacote.pacoteVersaoId,
          contratantePessoaId: mae.id,
          pagadorPessoaId: pagador,
          testemunhaPessoaId: k.testemunhaPessoaId ?? testemunha,
          valorCentavos: pacote.valorCentavos,
          taxaCentavos: taxa,
          descontoCentavos: desconto,
          parcelas: pedido.parcelas,
        });
      }
      if (o.estagioP2 === null) transicionar(l, o.id, "p2", "proposta_enviada");
      const conta = contaDe(k);
      evento(
        l,
        familia.id,
        "proposta",
        `Proposta registrada: ${pacote.nome}, ${pedido.parcelas}x`,
        {
          contrato_id: k.id,
        },
      );
      void uid;
      return {
        contratoId: k.id,
        conta,
        precisaAprovacao: precisa,
        descontoAprovado: Boolean(lv.propostas[o.id]?.descontoAprovadoPor),
      };
    },

    async aprovarDesconto(oportunidadeId) {
      const uid = autorizar(["diretoria"], true);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const o = l.oportunidades.find((x) => x.id === oportunidadeId);
      if (!o) recusar("oportunidade_inexistente");
      const extra = lv.propostas[o.id];
      const condicao = CONDICOES.find((c) => c.id === extra?.condicaoId);
      if (
        !extra ||
        !((extra.descontoPct ?? 0) > 0 || condicao?.requerAprovacao)
      ) {
        recusar("nada_a_aprovar");
      }
      if (!extra.descontoAprovadoPor) {
        extra.descontoAprovadoPor = uid;
        evento(
          l,
          o.familiaId,
          "proposta",
          "Condição da proposta aprovada pela diretoria",
        );
      }
    },

    async gerarLinkFormulario(oportunidadeId) {
      const uid = autorizar(["comercial", "diretoria"], true);
      const l = obterLoja();
      const lv = obterLojaVenda();
      const o = l.oportunidades.find((x) => x.id === oportunidadeId);
      if (!o) recusar("oportunidade_inexistente");
      if (
        !o.estagioP2 ||
        !["proposta_enviada", "em_negociacao", "ganho"].includes(o.estagioP2)
      ) {
        recusar(
          "estagio_nao_permite_formulario",
          String(o.estagioP2 ?? o.estagioP1),
        );
      }
      const familia = l.familias.find((f) => f.id === o.familiaId)!;
      if (
        familia.naoContatar ||
        !freioPermite("operacional", familia.estadoSensivel)
      ) {
        recusar("familia_em_estado_sensivel");
      }
      const k = contratoAberto(lv, familia.id);
      if (!k) recusar("sem_proposta");
      if (!k.tokenHash && k.expiraEm) recusar("formulario_ja_recebido");
      const extra = lv.propostas[o.id];
      const condicao = CONDICOES.find((c) => c.id === extra?.condicaoId);
      if (
        ((extra?.descontoPct ?? 0) > 0 || condicao?.requerAprovacao) &&
        !extra?.descontoAprovadoPor
      ) {
        recusar("desconto_sem_aprovacao");
      }
      const horas = numeroParametro("formulario_contrato", "validade_horas");
      if (!horas || horas <= 0) recusar("validade_sem_parametro");
      if (o.estagioP2 === "proposta_enviada")
        transicionar(l, o.id, "p2", "em_negociacao");
      if (o.estagioP2 === "em_negociacao") transicionar(l, o.id, "p2", "ganho");

      const token = randomBytes(32).toString("base64url");
      const expira = new Date(Date.now() + horas * 3_600_000).toISOString();
      k.tokenHash = hashToken(token);
      k.expiraEm = expira;
      k.status = "aguardando_dados";

      let tarefa = l.tarefas.find(
        (t) =>
          t.familiaId === familia.id &&
          t.tipo === "enviar_formulario_contrato" &&
          (t.status === "aberta" || t.status === "em_andamento") &&
          (t.payload as Record<string, Json>)?.contrato_id === k.id,
      );
      if (!tarefa) {
        const pessoa = contato(l, familia.id);
        tarefa = {
          id: crypto.randomUUID(),
          tipo: "enviar_formulario_contrato",
          titulo: `Enviar o formulário do contrato para a ${familia.nome}`,
          prioridade: "alta",
          status: "aberta",
          venceEm: new Date().toISOString(),
          familiaId: familia.id,
          responsavelId: uid,
          papelResponsavel: null,
          payload: {
            acao: "formulario_contrato",
            contrato_id: k.id,
            oportunidade_id: o.id,
            mensagemChave: "formulario_contrato",
            categoria: "operacional",
            ...(pessoa?.telefoneE164
              ? { telefoneE164: pessoa.telefoneE164 }
              : {}),
          },
          criadoEm: new Date().toISOString(),
        };
        l.tarefas.push(tarefa);
      }
      evento(
        l,
        familia.id,
        "formulario",
        `Link do formulário do contrato gerado, válido até ${dataHoraTexto(expira)}`,
        {
          contrato_id: k.id,
        },
      );
      return {
        token,
        expiraEm: expira,
        contratoId: k.id,
        tarefaId: tarefa.id,
        estagioP2: o.estagioP2,
      };
    },
  };
}

// --- Formulário público (sem usuário) -----------------------------------------------

function contratoDoToken(lv: LojaVenda, token: string): ContratoDemo | null {
  if (!token || token.length < 20 || token.length > 100) return null;
  const hash = hashToken(token);
  return (
    lv.contratos.find(
      (k) =>
        k.tokenHash === hash &&
        k.status === "aguardando_dados" &&
        k.expiraEm !== null &&
        Date.parse(k.expiraEm) > Date.now(),
    ) ?? null
  );
}

function origemHash(origem: string | null): string {
  return createHash("sha256")
    .update(`formulario:${origem?.trim() || "sem-origem"}`)
    .digest("hex");
}

function passouDoLimite(
  lv: LojaVenda,
  origem: string,
  contratoId: string | null,
) {
  const maximo = numeroParametro("formulario_contrato", "tentativas_max");
  const janela = numeroParametro(
    "formulario_contrato",
    "tentativas_janela_minutos",
  );
  if (maximo === null || janela === null) return false;
  const desde = Date.now() - janela * 60_000;
  lv.tentativas = lv.tentativas.filter(
    (t) => t.em >= Date.now() - janela * 2 * 60_000,
  );
  const recentes = lv.tentativas.filter((t) => t.em >= desde);
  return (
    recentes.filter((t) => t.origem === origem).length >= maximo ||
    (contratoId !== null &&
      recentes.filter((t) => t.contratoId === contratoId).length >= maximo)
  );
}

function cpfDigitosValidos(texto: string): boolean {
  const d = texto.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const n = d.split("").map(Number);
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += (n[i] ?? 0) * (10 - i);
  const dv1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  soma = 0;
  for (let i = 0; i < 10; i++) soma += (n[i] ?? 0) * (11 - i);
  const dv2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return n[9] === dv1 && n[10] === dv2;
}

function nomeValido(nome: string | undefined): boolean {
  const limpo = (nome ?? "").trim();
  return /^[\p{L}'.-]+( [\p{L}'.-]+)+$/u.test(limpo) && limpo.length <= 160;
}

function emailValido(email: string | undefined): boolean {
  const limpo = (email ?? "").trim();
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(limpo) && limpo.length <= 200;
}

function enderecoValido(e: EnderecoFormulario | null | undefined): boolean {
  return Boolean(
    e &&
    /^\d{8}$/.test(e.cep.replace(/\D/g, "")) &&
    e.logradouro.trim().length >= 2 &&
    e.numero.trim().length >= 1 &&
    e.bairro.trim().length >= 2 &&
    e.cidade.trim().length >= 2 &&
    /^[A-Z]{2}$/i.test(e.uf.trim()),
  );
}

export function criarFormularioDemonstracao(): FormularioContratoRepositorio {
  garantirDemonstracaoPermitida();

  return {
    async abrir(token, origem) {
      const l = obterLoja();
      const lv = obterLojaVenda();
      const chave = origemHash(origem);
      const janela = numeroParametro(
        "formulario_contrato",
        "tentativas_janela_minutos",
      );
      if (passouDoLimite(lv, chave, null)) {
        return {
          situacao: "limite",
          minutos: janela,
          textos: textosFormulario(null, { minutos: janela }),
        };
      }
      const k = contratoDoToken(lv, token);
      if (!k) {
        lv.tentativas.push({ origem: chave, contratoId: null, em: Date.now() });
        return { situacao: "invalido", textos: textosFormulario(null, {}) };
      }
      const pessoa = (id: string | null) =>
        l.pessoas.find((p) => p.id === id) ?? null;
      const mae = pessoa(k.contratantePessoaId);
      const pagador = pessoa(k.pagadorPessoaId);
      const testemunha = pessoa(k.testemunhaPessoaId);
      const tarefa = [...l.tarefas]
        .reverse()
        .find(
          (t) =>
            t.tipo === "enviar_formulario_contrato" &&
            (t.payload as Record<string, Json>)?.contrato_id === k.id,
        );
      const quem = primeiroNome(
        l.usuarios.find((u) => u.id === tarefa?.responsavelId)?.nome,
      );
      return {
        situacao: "valido",
        expiraEm: k.expiraEm!,
        pedePagador: k.pagadorPessoaId !== null,
        nomeGestante: mae?.nome ?? null,
        nomePagador: pagador?.nome ?? null,
        nomeTestemunha: testemunha?.nome ?? null,
        termoVersao: textoParametro("termo_lgpd_contrato_versao"),
        textos: textosFormulario(primeiroNome(mae?.nome), {
          quem_pediu: quem ?? "A equipe da Kraamzorg",
          minutos: numeroParametro("formulario_contrato", "duracao_minutos"),
          pagador: primeiroNome(pagador?.nome),
        }),
      };
    },

    async enviar(token, dados: DadosFormularioContrato, origem) {
      const l = obterLoja();
      const lv = obterLojaVenda();
      const chave = origemHash(origem);
      const janela = numeroParametro(
        "formulario_contrato",
        "tentativas_janela_minutos",
      );
      if (passouDoLimite(lv, chave, null))
        return { situacao: "limite", minutos: janela };
      const k = contratoDoToken(lv, token);
      if (!k) {
        lv.tentativas.push({ origem: chave, contratoId: null, em: Date.now() });
        return { situacao: "invalido" };
      }
      if (passouDoLimite(lv, chave, k.id))
        return { situacao: "limite", minutos: janela };

      const erros: Record<string, string> = {};
      const g = dados.gestante;
      if (!nomeValido(g?.nomeCompleto))
        erros["gestante.nome_completo"] = "invalido";
      if (!cpfDigitosValidos(g?.cpf ?? "")) erros["gestante.cpf"] = "invalido";
      const hoje = diaBrasilia(new Date());
      if (
        !g?.dataNascimento ||
        g.dataNascimento >= hoje ||
        g.dataNascimento < "1900-01-01"
      ) {
        erros["gestante.data_nascimento"] = "invalido";
      }
      if (!emailValido(g?.email)) erros["gestante.email"] = "invalido";
      if (!enderecoValido(g?.endereco)) erros["gestante.endereco"] = "invalido";
      if (
        !dados.atendimentoNoMesmoEndereco &&
        !enderecoValido(dados.enderecoAtendimento)
      ) {
        erros.endereco_atendimento = "invalido";
      }
      if (k.pagadorPessoaId) {
        const p = dados.pagador;
        if (!p) erros.pagador = "obrigatorio";
        else {
          if (!nomeValido(p.nomeCompleto))
            erros["pagador.nome_completo"] = "invalido";
          if (!cpfDigitosValidos(p.cpf)) erros["pagador.cpf"] = "invalido";
          else if (
            p.cpf.replace(/\D/g, "") === (g?.cpf ?? "").replace(/\D/g, "")
          ) {
            erros["pagador.cpf"] = "igual_gestante";
          }
          if (!emailValido(p.email)) erros["pagador.email"] = "invalido";
          if (!enderecoValido(p.endereco))
            erros["pagador.endereco"] = "invalido";
        }
      }
      if (dados.testemunha?.nomeCompleto?.trim()) {
        if (!nomeValido(dados.testemunha.nomeCompleto))
          erros["testemunha.nome_completo"] = "invalido";
        if (!emailValido(dados.testemunha.email))
          erros["testemunha.email"] = "invalido";
      }
      const versao = textoParametro("termo_lgpd_contrato_versao");
      if (
        !versao ||
        dados.consentimento?.aceito !== true ||
        dados.consentimento.versao !== versao
      ) {
        erros.consentimento = "obrigatorio";
      }
      if (Object.keys(erros).length > 0) {
        lv.tentativas.push({ origem: chave, contratoId: k.id, em: Date.now() });
        return { situacao: "corrigir", erros };
      }

      const agora = new Date().toISOString();
      const mae = l.pessoas.find((p) => p.id === k.contratantePessoaId);
      if (mae) {
        mae.nome = g.nomeCompleto.trim();
        mae.email = g.email.trim().toLowerCase();
        lv.consentimentos[mae.id] = { versao: versao!, em: agora };
        lv.dadosContrato[mae.id] = {
          cpf: g.cpf.replace(/\D/g, ""),
          dataNascimento: g.dataNascimento,
          endereco: { ...g.endereco, uf: g.endereco.uf.toUpperCase() },
        };
      }
      lv.enderecoAtendimento[k.familiaId] = dados.atendimentoNoMesmoEndereco
        ? g.endereco
        : dados.enderecoAtendimento!;
      if (k.pagadorPessoaId && dados.pagador) {
        const p = l.pessoas.find((x) => x.id === k.pagadorPessoaId);
        if (p) {
          p.nome = dados.pagador.nomeCompleto.trim();
          p.email = dados.pagador.email.trim().toLowerCase();
          lv.consentimentos[p.id] = { versao: versao!, em: agora };
        }
        lv.dadosContrato[k.pagadorPessoaId] = {
          cpf: dados.pagador.cpf.replace(/\D/g, ""),
          dataNascimento: null,
          endereco: dados.pagador.endereco,
        };
      }
      if (dados.testemunha?.nomeCompleto?.trim()) {
        const existente = l.pessoas.find((x) => x.id === k.testemunhaPessoaId);
        if (existente) {
          existente.nome = dados.testemunha.nomeCompleto.trim();
          existente.email = dados.testemunha.email.trim().toLowerCase();
        } else {
          const id = crypto.randomUUID();
          l.pessoas.push({
            id,
            familiaId: k.familiaId,
            papel: "acompanhante",
            nome: dados.testemunha.nomeCompleto.trim(),
            telefoneE164: "",
            email: dados.testemunha.email.trim().toLowerCase(),
            contatoPrincipal: false,
          });
          k.testemunhaPessoaId = id;
        }
      }
      k.tokenHash = null;
      k.expiraEm = agora;
      let responsavel: string | null = null;
      for (const t of l.tarefas) {
        if (
          t.tipo === "enviar_formulario_contrato" &&
          (t.payload as Record<string, Json>)?.contrato_id === k.id
        ) {
          responsavel = t.responsavelId;
          if (t.status === "aberta" || t.status === "em_andamento")
            t.status = "concluida";
        }
      }
      lv.notificacoes.push({
        usuarioId: responsavel,
        titulo: "Dados do contrato recebidos pelo formulário seguro",
        link: `/familias/${k.familiaId}/proposta`,
      });
      evento(
        l,
        k.familiaId,
        "formulario",
        "Dados do contrato recebidos pelo formulário seguro",
        {
          contrato_id: k.id,
        },
      );
      return { situacao: "recebido" };
    },
  };
}

/** Dados de contrato gravados pelo formulário (a ficha lê mascarado). */
export function dadosContratoDemonstracao(
  pessoaId: string,
): DadosContratoDemo | null {
  return obterLojaVenda().dadosContrato[pessoaId] ?? null;
}
