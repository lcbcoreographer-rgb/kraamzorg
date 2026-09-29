import Link from "next/link";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import type {
  ListaCobrancas,
  SituacaoCobranca,
} from "@/lib/dados/tipos-contrato";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { ROTULO_METODO, ROTULO_SITUACAO, VARIANTE_SITUACAO } from "../rotulos";

const FILTROS: { valor: SituacaoCobranca | undefined; rotulo: string }[] = [
  { valor: undefined, rotulo: "Todas" },
  { valor: "aberta", rotulo: "Em aberto" },
  { valor: "vencida", rotulo: "Vencidas" },
  { valor: "paga", rotulo: "Pagas" },
];

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Frase do resumo: número em frase, com comparação e sem painel de números soltos (voz.md, 5). */
export function fraseResumo(resumo: ListaCobrancas["resumo"]): string {
  const partes: string[] = [];
  const emAberto = resumo.abertas + resumo.vencidas;
  if (emAberto === 0) {
    partes.push("Nenhuma cobrança espera pagamento agora.");
  } else {
    partes.push(
      `${plural(emAberto, "cobrança espera", "cobranças esperam")} pagamento, somando ${formatarMoeda(resumo.aReceberCentavos)}.`,
    );
    if (resumo.vencidas > 0) {
      partes.push(`${plural(resumo.vencidas, "já venceu", "já venceram")}.`);
    }
  }
  if (resumo.pagas > 0) {
    partes.push(
      `${plural(resumo.pagas, "paga", "pagas")}, ${formatarMoeda(resumo.recebidoCentavos)} recebidos.`,
    );
  }
  return partes.join(" ");
}

export function ListaCobrancasTela({
  lista,
  situacao,
}: {
  lista: ListaCobrancas;
  situacao: SituacaoCobranca | undefined;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-corpo text-texto max-w-[60ch]">
        {fraseResumo(lista.resumo)}
      </p>

      <nav aria-label="Filtrar cobranças" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const ativo = f.valor === situacao;
          return (
            <Link
              key={f.rotulo}
              href={f.valor ? `/cobrancas?situacao=${f.valor}` : "/cobrancas"}
              aria-current={ativo ? "page" : undefined}
              className={
                ativo
                  ? "rounded-pilula bg-marinho text-texto-inverso min-h-toque text-apoio inline-flex items-center px-4 font-semibold no-underline"
                  : "rounded-pilula border-borda-campo bg-superficie text-texto hover:bg-marinho-08 min-h-toque text-apoio inline-flex items-center border-[1.5px] px-4 font-semibold no-underline"
              }
            >
              {f.rotulo}
            </Link>
          );
        })}
      </nav>

      {lista.cobrancas.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          titulo="Nenhuma cobrança neste filtro"
          texto="As cobranças nascem quando o contrato é assinado. Quando houver uma, ela aparece aqui com o link de pagamento e a situação."
        />
      ) : (
        <TabelaLista
          rotulo="Cobranças"
          colunas={[
            { chave: "familia", rotulo: "Família", principal: true },
            { chave: "situacao", rotulo: "Situação", canto: true },
            { chave: "valor", rotulo: "Valor", numerica: true },
            { chave: "vencimento", rotulo: "Vencimento" },
            { chave: "pagamento", rotulo: "Pagamento" },
          ]}
          linhas={lista.cobrancas.map((c) => ({
            id: c.id,
            valores: {
              familia: (
                <Link
                  href={`/cobrancas/${c.id}`}
                  className="text-texto font-semibold underline decoration-1 underline-offset-4"
                >
                  {c.familiaNome}
                </Link>
              ),
              situacao: (
                <Selo variante={VARIANTE_SITUACAO[c.situacao]}>
                  {ROTULO_SITUACAO[c.situacao]}
                </Selo>
              ),
              valor: formatarMoeda(c.valorCentavos),
              vencimento: formatarData(c.vencimento) ?? c.vencimento,
              pagamento:
                c.situacao === "paga"
                  ? [
                      c.pagoEm ? formatarData(c.pagoEm) : null,
                      c.metodo ? (ROTULO_METODO[c.metodo] ?? c.metodo) : null,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : c.temLink
                    ? "Link gerado"
                    : "Sem link ainda",
            },
          }))}
        />
      )}
    </div>
  );
}
