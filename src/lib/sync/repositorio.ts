import type {
  Entidade,
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";

/** Estado de uma entidade sincronizável no banco, como o repositório o vê. */
export interface EstadoEntidade {
  entidadeId: string;
  /** null para `registro_atendimento` (append-only, sem coluna versao). */
  versao: number | null;
  dados: unknown;
}

/**
 * Porta de gravação da sincronização (PRD, "a gravação no banco passa por
 * uma interface de repositório"). `POST /api/sync` (src/app/api/sync) só
 * enxerga esta interface; quem a implementa decide como e onde persistir.
 *
 * `RepositorioSincronizacaoMemoria` (repositorio-memoria.ts) é a
 * implementação usada pelos testes e, por ora, também pela rota em runtime:
 * o cliente Supabase de servidor (`src/lib/db`, P01) e as tabelas
 * assistenciais com validação por instrumento (P34 a P39) ainda não
 * existem neste ponto do projeto. Uma implementação real troca só este
 * arquivo por outro que fala com `api.*` (PostgREST só expõe `public` e
 * `api`, PRD 5.2); o motor cliente e a rota não mudam.
 */
export interface RepositorioSincronizacao {
  /**
   * Item já processado com este id (idempotência, PRD 15: "id gerado no
   * aparelho, idempotente"). Devolve o resultado gravado da primeira vez,
   * sem reaplicar nada.
   */
  buscarResultadoProcessado(
    id: string,
  ): Promise<ResultadoItemSincronizacao | null>;

  /** Estado atual da entidade no banco, ou null se ainda não existe. */
  buscarEstado(
    entidade: Entidade,
    entidadeId: string,
  ): Promise<EstadoEntidade | null>;

  /**
   * Cria um registro novo (entidadeId nulo no item) ou aplica a atualização
   * de um campo numa entidade versionada, já confirmada como sem conflito
   * pelo chamador. `versaoResultante` é a versão gravada (1 na criação) e
   * `entidadeId` é o id do registro gravado (o gerado pelo banco, na
   * criação).
   */
  aplicar(
    item: ItemSincronizacaoEntrada,
  ): Promise<{ versaoResultante: number | null; entidadeId: string }>;

  /**
   * Registro assistencial (`registro_atendimento`) que já existe e recebeu
   * um segundo envio com conteúdo divergente: grava `registro_adendo` em
   * vez de sobrescrever (D-05, PRD 6.10 regra 4).
   */
  registrarAdendo(item: ItemSincronizacaoEntrada): Promise<void>;

  /** Grava o resultado final do item (para idempotência e para auditoria). */
  marcarProcessado(
    item: ItemSincronizacaoEntrada,
    resultado: ResultadoItemSincronizacao,
  ): Promise<void>;

  /**
   * Log de auditoria com origem 'sync' (PRD 6.7: `log_auditoria.origem` ∈
   * {'app','agente','cron','webhook','sync'}). Toda escrita relevante grava
   * aqui (PRD 5.2).
   */
  registrarAuditoria(entrada: {
    usuarioId: string;
    acao: string;
    entidade: string;
    entidadeId: string | null;
    valorAntes: unknown;
    valorDepois: unknown;
  }): Promise<void>;
}
