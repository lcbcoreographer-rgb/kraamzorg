/**
 * Cumprimento do topo das telas de abertura (DESIGN.md, 2.2 e 2.13;
 * referência: "Hi, Elizabeth" no app de estudos). Pelo primeiro nome e
 * pela hora de Brasília: "Bom dia" até 11:59, "Boa tarde" até 17:59,
 * "Boa noite" depois. Sem exclamação e sem emoji (voz.md).
 */
export function horaEmBrasilia(agora: Date): number {
  const hora = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hourCycle: "h23",
  }).format(agora);
  return Number(hora);
}

export function cumprimentoDoHorario(agora: Date): string {
  const hora = horaEmBrasilia(agora);
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** "Talita" de "Talita Moreno"; nome vazio vira null. */
export function primeiroNome(nome: string | null | undefined): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return primeiro ? primeiro : null;
}

/** "Bom dia, Talita" ou só "Bom dia" quando não há nome. */
export function saudacao(
  nome: string | null | undefined,
  agora: Date = new Date(),
): string {
  const quem = primeiroNome(nome);
  const cumprimento = cumprimentoDoHorario(agora);
  return quem ? `${cumprimento}, ${quem}` : cumprimento;
}
