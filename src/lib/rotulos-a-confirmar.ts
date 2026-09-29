/**
 * Rótulos de interface que a camada de acolhimento propõe trocar e que
 * dependem de quem decide (DESIGN.md, seção 11.13; voz.md, seções 5 e 7).
 * Cada entrada guarda o rótulo em uso e o proposto; a tela lê sempre por
 * `rotulo()`, e a troca vai ao ar mudando só `aprovado` para `true`, num
 * commit com o nome de quem aprovou. Enum e valor gravado no banco não
 * mudam (o modo `nao_lead` e o estágio `perdido` continuam os mesmos).
 */
export const ROTULOS_A_CONFIRMAR = {
  /** Transferência de perda ou estado sensível: o gesto é registrar o contato, não "resolver" o luto. */
  resolverSensivel: {
    atual: "Marcar como resolvida",
    proposto: "Registrar o contato com a família",
    aprovado: false,
    quem: "Leonardo e Edilaine",
  },
  /** Ação de triagem: "não lead" classifica uma pessoa pelo que ela não é para a venda. */
  marcarNaoLead: {
    atual: "Marcar como não lead",
    proposto: "Marcar como outro assunto",
    aprovado: false,
    quem: "Leonardo",
  },
  /** Situação e filtro de conversa com a mesma troca. */
  naoLead: {
    atual: "Não lead",
    proposto: "Outro assunto",
    aprovado: false,
    quem: "Leonardo",
  },
  /** Estágio `perdido` no pipeline: "perda" já nomeia a perda gestacional no mesmo sistema. */
  estagioPerdido: {
    atual: "Perdido",
    proposto: "Não seguiu",
    aprovado: false,
    quem: "Leonardo",
  },
  marcarPerdido: {
    atual: "Marcar como perdido",
    proposto: "Encerrar: não seguiu com a Kraamzorg",
    aprovado: false,
    quem: "Leonardo",
  },
  motivoPerda: {
    atual: "Motivo da perda",
    proposto: "Por que não seguiu",
    aprovado: false,
    quem: "Leonardo",
  },
} as const satisfies Record<
  string,
  { atual: string; proposto: string; aprovado: boolean; quem: string }
>;

export type ChaveRotuloAConfirmar = keyof typeof ROTULOS_A_CONFIRMAR;

/** O rótulo que vai para a tela: o proposto só depois da aprovação. */
export function rotulo(chave: ChaveRotuloAConfirmar): string {
  const item: { atual: string; proposto: string; aprovado: boolean } =
    ROTULOS_A_CONFIRMAR[chave];
  return item.aprovado ? item.proposto : item.atual;
}
