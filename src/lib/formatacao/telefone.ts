/**
 * Telefone é gravado sempre em E.164 (PRD 5, "+5511..."). Este formatador só
 * exibe o número brasileiro por extenso; nunca grava nem valida no sentido
 * de negócio (isso é regra de cadastro, não de formatação).
 *
 * Número que não bate com o formato brasileiro volta como recebido, sem
 * inventar máscara para um formato que não reconhece.
 */
const TELEFONE_BR = /^\+55(\d{2})(\d{8,9})$/;

export function formatarTelefone(e164: string): string {
  const valor = e164.trim();
  const casa = TELEFONE_BR.exec(valor);
  if (!casa) {
    return valor;
  }

  const ddd = casa[1] ?? "";
  const numero = casa[2] ?? "";
  const quebra = numero.length === 9 ? 5 : 4;
  const inicio = numero.slice(0, quebra);
  const fim = numero.slice(quebra);
  return `+55 (${ddd}) ${inicio}-${fim}`;
}
