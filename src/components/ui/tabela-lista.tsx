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
    <table className={cn("text-apoio w-full border-collapse", className)}>
      <caption className="sr-only">{rotulo}</caption>
      <thead className="max-[719px]:sr-only">
        <tr>
          {colunas.map((coluna) => (
            <th
              key={coluna.chave}
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
      <tbody>
        {linhas.map((linha) => (
          <tr
            key={linha.id}
            className={cn(
              "border-linha ease-estado min-[720px]:hover:bg-marinho-08 border-b transition-colors duration-140",
              "max-[719px]:rounded-3 max-[719px]:bg-superficie max-[719px]:shadow-1 max-[719px]:mb-3 max-[719px]:grid max-[719px]:grid-cols-[minmax(0,1fr)_auto] max-[719px]:gap-x-3 max-[719px]:gap-y-1 max-[719px]:border-0 max-[719px]:p-4",
            )}
          >
            {colunas.map((coluna) => (
              <td
                key={coluna.chave}
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
                  <span className="text-texto-2 min-[720px]:hidden">
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
