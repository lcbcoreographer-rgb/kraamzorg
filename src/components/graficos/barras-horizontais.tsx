import { cn } from "@/lib/utils";

/**
 * Barras horizontais (skill dataviz): uma série, uma cor, o valor na ponta da
 * barra, rótulo em texto (nunca na cor da barra), barra de 12 px com a
 * ponta em pílula e a base reta [v4.4]. Serve a comparação de magnitude
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
    // Container query: numa coluna estreita (menos de 28rem) o rótulo e o
    // valor ficam em cima e a barra ganha a largura toda, embaixo.
    <ul
      aria-label={descricao}
      className={cn("@container flex flex-col gap-3", className)}
    >
      {dados.map((d) => {
        const largura = maior > 0 ? (d.valor / maior) * 100 : 0;
        return (
          <li
            key={d.id}
            className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 @max-md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <span className="text-apoio text-texto">
              {d.rotulo}
              {d.apoio ? (
                <span className="text-mini text-texto-2 block">{d.apoio}</span>
              ) : null}
            </span>
            {/* Trilha areia e barra marinho com a ponta em pílula (direção
                "Colo", DESIGN.md 2.4); a base continua reta, no zero. */}
            <span
              aria-hidden="true"
              className="bg-areia-clara rounded-r-pilula h-3 w-full @max-md:order-3 @max-md:col-span-2"
            >
              <span
                className="bg-marinho rounded-r-pilula block h-3"
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
