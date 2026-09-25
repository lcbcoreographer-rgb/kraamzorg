import { z } from "zod";

/**
 * Cookie da sessão fictícia do modo demonstração. Só existe em
 * desenvolvimento (src/lib/dados/modo.ts); não é assinado porque não
 * protege dado real nenhum: o que ele abre são as fixtures em memória.
 */
export const COOKIE_DEMONSTRACAO = "kz_demo_sessao";

/** Código do desafio do MFA na demonstração (o mesmo do protótipo, entrar.html). */
export const CODIGO_MFA_DEMONSTRACAO = "123456";

const esquema = z.object({
  u: z.string().min(1),
  aal: z.enum(["aal1", "aal2"]),
  em: z.number().int().positive(),
});

export type CookieDemonstracao = z.infer<typeof esquema>;

export function codificarCookieDemonstracao(dados: CookieDemonstracao): string {
  return Buffer.from(JSON.stringify(dados), "utf8").toString("base64url");
}

export function lerCookieDemonstracao(valor: string | undefined): CookieDemonstracao | null {
  if (!valor) return null;
  try {
    const bruto: unknown = JSON.parse(Buffer.from(valor, "base64url").toString("utf8"));
    const resultado = esquema.safeParse(bruto);
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export const OPCOES_COOKIE_DEMONSTRACAO = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: false,
};
