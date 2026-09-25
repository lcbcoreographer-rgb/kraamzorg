import type { EstadoEntidade, RepositorioSincronizacao } from "./repositorio";
import type {
  Entidade,
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";

interface EntradaAuditoria {
  usuarioId: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  valorAntes: unknown;
  valorDepois: unknown;
  origem: "sync";
  criadoEm: string;
}

interface EntradaAdendo {
  entidade: Entidade;
  /** Para `registro_atendimento`, é o `visita_id` (chave natural do registro). */
  entidadeId: string;
  autorId: string;
  criadoNoClienteEm: string;
  conteudo: unknown;
}

/**
 * Implementação em memória de {@link RepositorioSincronizacao}: usada pelos
 * testes do invariante 4 (Vitest) e, enquanto o P01 (cliente Supabase de
 * servidor) e o P34-P39 (formulários assistenciais reais) não existem,
 * também pela própria rota `POST /api/sync` em runtime; ver o comentário
 * em repositorio.ts. `novaInstancia()` cria um repositório limpo por teste
 * ou por processo; nada aqui é compartilhado entre chamadas de módulos
 * diferentes.
 */
export class RepositorioSincronizacaoMemoria implements RepositorioSincronizacao {
  private readonly estados = new Map<string, EstadoEntidade>();
  private readonly processados = new Map<string, ResultadoItemSincronizacao>();
  private readonly adendos: EntradaAdendo[] = [];
  private readonly auditoria: EntradaAuditoria[] = [];

  private chave(entidade: Entidade, entidadeId: string): string {
    return `${entidade}:${entidadeId}`;
  }

  async buscarResultadoProcessado(
    id: string,
  ): Promise<ResultadoItemSincronizacao | null> {
    return this.processados.get(id) ?? null;
  }

  async buscarEstado(
    entidade: Entidade,
    entidadeId: string,
  ): Promise<EstadoEntidade | null> {
    return this.estados.get(this.chave(entidade, entidadeId)) ?? null;
  }

  async aplicar(
    item: ItemSincronizacaoEntrada,
  ): Promise<{ versaoResultante: number | null; entidadeId: string }> {
    const assistencialAppendOnly = item.entidade === "registro_atendimento";

    if (item.entidadeId === null) {
      // Criação: gera um id como o banco geraria (gen_random_uuid()). Para
      // registro_atendimento o id de entidade sempre vem preenchido com o
      // visita_id (ver repositorio.ts); este ramo só existe para as
      // entidades versionadas criadas offline (ex.: anexo_audio novo).
      // uuid como o do banco: a rota só aceita entidadeId em formato uuid.
      const idGerado = crypto.randomUUID();
      const versao = assistencialAppendOnly ? null : 1;
      this.estados.set(this.chave(item.entidade, idGerado), {
        entidadeId: idGerado,
        versao,
        dados: item.payload,
      });
      return { versaoResultante: versao, entidadeId: idGerado };
    }

    const chave = this.chave(item.entidade, item.entidadeId);
    const atual = this.estados.get(chave);

    if (assistencialAppendOnly) {
      // Sem versão: primeira gravação para este visita_id.
      this.estados.set(chave, {
        entidadeId: item.entidadeId,
        versao: null,
        dados: item.payload,
      });
      return { versaoResultante: null, entidadeId: item.entidadeId };
    }

    const versaoResultante = (atual?.versao ?? 0) + 1;
    const dadosAnteriores =
      atual?.dados && typeof atual.dados === "object"
        ? (atual.dados as Record<string, unknown>)
        : {};
    const dados =
      item.campo !== null
        ? { ...dadosAnteriores, [item.campo]: item.payload }
        : item.payload;

    this.estados.set(chave, {
      entidadeId: item.entidadeId,
      versao: versaoResultante,
      dados,
    });
    return { versaoResultante, entidadeId: item.entidadeId };
  }

  async registrarAdendo(item: ItemSincronizacaoEntrada): Promise<void> {
    if (item.entidadeId === null) {
      throw new Error(
        "repositorio-memoria: registrarAdendo exige entidadeId (visita_id do registro_atendimento)",
      );
    }
    this.adendos.push({
      entidade: item.entidade,
      entidadeId: item.entidadeId,
      autorId: item.usuarioId,
      criadoNoClienteEm: item.criadoNoClienteEm,
      conteudo: item.payload,
    });
  }

  async marcarProcessado(
    item: ItemSincronizacaoEntrada,
    resultado: ResultadoItemSincronizacao,
  ): Promise<void> {
    this.processados.set(item.id, resultado);
  }

  async registrarAuditoria(entrada: {
    usuarioId: string;
    acao: string;
    entidade: string;
    entidadeId: string | null;
    valorAntes: unknown;
    valorDepois: unknown;
  }): Promise<void> {
    this.auditoria.push({
      ...entrada,
      origem: "sync",
      criadoEm: new Date().toISOString(),
    });
  }

  /** Só para teste e para a demonstração em /dev/sync: nunca chamado pela rota. */
  listarAdendos(): readonly EntradaAdendo[] {
    return this.adendos;
  }

  /** Só para teste e para a demonstração em /dev/sync: nunca chamado pela rota. */
  listarAuditoria(): readonly EntradaAuditoria[] {
    return this.auditoria;
  }
}
