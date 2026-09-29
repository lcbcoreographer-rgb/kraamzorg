import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import type { FamiliaPortal } from "@/lib/dados/tipos-equipe";
import {
  fraseEstadoSensivel,
  fraseProximaVisita,
  proximaVisitaDaFamilia,
  rotuloAcompanhamento,
} from "../textos";

/**
 * Famílias que a enfermeira acompanha (P38 item 1, protótipo enfermeira-
 * familias): só as atribuídas a ela. Cada cartão diz em que dia do
 * acompanhamento a família está e quando é a próxima visita. Na página de
 * sem sinal (`comLink` falso) os cartões não abrem a ficha, que exige sinal.
 */
export function ListaFamilias({
  familias,
  hoje,
  comLink = true,
}: {
  familias: FamiliaPortal[];
  hoje: string;
  comLink?: boolean;
}) {
  if (familias.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        titulo="Nenhuma família por enquanto"
        texto="Quando a coordenação atribuir uma família a você, ela aparece aqui com o dia do acompanhamento e a próxima visita."
      />
    );
  }
  return (
    <ul
      className="flex flex-col gap-4"
      aria-label="Famílias que você acompanha"
    >
      {familias.map((f) => {
        const proxima = proximaVisitaDaFamilia(f, hoje);
        const sensivel = fraseEstadoSensivel(f.estadoSensivel);
        const total = f.acompanhamento?.diasContratados ?? null;
        const feitas = f.visitas.filter(
          (v) => v.estado === "concluida" || v.estado === "ficha_pendente",
        ).length;
        const corpo = (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="font-titulo text-1 text-texto font-medium">
                {f.nomeExibicao}
              </h2>
              {total ? (
                <Selo variante="marinho">
                  <span className="font-mono">{`${feitas} de ${total} feitas`}</span>
                </Selo>
              ) : null}
            </div>
            <p className="text-apoio text-texto-2">
              {rotuloAcompanhamento(f.acompanhamento?.estado)}
              {f.bairro ? `. ${f.bairro}` : ""}
              {f.gemelar ? ". Gêmeos" : ""}.
            </p>
            <p className="text-corpo text-texto">
              {fraseProximaVisita(proxima)}
            </p>
            {sensivel ? (
              <p className="text-apoio text-sensivel">{sensivel}</p>
            ) : null}
          </>
        );
        return (
          <li key={f.familiaId} data-familia={f.familiaId}>
            {comLink ? (
              <Link
                href={`/minhas-familias/${f.familiaId}`}
                className="rounded-3 bg-superficie shadow-1 flex items-center gap-3 p-5 no-underline"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  {corpo}
                </span>
                <ChevronRight
                  className="text-texto-2 size-5 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            ) : (
              <div className="rounded-3 bg-superficie shadow-1 flex flex-col gap-2 p-5">
                {corpo}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
