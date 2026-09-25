import type { BancoOffline } from "./db";
import {
  ENTIDADE_ASSISTENCIAL_APPEND_ONLY,
  entidadeEVersionada,
  type Entidade,
  type EstadoItemFila,
  type ItemFila,
  type ItemSincronizacaoEntrada,
  type RascunhoCampo,
  type RespostaSincronizacao,
} from "./tipos";

/** Espera crescente entre tentativas (PRD 15: "reenvio e espera crescente"). */
const ESPERA_BASE_MS = 2_000;
const ESPERA_MAXIMA_MS = 5 * 60 * 1_000;

export function calcularEsperaMs(tentativas: number): number {
  return Math.min(ESPERA_BASE_MS * 2 ** tentativas, ESPERA_MAXIMA_MS);
}

/**
 * Tempo máximo de uma chamada a `POST /api/sync`. Sem ele, uma conexão que
 * trava sem cair deixaria o envio "enviando" para sempre e seguraria os
 * envios seguintes (processarFila roda um de cada vez por banco).
 */
const TEMPO_MAXIMO_ENVIO_MS = 30_000;

/** Estados que ainda precisam subir (a fila que "ainda não subiu", PRD 15). */
export const ESTADOS_PENDENTES: readonly EstadoItemFila[] = [
  "rascunho_local",
  "enviando",
  "erro",
];

