import type { Metadata } from "next";
import {
  PaginaDeAlertas,
  situacaoDaUrl,
} from "@/modules/assistencial/alertas/pagina-de-alertas";

export const metadata: Metadata = { title: "Alertas · Kraamzorg OS" };

/** Alertas clínicos das famílias da enfermeira (P40): ver e registrar o acionamento. */
export default async function PaginaAlertas({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string | string[] }>;
}) {
  const { situacao } = await searchParams;
  return (
    <PaginaDeAlertas caminho="/alertas" situacao={situacaoDaUrl(situacao)} />
  );
}
