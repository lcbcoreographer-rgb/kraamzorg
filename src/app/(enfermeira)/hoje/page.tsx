import type { Metadata } from "next";
import { TelaEmConstrucao } from "@/components/shell/tela-em-construcao";

export const metadata: Metadata = { title: "Hoje · Kraamzorg OS" };

/** "Hoje, quinta 24/09" (DESIGN.md, primeiro viewport da enfermeira). */
function tituloDeHoje(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  const dia = valor("weekday").replace("-feira", "");
  return `Hoje, ${dia} ${valor("day")}/${valor("month")}`;
}

/**
 * Dono: P38 (portal da enfermeira). Rota criada pela casca (P10) com o
 * estado vazio; o módulo troca este conteúdo, só nesta pasta.
 */
export default function PaginaHoje() {
  return (
    <TelaEmConstrucao
      titulo={tituloDeHoje()}
      tituloVazio="As visitas de hoje vão aparecer aqui"
      texto="A próxima visita com o endereço e a régua de dias, o botão para iniciar a visita e as fichas pendentes, em ordem de horário."
      acao={{ rotulo: "Ver minhas famílias", href: "/minhas-familias" }}
    />
  );
}
