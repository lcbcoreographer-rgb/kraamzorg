import type { EstadoEntidade, RepositorioSincronizacao } from "./repositorio";
import type {
  Entidade,
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";

/**
 * Junta os repositórios de sincronização por entidade. `real` cuida das
 * entidades que já têm repositório de verdade (hoje, a visita do portal);
 * `demais` cuida do resto (a memória de processo, fora de produção). Sem
 * `demais`, o resto é recusado pela rota antes de chegar aqui.
 */
export class RepositorioSincronizacaoComposto implements RepositorioSincronizacao {
  constructor(
    private readonly real: RepositorioSincronizacao,
    private readonly entidadesReais: readonly Entidade[],
    private readonly demais: RepositorioSincronizacao | null,
  ) {}

  private para(entidade: Entidade): RepositorioSincronizacao {
    if (this.entidadesReais.includes(entidade)) return this.real;
    if (!this.demais) {
      throw new Error(
        `entidade ${entidade} ainda sem repositório de sincronização`,
      );
    }
    return this.demais;
  }

  async buscarResultadoProcessado(
    id: string,
  ): Promise<ResultadoItemSincronizacao | null> {
    const real = await this.real.buscarResultadoProcessado(id);
    if (real) return real;
    return this.demais ? this.demais.buscarResultadoProcessado(id) : null;
  }

  buscarEstado(
    entidade: Entidade,
    entidadeId: string,
  ): Promise<EstadoEntidade | null> {
    return this.para(entidade).buscarEstado(entidade, entidadeId);
  }

  aplicar(item: ItemSincronizacaoEntrada) {
    return this.para(item.entidade).aplicar(item);
  }

  registrarAdendo(item: ItemSincronizacaoEntrada): Promise<void> {
    return this.para(item.entidade).registrarAdendo(item);
  }

  marcarProcessado(
    item: ItemSincronizacaoEntrada,
    resultado: ResultadoItemSincronizacao,
  ): Promise<void> {
    return this.para(item.entidade).marcarProcessado(item, resultado);
  }

  registrarAuditoria(
    entrada: Parameters<RepositorioSincronizacao["registrarAuditoria"]>[0],
  ): Promise<void> {
    const entidade = entrada.entidade as Entidade;
    return this.para(entidade).registrarAuditoria(entrada);
  }
}
