import type { ContaProposta } from "@/lib/dados/tipos-venda";
import { formatarMoeda } from "@/lib/formatacao";
import { cn } from "@/lib/utils";

/**
 * Régua fina: um bloco por dia do pacote ou por parcela, a mesma forma da
 * régua de dias (DESIGN.md 11.10, forma-assinatura). Decorativa: a frase
 * ao lado diz o número.
 */
export function ReguaFina({
  total,
  preenchida,
}: {
  total: number;
  preenchida: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid w-full gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: Math.max(total, 1) }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-pilula h-2",
            preenchida ? "bg-marinho" : "border-marinho-50 border",
          )}
        />
      ))}
    </span>
  );
}

export function fraseParcelas(conta: ContaProposta): string {
  if (conta.parcelas === 1) return "À vista.";
  if (conta.primeiraParcelaCentavos !== conta.parcelaCentavos) {
    return `${conta.parcelas} parcelas de ${formatarMoeda(conta.parcelaCentavos)}; a primeira fica em ${formatarMoeda(conta.primeiraParcelaCentavos)} por causa dos centavos.`;
  }
  return `${conta.parcelas} parcelas de ${formatarMoeda(conta.parcelaCentavos)}, sem juros.`;
}

/**
 * O recibo da proposta: pacote, desconto, deslocamento, total em mono e as
 * parcelas em blocos. Serve à proposta em edição (conta refeita no
 * navegador) e à fechada (conta que o banco gravou).
 */
export function ReciboConta({
  conta,
  nomePacote,
  percentualDesconto,
  cidade,
}: {
  conta: ContaProposta;
  nomePacote: string;
  percentualDesconto: number | null;
  cidade: string | null;
}) {
  return (
    <>
      <dl className="text-corpo grid grid-cols-[minmax(0,1fr)_auto] gap-y-2">
        <dt className="text-texto">{nomePacote}</dt>
        <dd className="text-texto pl-4 text-right font-mono tabular-nums">
          {formatarMoeda(conta.valorCentavos)}
        </dd>
        {conta.descontoCentavos > 0 ? (
          <>
            <dt className="text-texto-2">
              {percentualDesconto
                ? `Desconto de ${String(percentualDesconto).replace(".", ",")}%`
                : "Desconto"}
            </dt>
            <dd className="text-texto-2 pl-4 text-right font-mono tabular-nums">
              {formatarMoeda(-conta.descontoCentavos)}
            </dd>
          </>
        ) : null}
        {conta.taxaCentavos > 0 ? (
          <>
            <dt className="text-texto-2">
              Deslocamento{cidade ? ` para ${cidade}` : ""}
            </dt>
            <dd className="text-texto-2 pl-4 text-right font-mono tabular-nums">
              {formatarMoeda(conta.taxaCentavos)}
            </dd>
          </>
        ) : null}
        <dt className="text-texto border-linha border-t pt-2 font-semibold">
          Total
        </dt>
        <dd className="text-texto text-dado-lg border-linha border-t pt-2 pl-4 text-right font-mono font-semibold tabular-nums">
          {formatarMoeda(conta.totalCentavos)}
        </dd>
      </dl>
      <div className="flex flex-col gap-2">
        <ReguaFina total={conta.parcelas} preenchida />
        <p className="text-apoio text-texto-2">{fraseParcelas(conta)}</p>
      </div>
    </>
  );
}
