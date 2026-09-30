import Dexie, { type Table } from "dexie";
import type { RespostasFormulario } from "@/lib/instrumentos/respostas";
import type { AcionamentoAlerta } from "./registro";
import type { TrazidosDoDia } from "./referencia";

/**
 * Rascunho do checklist no aparelho (PRD 15, P39 item 1): cada resposta
 * grava aqui no mesmo instante, antes de qualquer envio. O registro só sobe
 * inteiro e assinado (`enfileirarRegistroAssistencial`, D-05); enquanto não
 * está assinado, o que existe é este rascunho, por visita.
 *
 * Fica em banco Dexie próprio (`kraamzorg-checklist`), separado da fila do
 * motor offline (P12), porque a fila só recebe o que já está assinado. O
 * rascunho de uma visita apaga sozinho quando o registro assinado sobe.
 */

/**
 * Alerta que já disparou nesta visita (avaliado no campo ou escolhido no
 * seletor). Fica gravado mesmo que o valor seja corrigido depois: o alerta
 * já foi para a coordenação e só se fecha com os quatro campos do DOC 3.
 */
export interface AlertaDisparado {
  regraId: string;
  bebeId: string | null;
  campo: string | null;
  /** Valor observado, em texto ("38,2"). */
  valorObservado: string | null;
  manual: boolean;
  /** Já entrou na fila de envio do aparelho. */
  enfileirado: boolean;
}

export interface RascunhoChecklist {
  visitaId: string;
  usuarioId: string;
  instrumentoVersao: string;
  respostas: RespostasFormulario;
  /** Texto de outro dia esperando "Vale para hoje" (não conta como resposta). */
  trazidos: TrazidosDoDia;
  /** Os quatro campos do DOC 3, por alerta. */
  acionamentos: AcionamentoAlerta[];
  /** Alertas que dispararam nesta visita, do campo ou do seletor do DOC 3 (K-07). */
  disparados: AlertaDisparado[];
  /** Índice da etapa onde a enfermeira parou. */
  etapa: number;
  /** Assinado às (ms), depois de assinar: a tela vira leitura. */
  assinadoEmMs: number | null;
  atualizadoEm: string;
}

export interface AudioPendente {
  id: string;
  visitaId: string;
  usuarioId: string;
  tipo: string;
  duracaoSeg: number | null;
  conteudo: Blob;
  criadoEm: string;
}

export interface ArmazemDeRascunhos {
  ler(visitaId: string): Promise<RascunhoChecklist | null>;
  salvar(rascunho: RascunhoChecklist): Promise<void>;
  apagar(visitaId: string): Promise<void>;
}

export interface ArmazemDeAudios {
  guardar(audio: AudioPendente): Promise<void>;
  listar(visitaId?: string): Promise<AudioPendente[]>;
  remover(id: string): Promise<void>;
}

export function rascunhoVazio(
  visitaId: string,
  usuarioId: string,
  instrumentoVersao: string,
  respostas: RespostasFormulario,
  agora: Date = new Date(),
): RascunhoChecklist {
  return {
    visitaId,
    usuarioId,
    instrumentoVersao,
    respostas,
    trazidos: {},
    acionamentos: [],
    disparados: [],
    etapa: 0,
    assinadoEmMs: null,
    atualizadoEm: agora.toISOString(),
  };
}

// --- Memória (testes e demonstração sem IndexedDB) --------------------------------

export function criarArmazemEmMemoria(): ArmazemDeRascunhos & ArmazemDeAudios {
  const rascunhos = new Map<string, RascunhoChecklist>();
  const audios = new Map<string, AudioPendente>();
  return {
    async ler(visitaId) {
      const r = rascunhos.get(visitaId);
      return r ? structuredClone(r) : null;
    },
    async salvar(rascunho) {
      rascunhos.set(rascunho.visitaId, structuredClone(rascunho));
    },
    async apagar(visitaId) {
      rascunhos.delete(visitaId);
    },
    async guardar(audio) {
      audios.set(audio.id, audio);
    },
    async listar(visitaId) {
      return [...audios.values()].filter(
        (a) => !visitaId || a.visitaId === visitaId,
      );
    },
    async remover(id) {
      audios.delete(id);
    },
  };
}

// --- Dexie (aparelho) ---------------------------------------------------------------

export class BancoChecklist extends Dexie {
  rascunhos!: Table<RascunhoChecklist, string>;
  audios!: Table<AudioPendente, string>;

  constructor(nome = "kraamzorg-checklist") {
    super(nome);
    this.version(1).stores({
      rascunhos: "visitaId, usuarioId",
      audios: "id, visitaId",
    });
  }
}

export function criarArmazemDexie(
  banco: BancoChecklist = new BancoChecklist(),
): ArmazemDeRascunhos & ArmazemDeAudios {
  return {
    async ler(visitaId) {
      return (await banco.rascunhos.get(visitaId)) ?? null;
    },
    async salvar(rascunho) {
      await banco.rascunhos.put(rascunho);
    },
    async apagar(visitaId) {
      await banco.rascunhos.delete(visitaId);
    },
    async guardar(audio) {
      await banco.audios.put(audio);
    },
    async listar(visitaId) {
      return visitaId
        ? banco.audios.where("visitaId").equals(visitaId).toArray()
        : banco.audios.toArray();
    },
    async remover(id) {
      await banco.audios.delete(id);
    },
  };
}

let armazemPadrao: (ArmazemDeRascunhos & ArmazemDeAudios) | null = null;

/** Armazém do aparelho (um só por aba). Só no navegador. */
export function armazemDoAparelho(): ArmazemDeRascunhos & ArmazemDeAudios {
  if (!armazemPadrao) armazemPadrao = criarArmazemDexie();
  return armazemPadrao;
}
