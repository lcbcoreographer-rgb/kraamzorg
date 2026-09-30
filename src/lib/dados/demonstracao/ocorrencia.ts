import { exigeMfa, type Papel } from "@/lib/auth/papeis";
import type { NivelAutenticacao } from "@/lib/auth/tipos";
import { ErroRepositorio } from "../erros";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  AberturaPesquisa,
  EstagioPosVenda,
  EventoHistorico,
  ListaOcorrencias,
  ListaPosVenda,
  OcorrenciaDetalhe,
  OcorrenciaRepositorio,
  OcorrenciaResumo,
  PedidoAtualizarOcorrencia,
  PedidoOcorrencia,
  PerguntaPesquisa,
  PesquisaPublicaRepositorio,
  PosVendaItem,
  PosVendaRepositorio,
  PrioridadeOcorrencia,
  ResultadoEnvioPesquisa,
  ResultadoLinkPesquisa,
  RespostasPesquisa,
  StatusOcorrencia,
  TextosPesquisa,
} from "../tipos-ocorrencia";
import { familiaPorNome, USUARIOS } from "./fixtures";
import { obterLoja } from "./loja";

/**
 * Ocorrências, pós-venda e pesquisa no modo demonstração (P42): as mesmas
 * regras de 0024_evolucao_ocorrencia_nf.sql sobre uma loja em memória. A prova
 * de permissão continua sendo o pgTAP (024); aqui o recorte por papel é o
 * mesmo, simplificado. Recusas com o mesmo código `ocorrencia:<código>` e
 * `pesquisa:<código>` na mensagem.
 */

export interface ContextoDemonstracaoOcorrencia {
  usuarioId: string | null;
  papeis: Papel[];
  aal: NivelAutenticacao;
}

interface OcorrenciaDemo extends OcorrenciaResumo {
  descricao: string;
  historico: EventoHistorico[];
  resolvidaEm: string | null;
}

interface PosVendaDemo {
  id: string;
  acompanhamentoId: string;
  familiaId: string;
  estagio: EstagioPosVenda;
  token: string | null;
  expiraEm: string | null;
  enviadaEm: string | null;
  respondidaEm: string | null;
  respostas: RespostasPesquisa | null;
  nps: number | null;
  classificacao: PosVendaItem["classificacao"];
  depoimento: boolean | null;
  imagem: boolean | null;
  acaoEm: string | null;
  criadoEm: string;
}

interface AcaoDemo {
  id: string;
  posVendaId: string;
  familiaId: string;
  acao: "depoimento" | "indicacao" | "escuta";
  titulo: string;
  venceEm: string;
}

interface LojaOcorrencias {
  ocorrencias: OcorrenciaDemo[];
  posVendas: PosVendaDemo[];
  acoes: AcaoDemo[];
  tentativas: { origem: string; em: number }[];
  notificacoes: { papel: Papel; titulo: string }[];
}

export const TOKEN_DEMO_PESQUISA = "demo-pesquisa-dalia-token-0001";

const CHAVE_GLOBAL = "__kraamzorgLojaOcorrencias";

/** Horas até o vencimento por prioridade (parametro.ocorrencia_sla). */
const SLA_HORAS: Record<PrioridadeOcorrencia, number> = {
  normal: 72,
  alta: 24,
  maxima: 4,
};
const PARAMETROS_PESQUISA = {
  validadeDias: 30,
  tentativasMax: 5,
  janelaMinutos: 15,
  promotorMin: 9,
  neutroMin: 7,
  depoimentoAposDias: 1,
  indicacaoAposDias: 7,
  escutaPrazoDias: 2,
};

export const PERGUNTAS_PESQUISA: PerguntaPesquisa[] = [
  {
    id: "nps",
    tipo: "escala_0_10",
    obrigatoria: true,
    texto:
      "De 0 a 10, o quanto você recomendaria a Kraamzorg a uma pessoa querida?",
    rotuloMin: "Nada provável",
    rotuloMax: "Muito provável",
  },
  {
    id: "recomendaria",
    tipo: "opcao",
    obrigatoria: false,
    texto: "Você recomendaria o acompanhamento a outras famílias?",
    opcoes: [
      { valor: "com_certeza", rotulo: "Com certeza" },
      { valor: "provavelmente", rotulo: "Provavelmente" },
      { valor: "talvez", rotulo: "Talvez" },
      { valor: "provavelmente_nao", rotulo: "Provavelmente não" },
      { valor: "nao", rotulo: "Não" },
    ],
  },
  {
    id: "destaque",
    tipo: "texto",
    obrigatoria: false,
    texto: "O que mais fez diferença para vocês nesses dias?",
  },
  {
    id: "sugestao",
    tipo: "texto",
    obrigatoria: false,
    texto: "Tem algo que a gente poderia fazer melhor?",
  },
  {
    id: "depoimento_autorizado",
    tipo: "sim_nao",
    obrigatoria: true,
    texto:
      "Podemos usar o seu depoimento, com o seu primeiro nome, para contar a outras famílias como foi?",
  },
  {
    id: "autorizacao_imagem",
    tipo: "sim_nao",
    obrigatoria: true,
    texto:
      "Podemos usar imagens do acompanhamento que vocês compartilharam em nossos materiais?",
  },
];

