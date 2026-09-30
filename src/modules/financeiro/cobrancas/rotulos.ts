import type { SituacaoCobranca } from "@/lib/dados/tipos-contrato";

/** Rótulos e cores de selo das situações da cobrança. */
export const ROTULO_SITUACAO: Record<SituacaoCobranca, string> = {
  aberta: "Aguardando o pagamento",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

export const VARIANTE_SITUACAO: Record<
  SituacaoCobranca,
  "aviso" | "alerta" | "sucesso" | "neutro"
> = {
  aberta: "aviso",
  vencida: "alerta",
  paga: "sucesso",
  cancelada: "neutro",
  estornada: "neutro",
};

export const ROTULO_METODO: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
};

export const ROTULO_NOTA: Record<string, string> = {
  pendente: "Nota fiscal pendente",
  processando: "Nota fiscal em emissão",
  emitida: "Nota fiscal emitida",
  erro: "Nota fiscal com erro",
  cancelada: "Nota fiscal cancelada",
};