function porCriacao(a: ItemFila, b: ItemFila): number {
  if (a.criadoNoClienteEm !== b.criadoNoClienteEm) {
    return a.criadoNoClienteEm < b.criadoNoClienteEm ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Instante de criação estritamente crescente no aparelho. Dois campos
 * salvos no mesmo milissegundo (ou com o relógio voltando alguns
 * milissegundos) ganhariam o mesmo `criadoNoClienteEm`, e o servidor
 * desempataria pelo `id`, que é aleatório: a ordem de criação se perderia.
 * Aqui o novo item nasce sempre pelo menos 1 ms depois do último da fila.
 */
async function instanteDeCriacao(db: BancoOffline): Promise<string> {
  const agora = Date.now();
  const ultimo = await db.fila.orderBy("criadoNoClienteEm").last();
  const ultimoMs = ultimo ? Date.parse(ultimo.criadoNoClienteEm) : Number.NaN;
  const instante =
    Number.isFinite(ultimoMs) && ultimoMs >= agora ? ultimoMs + 1 : agora;
  return new Date(instante).toISOString();
}

/**
 * `versaoBase` de um campo novo numa entidade versionada (PRD 6.10 regra
 * 13). O servidor aplica a fila na ordem e cada update sobe `versao` em 1.
 * Se a enfermeira salva dois campos da mesma visita sem sinal, os dois
 * partem da versão que ela leu (digamos 3); sem encadear, o primeiro
 * aplica (versão 4) e o segundo daria conflito com o próprio aparelho. Por
 * isso o campo novo parte da versão que o item anterior da mesma entidade
 * vai deixar:
 * - anterior sincronizado: a versão que o servidor devolveu;
 * - anterior ainda pendente: a base dele mais 1;
 * - anterior em conflito: a mesma base dele, para o conflito continuar
 *   aparecendo (a divergência precisa de decisão humana, não de palpite).
 * A versão informada por quem chamou vale quando é maior (a tela releu o
 * registro do servidor depois).
 */
async function versaoBaseEncadeada(
  db: BancoOffline,
  entidade: Entidade,
  entidadeId: string | null,
  informada: number | null,
): Promise<number | null> {
  if (entidadeId === null || !entidadeEVersionada(entidade)) {
    return informada;
  }

  const anteriores = await db.fila
    .where("[entidade+entidadeId]")
    .equals([entidade, entidadeId])
    .toArray();
  const anterior = anteriores.sort(porCriacao).at(-1);
  if (!anterior) return informada;

  let encadeada: number | null;
  if (anterior.estado === "sincronizado") {
    encadeada = anterior.versaoResultante ?? null;
  } else if (anterior.estado === "conflito") {
    encadeada = anterior.versaoBase;
  } else {
    encadeada = anterior.versaoBase === null ? null : anterior.versaoBase + 1;
  }

  if (encadeada === null) return informada;
  return informada === null ? encadeada : Math.max(informada, encadeada);
}

function gerarId(): string {
  return crypto.randomUUID();
}

function chaveRascunho(
  entidade: Entidade,
  entidadeId: string | null,
  campo: string,
): string {
  return `${entidade}:${entidadeId ?? "novo"}:${campo}`;
}

export interface SalvarCampoEntrada {
  usuarioId: string;
  entidade: Entidade;
  entidadeId: string | null;
  campo: string;
  valor: unknown;
  /** Obrigatório ao editar um registro que já existe numa entidade versionada. */
  versaoBase?: number | null;
}

/**
 * Salva um campo (PRD 15: "cada campo salvo grava localmente no mesmo
 * instante"). Uma única transação Dexie grava o rascunho (o que a tela
 * mostra) e cria o item de fila (o que sobe), para as duas coisas nunca
 * ficarem fora de sincronia entre si: "salvar grava local e enfileira no
 * mesmo instante".
 *
 * Devolve o item de fila criado, com `estado: "rascunho_local"`; quem
 * chamou decide se tenta enviar agora (normalmente sim, ver `processarFila`).
 */
export async function salvarCampo(
  db: BancoOffline,
  entrada: SalvarCampoEntrada,
): Promise<ItemFila> {
  if (entrada.entidade === ENTIDADE_ASSISTENCIAL_APPEND_ONLY) {
    // O registro assistencial é assinado inteiro e sobe inteiro
    // (enfileirarRegistroAssistencial); por campo, o servidor recusa.
    throw new Error(
      "registro_atendimento não é salvo por campo: use enfileirarRegistroAssistencial",
    );
  }

  const id = gerarId();
  let item: ItemFila | undefined;

  await db.transaction("rw", db.fila, db.rascunhos, async () => {
    const criadoNoClienteEm = await instanteDeCriacao(db);
    const versaoBase = await versaoBaseEncadeada(
      db,
      entrada.entidade,
      entrada.entidadeId,
      entrada.versaoBase ?? null,
    );

    item = {
      id,
      usuarioId: entrada.usuarioId,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      campo: entrada.campo,
      payload: entrada.valor,
      versaoBase,
      criadoNoClienteEm,
      estado: "rascunho_local",
      tentativas: 0,
      proximoEnvioEm: Date.parse(criadoNoClienteEm),
    };

    const rascunho: RascunhoCampo = {
      chave: chaveRascunho(entrada.entidade, entrada.entidadeId, entrada.campo),
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      campo: entrada.campo,
      valor: entrada.valor,
      atualizadoEm: criadoNoClienteEm,
      itemFilaId: id,
    };

    await db.fila.add(item);
    await db.rascunhos.put(rascunho);
  });

  return item!;
}

export interface EnfileirarRegistroEntrada {
  usuarioId: string;
  /** `registro_atendimento` é identificado pelo `visita_id` (ver tipos.ts). */
  visitaId: string;
  /** O registro inteiro, como foi assinado. O formato é do P38 e do instrumento. */
  registro: unknown;
}

/**
 * Enfileira um `registro_atendimento` inteiro (campo nulo), já assinado.
 * Grava na fila no mesmo instante, como `salvarCampo`, e segue a mesma
 * ordem de criação. No servidor, se a visita já tiver registro com
 * conteúdo diferente, vira adendo (D-05); nunca sobrescreve.
 */
export async function enfileirarRegistroAssistencial(
  db: BancoOffline,
  entrada: EnfileirarRegistroEntrada,
): Promise<ItemFila> {
  const id = gerarId();
  let item: ItemFila | undefined;

  await db.transaction("rw", db.fila, async () => {
    const criadoNoClienteEm = await instanteDeCriacao(db);
    item = {
      id,
      usuarioId: entrada.usuarioId,
      entidade: ENTIDADE_ASSISTENCIAL_APPEND_ONLY,
      entidadeId: entrada.visitaId,
      campo: null,
      payload: entrada.registro,
      versaoBase: null,
      criadoNoClienteEm,
      estado: "rascunho_local",
      tentativas: 0,
      proximoEnvioEm: Date.parse(criadoNoClienteEm),
    };
    await db.fila.add(item);
  });

  return item!;
}

/** O componente lê isto para mostrar o estado atual de um campo (PRD 15). */
export async function estadoDoCampo(
  db: BancoOffline,
  entidade: Entidade,
  entidadeId: string | null,
  campo: string,
): Promise<{ valor: unknown; item: ItemFila | undefined } | null> {
  const rascunho = await db.rascunhos.get(
    chaveRascunho(entidade, entidadeId, campo),
  );
  if (!rascunho) return null;
  const item = await db.fila.get(rascunho.itemFilaId);
  return { valor: rascunho.valor, item };
}

function itemParaEnvio(item: ItemFila): ItemSincronizacaoEntrada {
  return {
    id: item.id,
    usuarioId: item.usuarioId,
    entidade: item.entidade,
    entidadeId: item.entidadeId,
    campo: item.campo,
    payload: item.payload,
    versaoBase: item.versaoBase,
    criadoNoClienteEm: item.criadoNoClienteEm,
  };
}

/** Função que fala com `POST /api/sync`; injetada para os testes trocarem por um dublê. */
export type EnviarLote = (
  itens: ItemSincronizacaoEntrada[],
) => Promise<RespostaSincronizacao>;

/** `fetch` real, para o app: serializa o lote e lê a resposta de `POST /api/sync`. */
export const enviarLotePorFetch: EnviarLote = async (itens) => {
  const resposta = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itens }),
    signal: AbortSignal.timeout(TEMPO_MAXIMO_ENVIO_MS),
  });
  if (!resposta.ok) {
    throw new Error(`POST /api/sync respondeu ${resposta.status}`);
  }
  return (await resposta.json()) as RespostaSincronizacao;
};

