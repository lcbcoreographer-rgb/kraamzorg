import { EstadoVazio } from "@/components/ui/estado-vazio";
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
        titulo="Nenhum pagamento por enquanto"
        texto="Os pagamentos nascem das visitas realizadas. Quando a primeira visita for concluída, a profissional aparece aqui, bloqueada até o envio das evoluções aos médicos."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {dados.pagamentos.map((p) => (
        <li
          key={p.id}
          className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-titulo text-2 text-texto font-medium">
                {p.profissionalNome}
              </h2>
              <p className="text-apoio text-texto-2">
                {p.familiaNome ?? "Família"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Selo variante={VARIANTE[p.status]}>
                {ROTULO_STATUS_PAGAMENTO[p.status]}
              </Selo>
              <p className="text-dado-lg text-texto font-mono">
                {formatarMoeda(p.totalCentavos)}
              </p>
            </div>
          </div>
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
            <p className="text-apoio text-texto-2">
              Pago em{" "}
              {p.pagoEm
                ? (formatarData(p.pagoEm) ?? p.pagoEm)
                : "data não registrada"}
              .
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
