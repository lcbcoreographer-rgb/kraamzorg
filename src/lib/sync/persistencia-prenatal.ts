import { liveQuery } from "dexie";
import type {
  EstadoPersistencia,
  PersistenciaRespostas,
} from "@/lib/instrumentos/persistencia";
import {
  comValor,
  respostasVazias,
  separarCaminho,
  type EnderecoCampo,
  type RespostasFormulario,
  type ValorCampo,
} from "@/lib/instrumentos/respostas";
import type { BancoOffline } from "./db";
import {
  ESTADOS_PENDENTES,
  processarFila,
  salvarCampo as salvarCampoNaFila,
  type EnviarLote,
} from "./motor";
import { CAMPO_PROGRESSO, campoPrenatal } from "./prenatal";
import type { ItemFila } from "./tipos";

/**
 * Persistência da entrevista do DOC 1 sobre o motor offline (P12): cada
 * resposta grava no aparelho e entra na fila no mesmo instante
 * (`salvarCampo` do motor); a fila sobe para `/api/sync/prenatal` na ordem
 * de criação. Junto de cada resposta vai a marca de onde a pessoa parou
 * (etapa e campo), para sair no meio e voltar reabrindo no mesmo lugar, até
 * em outro aparelho.
 */

export interface OpcoesPersistenciaPrenatal {
  db: BancoOffline;
  usuarioId: string;
  consultaId: string;
  /** Versão que o servidor devolveu ao abrir a entrevista (base do primeiro campo). */
  versaoInicial: number;
  enviar: EnviarLote;
  /** Etapa (1 a N) em que a pessoa está agora. */
  etapaAtual: () => number;
}

export interface PersistenciaPrenatal extends PersistenciaRespostas {
  /** Grava a etapa em que a pessoa entrou (o campo, se houver, é o último gravado nela). */
  registrarEtapa(etapa: number): void;
}

function estadoDaFila(itens: ItemFila[]): EstadoPersistencia {
  const pendentes = itens.filter((i) => ESTADOS_PENDENTES.includes(i.estado));
  const comProblema = itens.some(
    (i) => i.estado === "erro" || i.estado === "conflito",
  );
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (comProblema) {
    return { estado: "erro", pendentes: pendentes.length, online };
  }
  if (itens.some((i) => i.estado === "enviando")) {
    return { estado: "enviando", pendentes: pendentes.length, online };
  }
  if (pendentes.length > 0) {
    return { estado: "local", pendentes: pendentes.length, online };
  }
  return {
    estado: "sincronizado",
    pendentes: 0,
    sincronizadoEm: new Date(),
    online,
  };
}

export function criarPersistenciaPrenatal(
  opcoes: OpcoesPersistenciaPrenatal,
): PersistenciaPrenatal {
  const { db, usuarioId, consultaId, versaoInicial, enviar } = opcoes;
  // último campo gravado na etapa atual (nulo ao trocar de etapa)
  let campoDaEtapa: string | null = null;
  let etapaDoCampo = 0;

  const subir = () => {
    void processarFila(db, enviar).catch(() => undefined);
  };

  async function enfileirarProgresso(etapa: number, campo: string | null) {
    await salvarCampoNaFila(db, {
      usuarioId,
      entidade: "consulta_prenatal",
      entidadeId: consultaId,
      campo: CAMPO_PROGRESSO,
      valor: campo ? { etapa, campo } : { etapa },
      versaoBase: versaoInicial,
    });
  }

  return {
    async salvarCampo(endereco: EnderecoCampo, valor: ValorCampo | null) {
      const campo = campoPrenatal(endereco.bloco, endereco.campo);
      await salvarCampoNaFila(db, {
        usuarioId,
        entidade: "consulta_prenatal",
        entidadeId: consultaId,
        campo,
        valor,
        versaoBase: versaoInicial,
      });
      const etapa = opcoes.etapaAtual();
      if (etapa !== etapaDoCampo) campoDaEtapa = null;
      etapaDoCampo = etapa;
      campoDaEtapa = campo;
      await enfileirarProgresso(etapa, campoDaEtapa);
      subir();
    },

    registrarEtapa(etapa: number) {
      campoDaEtapa = null;
      etapaDoCampo = etapa;
      void enfileirarProgresso(etapa, null).then(subir);
    },

    observarEstado(ouvinte) {
      const assinatura = liveQuery(() =>
        db.fila
          .where("[entidade+entidadeId]")
          .equals(["consulta_prenatal", consultaId])
          .toArray(),
      ).subscribe({
        next: (itens) => {
          if (itens.length > 0) ouvinte(estadoDaFila(itens));
        },
        error: () => undefined,
      });
      return () => assinatura.unsubscribe();
    },

    tentarNovamente() {
      void processarFila(db, enviar, undefined, { ignorarEspera: true }).catch(
        () => undefined,
      );
    },
  };
}