export const TEXTOS_PESQUISA: TextosPesquisa = {
  titulo: "Como foi para vocês?",
  abertura:
    "Oi, {nome}. Foram dias de muito cuidado, e a sua opinião ajuda a Kraamzorg a cuidar melhor das próximas famílias. São poucas perguntas e leva cerca de dois minutos.",
  enviar: "Enviar as minhas respostas",
  agradecimento:
    "Obrigada por contar como foi, {nome}. Cada resposta chega até a equipe e ajuda a cuidar melhor de quem vem depois.",
  link_invalido:
    "Este link não está mais disponível. Se você quiser responder, é só pedir um novo link à nossa equipe.",
  limite:
    "Foram muitas tentativas em pouco tempo. Aguarde alguns minutos e abra o link de novo.",
  corrigir:
    "Falta responder alguma pergunta. Confira as marcadas e envie de novo.",
};

const HORA = 3_600_000;

function criarLoja(): LojaOcorrencias {
  const agora = Date.now();
  const iso = (deslocamentoHoras: number) =>
    new Date(agora + deslocamentoHoras * HORA).toISOString();
  const aurora = familiaPorNome("Família Teste Aurora");
  const estrela = familiaPorNome("Família Teste Estrela");
  const cedro = familiaPorNome("Família Teste Cedro");
  const dalia = familiaPorNome("Família Teste Dália");
  const bruma = familiaPorNome("Família Teste Bruma");
  const coordenacao = USUARIOS.find((u) => u.papeis.includes("coordenacao"))!;
  const enfermeira = USUARIOS.find((u) => u.papeis.includes("enfermeira"))!;
  const id = (n: number) =>
    `00000000-0000-4000-8c00-${n.toString().padStart(12, "0")}`;
  const ocorrencia = (
    n: number,
    dados: Partial<OcorrenciaDemo> &
      Pick<
        OcorrenciaDemo,
        "titulo" | "descricao" | "tipo" | "prioridade" | "status"
      >,
  ): OcorrenciaDemo => ({
    id: id(n),
    familiaId: null,
    familiaNome: null,
    profissionalId: null,
    profissionalNome: null,
    privada: false,
    responsavelId: null,
    responsavelNome: null,
    slaVenceEm: null,
    vencida: false,
    criadoEm: iso(-30),
    versao: 1,
    historico: [
      { em: iso(-30), por: coordenacao.id, acao: "aberta", para: dados.status },
    ],
    resolvidaEm: null,
    ...dados,
  });
  return {
    ocorrencias: [
      ocorrencia(1, {
        familiaId: aurora.id,
        familiaNome: aurora.nome,
        tipo: "reclamacao",
        prioridade: "alta",
        status: "responsavel_definido",
        titulo: "Horário da visita mudou duas vezes",
        descricao:
          "A família contou que o horário da visita mudou duas vezes na mesma semana e pediu que isso não se repita.",
        responsavelId: enfermeira.id,
        responsavelNome: enfermeira.nome,
        slaVenceEm: iso(-6),
        criadoEm: iso(-6 - 24 + 24),
      }),
      ocorrencia(2, {
        familiaId: estrela.id,
        familiaNome: estrela.nome,
        tipo: "detrator",
        prioridade: "alta",
        privada: true,
        status: "aberta",
        titulo: "Pesquisa de satisfação com nota baixa",
        descricao:
          "A família respondeu a pesquisa com nota 4 de 0 a 10. Contato pessoal da coordenação, sem pedido de avaliação pública.",
        criadoEm: iso(-48),
        slaVenceEm: iso(-24),
      }),
      ocorrencia(3, {
        familiaId: cedro.id,
        familiaNome: cedro.nome,
        tipo: "contato_perdido",
        prioridade: "normal",
        status: "em_acompanhamento",
        titulo: "Sem resposta depois do último dia",
        descricao:
          "A equipe tentou falar duas vezes com a família depois do último dia e não teve retorno.",
        responsavelId: coordenacao.id,
        responsavelNome: coordenacao.nome,
        slaVenceEm: iso(40),
        criadoEm: iso(-30),
      }),
      ocorrencia(4, {
        familiaId: dalia.id,
        familiaNome: dalia.nome,
        tipo: "registro_atrasado",
        prioridade: "normal",
        status: "resolvida",
        titulo: "Ficha da visita entregue com atraso",
        descricao:
          "A ficha do D3 subiu quase um dia depois da visita por falta de sinal.",
        responsavelId: coordenacao.id,
        responsavelNome: coordenacao.nome,
        criadoEm: iso(-120),
        resolvidaEm: iso(-100),
        slaVenceEm: iso(-48),
      }),
    ],
    posVendas: [
      {
        id: id(11),
        acompanhamentoId: id(111),
        familiaId: aurora.id,
        estagio: "protocolo_ultimo_dia_concluido",
        token: null,
        expiraEm: null,
        enviadaEm: null,
        respondidaEm: null,
        respostas: null,
        nps: null,
        classificacao: null,
        depoimento: null,
        imagem: null,
        acaoEm: null,
        criadoEm: iso(-2),
      },
      {
        id: id(12),
        acompanhamentoId: id(112),
        familiaId: dalia.id,
        estagio: "pesquisa_enviada",
        token: TOKEN_DEMO_PESQUISA,
        expiraEm: iso(24 * 28),
        enviadaEm: iso(-20),
        respondidaEm: null,
        respostas: null,
        nps: null,
        classificacao: null,
        depoimento: null,
        imagem: null,
        acaoEm: null,
        criadoEm: iso(-30),
      },
      {
        id: id(13),
        acompanhamentoId: id(113),
        familiaId: cedro.id,
        estagio: "classificado",
        token: null,
        expiraEm: null,
        enviadaEm: iso(-70),
        respondidaEm: iso(-60),
        respostas: { nps: 10, destaque: "A presença todos os dias." },
        nps: 10,
        classificacao: "promotor",
        depoimento: true,
        imagem: true,
        acaoEm: null,
        criadoEm: iso(-90),
      },
      {
        id: id(14),
        acompanhamentoId: id(114),
        familiaId: bruma.id,
        estagio: "protocolo_ultimo_dia_concluido",
        token: null,
        expiraEm: null,
        enviadaEm: null,
        respondidaEm: null,
        respostas: null,
        nps: null,
        classificacao: null,
        depoimento: null,
        imagem: null,
        acaoEm: null,
        criadoEm: iso(-5),
      },
    ],
    acoes: [],
    tentativas: [],
    notificacoes: [],
  };
}

