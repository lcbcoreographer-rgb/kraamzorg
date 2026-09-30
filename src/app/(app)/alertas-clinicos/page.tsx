import type { Metadata } from "next";
import {
  PaginaDeAlertas,
  situacaoDaUrl,
} from "@/modules/assistencial/alertas/pagina-de-alertas";

export const metadata: Metadata = { title: "Alertas clínicos · Kraamzorg OS" };

/**
 * Alertas clínicos para a coordenação e a diretoria (P40): a coordenação
 * completa o registro do DOC 3 e fecha; a diretoria lê.
 */
export default async function PaginaAlertasClinicos({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string | string[] }>;
}) {
  const { situacao } = await searchParams;
  return (
    <PaginaDeAlertas
      caminho="/alertas-clinicos"
      situacao={situacaoDaUrl(situacao)}
    />
  );
}
