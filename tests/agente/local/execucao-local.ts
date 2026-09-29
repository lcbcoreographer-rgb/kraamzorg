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
import type { Fluxo, N8n, Servico } from "./n8n";

import { executarAcaoDeBanco } from "../lib/acoes";
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
import { CLASSIFICACAO_PADRAO, ROTEIROS } from "./modelo-roteirizado";
import type { ContextoDoModelo, RoteiroDoTurno } from "./modelo-roteirizado";
import { consultaLocal, linhasPsql } from "./ponte-psql";
import type { ConexaoLocal } from "./ponte-psql";

let fluxosEmCache: Promise<{ fluxo2: Fluxo; fluxo3: Fluxo }> | null = null;

export function fluxosGerados(): Promise<{ fluxo2: Fluxo; fluxo3: Fluxo }> {
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
  | "fluxo2";

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
      servicos: this.servicosDe(this.fluxo3, true),
    });
  }

  /** Entrada B: o gatilho de 30 minutos busca os follow-ups devidos. */
  followup(): void {
    this.n8n.simularFluxo(this.fluxo3, {
      gatilho: this.n8n.NOS.aCada30Min,
      entrada: {},
      servicos: this.servicosDe(this.fluxo3, true),
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
    (tipo: "classificacao" | "reescrita" | "followup") => (): Objeto => {
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
          ? saida({ digitos: this.o.quem.digitos })
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

  private servicosDe(fluxo: Fluxo, ehFluxo3: boolean): Record<string, Servico> {
    const servicos: Record<string, Servico> = {};
    for (const no of fluxo.nodes) {
      if (no.type === "n8n-nodes-base.postgres")
        servicos[no.name] = ((p: Objeto) => this.banco(p)) as Servico;
      else if (no.type === "n8n-nodes-base.redis")
        servicos[no.name] = this.redisFalso;
      else if (no.type === "n8n-nodes-base.executeWorkflow") {
        servicos[no.name] = ((p: Objeto) => {
          if (this.falhas.has("fluxo2")) throw new Error("sub-fluxo falhou");
          return this.rodarFluxo2(
            (p["workflowInputs"] as { value: Objeto }).value,
          );
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
        else if (ehFluxo3 && no.name === this.n8n.NOS.gerarMensagem)
          servicos[no.name] = this.openai("followup") as Servico;
      }
    }
    return servicos;
  }

  private rodarFluxo2(entrada: Objeto): unknown {
    return this.n8n.simularFluxo(this.fluxo2, {
      entrada,
      servicos: this.servicosDe(this.fluxo2, false),
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
    const chamadas =
      typeof resposta.ferramentas === "function"
        ? resposta.ferramentas({ mensagem })
        : (resposta.ferramentas ?? []);
    const passos: Objeto[] = [];
    const observacoes: Objeto[] = [];
    for (const chamada of chamadas) {
      const observacao = this.executarFerramenta(
        chamada.ferramenta,
        chamada.entrada,
        ctx.contexto,
      );
      passos.push({
        action: { tool: chamada.ferramenta, toolInput: chamada.entrada },
        observation: JSON.stringify(observacao),
      });
      observacoes.push(extrairResultado(observacao));
    }
    const texto =
      typeof resposta.texto === "function"
        ? resposta.texto({ ...this.contextoDoModelo(mensagem), observacoes })
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
      return this.rodarFluxo2(valores);
    }
    return [];
  }
}

function extrairResultado(observacao: unknown): Objeto {
  if (Array.isArray(observacao))
    return ((observacao[0] as Objeto | undefined)?.["resultado"] ??
      {}) as Objeto;
  return (observacao ?? {}) as Objeto;
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
    const sessao = new SessaoLocal({
      caso,
      quem,
      opcoes,
      conexao: this.conexao,
      planos: referenciaInicial.planos,
      horariosDaEdilaine: referenciaInicial.horariosDaEdilaine,
      transcricaoDe: (id) => transcricoes.get(id) ?? null,
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
          } else {
            enviado = await executarAcaoDeBanco(
              this.consulta,
              turno,
              quem.e164,
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
    await desfazerPreparo();

    // Turnos que faltaram por causa do erro ficam vazios, para as regras acusarem em vez de quebrar.
    while (resultadosDeTurno.length < caso.turnos.length) {
      resultadosDeTurno.push({
        turno: resultadosDeTurno.length + 1,
        enviado: "",
        envios: [],
      });
      estadoPorTurno.push(estadoFinal);
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