export interface ResumoProcessamento {
  sincronizados: number;
  conflitos: number;
  erros: number;
  pendentesRestantes: number;
}

export interface OpcoesProcessamento {
  /**
   * Envia mesmo com itens ainda dentro da espera crescente. Usado quando a
   * conexão volta, quando a aba volta ao foco (PRD 15) e no botão de nova
   * tentativa: nesses casos não faz sentido esperar.
   */
  ignorarEspera?: boolean;
}

/** Um processamento por vez, por banco: a próxima chamada espera a anterior. */
const processamentoEmCurso = new WeakMap<
  BancoOffline,
  Promise<ResumoProcessamento>
>();

/**
 * Sobe a fila (PRD 15: "rascunho local, enviando, sincronizado"; conflito
 * e erro além dos três). Chamado ao reconectar, ao voltar o foco da aba e,
 * para os itens em espera crescente, por um temporizador (ver
 * `iniciarMotorSincronizacao`).
 *
 * Regras que garantem o invariante 4 ("chega íntegro e na ordem"):
 * - Quando algum item está pronto, sobe a fila pendente inteira, num lote
 *   só, na ordem de criação. Enviar só os prontos deixaria um item novo
 *   passar na frente de um mais antigo que ainda está na espera crescente.
 * - Um item que ficou "enviando" (aba fechada ou aparelho desligado no
 *   meio do envio) volta a subir na próxima passada; o servidor é
 *   idempotente pelo id, então reenviar nunca duplica.
 * - Uma passada por vez, por banco: gatilhos que chegam juntos (online,
 *   foco, temporizador) entram em fila em vez de enviar o mesmo item duas
 *   vezes ao mesmo tempo.
 */
export function processarFila(
  db: BancoOffline,
  enviar: EnviarLote = enviarLotePorFetch,
  agora?: number,
  opcoes: OpcoesProcessamento = {},
): Promise<ResumoProcessamento> {
  const anterior = processamentoEmCurso.get(db) ?? Promise.resolve();
  const esta = anterior
    .catch(() => undefined)
    .then(() => processarFilaAgora(db, enviar, agora ?? Date.now(), opcoes));
  processamentoEmCurso.set(db, esta);
  const liberar = () => {
    if (processamentoEmCurso.get(db) === esta) {
      processamentoEmCurso.delete(db);
    }
  };
  esta.then(liberar, liberar);
  return esta;
}

async function contarPendentes(db: BancoOffline): Promise<number> {
  return db.fila.where("estado").anyOf(ESTADOS_PENDENTES).count();
}

