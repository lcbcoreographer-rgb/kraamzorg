/**
 * Guarda contra dado pessoal no assunto de e-mail (CLAUDE.md, "Nome de
 * paciente nunca em... assunto de e-mail"). Comparação sem acento e sem
 * caixa, porque "María" e "MARIA" são o mesmo problema.
 */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export class AssuntoComDadoPessoalError extends Error {
  constructor(termo: string) {
    super(
      `E-mail recusado: o assunto contém um termo proibido ("${termo}"). ` +
        "Assunto de e-mail nunca leva nome de paciente (CLAUDE.md).",
    );
    this.name = "AssuntoComDadoPessoalError";
  }
}

export function garantirAssuntoSemDadoPessoal(
  assunto: string,
  termosProibidos: string[] = [],
): void {
  const assuntoNormalizado = normalizar(assunto);
  for (const termo of termosProibidos) {
    const termoNormalizado = normalizar(termo);
    if (
      termoNormalizado.length > 0 &&
      assuntoNormalizado.includes(termoNormalizado)
    ) {
      throw new AssuntoComDadoPessoalError(termo);
    }
  }
}
