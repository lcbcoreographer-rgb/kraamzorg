import type { PortalRepositorio } from "@/lib/dados/repositorios";
import type { EstadoEntidade, RepositorioSincronizacao } from "./repositorio";
import type {
  Entidade,
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";

/** Campos da visita que o portal da enfermeira sobe pelo motor offline (P38). */
export const CAMPOS_VISITA_SINCRONIZAVEIS = [
  "checkin_em",
  "checkout_em",
] as const;

export function eCampoDeVisitaSincronizavel(
  entidade: Entidade,
  campo: string | null,
): boolean {
  return (
    entidade === "visita" &&
    campo !== null &&
    (CAMPOS_VISITA_SINCRONIZAVEIS as readonly string[]).includes(campo)
  );
}

/**
 * Repositório de sincronização real da visita (P38): a chegada e a saída da
 * enfermeira sobem pela fila do aparelho (P12) e são gravadas pelas funções
 * `api.registrar_chegada` e `api.registrar_saida`, com a sessão da própria
 * enfermeira (papel, AAL2, visita dela e família atribuída conferidos por
 * dentro). Os itens já processados ficam em `fila_sincronizacao`, para o
 * mesmo id reenviado nunca reaplicar. A regra de conflito por versão é a do
 * protocolo (`protocolo.ts`); aqui só está a porta do banco.
 *
 * Só sabe de `visita.checkin_em` e `visita.checkout_em`. As outras entidades
 * da fila (pré-natal, registro, áudio, alerta) ganham o próprio repositório
 * com os prompts que as criam (P35, P39, P40).
 */
export class RepositorioSincronizacaoVisita implements RepositorioSincronizacao {
  constructor(private readonly portal: PortalRepositorio) {}

  buscarResultadoProcessado(
    id: string,
  ): Promise<ResultadoItemSincronizacao | null> {
    return this.portal.resultadoProcessado(id);
  }

  async buscarEstado(
    entidade: Entidade,
    entidadeId: string,
  ): Promise<EstadoEntidade | null> {
    if (entidade !== "visita") return null;
    const estado = await this.portal.estadoDaVisita(entidadeId);
    if (!estado) return null;
    return {
      entidadeId,
      versao: estado.versao,
      dados: {
        estado: estado.estado,
        checkin_em: estado.checkinEm,
        checkout_em: estado.checkoutEm,
      },
    };
  }

  async aplicar(
    item: ItemSincronizacaoEntrada,
  ): Promise<{ versaoResultante: number | null; entidadeId: string }> {
    if (
      item.entidadeId === null ||
      !eCampoDeVisitaSincronizavel(item.entidade, item.campo) ||
      typeof item.payload !== "string"
    ) {
      throw new Error(
        "sincronização de visita: só checkin_em e checkout_em, com a hora em texto",
      );
    }
    const resultado =
      item.campo === "checkin_em"
        ? await this.portal.registrarChegadaSincronizada(
            item.entidadeId,
            item.payload,
          )
        : await this.portal.registrarSaidaSincronizada(
            item.entidadeId,
            item.payload,
          );
    return { versaoResultante: resultado.versao, entidadeId: item.entidadeId };
  }

  async registrarAdendo(): Promise<void> {
    throw new Error("visita não tem adendo: só registro_atendimento (D-05)");
  }

  marcarProcessado(
    item: ItemSincronizacaoEntrada,
    resultado: ResultadoItemSincronizacao,
  ): Promise<void> {
    return this.portal.guardarProcessado(item, resultado);
  }

  /**
   * As funções api já gravam o log da chegada e da saída (origem sync) e o
   * gatilho de auditoria grava a mudança da visita: nada a repetir aqui.
   */
  async registrarAuditoria(): Promise<void> {
    return;
  }
}
