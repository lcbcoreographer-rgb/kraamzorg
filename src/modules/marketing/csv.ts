import type { LinhaExportacaoMarketing } from "@/lib/dados/tipos-relacao";

/**
 * CSV da exportação de marketing (P47). Separador ponto e vírgula e BOM, para
 * abrir direto no Excel em português. Célula que começa com =, +, - ou @ ganha
 * um apóstrofo na frente, para a planilha não executar fórmula.
 */
export const CABECALHO_CSV = [
  "Família",
  "Data provável do parto (estimativa)",
  "Gemelar",
  "Primeira gestação",
  "Origem",
  "Código do canal",
  "UTM",
  "Entrou em",
];

export function celulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

const simNao = (v: boolean | null) => (v === null ? "" : v ? "sim" : "não");

export function csvDaExportacao(linhas: LinhaExportacaoMarketing[]): string {
  const corpo = linhas.map((l) =>
    [
      l.nomeExibicao,
      l.dpp ?? "",
      simNao(l.gemelar),
      simNao(l.primeiraGestacao),
      l.origem,
      l.codigoOrigem ?? "",
      l.utm
        ? Object.entries(l.utm)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")
        : "",
      l.criadoEm.slice(0, 10),
    ]
      .map(celulaCsv)
      .join(";"),
  );
  return `﻿${[CABECALHO_CSV.map(celulaCsv).join(";"), ...corpo].join("\r\n")}\r\n`;
}
