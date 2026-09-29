import "server-only";
import { headers } from "next/headers";

/**
 * Endereço de quem abriu ou enviou o formulário público (P30), para o
 * limite de tentativas e o Turnstile. Na Vercel, o primeiro item de
 * x-forwarded-for é o IP do cliente (o próprio proxy da Vercel escreve o
 * cabeçalho). O banco guarda só o HMAC dele (privado.formulario_origem);
 * aqui ele nunca é gravado nem logado.
 */
export function origemDaRequisicao(cabecalhos: Headers): string | null {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direto = cabecalhos.get("x-real-ip")?.trim();
  const ip = encaminhado || direto || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

export async function origemAtual(): Promise<string | null> {
  return origemDaRequisicao(await headers());
}
