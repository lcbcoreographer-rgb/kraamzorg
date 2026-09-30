/**
 * P28 · Executor local: roda os casos no simulador do fluxo 3 (o JSON que o
 * build gera, nó a nó) sobre o banco local.
 *
 * O que é de verdade aqui:
 * - o fluxo 3 e o fluxo 2 gerados por `n8n/build.mjs`, com o código embutido
 *   dos nós Code rodando (filtro de termos, agrupamento, validador, preparo
 *   do envio, decisão de modo);
 * - o banco: cada nó Postgres executa a chamada `agente.*` no Postgres local
 *   como o papel `n8n_agente`, o mesmo que o n8n de homologação usa; a
 *   pausa, o freio, as transferências, os marcos e o modo da conversa saem
 *   das funções reais;
 * - as ferramentas do agente: os parâmetros do nó gerado (`$fromAI`, chave
 *   `conversa_id` fixa por expressão) rodam contra o banco ou contra o fluxo
 *   2 gerado.
 *
 * O que é de mentira: a OpenAI (classificador, agente, reescrita, follow-up,
 * respostas em `modelo-roteirizado.ts`), a UAZAPI (o envio vira captura na
 * memória, igual à rota `/api/teste/uazapi`) e o Redis (um mapa).
 *
 * `SessaoLocal` é uma conversa de um caso. O `ExecutorLocal` roda os turnos
 * dela em sequência; o servidor de homologação simulado
 * (`servidor-simulado.ts`) usa a mesma sessão para responder ao webhook.
 */
import path from "node:path";
import { carregarN8n } from "./n8n";
import type { CalendarioSimuladoN8n, Fluxo, N8n, Servico } from "./n8n";

import { encerrarPendencias, executarAcaoDeBanco } from "../lib/acoes";
import type { AcaoDeBanco } from "../lib/acoes";
import { CALENDARIO_DE_TESTE, fotografar, resumirEvento } from "../lib/agenda";
import type { CalendarioDeTeste } from "../lib/agenda";
import {
  descreverTurno,
  idDaMensagem,
  interlocutora,
  montarPayload,
} from "../lib/payloads";
import type { Interlocutora } from "../lib/payloads";
import { aplicarPreparo } from "../lib/preparo";
import {
  gravarParametro,
  lerEstado,
  lerParametro,
  lerReferencia,
  lit,
  sqlAgendarFollowup,
} from "../lib/sql";
import type { Consulta } from "../lib/sql";
import { ehAcao } from "../lib/tipos";
import type {
  Caso,
  Envio,
  EstadoBanco,
  Objeto,
  Plano,
  ResultadoCaso,
  ResultadoTurno,
  Turno,
} from "../lib/tipos";
import { CLASSIFICACAO_PADRAO } from "./modelo-roteirizado";
import { ROTEIROS } from "./roteiros";
import type { ContextoDoModelo, RoteiroDoTurno } from "./modelo-roteirizado";
import { consultaLocal, linhasPsql } from "./ponte-psql";
import type { ConexaoLocal } from "./ponte-psql";

let fluxosEmCache: Promise<{
  fluxo2: Fluxo;
  fluxo3: Fluxo;
  fluxo4: Fluxo;
}> | null = null;

export function fluxosGerados(): Promise<{
  fluxo2: Fluxo;
  fluxo3: Fluxo;
  fluxo4: Fluxo;
}> {
  fluxosEmCache ??= (async () => {
    const n8n = await carregarN8n();
    const { config } = await n8n.carregarConfig(
      "hml",
      path.join(process.cwd(), "n8n"),
      { log: () => {} },
    );
    return n8n.gerarFluxos(config, "hml");
  })();
  return fluxosEmCache;
}

// ---------------------------------------------------------------------------
// Falhas forçadas (só o simulador consegue)
// ---------------------------------------------------------------------------

export type FalhaForcada =
  | "checar_termos_alerta"
  | "openai_classificacao"
  | "openai_reescrita"
  | "registrar_transcricao"
  | "agente"
  | "redis"
  | "fluxo2"
  | "fluxo4";