/**
 * O que ficou no aparelho e ainda não subiu (ou subiu e o servidor ainda não
 * devolveu na leitura): respostas e a marca de onde a pessoa parou, para a
 * entrevista reabrir sem perder nada de quem digitou sem sinal.
 */
export async function lerRascunhosPrenatal(
  db: BancoOffline,
  consultaId: string,
): Promise<{
  respostas: { endereco: EnderecoCampo; valor: ValorCampo | null }[];
  progresso: { etapa: number; campo: string | null } | null;
}> {
  const rascunhos = await db.rascunhos
    .where("entidade")
    .equals("consulta_prenatal")
    .filter((r) => r.entidadeId === consultaId)
    .toArray();
  const respostas: { endereco: EnderecoCampo; valor: ValorCampo | null }[] = [];
  let progresso: { etapa: number; campo: string | null } | null = null;
  // o que já subiu está no servidor (que pode ter mudado depois, em outro
  // aparelho): só vale o rascunho que ainda espera para subir
  const itens = await db.fila.bulkGet(rascunhos.map((r) => r.itemFilaId));
  const pendentes = new Set(
    itens
      .filter(
        (i): i is ItemFila => i !== undefined && i.estado !== "sincronizado",
      )
      .map((i) => i.id),
  );
  for (const r of rascunhos) {
    if (!pendentes.has(r.itemFilaId)) continue;
    if (r.campo === CAMPO_PROGRESSO) {
      const p = r.valor as { etapa?: unknown; campo?: unknown } | null;
      if (p && typeof p.etapa === "number") {
        progresso = {
          etapa: p.etapa,
          campo: typeof p.campo === "string" ? p.campo : null,
        };
      }
      continue;
    }
    if (!r.campo.includes(".")) continue;
    const { bloco, campo } = separarCaminho(r.campo);
    respostas.push({
      endereco: { bloco, campo },
      valor: (r.valor ?? null) as ValorCampo | null,
    });
  }
  return { respostas, progresso };
}

/** Sobrepõe os rascunhos do aparelho às respostas do servidor. */
export function sobreporRascunhos(
  servidor: RespostasFormulario,
  locais: { endereco: EnderecoCampo; valor: ValorCampo | null }[],
): RespostasFormulario {
  let atual = servidor ?? respostasVazias();
  for (const { endereco, valor } of locais) {
    atual = comValor(atual, endereco, valor);
  }
  return atual;
}

/**
 * Espera a fila da consulta esvaziar (tentando subir), até o tempo máximo.
 * Concluir a entrevista só faz sentido com tudo no servidor: depois de
 * concluída, resposta nova exige motivo. Devolve falso se sobrou item
 * (sem sinal, por exemplo): a tela avisa e não conclui.
 */
export async function aguardarFilaVazia(
  db: BancoOffline,
  consultaId: string,
  enviar: EnviarLote,
  tempoMaximoMs = 8_000,
): Promise<boolean> {
  const limite = Date.now() + tempoMaximoMs;
  for (;;) {
    const pendentes = await db.fila
      .where("[entidade+entidadeId]")
      .equals(["consulta_prenatal", consultaId])
      .filter((i) => ESTADOS_PENDENTES.includes(i.estado))
      .count();
    if (pendentes === 0) return true;
    if (Date.now() >= limite) return false;
    await processarFila(db, enviar, undefined, { ignorarEspera: true }).catch(
      () => undefined,
    );
    await new Promise((resolver) => setTimeout(resolver, 250));
  }
}
