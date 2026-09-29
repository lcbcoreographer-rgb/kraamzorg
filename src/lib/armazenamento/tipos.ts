/**
 * Armazenamento privado de documentos (contrato em PDF e comprovante de
 * baixa manual). Nada aqui é público: quem precisa abrir um arquivo recebe
 * uma URL assinada de vida curta (CLAUDE.md, "Segurança e LGPD") ou, na
 * demonstração, os bytes pela rota autenticada.
 */
export interface ArmazenamentoPrivado {
  /**
   * Grava o arquivo. `substituir` só vale para o contrato gerado de novo
   * antes do envio; comprovante nunca substitui outro.
   */
  salvar(
    caminho: string,
    conteudo: Uint8Array,
    contentType: string,
    substituir: boolean,
  ): Promise<void>;
  /** Lê o arquivo (envio do PDF à Autentique). Nulo se não existe. */
  ler(caminho: string): Promise<Uint8Array | null>;
  /**
   * Como entregar o arquivo a quem tem permissão: uma URL assinada curta
   * (Supabase) ou os próprios bytes (demonstração, sem storage).
   */
  abrir(
    caminho: string,
    segundos: number,
  ): Promise<
    | { tipo: "url"; url: string }
    | { tipo: "bytes"; bytes: Uint8Array; contentType: string }
    | null
  >;
}