export interface OpcoesDeCaso {
  falhas?: FalhaForcada[];
  /** Roteiro do modelo no lugar do padrão (casos só do simulador). */
  roteiros?: Record<number, RoteiroDoTurno>;
}

export interface Transcricao {
  texto: string | null;
  falhar: boolean;
}

export interface OpcoesDeSessao {
  caso: Caso;
  quem: Interlocutora;
  opcoes?: OpcoesDeCaso;
  conexao: ConexaoLocal;
  planos: Plano[];
  horariosDaEdilaine: string[];
  /** Chamado a cada envio à UAZAPI simulada, com o corpo cru (formato da rota de captura). */
  aoEnviar?: (corpo: Objeto, tipo: "texto" | "midia") => void;
  /** O que `message/download` devolve para uma mensagem de áudio. */
  transcricaoDe: (messageId: string) => Transcricao | null;
  /**
   * O Google Calendar de teste desta conversa (P25b). O executor cria um por
   * caso; o servidor simulado, um por conversa. Sem ele, um calendário novo e vazio.
   */
  calendario?: CalendarioSimuladoN8n;
}

// ---------------------------------------------------------------------------
// Sessão: a conversa de um caso
// ---------------------------------------------------------------------------

export class SessaoLocal {
  readonly envios: Envio[] = [];
  readonly modeloRodouPorTurno: boolean[] = [];
  turnoAtual = 1;
  cpfEnviado: string | null = null;

  private readonly redis = new Map<string, Objeto>();
  private readonly falhas: Set<FalhaForcada>;
  private readonly roteiros: Record<number, RoteiroDoTurno>;
  private n8n!: N8n;
  private fluxo2!: Fluxo;
  private fluxo3!: Fluxo;
  private fluxo4!: Fluxo;
  /** O calendário de teste desta conversa (a Edilaine mexe nele pelo executor). */
  calendario!: CalendarioSimuladoN8n;
  /** O que cada ferramenta devolveu por último, para o roteiro do modelo (ids de opção, por exemplo). */
  private readonly ultimasObservacoes = new Map<string, Objeto>();
  /** As opções de horário da última lista que a agenda devolveu. */
  private ultimasOpcoes: { id_opcao: string; texto: string }[] = [];
  /** As entradas de cada chamada de ferramenta, na ordem em que o roteiro as fez. */
  private readonly historicoDeEntradas = new Map<string, Objeto[]>();
  private ultimaMensagem = "";
  private mensagemAtual = "";

  constructor(private readonly o: OpcoesDeSessao) {
    this.falhas = new Set(o.opcoes?.falhas ?? []);
    this.roteiros = o.opcoes?.roteiros ?? ROTEIROS[o.caso.id] ?? {};
  }

  async iniciar(): Promise<void> {
    this.n8n = await carregarN8n();
    const fluxos = await fluxosGerados();
    this.fluxo2 = fluxos.fluxo2;
    this.fluxo3 = fluxos.fluxo3;
    this.fluxo4 = fluxos.fluxo4;
    this.calendario = this.o.calendario ?? this.n8n.criarCalendarioSimulado();
  }

  /** Entrada A: uma mensagem da família chega ao webhook. */
  webhook(corpo: Objeto, textoDaMensagem: string, messageId: string): void {
    this.ultimaMensagem = textoDaMensagem;
    this.mensagemAtual = messageId;
    const cpf = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.exec(textoDaMensagem)?.[0];
    if (cpf) this.cpfEnviado = cpf;
    this.n8n.simularFluxo(this.fluxo3, {
      gatilho: this.n8n.NOS.webhook,
      entrada: { headers: {}, body: corpo },
      servicos: this.servicosDe(this.fluxo3, "fluxo3"),
    });
  }

  /**
   * Entrada B: o gatilho de 30 minutos busca os follow-ups devidos e, [v4.3],
   * o que a Isadora escreve em torno da agenda (lembrete da véspera, falta,
   * devolutiva e horário liberado).
   */
  followup(): void {
    this.n8n.simularFluxo(this.fluxo3, {
      gatilho: this.n8n.NOS.aCada30Min,
      entrada: {},
      servicos: this.servicosDe(this.fluxo3, "fluxo3"),
    });
  }

