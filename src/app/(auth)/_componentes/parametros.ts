import { proximoSeguro } from "@/lib/auth/acesso";

export type ParametrosBusca = Promise<
  Record<string, string | string[] | undefined>
>;

/** Um valor de ?chave= (o primeiro, se vier repetido). */
export function parametro(
  busca: Record<string, string | string[] | undefined>,
  chave: string,
) {
  const valor = busca[chave];
  return Array.isArray(valor) ? valor[0] : valor;
}

/** ?proximo= só quando é caminho interno do app. */
export function proximoDaBusca(
  busca: Record<string, string | string[] | undefined>,
) {
  return proximoSeguro(parametro(busca, "proximo")) ?? undefined;
}
