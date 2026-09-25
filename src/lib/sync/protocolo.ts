import type { RepositorioSincronizacao } from "./repositorio";
import {
  ENTIDADE_ASSISTENCIAL_APPEND_ONLY,
  entidadeEVersionada,
  type ItemSincronizacaoEntrada,
  type RequisicaoSincronizacao,
  type RespostaSincronizacao,
  type ResultadoItemSincronizacao,
} from "./tipos";

/**
 * Compara profundamente por igualdade estrutural (chaves e arrays, em
 * qualquer ordem de chave), o bastante para decidir se um segundo envio de
 * `registro_atendimento` é a mesma gravação reenviada ou uma divergência de
 * verdade (D-05: divergência vira adendo, reenvio idêntico não).
 */
function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, indice) => iguais(item, b[indice]));
  }

  const chavesA = Object.keys(a as Record<string, unknown>);
  const chavesB = Object.keys(b as Record<string, unknown>);
  if (chavesA.length !== chavesB.length) return false;
  return chavesA.every((chave) =>
    iguais(
      (a as Record<string, unknown>)[chave],
      (b as Record<string, unknown>)[chave],
    ),
  );
}

/**
 * Ordena por `criadoNoClienteEm` (regra 15: "a fila envia na ordem de
 * criação"), com o `id` como desempate estável para dois itens gerados no
 * mesmo milissegundo. A ordem de chegada na requisição HTTP não importa: um
 * lote reenviado fora de ordem, ou dois lotes de aparelhos diferentes que se
 * cruzam, aplicam sempre na mesma ordem de criação.
 */
function ordenarPorCriacao(
  itens: readonly ItemSincronizacaoEntrada[],
): ItemSincronizacaoEntrada[] {
  return [...itens].sort((a, b) => {
    const diferenca =
      Date.parse(a.criadoNoClienteEm) - Date.parse(b.criadoNoClienteEm);
    return diferenca !== 0 ? diferenca : a.id.localeCompare(b.id);
  });
}

async function processarItem(
  item: ItemSincronizacaoEntrada,
  repo: RepositorioSincronizacao,
): Promise<ResultadoItemSincronizacao> {
  // Idempotência (PRD 15): id gerado no aparelho, reenviar não reaplica.
  const jaProcessado = await repo.buscarResultadoProcessado(item.id);
  if (jaProcessado) {
    return jaProcessado;
  }

  let resultado: ResultadoItemSincronizacao;

  if (item.entidade === ENTIDADE_ASSISTENCIAL_APPEND_ONLY) {
    resultado = await processarAssistencialAppendOnly(item, repo);
  } else if (entidadeEVersionada(item.entidade)) {
    resultado = await processarVersionada(item, repo);
  } else {
    resultado = {
      id: item.id,
      status: "erro",
      erro: `entidade não sincronizável: ${item.entidade}`,
    };
  }

  await repo.marcarProcessado(item, resultado);
  await repo.registrarAuditoria({
    usuarioId: item.usuarioId,
    acao:
      resultado.status === "conflito"
        ? "sincronizacao_conflito"
        : resultado.virouAdendo
          ? "sincronizacao_adendo"
          : "sincronizacao",
    entidade: item.entidade,
    entidadeId: item.entidadeId,
    valorAntes: resultado.conflito?.original ?? null,
    valorDepois: resultado.status === "processado" ? item.payload : null,
  });

  return resultado;
}

async function processarAssistencialAppendOnly(
  item: ItemSincronizacaoEntrada,
  repo: RepositorioSincronizacao,
): Promise<ResultadoItemSincronizacao> {
  // Para registro_atendimento, entidadeId é o visita_id (chave natural: uma
  // visita tem no máximo um registro). O id de linha do registro em si é
  // gerado pelo banco e não importa para o protocolo de sincronização.
  if (item.entidadeId === null) {
    return {
      id: item.id,
      status: "erro",
      erro: "registro_atendimento exige entidadeId (o visita_id)",
    };
  }

  const estado = await repo.buscarEstado(item.entidade, item.entidadeId);

  if (!estado) {
    await repo.aplicar(item);
    return { id: item.id, status: "processado" };
  }

  if (iguais(estado.dados, item.payload)) {
    // Mesmo conteúdo reenviado (ex.: reenvio após queda de rede antes do
    // ack): não é divergência, não gera adendo (D-05 é sobre correção, não
    // sobre reenvio idêntico).
    return { id: item.id, status: "processado", virouAdendo: false };
  }

  // Registro assistencial nunca é sobrescrito (D-05, PRD 6.10 regra 4): o
  // original de `estado` continua exatamente como estava; a divergência
  // vira adendo, nunca um update.
  await repo.registrarAdendo(item);
  return { id: item.id, status: "processado", virouAdendo: true };
}

async function processarVersionada(
  item: ItemSincronizacaoEntrada,
  repo: RepositorioSincronizacao,
): Promise<ResultadoItemSincronizacao> {
  if (item.entidadeId === null) {
    const { versaoResultante } = await repo.aplicar(item);
    return {
      id: item.id,
      status: "processado",
      versaoResultante: versaoResultante ?? undefined,
    };
  }

  const estado = await repo.buscarEstado(item.entidade, item.entidadeId);
  if (!estado) {
    return {
      id: item.id,
      status: "erro",
      erro: `${item.entidade} ${item.entidadeId} não encontrada`,
    };
  }

  if (item.versaoBase === null) {
    return {
      id: item.id,
      status: "erro",
      erro: "versaoBase é obrigatória para atualizar entidade versionada",
    };
  }

  if (estado.versao !== item.versaoBase) {
    // Conflito pela coluna versao (PRD 6.10 regra 13, 15): o original fica
    // preservado (nada é aplicado); o item guarda os dois lados.
    return {
      id: item.id,
      status: "conflito",
      conflito: {
        original: estado.dados,
        versaoAtual: estado.versao ?? 0,
        tentativa: item.payload,
      },
    };
  }

  const { versaoResultante } = await repo.aplicar(item);
  return {
    id: item.id,
    status: "processado",
    versaoResultante: versaoResultante ?? undefined,
  };
}

/**
 * Aplica um lote de itens da fila, na ordem de criação, cada um só uma vez
 * (invariante 4). É a função que `POST /api/sync` (src/app/api/sync) chama;
 * fica separada da rota HTTP para os testes do invariante 4 chamarem direto,
 * sem precisar de um servidor Next de pé (Vitest com fake-indexeddb só do
 * lado do motor cliente, este arquivo é puro Node).
 */
export async function processarLote(
  requisicao: RequisicaoSincronizacao,
  repo: RepositorioSincronizacao,
): Promise<RespostaSincronizacao> {
  const ordenados = ordenarPorCriacao(requisicao.itens);
  const resultados: ResultadoItemSincronizacao[] = [];

  // Sequencial de propósito: preserva a ordem de criação mesmo quando duas
  // atualizações do lote miram a mesma entidade (a segunda precisa ver o
  // efeito da primeira para o conflito de versão fazer sentido).
  for (const item of ordenados) {
    resultados.push(await processarItem(item, repo));
  }

  return { resultados };
}
