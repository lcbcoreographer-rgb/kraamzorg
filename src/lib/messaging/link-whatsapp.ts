/**
 * Link `wa.me` com texto pré-preenchido (canal manual, PRD 23.2). Só monta
 * a URL; a pessoa ainda toca em enviar dentro do próprio WhatsApp, então
 * isto nunca é "envio" de verdade (D-08: sem API oficial, sem disparo
 * automático para a família fora do que a UAZAPI permite).
 */
export function digitosTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * `null` quando não sobra dígito suficiente para um número de WhatsApp
 * (evita gerar link quebrado; a tela decide o que mostrar no lugar).
 */
export function montarLinkWhatsApp(
  telefoneE164: string,
  texto: string,
): string | null {
  const digitos = digitosTelefone(telefoneE164);
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
