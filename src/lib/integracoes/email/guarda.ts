/**
 * Guarda contra dado pessoal no assunto e no nome de anexo de e-mail
 * (CLAUDE.md: "Nome de paciente nunca em nome de arquivo... assunto de
 * e-mail... ou log").
 *
 * Recusa quando o texto contém:
 * - um dos nomes informados por quem chama (nome completo ou qualquer parte
 *   do nome com 3 letras ou mais que comece com maiúscula, porque "Evolução
 *   de Maria" vaza tanto quanto "Evolução de Maria da Silva"), comparado
 *   sem acento, sem caixa e por palavra inteira;
 * - no assunto, também algo com forma de CPF, telefone ou e-mail.
 *
 * A mensagem de erro nunca repete o termo encontrado: ela pode ir para log.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Números soltos (não colados a letra, dígito ou hífen, para um id em
// hexadecimal nunca parecer CPF ou telefone).
const PADRAO_CPF = /(?<![\p{L}\d-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\p{L}\d-])/u;
const PADRAO_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Oito dígitos ou mais, com ou sem separadores de telefone.
const PADRAO_TELEFONE =
  /(?<![\p{L}\d-])\+?\d(?:[\s().-]*\d){7,}(?![\p{L}\d-])/u;

export class AssuntoComDadoPessoalError extends Error {
  constructor(onde: string) {
    super(
      `E-mail recusado: ${onde} contém dado pessoal (nome, CPF, telefone ou ` +
        "e-mail). Assunto e nome de anexo nunca levam dado de paciente.",
    );
    this.name = "AssuntoComDadoPessoalError";
  }
}

function termosDoNome(nome: string): string[] {
  const termos = [nome];
  for (const parte of nome.split(/\s+/)) {
    const letras = parte.replace(/[^\p{L}]/gu, "");
    if (letras.length >= 3 && /^\p{Lu}/u.test(letras)) termos.push(letras);
  }
  return termos;
}

function contemContato(texto: string): boolean {
  return (
    PADRAO_CPF.test(texto) ||
    PADRAO_EMAIL.test(texto) ||
    PADRAO_TELEFONE.test(texto)
  );
}

function contemNome(texto: string, nomesProibidos: readonly string[]): boolean {
  const textoNormalizado = normalizar(texto);
  for (const nome of nomesProibidos) {
    for (const termo of termosDoNome(nome)) {
      const termoNormalizado = normalizar(termo);
      if (!termoNormalizado) continue;
      const regex = new RegExp(
        `(^|[^a-z0-9])${escaparRegex(termoNormalizado)}($|[^a-z0-9])`,
      );
      if (regex.test(textoNormalizado)) return true;
    }
  }
  return false;
}

export function contemDadoPessoal(
  texto: string,
  nomesProibidos: readonly string[],
): boolean {
  return contemContato(texto) || contemNome(texto, nomesProibidos);
}

export function garantirAssuntoSemDadoPessoal(
  assunto: string,
  nomesProibidos: readonly string[],
): void {
  if (contemDadoPessoal(assunto, nomesProibidos)) {
    throw new AssuntoComDadoPessoalError("o assunto");
  }
}

export function garantirNomeArquivoSemDadoPessoal(
  nomeArquivo: string,
  nomesProibidos: readonly string[],
): void {
  // Separadores comuns de nome de arquivo viram espaço antes da checagem
  // ("evolucao-maria-silva.pdf" também é nome de paciente). Aqui só nomes:
  // arquivo nomeado por id (a regra do CLAUDE.md) tem dígitos de sobra.
  const legivel = nomeArquivo.replace(/[-_.]+/g, " ");
  if (contemNome(legivel, nomesProibidos)) {
    throw new AssuntoComDadoPessoalError("o nome do anexo");
  }
}