export function obterLojaOcorrencias(): LojaOcorrencias {
  garantirDemonstracaoPermitida();
  const g = globalThis as unknown as Record<string, LojaOcorrencias>;
  g[CHAVE_GLOBAL] ??= criarLoja();
  return g[CHAVE_GLOBAL]!;
}

/** Só para teste: volta a loja ao começo. */
export function reiniciarLojaOcorrencias(): void {
  const g = globalThis as unknown as Record<string, LojaOcorrencias>;
  g[CHAVE_GLOBAL] = criarLoja();
}

function recusa(
  dominio: "ocorrencia" | "pesquisa",
  codigo: string,
): ErroRepositorio {
  return new ErroRepositorio("recusado", `${dominio}:${codigo}`);
}

const ORDEM_STATUS: StatusOcorrencia[] = [
  "aberta",
  "triagem",
  "responsavel_definido",
  "em_acompanhamento",
  "resolvida",
  "encerrada",
];

function vencida(o: {
  slaVenceEm: string | null;
  status: StatusOcorrencia;
}): boolean {
  return (
    o.slaVenceEm !== null &&
    Date.parse(o.slaVenceEm) < Date.now() &&
    o.status !== "resolvida" &&
    o.status !== "encerrada"
  );
}

export function criarOcorrenciaDemonstracao(
  contexto: ContextoDemonstracaoOcorrencia,
): OcorrenciaRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));

  function autorizar(...papeis: Papel[]): string {
    if (!contexto.usuarioId) {
      throw new ErroRepositorio("sem_permissao", "demonstração: sem sessão");
    }
    if (!tem(...papeis)) {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: papel sem acesso",
      );
    }
    if (exigeMfa(contexto.papeis) && contexto.aal !== "aal2") {
      throw new ErroRepositorio("sem_permissao", "demonstração: exige MFA");
    }
    return contexto.usuarioId;
  }

  const gestor = () => tem("coordenacao", "diretoria");

  function visivel(o: OcorrenciaDemo): boolean {
    return gestor() || (!o.privada && o.responsavelId === contexto.usuarioId);
  }

  function resumo(o: OcorrenciaDemo): OcorrenciaResumo {
    const { descricao: _d, historico: _h, resolvidaEm: _r, ...resto } = o;
    void _d;
    void _h;
    void _r;
    return { ...resto, vencida: vencida(o) };
  }

  return {
    async listar(situacao, familiaId) {
      autorizar("coordenacao", "diretoria", "enfermeira");
      const itens = obterLojaOcorrencias()
        .ocorrencias.filter(visivel)
        .filter((o) => !familiaId || o.familiaId === familiaId)
        .filter((o) => {
          const fechada = o.status === "resolvida" || o.status === "encerrada";
          return (
            situacao === "todas" ||
            (situacao === "abertas" ? !fechada : fechada)
          );
        });
      const peso = (o: OcorrenciaDemo) =>
        (o.status === "resolvida" || o.status === "encerrada" ? 100 : 0) +
        (o.prioridade === "maxima" ? 0 : o.prioridade === "alta" ? 10 : 20);
      const ordenadas = [...itens].sort(
        (a, b) =>
          peso(a) - peso(b) ||
          (a.slaVenceEm ?? "9").localeCompare(b.slaVenceEm ?? "9"),
      );
      const abertas = itens.filter(
        (o) => o.status !== "resolvida" && o.status !== "encerrada",
      );
      const lista: ListaOcorrencias = {
        resumo: {
          abertas: abertas.length,
          vencidas: abertas.filter(vencida).length,
          privadas: abertas.filter((o) => o.privada).length,
        },
        ocorrencias: ordenadas.map(resumo),
      };
      return lista;
    },

    async obter(ocorrenciaId): Promise<OcorrenciaDetalhe> {
      autorizar("coordenacao", "diretoria", "enfermeira");
      const o = obterLojaOcorrencias().ocorrencias.find(
        (x) => x.id === ocorrenciaId,
      );
      if (!o || !visivel(o)) throw recusa("ocorrencia", "inexistente");
      return {
        ...resumo(o),
        descricao: o.descricao,
        historico: structuredClone(o.historico),
        resolvidaEm: o.resolvidaEm,
        podeGerir: gestor(),
      };
    },

    async responsaveis() {
      autorizar("coordenacao", "diretoria");
      return USUARIOS.filter(
        (u) =>
          u.ativo &&
          u.papeis.some((p) =>
            ["coordenacao", "diretoria", "enfermeira"].includes(p),
          ),
      )
        .map((u) => ({ id: u.id, nome: u.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },

    async registrar(pedido: PedidoOcorrencia) {
      const usuario = autorizar("coordenacao", "diretoria");
      if (pedido.titulo.trim().length < 3 || pedido.titulo.length > 160) {
        throw recusa("ocorrencia", "titulo_invalido");
      }
      if (
        pedido.descricao.trim().length < 3 ||
        pedido.descricao.length > 4000
      ) {
        throw recusa("ocorrencia", "descricao_invalida");
      }
      const l = obterLoja();
      const familia = pedido.familiaId
        ? l.familias.find((f) => f.id === pedido.familiaId)
        : undefined;
      if (pedido.familiaId && !familia)
        throw recusa("ocorrencia", "familia_inexistente");
      const responsavel = pedido.responsavelId
        ? USUARIOS.find((u) => u.id === pedido.responsavelId)
        : undefined;
      if (pedido.responsavelId && !responsavel) {
        throw recusa("ocorrencia", "responsavel_invalido");
      }
      const privada = pedido.tipo === "detrator" ? true : pedido.privada;
      const agora = Date.now();
      const status: StatusOcorrencia = responsavel
        ? "responsavel_definido"
        : "aberta";
      const nova: OcorrenciaDemo = {
        id: crypto.randomUUID(),
        familiaId: pedido.familiaId,
        familiaNome: familia?.nome ?? null,
        profissionalId: pedido.profissionalId,
        profissionalNome: null,
        tipo: pedido.tipo,
        prioridade: pedido.prioridade,
        privada,
        titulo: pedido.titulo.trim(),
        descricao: pedido.descricao.trim(),
        status,
        responsavelId: responsavel?.id ?? null,
        responsavelNome: responsavel?.nome ?? null,
        slaVenceEm: new Date(
          agora + SLA_HORAS[pedido.prioridade] * HORA,
        ).toISOString(),
        vencida: false,
        criadoEm: new Date(agora).toISOString(),
        versao: 1,
        historico: [
          {
            em: new Date(agora).toISOString(),
            por: usuario,
            acao: "aberta",
            para: status,
          },
        ],
        resolvidaEm: null,
      };
      obterLojaOcorrencias().ocorrencias.push(nova);
      return { id: nova.id, privada };
    },

    async atualizar(pedido: PedidoAtualizarOcorrencia) {
      const usuario = autorizar("coordenacao", "diretoria", "enfermeira");
      const o = obterLojaOcorrencias().ocorrencias.find(
        (x) => x.id === pedido.ocorrenciaId,
      );
      if (!o || !visivel(o)) throw recusa("ocorrencia", "inexistente");
      if (
        pedido.versaoBase !== undefined &&
        pedido.versaoBase !== null &&
        pedido.versaoBase !== o.versao
      ) {
        throw recusa("ocorrencia", "versao_desatualizada");
      }
      if (
        !gestor() &&
        (pedido.responsavelId !== undefined ||
          pedido.prioridade !== undefined ||
          pedido.privada !== undefined)
      ) {
        throw new ErroRepositorio(
          "sem_permissao",
          "demonstração: o responsável altera só o status e o histórico",
        );
      }
      if (o.status === "encerrada") throw recusa("ocorrencia", "encerrada");
      const nota = pedido.nota?.trim() || undefined;
      let novo: StatusOcorrencia = o.status;
      if (pedido.status && pedido.status !== o.status) {
        const de = ORDEM_STATUS.indexOf(o.status);
        const para = ORDEM_STATUS.indexOf(pedido.status);
        if (para < 0) throw recusa("ocorrencia", "status_invalido");
        if (
          para < de &&
          !(o.status === "resolvida" && pedido.status === "em_acompanhamento")
        ) {
          throw recusa("ocorrencia", "status_para_tras");
        }
        if (
          (pedido.status === "resolvida" || pedido.status === "encerrada") &&
          (!nota || nota.length < 10)
        ) {
          throw recusa("ocorrencia", "resolucao_sem_nota");
        }
        const responsavelFinal =
          pedido.responsavelId === undefined
            ? o.responsavelId
            : pedido.responsavelId;
        if (
          para >= ORDEM_STATUS.indexOf("responsavel_definido") &&
          !responsavelFinal
        ) {
          throw recusa("ocorrencia", "sem_responsavel");
        }
        novo = pedido.status;
      }
      if (pedido.privada === false && o.tipo === "detrator") {
        throw recusa("ocorrencia", "detrator_privada");
      }
      if (pedido.responsavelId) {
        const r = USUARIOS.find((u) => u.id === pedido.responsavelId);
        if (!r) throw recusa("ocorrencia", "responsavel_invalido");
        o.responsavelId = r.id;
        o.responsavelNome = r.nome;
        if (
          pedido.status === undefined &&
          (o.status === "aberta" || o.status === "triagem")
        ) {
          novo = "responsavel_definido";
        }
      }
      if (pedido.prioridade && pedido.prioridade !== o.prioridade) {
        o.prioridade = pedido.prioridade;
        if (novo !== "resolvida" && novo !== "encerrada") {
          o.slaVenceEm = new Date(
            Date.parse(o.criadoEm) + SLA_HORAS[pedido.prioridade] * HORA,
          ).toISOString();
        }
      }
      if (pedido.privada !== undefined) o.privada = pedido.privada;
      const evento: EventoHistorico = {
        em: new Date().toISOString(),
        por: usuario,
        acao: "atualizada",
        ...(novo !== o.status ? { de: o.status, para: novo } : {}),
        ...(nota ? { nota } : {}),
        ...(pedido.prioridade ? { prioridade: pedido.prioridade } : {}),
        ...(pedido.privada !== undefined ? { privada: pedido.privada } : {}),
      };
      o.status = novo;
      o.resolvidaEm =
        novo === "resolvida" || novo === "encerrada"
          ? (o.resolvidaEm ?? new Date().toISOString())
          : null;
      o.historico.push(evento);
      o.versao += 1;
      return { id: o.id, status: o.status, versao: o.versao };
    },
  };
}

// --- Pós-venda ---------------------------------------------------------------------------------

export function criarPosVendaDemonstracao(
  contexto: ContextoDemonstracaoOcorrencia,
): PosVendaRepositorio {
  garantirDemonstracaoPermitida();
  const tem = (...papeis: Papel[]) =>
    papeis.some((p) => contexto.papeis.includes(p));

  function autorizar() {
    if (!contexto.usuarioId) {
      throw new ErroRepositorio("sem_permissao", "demonstração: sem sessão");
    }
    if (!tem("coordenacao", "diretoria")) {
      throw new ErroRepositorio(
        "sem_permissao",
        "demonstração: papel sem acesso",
      );
    }
    if (exigeMfa(contexto.papeis) && contexto.aal !== "aal2") {
      throw new ErroRepositorio("sem_permissao", "demonstração: exige MFA");
    }
  }

  function bloqueioDa(familiaId: string): PosVendaItem["bloqueio"] {
    const f = obterLoja().familias.find((x) => x.id === familiaId);
    if (!f) return null;
    if (f.naoContatar) return "nao_contatar";
    return f.estadoSensivel === "normal" ? null : "freio";
  }

  function item(p: PosVendaDemo): PosVendaItem {
    const f = obterLoja().familias.find((x) => x.id === p.familiaId);
    const bloqueio = bloqueioDa(p.familiaId);
    return {
      id: p.id,
      acompanhamentoId: p.acompanhamentoId,
      familiaId: p.familiaId,
      familiaNome: f?.nome ?? "Família",
      estagio: p.estagio,
      nps: p.nps,
      classificacao: p.classificacao,
      depoimentoAutorizado: p.depoimento,
      autorizacaoImagem: p.imagem,
      pesquisaEnviadaEm: p.enviadaEm,
      pesquisaRespondidaEm: p.respondidaEm,
      pesquisaExpiraEm: p.expiraEm,
      linkAtivo:
        p.token !== null &&
        p.expiraEm !== null &&
        Date.parse(p.expiraEm) > Date.now(),
      bloqueio,
      podeGerarLink:
        bloqueio === null &&
        (p.estagio === "protocolo_ultimo_dia_concluido" ||
          p.estagio === "pesquisa_enviada"),
      acaoExecutadaEm: p.acaoEm,
      criadoEm: p.criadoEm,
    };
  }

  function achar(id: string): PosVendaDemo {
    const p = obterLojaOcorrencias().posVendas.find((x) => x.id === id);
    if (!p) throw recusa("pesquisa", "inexistente");
    return p;
  }

  return {
    async listar(situacao): Promise<ListaPosVenda> {
      autorizar();
      const todos = obterLojaOcorrencias().posVendas.filter(
        (p) => situacao === "todos" || p.estagio !== "arquivado",
      );
      const respondidas = todos.filter((p) => p.nps !== null);
      const conta = (c: PosVendaItem["classificacao"]) =>
        todos.filter((p) => p.classificacao === c).length;
      return {
        resumo: {
          aguardandoEnvio: todos.filter(
            (p) => p.estagio === "protocolo_ultimo_dia_concluido",
          ).length,
          aguardandoResposta: todos.filter(
            (p) => p.estagio === "pesquisa_enviada",
          ).length,
          respondidas: respondidas.length,
          promotores: conta("promotor"),
          neutros: conta("neutro"),
          detratores: conta("detrator"),
          nps:
            respondidas.length === 0
              ? null
              : Math.round(
                  ((conta("promotor") - conta("detrator")) * 100) /
                    respondidas.length,
                ),
        },
        itens: todos.map(item),
      };
    },

    async gerarLink(posVendaId): Promise<ResultadoLinkPesquisa> {
      autorizar();
      const p = achar(posVendaId);
      if (
        p.estagio !== "protocolo_ultimo_dia_concluido" &&
        p.estagio !== "pesquisa_enviada"
      ) {
        throw recusa("pesquisa", "fora_da_fase");
      }
      const bloqueio = bloqueioDa(p.familiaId);
      if (bloqueio === "nao_contatar") throw recusa("pesquisa", "nao_contatar");
      if (bloqueio === "freio") {
        return { bloqueado: true, motivo: "familia_em_estado_sensivel" };
      }
      p.token = `demo-${crypto.randomUUID().replaceAll("-", "")}`;
      p.expiraEm = new Date(
        Date.now() + PARAMETROS_PESQUISA.validadeDias * 24 * HORA,
      ).toISOString();
      const f = obterLoja().familias.find((x) => x.id === p.familiaId);
      const contato = obterLoja().pessoas.find(
        (x) => x.familiaId === p.familiaId && x.contatoPrincipal,
      );
      const primeiroNome = contato?.nome.split(" ")[0] ?? "";
      const modelo = obterLoja().mensagensModelo.find(
        (m) => m.chave === "pesquisa_convite",
      );
      void f;
      return {
        bloqueado: false,
        token: p.token,
        expiraEm: p.expiraEm,
        texto: modelo
          ? modelo.texto
              .replaceAll("{nome}", primeiroNome)
              .replaceAll("{link}", "@@LINK@@")
          : null,
      };
    },

    async marcarEnviada(posVendaId) {
      autorizar();
      const p = achar(posVendaId);
      if (p.estagio === "pesquisa_enviada") return;
      if (
        p.estagio !== "protocolo_ultimo_dia_concluido" ||
        !p.token ||
        !p.expiraEm ||
        Date.parse(p.expiraEm) <= Date.now()
      ) {
        throw recusa("pesquisa", "sem_link");
      }
      p.enviadaEm = new Date().toISOString();
      p.estagio = "pesquisa_enviada";
    },

    async avancar(posVendaId) {
      autorizar();
      const p = achar(posVendaId);
      const para: EstagioPosVenda | null =
        p.estagio === "classificado"
          ? "acao_executada"
          : p.estagio === "acao_executada"
            ? "arquivado"
            : null;
      if (!para) throw recusa("pesquisa", "sem_proximo_passo");
      p.estagio = para;
      if (para === "acao_executada") p.acaoEm = new Date().toISOString();
      return { estagio: para };
    },
  };
}

// --- Pesquisa pública ----------------------------------------------------------------------------

function classificar(nps: number): NonNullable<PosVendaItem["classificacao"]> {
  if (nps >= PARAMETROS_PESQUISA.promotorMin) return "promotor";
  if (nps >= PARAMETROS_PESQUISA.neutroMin) return "neutro";
  return "detrator";
}

export function criarPesquisaPublicaDemonstracao(): PesquisaPublicaRepositorio {
  garantirDemonstracaoPermitida();

  function limite(origem: string | null): boolean {
    const l = obterLojaOcorrencias();
    const desde = Date.now() - PARAMETROS_PESQUISA.janelaMinutos * 60_000;
    l.tentativas = l.tentativas.filter((t) => t.em >= desde);
    return (
      l.tentativas.filter((t) => t.origem === (origem ?? "sem-origem"))
        .length >= PARAMETROS_PESQUISA.tentativasMax
    );
  }

  function achar(token: string): PosVendaDemo | null {
    return (
      obterLojaOcorrencias().posVendas.find(
        (p) =>
          p.token !== null &&
          p.token === token &&
          p.expiraEm !== null &&
          Date.parse(p.expiraEm) > Date.now() &&
          p.estagio === "pesquisa_enviada",
      ) ?? null
    );
  }

  function bloqueada(p: PosVendaDemo): boolean {
    const f = obterLoja().familias.find((x) => x.id === p.familiaId);
    return !f || f.naoContatar || f.estadoSensivel !== "normal";
  }

  function primeiroNome(p: PosVendaDemo): string | null {
    const contato = obterLoja().pessoas.find(
      (x) => x.familiaId === p.familiaId && x.contatoPrincipal,
    );
    return contato?.nome.split(" ")[0] ?? null;
  }

  return {
    async abrir(token, origem): Promise<AberturaPesquisa> {
      if (limite(origem)) {
        return {
          situacao: "limite",
          minutos: PARAMETROS_PESQUISA.janelaMinutos,
          textos: TEXTOS_PESQUISA,
        };
      }
      const p = achar(token);
      if (!p) {
        obterLojaOcorrencias().tentativas.push({
          origem: origem ?? "sem-origem",
          em: Date.now(),
        });
        return { situacao: "invalido", textos: TEXTOS_PESQUISA };
      }
      if (bloqueada(p))
        return { situacao: "invalido", textos: TEXTOS_PESQUISA };
      return {
        situacao: "valido",
        nome: primeiroNome(p),
        perguntas: PERGUNTAS_PESQUISA,
        textos: TEXTOS_PESQUISA,
      };
    },

    async enviar(token, respostas, origem): Promise<ResultadoEnvioPesquisa> {
      if (limite(origem)) {
        return {
          situacao: "limite",
          minutos: PARAMETROS_PESQUISA.janelaMinutos,
        };
      }
      const p = achar(token);
      if (!p) {
        obterLojaOcorrencias().tentativas.push({
          origem: origem ?? "sem-origem",
          em: Date.now(),
        });
        return { situacao: "invalido" };
      }
      if (bloqueada(p)) return { situacao: "invalido" };

      const erros: Record<string, string> = {};
      const limpo: RespostasPesquisa = {};
      for (const pergunta of PERGUNTAS_PESQUISA) {
        const v = respostas[pergunta.id];
        const vazio =
          v === undefined ||
          v === null ||
          (typeof v === "string" && v.trim() === "");
        if (vazio) {
          if (pergunta.obrigatoria) erros[pergunta.id] = "obrigatorio";
          continue;
        }
        if (pergunta.tipo === "escala_0_10") {
          if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10)
            limpo[pergunta.id] = v;
          else erros[pergunta.id] = "invalido";
        } else if (pergunta.tipo === "sim_nao") {
          if (typeof v === "boolean") limpo[pergunta.id] = v;
          else erros[pergunta.id] = "invalido";
        } else if (pergunta.tipo === "opcao") {
          if (
            typeof v === "string" &&
            pergunta.opcoes?.some((o) => o.valor === v)
          )
            limpo[pergunta.id] = v;
          else erros[pergunta.id] = "invalido";
        } else if (typeof v === "string" && v.length <= 2000) {
          limpo[pergunta.id] = v.trim();
        } else {
          erros[pergunta.id] = "invalido";
        }
      }
      if (Object.keys(erros).length > 0) return { situacao: "corrigir", erros };

      const nps = limpo.nps as number;
      const classe = classificar(nps);
      p.respostas = limpo;
      p.nps = nps;
      p.classificacao = classe;
      p.depoimento = limpo.depoimento_autorizado as boolean;
      p.imagem = limpo.autorizacao_imagem as boolean;
      p.respondidaEm = new Date().toISOString();
      p.token = null;
      p.estagio = "classificado";

      const l = obterLojaOcorrencias();
      const familia = obterLoja().familias.find((f) => f.id === p.familiaId);
      const nome = familia?.nome ?? "família";
      const em = (dias: number) =>
        new Date(Date.now() + dias * 24 * HORA).toISOString();
      if (classe === "promotor") {
        l.acoes.push(
          {
            id: crypto.randomUUID(),
            posVendaId: p.id,
            familiaId: p.familiaId,
            acao: "depoimento",
            titulo: `Pedir o depoimento da ${nome}`,
            venceEm: em(PARAMETROS_PESQUISA.depoimentoAposDias),
          },
          {
            id: crypto.randomUUID(),
            posVendaId: p.id,
            familiaId: p.familiaId,
            acao: "indicacao",
            titulo: `Convidar a ${nome} para indicar`,
            venceEm: em(PARAMETROS_PESQUISA.indicacaoAposDias),
          },
        );
      } else if (classe === "neutro") {
        l.acoes.push({
          id: crypto.randomUUID(),
          posVendaId: p.id,
          familiaId: p.familiaId,
          acao: "escuta",
          titulo: `Ouvir com calma a ${nome}`,
          venceEm: em(PARAMETROS_PESQUISA.escutaPrazoDias),
        });
      } else {
        const agora = new Date().toISOString();
        l.ocorrencias.push({
          id: crypto.randomUUID(),
          familiaId: p.familiaId,
          familiaNome: nome,
          profissionalId: null,
          profissionalNome: null,
          tipo: "detrator",
          prioridade: "alta",
          privada: true,
          titulo: "Pesquisa de satisfação com nota baixa",
          descricao: `A família respondeu a pesquisa com nota ${nps} de 0 a 10. Contato pessoal da coordenação, sem pedido de avaliação pública.`,
          status: "aberta",
          responsavelId: null,
          responsavelNome: null,
          slaVenceEm: new Date(
            Date.now() + SLA_HORAS.alta * HORA,
          ).toISOString(),
          vencida: false,
          criadoEm: agora,
          versao: 1,
          historico: [
            {
              em: agora,
              por: null,
              acao: "aberta",
              para: "aberta",
              origem: "pesquisa",
            },
          ],
          resolvidaEm: null,
        });
        l.notificacoes.push({
          papel: "coordenacao",
          titulo:
            "Uma família respondeu a pesquisa com nota baixa: contato pessoal da coordenação",
        });
      }
      return { situacao: "recebido" };
    },
  };
}

/** Tarefas que a classificação criou (a demonstração as mostra no pós-venda). */
export function acoesDoPosVenda(): AcaoDemo[] {
  return obterLojaOcorrencias().acoes;
}
