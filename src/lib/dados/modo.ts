/**
 * Qual implementação dos repositórios (e da autenticação) o servidor usa.
 *
 * - "supabase": a real. Padrão em qualquer ambiente.
 * - "demonstracao": dados fictícios em memória, para as telas rodarem e
 *   serem testadas nesta máquina, que não tem Supabase Auth nem PostgREST.
 *   Só vale com NEXT_PUBLIC_APP_ENV=desenvolvimento e KZ_DADOS=demonstracao,
 *   e nunca num deploy de produção da Vercel.
 *
 * Pedir demonstração fora de desenvolvimento não cai em silêncio para o
 * Supabase: lança erro. Um ambiente mal configurado tem que parar na hora,
 * não servir tela com dado inventado nem tela vazia sem explicação.
 *
 * O código de tela nunca lê isto: quem decide é a fábrica de repositórios
 * (src/lib/dados/fabrica.ts) e a de autenticação (src/lib/auth/sessao.ts).
 */
export type ModoDados = "supabase" | "demonstracao";

export class ErroModoDemonstracao extends Error {
  constructor(motivo: string) {
    super(
      `O modo demonstração só roda em desenvolvimento (${motivo}). ` +
        "Tire KZ_DADOS=demonstracao deste ambiente ou use NEXT_PUBLIC_APP_ENV=desenvolvimento.",
    );
    this.name = "ErroModoDemonstracao";
  }
}

/** Confere se o modo demonstração pode rodar aqui; lança erro se não puder. */
export function garantirDemonstracaoPermitida(): void {
  if (process.env.KZ_DADOS !== "demonstracao") {
    throw new ErroModoDemonstracao("KZ_DADOS não é demonstracao");
  }
  if (process.env.NEXT_PUBLIC_APP_ENV !== "desenvolvimento") {
    throw new ErroModoDemonstracao(
      `NEXT_PUBLIC_APP_ENV é ${process.env.NEXT_PUBLIC_APP_ENV ?? "vazio"}`,
    );
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new ErroModoDemonstracao("deploy de produção da Vercel");
  }
}

/** Modo pedido pelo ambiente. Demonstração fora de desenvolvimento lança erro. */
export function modoDados(): ModoDados {
  if (process.env.KZ_DADOS === "demonstracao") {
    garantirDemonstracaoPermitida();
    return "demonstracao";
  }
  return "supabase";
}
