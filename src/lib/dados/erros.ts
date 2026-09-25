/**
 * Erro único dos repositórios. A tela troca o código por uma frase que diz
 * o que aconteceu e o que fazer (PRD 20.3); o detalhe técnico fica no
 * servidor, nunca na tela nem com nome de paciente.
 */
export type CodigoErroRepositorio =
  /** A RLS ou a função api recusou (papel ou AAL2 insuficiente). */
  | "sem_permissao"
  /** Registro não existe ou não é visível para o papel. */
  | "nao_encontrado"
  /** Regra de negócio do banco recusou (transição não permitida, motivo faltando). */
  | "recusado"
  /** Função do schema api que o módulo ainda não criou (migration pendente). */
  | "funcao_pendente"
  /** Banco fora do ar ou rede. */
  | "indisponivel"
  | "desconhecido";

export class ErroRepositorio extends Error {
  readonly codigo: CodigoErroRepositorio;

  constructor(codigo: CodigoErroRepositorio, detalhe: string) {
    super(detalhe);
    this.name = "ErroRepositorio";
    this.codigo = codigo;
  }
}

interface ErroPostgrest {
  code?: string;
  message?: string;
}

/** Traduz o erro do PostgREST (código do Postgres ou PGRST) para o código do app. */
export function traduzirErroBanco(
  erro: ErroPostgrest,
  contexto: string,
): ErroRepositorio {
  const codigo = erro.code ?? "";
  const detalhe = `${contexto}: ${erro.message ?? "erro sem mensagem"}`;
  if (codigo === "42501" || codigo === "PGRST301" || codigo === "PGRST302") {
    return new ErroRepositorio("sem_permissao", detalhe);
  }
  if (codigo === "PGRST116")
    return new ErroRepositorio("nao_encontrado", detalhe);
  if (codigo === "PGRST202" || codigo === "42883") {
    return new ErroRepositorio("funcao_pendente", detalhe);
  }
  if (
    codigo.startsWith("P0") ||
    codigo === "23514" ||
    codigo === "22023" ||
    codigo === "23505"
  ) {
    return new ErroRepositorio("recusado", detalhe);
  }
  if (codigo === "" || codigo.startsWith("08") || codigo === "57P01") {
    return new ErroRepositorio("indisponivel", detalhe);
  }
  return new ErroRepositorio("desconhecido", detalhe);
}
