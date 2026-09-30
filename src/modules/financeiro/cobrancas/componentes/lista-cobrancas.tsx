import Link from "next/link";
import { CircleCheck, Hourglass } from "lucide-react";
import { FiltroPilula } from "@/components/blocos/filtro-pilula";
import { FolhaLupa } from "@/components/ilustracoes";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
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

function contagemDoFiltro(
  resumo: ListaCobrancas["resumo"],
  valor: SituacaoCobranca | undefined,
): number {
  if (valor === "aberta") return resumo.abertas;
  if (valor === "vencida") return resumo.vencidas;
  if (valor === "paga") return resumo.pagas;
  return resumo.abertas + resumo.vencidas + resumo.pagas;
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
      <p className="text-3 text-texto max-w-[60ch]">
        {fraseResumo(lista.resumo)}
      </p>

      {/* Os dois números do caixa (DESIGN.md, 2.6): o que falta receber é
          o agora (dourado), o que já entrou é o feito (sálvia). O valor em
          Jost, grande, com a contagem em frase embaixo. */}
      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-2 lg:max-w-[720px] lg:gap-3">
        <CartaoResumo
          tom="dourado"
          arranjo="linha"
          icone={<Hourglass />}
          valor={formatarMoeda(lista.resumo.aReceberCentavos)}
          rotulo="a receber"
          contexto={
            lista.resumo.abertas + lista.resumo.vencidas === 0
              ? "nenhuma cobrança em aberto"
              : `${plural(lista.resumo.abertas + lista.resumo.vencidas, "cobrança em aberto", "cobranças em aberto")}${lista.resumo.vencidas > 0 ? `, ${plural(lista.resumo.vencidas, "vencida", "vencidas")}` : ""}`
          }
        />
        <CartaoResumo
          tom="salvia"
          arranjo="linha"
          icone={<CircleCheck />}
          valor={formatarMoeda(lista.resumo.recebidoCentavos)}
          rotulo="recebido"
          contexto={
            lista.resumo.pagas === 0
              ? "nenhuma paga ainda"
              : plural(lista.resumo.pagas, "cobrança paga", "cobranças pagas")
          }
        />
      </div>

      <FiltroPilula
        rotulo="Filtrar cobranças"
        itens={FILTROS.map((f) => ({
          rotulo: f.rotulo,
          href: f.valor ? `/cobrancas?situacao=${f.valor}` : "/cobrancas",
          ativo: f.valor === situacao,
          contagem: contagemDoFiltro(lista.resumo, f.valor),
        }))}
      />

      {lista.cobrancas.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={<FolhaLupa tamanho={104} />}
          titulo="Nenhuma cobrança neste filtro"
          texto="As cobranças nascem quando o contrato é assinado. Quando houver uma, ela aparece aqui com o link de pagamento e a situação."
        />
      ) : (
        <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 min-[720px]:p-2 lg:px-4 lg:py-3">
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
        </div>
      )}
    </div>
  );
}
