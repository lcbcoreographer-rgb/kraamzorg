import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabela que vira lista (DESIGN.md, seção 6). No computador, tabela com
 * hairline entre linhas, número à direita em mono. Abaixo de 720 px, cada
 * linha vira cartão: coluna `principal` em destaque, `canto` no canto
 * superior direito (selo de estado), as demais como "Rótulo valor". A
 * tabela semântica continua no DOM nos dois tamanhos: só a apresentação
 * muda, então quem usa leitor de tela sempre ouve uma tabela de verdade.
 */
export interface ColunaTabela {
  chave: string;
  rotulo: string;
  numerica?: boolean;
  alinhamento?: "esquerda" | "direita";
  /** Coluna de destaque no cartão do celular (ex: nome). Uma por tabela. */
  principal?: boolean;
  /** Coluna que vai para o canto superior direito do cartão (ex: selo). */
  canto?: boolean;
}

export interface LinhaTabela {
  id: string;
  valores: Record<string, React.ReactNode>;
}

export interface TabelaListaProps {
  /** Legenda acessível da tabela (não aparece visualmente). */
  rotulo: string;
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  className?: string;
}

export function TabelaLista({
  rotulo,
  colunas,
  linhas,
  className,
}: TabelaListaProps) {
  return (
    <table
      role="table"
      className={cn("text-apoio w-full border-collapse", className)}
    >
      <caption className="sr-only">{rotulo}</caption>
      <thead role="rowgroup" className="max-[719px]:sr-only">
        <tr role="row">
          {colunas.map((coluna) => (
            <th
              key={coluna.chave}
              role="columnheader"
              scope="col"
              className={cn(
                "border-linha text-texto-2 border-b px-3 py-2 text-left font-medium whitespace-nowrap",
                (coluna.alinhamento === "direita" || coluna.numerica) &&
                  "text-right",
              )}
            >
              {coluna.rotulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {linhas.map((linha) => (
          <tr
            key={linha.id}
            role="row"
            className={cn(
              "border-linha ease-estado min-[720px]:hover:bg-marinho-08 border-b transition-colors duration-140",
              "max-[719px]:rounded-3 max-[719px]:bg-superficie max-[719px]:shadow-1 max-[719px]:mb-3 max-[719px]:grid max-[719px]:grid-cols-[minmax(0,1fr)_auto] max-[719px]:gap-x-3 max-[719px]:gap-y-1 max-[719px]:border-0 max-[719px]:p-4",
            )}
          >
            {colunas.map((coluna) => (
              <td
                key={coluna.chave}
                role="cell"
                className={cn(
                  "h-12 px-3 align-middle",
                  (coluna.alinhamento === "direita" || coluna.numerica) &&
                    "text-right",
                  coluna.numerica && "font-mono tabular-nums",
                  "max-[719px]:block max-[719px]:h-auto max-[719px]:p-0 max-[719px]:text-left",
                  coluna.principal &&
                    "max-[719px]:text-corpo max-[719px]:font-semibold",
                  coluna.canto &&
                    "max-[719px]:col-start-2 max-[719px]:row-start-1 max-[719px]:self-start",
                  !coluna.principal &&
                    !coluna.canto &&
                    "max-[719px]:col-span-2",
                )}
              >
                {!coluna.principal && !coluna.canto ? (
                  // sr-only no computador não muda nada (o cabeçalho real já
                  // está visível); no celular, sem aria-hidden, o leitor de
                  // tela lia o rótulo duas vezes: uma vez aqui, outra no
                  // cabeçalho sr-only da tabela (achado da auditoria da P10
                  // parcial). font-sans porque o rótulo não é dado: sem
                  // isto, herdava o font-mono da coluna numérica.
                  <span
                    aria-hidden="true"
                    className="text-texto-2 font-sans min-[720px]:hidden"
                  >
                    {coluna.rotulo}{" "}
                  </span>
                ) : null}
                {linha.valores[coluna.chave]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
