import { ROTULO_PAPEL_PESSOA } from "../pipeline/estagios";
import type { PapelPessoa } from "@/lib/dados/tipos";

/**
 * Rótulos que a ficha precisa e o pipeline (P15) já mantém: reaproveita em
 * vez de duplicar (`ROTULO_PAPEL_PESSOA`, PRD 13). O resto é próprio deste
 * módulo.
 */
export { ROTULO_PAPEL_PESSOA };

export function rotuloPapelPessoa(papel: PapelPessoa): string {
  return ROTULO_PAPEL_PESSOA[papel];
}

/**
 * `evento_familia.tipo` é texto livre (comentário da coluna na migration
 * 0003: "lead_entrou, estagio, pdf_enviado, sessao, contrato, ..."), sem
 * enum no banco. Aqui só troca o código por um rótulo mais claro quando a
 * tela reconhece o tipo; um tipo desconhecido mostra o título do evento sem
 * decoração, nunca quebra.
 */
export const ROTULO_TIPO_EVENTO: Record<string, string> = {
  entrada: "Entrada",
  lead_entrou: "Entrada",
  estagio: "Mudança de estágio",
  marco: "Marco comercial",
  pdf_enviado: "Apresentação enviada",
  sessao: "Sessão de venda",
  contrato: "Contrato",
  freio: "Freio",
  nao_contatar: "Não contatar",
  data_nascimento: "Nascimento registrado",
  data_alta: "Alta registrada",
  mesclagem: "Famílias unidas",
  outro: "Evento",
};

export function rotuloTipoEvento(tipo: string): string {
  return ROTULO_TIPO_EVENTO[tipo] ?? tipo;
}
