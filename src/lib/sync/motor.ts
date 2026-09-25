import type { BancoOffline } from "./db";
import type {
  Entidade,
  EstadoItemFila,
  ItemFila,
  ItemSincronizacaoEntrada,
  RascunhoCampo,
  RespostaSincronizacao,
} from "./tipos";

/** Espera crescente entre tentativas (PRD 15: "reenvio e espera crescente"). */
const ESPERA_BASE_MS = 2_000;
const ESPERA_MAXIMA_MS = 5 * 60 * 1_000;

export function calcularEsperaMs(tentativas: number): number {
  return Math.min(ESPERA_BASE_MS * 2 ** tentativas, ESPERA_MAXIMA_MS);
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
 * chamou decide se tenta enviar agora (normalmente sim, ver `motorAtivo`).
 */
export async function salvarCampo(
  db: BancoOffline,
  entrada: SalvarCampoEntrada,
): Promise<ItemFila> {
  const agora = new Date().toISOString();
  const id = gerarId();

  const item: ItemFila = {
    id,
    usuarioId: entrada.usuarioId,
    entidade: entrada.entidade,
    entidadeId: entrada.entidadeId,
    campo: entrada.campo,
    payload: entrada.valor,
    versaoBase: entrada.versaoBase ?? null,
    criadoNoClienteEm: agora,
    estado: "rascunho_local",
    tentativas: 0,
    proximoEnvioEm: Date.now(),
  };

  const rascunho: RascunhoCampo = {
    chave: chaveRascunho(entrada.entidade, entrada.entidadeId, entrada.campo),
    entidade: entrada.entidade,
    entidadeId: entrada.entidadeId,
    campo: entrada.campo,
    valor: entrada.valor,
    atualizadoEm: agora,
    itemFilaId: id,
  };

  await db.transaction("rw", db.fila, db.rascunhos, async () => {
    await db.fila.add(item);
    await db.rascunhos.put(rascunho);
  });

  return item;
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

/**
 * Percorre a fila em ordem de criação e envia em lote os itens prontos
 * (`rascunho_local` ou `erro` cuja espera já passou), atualizando o estado
 * de cada um pelo resultado (PRD 15: "rascunho local, enviando,
 * sincronizado"; conflito e erro além dos três). Chamado ao reconectar, ao
 * voltar o foco da aba e, para os itens em espera crescente, por um
 * temporizador (ver `iniciarMotorSincronizacao`).
 */
export async function processarFila(
  db: BancoOffline,
  enviar: EnviarLote = enviarLotePorFetch,
  agora: number = Date.now(),
): Promise<ResumoProcessamento> {
  const prontos = (
    await db.fila
      .where("estado")
      .anyOf(["rascunho_local", "erro"] satisfies EstadoItemFila[])
      .toArray()
  )
    .filter((item) => item.proximoEnvioEm <= agora)
    .sort(
      (a, b) =>
        Date.parse(a.criadoNoClienteEm) - Date.parse(b.criadoNoClienteEm),
    );

  const resumo: ResumoProcessamento = {
    sincronizados: 0,
    conflitos: 0,
    erros: 0,
    pendentesRestantes: 0,
  };

  if (prontos.length === 0) {
    resumo.pendentesRestantes = await db.fila
      .where("estado")
      .anyOf(["rascunho_local", "erro"] satisfies EstadoItemFila[])
      .count();
    return resumo;
  }

  await db.fila.bulkUpdate(
    prontos.map((item) => ({ key: item.id, changes: { estado: "enviando" } })),
  );

  let resposta: RespostaSincronizacao;
  try {
    resposta = await enviar(prontos.map(itemParaEnvio));
  } catch (erro) {
    // Sem rede ou servidor fora do ar: todo o lote volta para trás da fila,
    // com espera crescente (regra 15). Nada se perde.
    await db.fila.bulkUpdate(
      prontos.map((item) => {
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
    resumo.erros = prontos.length;
    resumo.pendentesRestantes = prontos.length;
    return resumo;
  }

  const resultadosPorId = new Map(
    resposta.resultados.map((r) => [r.id, r] as const),
  );

  await db.fila.bulkUpdate(
    prontos.map((item) => {
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
        return { key: item.id, changes: { estado: "sincronizado" as const } };
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

  resumo.pendentesRestantes = await db.fila
    .where("estado")
    .anyOf(["rascunho_local", "erro"] satisfies EstadoItemFila[])
    .count();

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

  const tentar = () => {
    void processarFila(db, enviar);
  };

  window.addEventListener("online", tentar);
  window.addEventListener("focus", tentar);
  const temporizador = window.setInterval(tentar, intervaloMs);

  // Primeira passada, para itens que já estavam prontos quando a tela abriu.
  tentar();

  return () => {
    window.removeEventListener("online", tentar);
    window.removeEventListener("focus", tentar);
    window.clearInterval(temporizador);
  };
}
