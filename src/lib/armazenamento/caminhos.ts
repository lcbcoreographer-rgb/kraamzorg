/**
 * Caminhos do armazenamento privado (CLAUDE.md: "nome de paciente nunca em
 * nome de arquivo, caminho de storage, URL, query string..."). Só existem
 * dois formatos, e os dois são montados a partir de ids:
 *
 * - contratos/<id do contrato>.pdf e contratos/<id do contrato>-assinado.pdf
 * - comprovantes/<id da cobrança>-<código>.<pdf|png|jpg|jpeg>
 *
 * O banco confere os mesmos formatos (0019_contrato_cobranca.sql); aqui a
 * checagem vem antes de qualquer gravação ou leitura no storage.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const RE_CONTRATO = new RegExp(`^contratos/${UUID}(-assinado)?\\.pdf$`);
const RE_COMPROVANTE = new RegExp(
  `^comprovantes/${UUID}-[a-z0-9]{8,32}\\.(pdf|png|jpg|jpeg)$`,
);

export type ExtensaoComprovante = "pdf" | "png" | "jpg";

export function caminhoContrato(contratoId: string, assinado: boolean): string {
  return `contratos/${contratoId}${assinado ? "-assinado" : ""}.pdf`;
}

export function caminhoComprovante(
  cobrancaId: string,
  extensao: ExtensaoComprovante,
  codigo: string,
): string {
  return `comprovantes/${cobrancaId}-${codigo}.${extensao}`;
}

/** Código aleatório de 16 caracteres [a-z0-9] para o nome do comprovante. */
export function codigoAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export function caminhoValido(caminho: string): boolean {
  return RE_CONTRATO.test(caminho) || RE_COMPROVANTE.test(caminho);
}

export function ehComprovante(caminho: string): boolean {
  return RE_COMPROVANTE.test(caminho);
}

/** Tipo do arquivo pelos primeiros bytes (a extensão e o tipo do navegador não bastam). */
export function tipoDoArquivo(
  bytes: Uint8Array,
): { extensao: ExtensaoComprovante; contentType: string } | null {
  if (
    bytes.length > 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { extensao: "pdf", contentType: "application/pdf" };
  }
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { extensao: "png", contentType: "image/png" };
  }
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extensao: "jpg", contentType: "image/jpeg" };
  }
  return null;
}