  /** [v4.3] Entrada B do fluxo 4: compara as reuniões da Isadora com o calendário. */
  sincronizarAgenda(): void {
    this.n8n.simularFluxo(this.fluxo4, {
      gatilho: this.n8n.NOS_FLUXO4.aCada30Min,
      entrada: {},
      servicos: this.servicosDe(this.fluxo4, "fluxo4"),
    });
  }

  // -------------------------------------------------------------------------

  private registrarEnvio(
    parametros: Objeto,
    tipo: Envio["tipo"],
  ): { messageid: string } {
    const corpo = (parametros["jsonBody"] ?? {}) as Objeto;
    const numero = String(corpo["number"] ?? "");
    const destino: Envio["destino"] =
      numero === this.o.quem.jid
        ? "familia"
        : numero.endsWith("@g.us")
          ? "grupo"
          : "plantao";
    this.envios.push({
      turno: this.turnoAtual,
      ordem: this.envios.length + 1,
      destino,
      tipo,
      texto: tipo === "texto" ? String(corpo["text"] ?? "") : "",
      arquivo:
        tipo === "documento" ? String(corpo["docName"] ?? "") : undefined,
    });
    this.o.aoEnviar?.(corpo, tipo === "texto" ? "texto" : "midia");
    return {
      messageid: `wa-${this.o.caso.id.toLowerCase()}-${this.o.quem.digitos}-${this.envios.length}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  private banco = (parametros: Objeto): Objeto[] => {
    const query = String(parametros["query"]);
    const funcao = /agente\.(\w+)\(/.exec(query)?.[1] ?? "";
    if (this.falhas.has(funcao as FalhaForcada))
      throw new Error(`connect ECONNREFUSED (${funcao})`);
    const opcoesNo = (parametros["options"] ?? {}) as Objeto;
    const valores = (opcoesNo["queryReplacement"] ?? []) as unknown[];
    const sql = query.replace(/\$(\d+)/g, (_, n: string) =>
      lit(valores[Number(n) - 1]),
    );
    return linhasPsql(this.o.conexao, "n8n_agente", sql);
  };

  private openai =
    (tipo: "classificacao" | "reescrita" | "followup") =>
    (parametros: Objeto = {}): Objeto => {
      if (this.falhas.has(`openai_${tipo}` as FalhaForcada))
        throw new Error("OpenAI 500");
      const roteiro = this.roteiros[this.turnoAtual];
      const saida =
        tipo === "classificacao"
          ? (roteiro?.classificador ?? CLASSIFICACAO_PADRAO)
          : tipo === "reescrita"
            ? roteiro?.reescrita
            : roteiro?.followup;
      if (saida === undefined)
        throw new Error(
          `o roteiro do caso ${this.o.caso.id} não define a saída de "${tipo}" no turno ${this.turnoAtual}`,
        );
      const final =
        typeof saida === "function"
          ? saida({
              digitos: this.o.quem.digitos,
              textoBase: textoBaseDoPrompt(parametros),
            })
          : saida;
      return { choices: [{ message: { content: JSON.stringify(final) } }] };
    };

  private classificadorDePedido = (parametros: Objeto): Objeto => {
    let saida = this.roteiros[this.turnoAtual]?.classificadorPedido;
    if (!saida) {
      const corpo = JSON.stringify(parametros["jsonBody"] ?? {});
      const motivo =
        /Motivo escolhido pela assistente: (\w+)/.exec(
          corpo.replace(/\\n/g, " "),
        )?.[1] ?? "outro";
      saida = {
        tipo: motivo,
        porque: "roteiro de homologação: concorda com o motivo da assistente",
      };
    }
    return { choices: [{ message: { content: JSON.stringify(saida) } }] };
  };

  private redisFalso: Servico = (parametros) => {
    if (this.falhas.has("redis"))
      throw this.n8n.erroNoInteiro("Redis: connect ECONNREFUSED");
    const { operation, key } = parametros as { operation: string; key: string };
    if (operation === "set" && parametros["keyType"] === "hash") {
      const atual = this.redis.get(key) ?? {};
      this.redis.set(key, {
        ...atual,
        ...JSON.parse(String(parametros["value"])),
      });
    } else if (operation === "set") {
      this.redis.set(key, parametros["value"] as unknown as Objeto);
    } else if (operation === "get") {
      return (this.redis.get(key) ?? {}) as never;
    } else if (operation === "delete") {
      this.redis.delete(key);
    }
    return null as never;
  };

  private servicosDe(
    fluxo: Fluxo,
    qual: "fluxo2" | "fluxo3" | "fluxo4",
  ): Record<string, Servico> {
    const ehFluxo3 = qual === "fluxo3";
    const servicos: Record<string, Servico> = {};
    for (const no of fluxo.nodes) {
      if (no.type === "n8n-nodes-base.postgres")
        servicos[no.name] = ((p: Objeto) => this.banco(p)) as Servico;
      else if (no.type === "n8n-nodes-base.googleCalendar")
        // [v4.3] O nó do Google Calendar do fluxo 4 fala com o calendário de teste.
        servicos[no.name] = ((p: Objeto) =>
          this.calendario.executarNoGoogle(p)) as Servico;
      else if (no.type === "n8n-nodes-base.redis")
        servicos[no.name] = this.redisFalso;
      else if (no.type === "n8n-nodes-base.executeWorkflow") {
        servicos[no.name] = ((p: Objeto) => {
          const entradas = (p["workflowInputs"] as { value: Objeto }).value;
          if (this.ehFluxo4(p)) {
            if (this.falhas.has("fluxo4"))
              throw new Error("sub-fluxo da agenda falhou");
            return this.rodarFluxo4(entradas);
          }
          if (this.falhas.has("fluxo2")) throw new Error("sub-fluxo falhou");
          return this.rodarFluxo2(entradas);
        }) as Servico;
      } else if (no.type === "@n8n/n8n-nodes-langchain.agent")
        servicos[no.name] = this.agenteRoteirizado;
      else if (no.type === "n8n-nodes-base.httpRequest") {
        const url = String(no.parameters["url"]);
        if (url.includes("/send/media"))
          servicos[no.name] = ((p: Objeto) =>
            this.registrarEnvio(p, "documento")) as Servico;
        else if (url.includes("/send/"))
          servicos[no.name] = ((p: Objeto) =>
            this.registrarEnvio(p, "texto")) as Servico;
        else if (!ehFluxo3 && no.name === this.n8n.NOS_FLUXO2.classificarPedido)
          servicos[no.name] = this.classificadorDePedido as Servico;
        else if (url.includes("/message/download")) {
          servicos[no.name] = (() => {
            const transcricao = this.o.transcricaoDe(this.mensagemAtual);
            if (!transcricao || transcricao.falhar)
              throw new Error("transcrição falhou");
            return { transcription: transcricao.texto };
          }) as Servico;
        } else if (ehFluxo3 && no.name === this.n8n.NOS.classificarMensagem)
          servicos[no.name] = this.openai("classificacao") as Servico;
        else if (ehFluxo3 && no.name === this.n8n.NOS.reescrever)
          servicos[no.name] = this.openai("reescrita") as Servico;
        else if (
          ehFluxo3 &&
          (no.name === this.n8n.NOS.gerarMensagem ||
            no.name === this.n8n.NOS.gerarMensagemAgenda)
        )
          servicos[no.name] = this.openai("followup") as Servico;
      }
    }
    return servicos;
  }

  /** A chamada aponta para o fluxo 4 (Agenda da Isadora)? O id vem do config do build. */
  private ehFluxo4(parametros: Objeto): boolean {
    const referencia = parametros["workflowId"] as
      { value?: unknown } | undefined;
    return String(referencia?.value ?? "") === this.fluxo4.id;
  }

  private rodarFluxo2(entrada: Objeto): unknown {
    return this.n8n.simularFluxo(this.fluxo2, {
      entrada,
      servicos: this.servicosDe(this.fluxo2, "fluxo2"),
    }).saida[0];
  }

  /**
   * O fluxo 4 (Agenda da Isadora) gerado, com o banco local e o calendário de
   * teste. É o que as cinco ferramentas de agenda e a Entrada B do fluxo 3
   * chamam.
   */
  private rodarFluxo4(entrada: Objeto): unknown {
    return this.n8n.simularFluxo(this.fluxo4, {
      entrada,
      servicos: this.servicosDe(this.fluxo4, "fluxo4"),
    }).saida[0];
  }

  // O agente: roda as ferramentas do roteiro de verdade e devolve o texto.
  private agenteRoteirizado = ((
    _parametros: Objeto,
    item: Objeto,
    ctx: { contexto: unknown },
  ) => {
    try {
      return this.executarAgente(item, ctx);
    } catch (e) {
      if (process.env["KZ_HOMOLOG_DEPURAR"])
        console.error(`[depuração ${this.o.caso.id} t${this.turnoAtual}]`, e);
      throw e;
    }
  }) as Servico;

  private executarAgente(item: Objeto, ctx: { contexto: unknown }) {
    this.modeloRodouPorTurno[this.turnoAtual - 1] = true;
    if (this.falhas.has("agente")) throw new Error("OpenAI timeout");
    const resposta = this.roteiros[this.turnoAtual]?.agente;
    if (!resposta) {
      throw new Error(
        `o modelo de conversa rodou no turno ${this.turnoAtual} do caso ${this.o.caso.id}, mas o roteiro não tem resposta para ele. ` +
          "Se este caminho devia ser do sistema (saúde, perda, silêncio), é uma falha real; senão, falta escrever a resposta em modelo-roteirizado.ts.",
      );
    }
    const mensagem = String(
      (item as { texto_agrupado?: unknown })["texto_agrupado"] ??
        this.ultimaMensagem,
    );
    const observacoes: Objeto[] = [];
    // Cada chamada pode depender do que a anterior devolveu (o id da opção que
    // a ferramenta de agenda acabou de gravar, por exemplo), como o modelo faz.
    const contextoDeChamada = {
      mensagem,
      observacoes,
      ultimo: (ferramenta: string) => this.ultimasObservacoes.get(ferramenta),
      opcoes: () => this.ultimasOpcoes,
      entradas: (ferramenta: string) =>
        this.historicoDeEntradas.get(ferramenta) ?? [],
    };
    const lista =
      typeof resposta.ferramentas === "function"
        ? resposta.ferramentas(contextoDeChamada)
        : (resposta.ferramentas ?? []);
    const passos: Objeto[] = [];
    for (const item of lista) {
      const chamada =
        typeof item === "function" ? item(contextoDeChamada) : item;
      if (chamada === null) continue;
      const observacao = this.executarFerramenta(
        chamada.ferramenta,
        chamada.entrada,
        ctx.contexto,
      );
      passos.push({
        action: { tool: chamada.ferramenta, toolInput: chamada.entrada },
        observation: JSON.stringify(observacao),
      });
      const resultado = extrairResultado(observacao);
      observacoes.push(resultado);
      this.ultimasObservacoes.set(chamada.ferramenta, resultado);
      this.historicoDeEntradas.set(chamada.ferramenta, [
        ...(this.historicoDeEntradas.get(chamada.ferramenta) ?? []),
        chamada.entrada,
      ]);
      const opcoesDaResposta = (resultado as { opcoes?: unknown }).opcoes;
      if (Array.isArray(opcoesDaResposta) && opcoesDaResposta.length > 0)
        this.ultimasOpcoes = opcoesDaResposta as {
          id_opcao: string;
          texto: string;
        }[];
    }
    const texto =
      typeof resposta.texto === "function"
        ? resposta.texto({
            ...this.contextoDoModelo(mensagem),
            observacoes,
            ultimo: contextoDeChamada.ultimo,
            opcoes: contextoDeChamada.opcoes,
            entradas: contextoDeChamada.entradas,
          })
        : resposta.texto;
    return { output: texto, intermediateSteps: passos };
  }

  private contextoDoModelo(mensagem: string): ContextoDoModelo {
    const achar = (
      filtro: string | { dias: number; gemelar?: boolean },
    ): Plano => {
      const plano =
        typeof filtro === "string"
          ? this.o.planos.find(
              (p) => p.nome.toLowerCase() === filtro.toLowerCase(),
            )
          : this.o.planos.find(
              (p) =>
                p.dias === filtro.dias &&
                p.gemelar === (filtro.gemelar ?? false),
            );
      if (!plano)
        throw new Error(
          `o roteiro pede um plano que não está vigente no banco: ${JSON.stringify(filtro)}`,
        );
      return plano;
    };
    return {
      planos: this.o.planos,
      mensagem,
      observacoes: [],
      ultimo: (ferramenta: string) => this.ultimasObservacoes.get(ferramenta),
      opcoes: () => this.ultimasOpcoes,
      entradas: (ferramenta: string) =>
        this.historicoDeEntradas.get(ferramenta) ?? [],
      horariosDaEdilaine: this.o.horariosDaEdilaine,
      aVista: (f) => achar(f).valor,
      parcela: (f) => achar(f).parcela_texto,
    };
  }

  private executarFerramenta(
    nome: string,
    entrada: Objeto,
    contexto: unknown,
  ): unknown {
    const no = this.fluxo3.nodes.find((n) => n.name === nome);
    if (!no)
      throw new Error(`ferramenta "${nome}" não existe no fluxo 3 gerado`);
    const escopo = this.n8n.escopoDeFerramenta(
      contexto,
      (chave: string) => entrada[chave],
    );
    if (no.type === "n8n-nodes-base.postgresTool") {
      const opcoesNo = (no.parameters["options"] ?? {}) as Objeto;
      const valores = opcoesNo["queryReplacement"]
        ? (this.n8n.avaliarParametro(
            opcoesNo["queryReplacement"],
            escopo,
          ) as unknown[])
        : [];
      return this.banco({
        query: no.parameters["query"],
        options: { queryReplacement: valores },
      });
    }
    if (no.type === "@n8n/n8n-nodes-langchain.toolWorkflow") {
      const valores = this.n8n.avaliarParametro(
        (no.parameters["workflowInputs"] as { value: Objeto }).value,
        escopo,
      ) as Objeto;
      if (this.ehFluxo4(no.parameters)) {
        if (this.falhas.has("fluxo4"))
          throw new Error("sub-fluxo da agenda falhou");
        return this.rodarFluxo4(valores);
      }
      return this.rodarFluxo2(valores);
    }
    return [];
  }
}

/** O texto aprovado que o nó de follow-up entregou ao gerador, lido do prompt montado. */
function textoBaseDoPrompt(parametros: Objeto): string {
  const corpo = JSON.stringify(parametros["jsonBody"] ?? parametros).replace(
    /\\n/g,
    "\n",
  );
  const achado =
    /define a intenção desta mensagem:\s*([\s\S]*?)\s*Nome da pessoa:/.exec(
      corpo,
    );
  return achado?.[1]?.replace(/\\"/g, '"') ?? "";
}

function extrairResultado(observacao: unknown): Objeto {
  if (Array.isArray(observacao))
    return ((observacao[0] as Objeto | undefined)?.["resultado"] ??
      {}) as Objeto;
  return (observacao ?? {}) as Objeto;
}

// ---------------------------------------------------------------------------
// Calendário de teste local (P25b)
// ---------------------------------------------------------------------------

/**
 * O Google Calendar de mentira do n8n (`n8n/src/lib/calendario-simulado.mjs`)
 * na interface que o roteiro usa. Os eventos "de outra pessoa" que o teste cria
 * têm o id começando por `alheio`: a chamada de criação deles não conta como
 * chamada da Isadora.
 */
export function calendarioLocal(sim: CalendarioSimuladoN8n): CalendarioDeTeste {
  let alheios = 0;
  const deOutraPessoa = (c: Objeto) =>
    String(c["id"] ?? "").startsWith("alheio");
  return {
    async chamadas() {
      return sim.chamadas
        .filter((c) => !deOutraPessoa(c))
        .map((c) => JSON.parse(JSON.stringify(c)) as Objeto) as never;
    },
    async eventos() {
      return sim.eventos(CALENDARIO_DE_TESTE).map(resumirEvento);
    },
    async ocupar(inicio, fim) {
      sim.ocupar(CALENDARIO_DE_TESTE, inicio, fim);
    },
    async liberarTudo() {
      sim.liberarTudo();
    },
    async criarEventoAlheio(inicio, fim) {
      alheios += 1;
      const id = `alheio${alheios}${Math.random().toString(36).slice(2, 8)}`;
      sim.executarHttp("eventos", {
        calendar_id: CALENDARIO_DE_TESTE,
        id,
        summary: "Compromisso pessoal (evento de outra pessoa)",
        start: inicio,
        end: fim,
        attendees: [],
      });
      return id;
    },
    async moverEvento(eventoId, inicio, fim) {
      sim.moverPelaEdilaine(CALENDARIO_DE_TESTE, eventoId, inicio, fim);
    },
    async apagarEvento(eventoId) {
      sim.apagarPelaEdilaine(CALENDARIO_DE_TESTE, eventoId);
    },
    async foraDoAr(valor) {
      sim.ficarForaDoAr(valor);
    },
    async falharProxima(operacao, mensagem, codigo) {
      sim.falharProxima(operacao, mensagem, codigo);
    },
    async reiniciar() {
      sim.liberarTudo();
      sim.limparFalhas();
    },
  };
}

// ---------------------------------------------------------------------------
// Executor: os turnos de um caso, em sequência
// ---------------------------------------------------------------------------

export class ExecutorLocal {
  private readonly consulta: Consulta;
  private restauracoes: (() => Promise<void>)[] = [];
  private sequencia = 0;
  private readonly base = 1_000_000 + Math.floor(Math.random() * 8_000_000);

  constructor(private readonly conexao: ConexaoLocal) {
    this.consulta = consultaLocal(conexao);
  }

  /** Liga o agente em produção (local) e devolve o valor antigo no fim. */
  async iniciar(): Promise<void> {
    const modo = await lerParametro(this.consulta, "agente_modo");
    await gravarParametro(this.consulta, "agente_modo", "producao");
    this.restauracoes.push(async () =>
      gravarParametro(this.consulta, "agente_modo", modo),
    );
  }

  async encerrar(): Promise<void> {
    for (const f of this.restauracoes.reverse()) await f();
    this.restauracoes = [];
  }

  private novaInterlocutora(): Interlocutora {
    this.sequencia += 1;
    return interlocutora(
      `551199${String(this.base + this.sequencia).padStart(7, "0")}`,
    );
  }

  async executar(
    caso: Caso,
    opcoes: OpcoesDeCaso = {},
  ): Promise<ResultadoCaso> {
    const quem = this.novaInterlocutora();
    const desfazerPreparo = await aplicarPreparo(
      this.consulta,
      caso.preparo ?? [],
      { ambiente: "local" },
    );
    const referenciaInicial = await lerReferencia(this.consulta, {
      conversaId: null,
      telefone: quem.e164,
      cpfEnviado: null,
    });

    const transcricoes = new Map<string, Transcricao>();
    const n8n = await carregarN8n();
    const calendarioSimulado = n8n.criarCalendarioSimulado();
    const calendario = calendarioLocal(calendarioSimulado);
    const eventosAlheios: string[] = [];
    const chamadasPorTurno: number[] = [];
    const sessao = new SessaoLocal({
      caso,
      quem,
      opcoes,
      conexao: this.conexao,
      planos: referenciaInicial.planos,
      horariosDaEdilaine: referenciaInicial.horariosDaEdilaine,
      transcricaoDe: (id) => transcricoes.get(id) ?? null,
      calendario: calendarioSimulado,
    });
    await sessao.iniciar();

    const resultadosDeTurno: ResultadoTurno[] = [];
    const estadoPorTurno: EstadoBanco[] = [];
    let erro: string | undefined;
    try {
      for (const [indice, turno] of caso.turnos.entries()) {
        sessao.turnoAtual = indice + 1;
        const antes = sessao.envios.length;
        let enviado: string;
        if (ehAcao(turno)) {
          if (turno.acao === "executarFollowup") {
            await this.consulta.linhas(sqlAgendarFollowup());
            sessao.followup();
            enviado = "[o agendador do follow-up roda]";
          } else if (turno.acao === "executarAgendador") {
            // O motor agenda a cadência (pg_cron a cada 5 minutos); a Entrada B do fluxo 3
            // (lembrete, falta, devolutiva, horário liberado, retorno) e a sincronização do
            // fluxo 4 com o calendário fazem o resto.
            await this.consulta.linhas(sqlAgendarFollowup());
            sessao.followup();
            sessao.sincronizarAgenda();
            enviado = "[o agendador da agenda roda]";
          } else {
            enviado = await executarAcaoDeBanco(
              this.consulta,
              turno as AcaoDeBanco,
              quem.e164,
              { calendario, eventosAlheios },
            );
          }
        } else {
          enviado = descreverTurno(turno);
          this.mandarMensagem(
            sessao,
            turno,
            quem,
            indice + 1,
            caso,
            transcricoes,
          );
        }
        resultadosDeTurno.push({
          turno: indice + 1,
          enviado,
          envios: sessao.envios.slice(antes),
        });
        chamadasPorTurno.push((await calendario.chamadas()).length);
        estadoPorTurno.push(await lerEstado(this.consulta, quem.e164));
      }
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }

    const estadoFinal =
      estadoPorTurno[estadoPorTurno.length - 1] ??
      (await lerEstado(this.consulta, quem.e164));
    const referencia = await lerReferencia(this.consulta, {
      conversaId: estadoFinal.conversa?.id ?? null,
      telefone: quem.e164,
      cpfEnviado: sessao.cpfEnviado,
    });
    await encerrarPendencias(this.consulta, estadoFinal.conversa?.id);
    await desfazerPreparo();

    // Turnos que faltaram por causa do erro ficam vazios, para as regras acusarem em vez de quebrar.
    while (resultadosDeTurno.length < caso.turnos.length) {
      resultadosDeTurno.push({
        turno: resultadosDeTurno.length + 1,
        enviado: "",
        envios: [],
      });
      estadoPorTurno.push(estadoFinal);
      chamadasPorTurno.push((await calendario.chamadas()).length);
    }
    const resultado: ResultadoCaso = {
      caso,
      turnos: resultadosDeTurno,
      estado: estadoFinal,
      estadoPorTurno,
      referencia,
      modeloRodouPorTurno: caso.turnos.map(
        (_, i) => sessao.modeloRodouPorTurno[i] === true,
      ),
      agenda: await fotografar(calendario, eventosAlheios, (i) => {
        const indice = chamadasPorTurno.findIndex((n) => i < n);
        return indice < 0 ? chamadasPorTurno.length : indice + 1;
      }),
      chamadasDeAgendaPorTurno: chamadasPorTurno,
    };
    if (erro)
      throw Object.assign(new Error(erro), { resultadoParcial: resultado });
    return resultado;
  }

  private mandarMensagem(
    sessao: SessaoLocal,
    turno: Extract<Turno, { tipo: string }>,
    quem: Interlocutora,
    numero: number,
    caso: Caso,
    transcricoes: Map<string, Transcricao>,
  ): void {
    const messageId = idDaMensagem(caso.id, numero);
    if (turno.tipo === "audio") {
      transcricoes.set(
        messageId,
        turno.falharTranscricao
          ? { texto: null, falhar: true }
          : { texto: turno.transcricao, falhar: false },
      );
    }
    const corpo = montarPayload(turno, {
      quem,
      instancia: "kraamzorg-exemplo",
      messageId,
    });
    const texto =
      turno.tipo === "texto"
        ? turno.texto
        : turno.tipo === "foto"
          ? turno.legenda
          : turno.tipo === "audio"
            ? (turno.transcricao ?? "")
            : "";
    sessao.webhook(corpo, texto, messageId);
  }
}
