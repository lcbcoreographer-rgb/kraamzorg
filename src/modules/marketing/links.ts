import type { CanaisMarketing, CanalCaptacao } from "@/lib/dados/tipos-relacao";
import { montarLinkWhatsApp } from "@/lib/messaging/link-whatsapp";

/** Código de origem que vai no texto: prefixo, traço e o código do canal. */
export function codigoDeOrigem(prefixo: string | null, codigo: string): string {
  return prefixo ? `${prefixo}-${codigo}` : codigo;
}

/** Link wa.me do canal: o texto-modelo com o código no lugar de {codigo}. */
export function linkWhatsAppDoCanal(
  canais: Pick<CanaisMarketing, "numeroE164" | "prefixo" | "textoModelo">,
  canal: Pick<CanalCaptacao, "codigo">,
): string | null {
  if (!canais.numeroE164 || !canais.textoModelo) return null;
  const texto = canais.textoModelo.replaceAll(
    "{codigo}",
    codigoDeOrigem(canais.prefixo, canal.codigo),
  );
  return montarLinkWhatsApp(canais.numeroE164, texto);
}

/** Endereço da página de captação do canal. */
export function linkDaPagina(enderecoBase: string, codigo: string): string {
  return `${enderecoBase}/c/${codigo.toLowerCase()}`;
}