async function processarFilaAgora(
  db: BancoOffline,
  enviar: EnviarLote,
  agora: number,
  opcoes: OpcoesProcessamento,
): Promise<ResumoProcessamento> {
  const pendentes = (
    await db.fila.where("estado").anyOf(ESTADOS_PENDENTES).toArray()
  ).sort(porCriacao);

  const resumo: ResumoProcessamento = {
    sincronizados: 0,
    conflitos: 0,
    erros: 0,
    pendentesRestantes: 0,
  };

  const algumPronto =
    opcoes.ignorarEspera === true ||
    pendentes.some((item) => item.proximoEnvioEm <= agora);

  if (pendentes.length === 0 || !algumPronto) {
    resumo.pendentesRestantes = pendentes.length;
    return resumo;
  }

  const lote = pendentes;

  await db.fila.bulkUpdate(
    lote.map((item) => ({ key: item.id, changes: { estado: "enviando" } })),
  );

  let resposta: RespostaSincronizacao;
  try {
    resposta = await enviar(lote.map(itemParaEnvio));
  } catch (erro) {
    // Sem rede ou servidor fora do ar: todo o lote volta para trás da fila,
    // com espera crescente (regra 15). Nada se perde.
    await db.fila.bulkUpdate(
      lote.map((item) => {
        const tentativas = item.tentativas + 1;
        return {
          key: item.id,
          changes: {
            estado: "erro" as const,
            tentativas,
            proximoEnvioEm: agora + calcularEsperaMs(tentativas),
            erroMensagem: erro instanceof Error ? erro.message : String(erro),
          },
        };
      }),
    );
    resumo.erros = lote.length;
    resumo.pendentesRestantes = lote.length;
    return resumo;
  }

  const resultadosPorId = new Map(
    resposta.resultados.map((r) => [r.id, r] as const),
  );

  await db.fila.bulkUpdate(
    lote.map((item) => {
      const resultado = resultadosPorId.get(item.id);
      if (!resultado) {
        const tentativas = item.tentativas + 1;
        resumo.erros += 1;
        return {
          key: item.id,
          changes: {
            estado: "erro" as const,
            tentativas,
            proximoEnvioEm: agora + calcularEsperaMs(tentativas),
            erroMensagem: "sem resultado do servidor para este item",
          },
        };
      }

      if (resultado.status === "processado") {
        resumo.sincronizados += 1;
        return {
          key: item.id,
          changes: {
            estado: "sincronizado" as const,
            versaoResultante: resultado.versaoResultante,
            entidadeIdCriado: resultado.entidadeIdCriado,
          },
        };
      }

      if (resultado.status === "conflito") {
        resumo.conflitos += 1;
        return {
          key: item.id,
          changes: {
            estado: "conflito" as const,
            conflito: resultado.conflito,
          },
        };
      }

      const tentativas = item.tentativas + 1;
      resumo.erros += 1;
      return {
        key: item.id,
        changes: {
          estado: "erro" as const,
          tentativas,
          proximoEnvioEm: agora + calcularEsperaMs(tentativas),
          erroMensagem: resultado.erro,
        },
      };
    }),
  );

  resumo.pendentesRestantes = await contarPendentes(db);

  return resumo;
}

export interface ConfiguracaoMotor {
  enviar?: EnviarLote;
  /** Intervalo do temporizador que reavalia a espera crescente (padrão: 5 s). */
  intervaloMs?: number;
}

/**
 * Liga os gatilhos de envio (PRD 15: ao voltar a conexão, ao voltar o foco,
 * e a espera crescente de quem falhou). Só faz sentido no navegador; quem
 * chama (a tela) cuida de rodar isto uma vez e limpar no unmount. Devolve a
 * função de limpeza.
 */
export function iniciarMotorSincronizacao(
  db: BancoOffline,
  config: ConfiguracaoMotor = {},
): () => void {
  const enviar = config.enviar ?? enviarLotePorFetch;
  const intervaloMs = config.intervaloMs ?? 5_000;

  const tentar = (opcoes: OpcoesProcessamento) => {
    // Falha aqui já ficou registrada no item (estado "erro"); o gatilho
    // seguinte tenta de novo.
    processarFila(db, enviar, undefined, opcoes).catch(() => undefined);
  };
  // Conexão ou foco de volta: sobe já, sem esperar a espera crescente.
  const tentarJa = () => tentar({ ignorarEspera: true });
  const tentarNoTempo = () => tentar({});

  window.addEventListener("online", tentarJa);
  window.addEventListener("focus", tentarJa);
  const temporizador = window.setInterval(tentarNoTempo, intervaloMs);

  // Primeira passada, para o que ficou na fila (inclusive envio interrompido).
  tentarJa();

  return () => {
    window.removeEventListener("online", tentarJa);
    window.removeEventListener("focus", tentarJa);
    window.clearInterval(temporizador);
  };
}
