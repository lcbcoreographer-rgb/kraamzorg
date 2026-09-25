import type { EnderecoCampo, ValorCampo } from "./respostas";

/**
 * Contrato entre o gerador de formulário (src/components/instrumentos) e o
 * motor offline (src/lib/sync, P12). O gerador chama `salvarCampo` a cada
 * resposta (toque, ou saída do campo de texto e de número); o motor grava
 * no aparelho, põe na fila de sincronização e avisa o estado por
 * `observarEstado`. O gerador não conhece Dexie, rede nem banco.
 *
 * `valor = null` apaga a resposta do campo.
 */
export type EstadoSincronizacaoFormulario =
  "local" | "enviando" | "sincronizado" | "erro";

export interface EstadoPersistencia {
  estado: EstadoSincronizacaoFormulario;
  /** Respostas na fila, ainda não confirmadas pelo servidor. */
  pendentes: number;
  /** Última confirmação do servidor. */
  sincronizadoEm?: Date;
  /** Falso quando o aparelho está sem sinal. */
  online?: boolean;
}

export interface PersistenciaRespostas {
  salvarCampo(
    endereco: EnderecoCampo,
    valor: ValorCampo | null,
  ): Promise<void> | void;
  /** Assina mudanças de estado da fila. Devolve a função que cancela. */
  observarEstado?(ouvinte: (estado: EstadoPersistencia) => void): () => void;
  /** Força nova tentativa de envio (botão "Tentar agora"). */
  tentarNovamente?(): void;
}

export interface GravacaoEmMemoria {
  endereco: EnderecoCampo;
  valor: ValorCampo | null;
}

/**
 * Implementação em memória, para teste e para a vitrine de
 * desenvolvimento. Não sincroniza nada: guarda a sequência de gravações e
 * informa sempre "local" com a contagem de pendentes.
 */
export function criarPersistenciaEmMemoria(): PersistenciaRespostas & {
  gravacoes: GravacaoEmMemoria[];
} {
  const gravacoes: GravacaoEmMemoria[] = [];
  const ouvintes = new Set<(estado: EstadoPersistencia) => void>();
  return {
    gravacoes,
    salvarCampo(endereco, valor) {
      gravacoes.push({ endereco: { ...endereco }, valor });
      const estado: EstadoPersistencia = {
        estado: "local",
        pendentes: gravacoes.length,
      };
      for (const ouvinte of ouvintes) ouvinte(estado);
    },
    observarEstado(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
