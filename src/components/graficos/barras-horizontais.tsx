import { cn } from "@/lib/utils";

/**
 * Barras horizontais (skill dataviz): uma série, uma cor, o valor na ponta da
 * barra, rótulo em texto (nunca na cor da barra), barra de até 12 px com a
 * ponta de 4 px arredondada e a base reta. Serve a comparação de magnitude
 * entre poucas categorias (despesas por categoria, leads por origem, receita
 * por origem, faixas de atraso). Com mais de oito categorias, use uma tabela.
 */
export interface DadoBarra {
  id: string;
  rotulo: string;
  valor: number;
  /** Valor já formatado, escrito na ponta da barra. */
  valorTexto: string;
  /** Segunda linha, em texto de apoio (ex: "3 cobranças"). */
  apoio?: string;
}

export function BarrasHorizontais({
  dados,
  descricao,
  className,
}: {
  dados: DadoBarra[];
  /** Frase que diz o que o gráfico mostra (leitor de tela). */
  descricao: string;
  className?: string;
}) {
  const maior = Math.max(...dados.map((d) => d.valor), 0);
  return (
    <ul aria-label={descricao} className={cn("flex flex-col gap-3", className)}>
      {dados.map((d) => {
        const largura = maior > 0 ? (d.valor / maior) * 100 : 0;
        return (
          <li
            key={d.id}
            className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 max-[520px]:grid-cols-[minmax(0,1fr)_auto]"
          >
            <span className="text-apoio text-texto">
              {d.rotulo}
              {d.apoio ? (
                <span className="text-mini text-texto-2 block">{d.apoio}</span>
              ) : null}
            </span>
            <span
              aria-hidden="true"
              className="bg-marinho-08 h-3 w-full rounded-r-[4px] max-[520px]:order-3 max-[520px]:col-span-2"
            >
              <span
                className="bg-marinho-50 block h-3 rounded-r-[4px]"
                style={{
                  width: `${Math.max(largura, d.valor > 0 ? 1.5 : 0)}%`,
                }}
              />
            </span>
            <span className="text-dado text-texto text-right font-mono">
              {d.valorTexto}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
