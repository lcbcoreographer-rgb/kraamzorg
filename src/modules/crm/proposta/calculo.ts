import type {
  CondicaoProposta,
  ContaProposta,
  PacoteProposta,
} from "@/lib/dados/tipos-venda";

/**
 * Conta da proposta em centavos, espelho de privado.venda_conta e
 * privado.venda_calcular (0018_venda.sql). Serve para a tela mostrar o
 * resumo enquanto o comercial escolhe; o valor que vale é o que o banco
 * calcula ao salvar (api.salvar_proposta nunca recebe valor do navegador).
 * Os dois testes (calculo.test.ts e supabase/tests/018_venda.sql) conferem
 * os mesmos números.
 *
 * Regras: o desconto incide sobre o valor do pacote, arredondado ao
 * centavo; a taxa de deslocamento entra depois; a parcela é o total
 * dividido pelas parcelas, para baixo, e o resto vai na primeira.
 */
export function contaDaProposta(
  valorCentavos: number,
  taxaCentavos: number,
  descontoCentavos: number,
  parcelas: number,
): ContaProposta {
  const total = valorCentavos - descontoCentavos + taxaCentavos;
  const quantas = Math.max(Math.trunc(parcelas) || 1, 1);
  const parcela = Math.trunc(total / quantas);
  return {
    valorCentavos,
    taxaCentavos,
    descontoCentavos,
    totalCentavos: total,
    parcelas: quantas,
    parcelaCentavos: parcela,
    primeiraParcelaCentavos: parcela + (total - parcela * quantas),
  };
}

/** Desconto percentual sobre o pacote, arredondado como o round do Postgres. */
export function descontoPorPercentual(
  valorCentavos: number,
  percentual: number,
): number {
  const bruto = (valorCentavos * percentual) / 100;
  // round do Postgres para numeric: meio para longe do zero.
  return Math.sign(bruto) * Math.round(Math.abs(bruto));
}

export interface EscolhaProposta {
  pacote: PacoteProposta | null;
  condicao: CondicaoProposta | null;
  parcelas: number;
  /** Desconto manual, fora da tabela (só sem condição de desconto). */
  descontoPct: number;
  taxaCentavos: number;
}

/** Percentual que vale: o da condição de desconto, ou o manual. */
export function percentualDaEscolha(escolha: EscolhaProposta): number {
  if (escolha.condicao?.tipo === "desconto_pct") return escolha.condicao.valor;
  return escolha.descontoPct;
}

/** Até quantas parcelas a escolha permite (pacote ou condição de parcelamento). */
export function parcelasMaximas(escolha: EscolhaProposta): number {
  const base = escolha.pacote?.parcelasMaxSemJuros ?? 1;
  if (escolha.condicao?.tipo === "parcelamento") {
    return Math.max(base, Math.trunc(escolha.condicao.valor));
  }
  return base;
}

/** A escolha pede aprovação registrada da diretoria (C-04, C-05)? */
export function precisaAprovacao(escolha: EscolhaProposta): boolean {
  return (
    Boolean(escolha.condicao?.requerAprovacao) ||
    (escolha.condicao?.tipo !== "desconto_pct" && escolha.descontoPct > 0)
  );
}

export function contaDaEscolha(escolha: EscolhaProposta): ContaProposta | null {
  if (!escolha.pacote) return null;
  const valor = escolha.pacote.valorCentavos;
  return contaDaProposta(
    valor,
    escolha.taxaCentavos,
    descontoPorPercentual(valor, percentualDaEscolha(escolha)),
    escolha.parcelas,
  );
}
