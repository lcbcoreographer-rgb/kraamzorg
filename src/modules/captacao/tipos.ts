/**
 * Tipos da captação (P47), fora de acoes.ts porque um arquivo "use server"
 * só exporta funções assíncronas.
 */
export interface PedidoCaptacao {
  canal: string;
  utm: Record<string, string>;
  verificacao: string | null;
}

export type ResultadoCaptacao =
  | { situacao: "ok"; url: string }
  | { situacao: "limite" | "indisponivel" | "verificacao" | "erro" };

const CHAVES_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Só as cinco chaves utm_*, cada uma texto curto (o banco limpa de novo). */
export function utmDaBusca(
  busca: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const chave of CHAVES_UTM) {
    const valor = busca[chave];
    const texto = Array.isArray(valor) ? valor[0] : valor;
    if (typeof texto === "string" && texto.length > 0 && texto.length <= 80) {
      saida[chave] = texto;
    }
  }
  return saida;
}
