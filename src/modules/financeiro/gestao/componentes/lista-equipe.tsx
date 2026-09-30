import type * as React from "react";
import { CircleCheck, Lock, UserRound, Wallet } from "lucide-react";
import { SecaoBloco } from "@/components/blocos/secao-bloco";
import { MantaDobrada } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";
import { cn } from "@/lib/utils";
import { Selo } from "@/components/ui/selo";
import type {
  PagamentoEquipe,
  PagamentosEquipe,
} from "@/lib/dados/tipos-gestao";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { formatarDecimal, rotuloMes } from "@/lib/gestao/formato";
import { plural, ROTULO_STATUS_PAGAMENTO, TEXTO_BLOQUEIO } from "../textos";
import { PagarEquipe } from "./pagar-equipe";

/** Frase de abertura da tela de pagamento da equipe. */
export function fraseEquipe(p: PagamentosEquipe): string {
  const r = p.resumo;
  if (p.pagamentos.length === 0) {
    return "Ainda não há visita realizada para gerar pagamento.";
  }
  const partes: string[] = [];
  if (r.liberadoQtd > 0) {
    partes.push(
      `${plural(r.liberadoQtd, "pagamento liberado", "pagamentos liberados")}, ${formatarMoeda(r.liberadoCentavos)}`,
    );
  }
  if (r.bloqueadoQtd > 0) {
    partes.push(
      `${plural(r.bloqueadoQtd, "pagamento bloqueado", "pagamentos bloqueados")}, ${formatarMoeda(r.bloqueadoCentavos)}`,
    );
  }
  partes.push(
    `${formatarMoeda(r.pagoNoMesCentavos)} pagos em ${rotuloMes(r.mes)}`,
  );
  return `${partes.join("; ")}.`;
}

const VARIANTE = {
  bloqueado: "aviso",
  liberado: "sucesso",
  pago: "neutro",
} as const;

function Conta({ p }: { p: PagamentoEquipe }) {
  const horasPorVisita = p.visitas > 0 ? p.horas / p.visitas : 0;
  return (
    <p className="text-apoio text-texto-2 max-w-[62ch]">
      {plural(p.visitas, "visita", "visitas")} de{" "}
      {formatarDecimal(horasPorVisita)}{" "}
      {horasPorVisita === 1 ? "hora" : "horas"}: {formatarDecimal(p.horas)}{" "}
      {p.horas === 1 ? "hora" : "horas"}
      {p.valorHoraCentavos !== null
        ? ` a ${formatarMoeda(p.valorHoraCentavos)} = ${formatarMoeda(p.valorHorasCentavos)}`
        : ""}
      {p.ajudaDeslocamentoCentavos > 0
        ? `, mais ${formatarMoeda(p.ajudaDeslocamentoCentavos)} de ajuda de deslocamento`
        : ""}
      .
    </p>
  );
}

/**
 * Pagamento da equipe (P46 item 3): horas por visita vezes o valor da hora,
 * mais a ajuda de deslocamento, liberado só depois do envio das evoluções aos
 * médicos. Bloqueado diz o que falta; liberado pede o dia do pagamento.
 */
export function ListaEquipe({
  dados,
  hoje,
}: {
  dados: PagamentosEquipe;
  hoje: string;
}) {
  if (dados.pagamentos.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        ilustracao={<MantaDobrada tamanho={104} />}
        titulo="Nenhum pagamento por enquanto"
        texto="Os pagamentos nascem das visitas realizadas. Quando a primeira visita for concluída, a profissional aparece aqui, bloqueada até o envio das evoluções aos médicos."
      />
    );
  }
  // Três blocos pela situação (DESIGN.md, 6.1): o que dá para pagar agora
  // vem primeiro (dourado, o agora), depois o que espera as evoluções e, no
  // fim, o que já foi pago (sálvia, o feito). Cada pagamento é um cartão
  // com a pessoa num tile e o valor em número grande.
  return (
    <div className="flex flex-col gap-10">
      {GRUPOS.map((grupo) => {
        const doGrupo = dados.pagamentos.filter(
          (p) => p.status === grupo.status,
        );
        if (doGrupo.length === 0) return null;
        return (
          <SecaoBloco
            key={grupo.status}
            idTitulo={`equipe-${grupo.status}`}
            titulo={grupo.titulo}
            icone={grupo.icone}
            tom={grupo.tom ?? "areia"}
            semTom={!grupo.tom}
            contagem={doGrupo.length}
          >
            <ul className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {doGrupo.map((p) => (
                <CartaoPagamento key={p.id} p={p} hoje={hoje} />
              ))}
            </ul>
          </SecaoBloco>
        );
      })}
    </div>
  );
}

const GRUPOS: {
  status: PagamentoEquipe["status"];
  titulo: string;
  icone: React.ReactNode;
  tom?: Tom;
}[] = [
  {
    status: "liberado",
    titulo: "Liberados para pagar",
    icone: <Wallet />,
    tom: "dourado",
  },
  { status: "bloqueado", titulo: "Esperando as evoluções", icone: <Lock /> },
  {
    status: "pago",
    titulo: "Pagos no mês",
    icone: <CircleCheck />,
    tom: "salvia",
  },
];

function CartaoPagamento({ p, hoje }: { p: PagamentoEquipe; hoje: string }) {
  return (
    <li
      className={cn(
        "rounded-3 flex flex-col gap-3 p-5",
        p.status === "pago" ? "bg-salvia-clara" : "bg-superficie shadow-1",
      )}
    >
      <div className="flex items-start gap-3">
        <TileIcone tom="argila" forma="quadrado">
          <UserRound />
        </TileIcone>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-titulo text-2 text-texto font-medium">
            {p.profissionalNome}
          </h3>
          <p className="text-apoio text-texto-2">
            {p.familiaNome ?? "Família"}
          </p>
        </div>
        <Selo variante={VARIANTE[p.status]}>
          {ROTULO_STATUS_PAGAMENTO[p.status]}
        </Selo>
      </div>
      <p className="font-titulo text-display text-texto font-medium tabular-nums">
        {formatarMoeda(p.totalCentavos)}
      </p>
      <Conta p={p} />
      {p.status === "bloqueado" && p.motivoBloqueio ? (
        <p className="text-corpo text-texto max-w-[62ch]">
          {TEXTO_BLOQUEIO[p.motivoBloqueio]}
        </p>
      ) : null}
      {p.status === "liberado" ? (
        <PagarEquipe
          pagamentoId={p.id}
          profissionalNome={p.profissionalNome}
          hoje={hoje}
        />
      ) : null}
      {p.status === "pago" ? (
        <p className="text-apoio text-texto">
          Pago em{" "}
          {p.pagoEm
            ? (formatarData(p.pagoEm) ?? p.pagoEm)
            : "data não registrada"}
          .
        </p>
      ) : null}
    </li>
  );
}
