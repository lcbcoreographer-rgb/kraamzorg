import Link from "next/link";
import { FileCheck, FileClock } from "lucide-react";
import { FiltroPilula } from "@/components/blocos/filtro-pilula";
import { FolhaLupa } from "@/components/ilustracoes";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import type { EstadoNota, ListaNotas } from "@/lib/dados/tipos-nota";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { FILTROS_NOTA, ROTULO_ESTADO, VARIANTE_ESTADO } from "../rotulos";

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Frase do resumo: número em frase, sem painel de números soltos (voz.md 5). */
export function fraseResumoNotas(resumo: ListaNotas["resumo"]): string {
  const partes: string[] = [];
  const aEmitir = resumo.pendentes + resumo.comErro;
  if (aEmitir === 0) {
    partes.push("Nenhuma nota espera emissão agora.");
  } else {
    partes.push(`${plural(aEmitir, "nota espera", "notas esperam")} emissão.`);
    if (resumo.comErro > 0) {
      partes.push(
        `${plural(resumo.comErro, "voltou com erro", "voltaram com erro")}, com o motivo na nota.`,
      );
    }
  }
  if (resumo.processando > 0) {
    partes.push(
      `${plural(resumo.processando, "está", "estão")} em processamento no provedor.`,
    );
  }
  if (resumo.emitidas > 0) {
    partes.push(`${plural(resumo.emitidas, "emitida", "emitidas")}.`);
  }
  return partes.join(" ");
}

export function ListaNotasTela({
  lista,
  estado,
}: {
  lista: ListaNotas;
  estado: EstadoNota | undefined;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-3 text-texto max-w-[60ch]">
        {fraseResumoNotas(lista.resumo)}
      </p>

      {/* O que pede o financeiro agora (dourado) e o que já foi emitido
          (sálvia), em número grande com a frase embaixo (DESIGN.md, 2.6).
          Erro e processamento continuam no selo de cada nota. */}
      <div className="tablet:grid-cols-2 grid grid-cols-1 gap-2 lg:max-w-[720px] lg:gap-3">
        <CartaoResumo
          tom="dourado"
          arranjo="linha"
          icone={<FileClock />}
          valor={lista.resumo.pendentes + lista.resumo.comErro}
          rotulo={
            lista.resumo.pendentes + lista.resumo.comErro === 1
              ? "nota para emitir"
              : "notas para emitir"
          }
          contexto={
            lista.resumo.comErro > 0
              ? `${lista.resumo.comErro} com erro, com o motivo na nota`
              : "nenhuma com erro"
          }
        />
        <CartaoResumo
          tom="salvia"
          arranjo="linha"
          icone={<FileCheck />}
          valor={lista.resumo.emitidas}
          rotulo={lista.resumo.emitidas === 1 ? "emitida" : "emitidas"}
          contexto={
            lista.resumo.processando > 0
              ? `${lista.resumo.processando} ainda no provedor`
              : "nenhuma esperando o provedor"
          }
        />
      </div>

      <p className="text-apoio text-texto-2 max-w-[60ch]">
        {lista.emissaoAutomatica
          ? "A emissão automática está ligada: o sistema pede a nota ao provedor depois do pagamento confirmado."
          : "A emissão é manual: o financeiro, com a contadora, emite no portal do provedor e registra o número aqui."}
      </p>

      <FiltroPilula
        rotulo="Filtrar notas"
        itens={FILTROS_NOTA.map((f) => ({
          rotulo: f.rotulo,
          href: f.valor ? `/notas?situacao=${f.valor}` : "/notas",
          ativo: f.valor === estado,
        }))}
      />

      {lista.notas.length === 0 ? (
        <EstadoVazio
          nivelTitulo="h2"
          ilustracao={<FolhaLupa tamanho={104} />}
          titulo={estado ? "Nenhuma nota neste filtro" : "Nenhuma nota ainda"}
          texto="Quando uma cobrança é paga, a nota fiscal dela aparece aqui para emitir. Depois de emitida, o número e os arquivos ficam guardados."
        />
      ) : (
        <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 min-[720px]:p-2 lg:px-4 lg:py-3">
          <TabelaLista
            rotulo="Notas fiscais"
            colunas={[
              { chave: "familia", rotulo: "Família", principal: true },
              { chave: "estado", rotulo: "Situação", canto: true },
              { chave: "tomador", rotulo: "Quem paga" },
              { chave: "parcela", rotulo: "Parcela" },
              { chave: "valor", rotulo: "Valor", numerica: true },
              { chave: "pago", rotulo: "Pago em" },
              { chave: "numero", rotulo: "Número da nota" },
            ]}
            linhas={lista.notas.map((n) => ({
              id: n.id,
              valores: {
                familia: (
                  <Link
                    href={`/notas/${n.id}`}
                    className="text-texto font-semibold underline-offset-4 hover:underline"
                  >
                    {n.familiaNome}
                  </Link>
                ),
                estado: (
                  <Selo variante={VARIANTE_ESTADO[n.status]}>
                    {ROTULO_ESTADO[n.status]}
                  </Selo>
                ),
                tomador: n.tomadorNome ?? "Sem pagador",
                parcela: `Parcela ${n.parcela}`,
                valor: formatarMoeda(n.valorCentavos),
                pago: n.pagoEm ? formatarData(n.pagoEm) : "Sem data",
                numero: n.numero ? (
                  <span className="font-mono">{n.numero}</span>
                ) : (
                  "Ainda sem número"
                ),
              },
            }))}
          />
        </div>
      )}
    </div>
  );
}
