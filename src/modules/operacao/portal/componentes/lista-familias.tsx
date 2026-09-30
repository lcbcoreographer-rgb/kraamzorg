import Link from "next/link";
import { CalendarDays, ChevronRight, House, OctagonPause } from "lucide-react";
import { ChaveDeCasa } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { ReguaDias, type DiaRegua } from "@/components/ui/regua-dias";
import { TileIcone } from "@/components/ui/tile-icone";
import type { FamiliaPortal } from "@/lib/dados/tipos-equipe";
import { cn } from "@/lib/utils";
import {
  fraseEstadoSensivel,
  fraseProximaVisita,
  proximaVisitaDaFamilia,
  rotuloAcompanhamento,
} from "../textos";

/** A régua do acompanhamento: feito, ficha pendente, hoje e o que falta. */
function reguaDaFamilia(
  f: FamiliaPortal,
  total: number,
  proximaHoje: number | null,
): DiaRegua[] {
  return Array.from({ length: total }, (_, i) => {
    const numero = i + 1;
    const visita = f.visitas.find((v) => v.diaNumero === numero);
    if (visita?.estado === "concluida")
      return { numero, estado: "feito", rotuloEstado: "feito" };
    if (visita?.estado === "ficha_pendente")
      return { numero, estado: "pendente", rotuloEstado: "ficha pendente" };
    if (numero === proximaHoje)
      return { numero, estado: "hoje", rotuloEstado: "hoje" };
    return { numero, estado: "futuro" };
  });
}

/**
 * Famílias que a enfermeira acompanha (P38 item 1; direção "Colo"): só as
 * atribuídas a ela. Cada família é um bloco areia (o lugar da família) com
 * o dia do acompanhamento na régua e a próxima visita num bloco do tempo:
 * dourado quando é hoje, lavanda quando é outro dia. Família em pausa fica
 * sem tom e sem régua, só com a frase do estado (DESIGN.md 11.8). Na página
 * de sem sinal (`comLink` falso) os cartões não abrem a ficha, que exige
 * sinal.
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
        ilustracao={<ChaveDeCasa tamanho={112} />}
        titulo="Nenhuma família por enquanto"
        texto="Quando a coordenação atribuir uma família a você, ela aparece aqui com o dia do acompanhamento e a próxima visita."
      />
    );
  }
  return (
    <ul
      className="tablet:grid-cols-2 grid grid-cols-1 items-start gap-3 lg:gap-4"
      aria-label="Famílias que você acompanha"
    >
      {familias.map((f) => {
        const proxima = proximaVisitaDaFamilia(f, hoje);
        const fraseSensivel = fraseEstadoSensivel(f.estadoSensivel);
        const pausa =
          f.estadoSensivel === "bloqueio_total" ||
          f.estadoSensivel === "encerrado_sensivel";
        const total = f.acompanhamento?.diasContratados ?? null;
        const feitas = f.visitas.filter(
          (v) => v.estado === "concluida" || v.estado === "ficha_pendente",
        ).length;
        const proximaEhHoje = proxima?.data === hoje;
        const corpo = (
          <>
            <div className="flex items-start gap-3">
              {pausa ? null : (
                <TileIcone tom="areia" intensidade="media">
                  <House />
                </TileIcone>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="font-titulo text-1 text-texto font-medium">
                  {f.nomeExibicao}
                </h2>
                <p className="text-apoio text-texto-2">
                  {rotuloAcompanhamento(f.acompanhamento?.estado)}
                  {f.bairro ? `. ${f.bairro}` : ""}
                  {f.gemelar ? ". Gêmeos" : ""}.
                </p>
              </div>
              {comLink ? (
                <ChevronRight
                  className="text-texto-2 mt-2 size-5 shrink-0"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            {total && !pausa ? (
              <div className="flex flex-col gap-2">
                <ReguaDias
                  dias={reguaDaFamilia(
                    f,
                    total,
                    proximaEhHoje ? (proxima?.diaNumero ?? null) : null,
                  )}
                  rotulo={`Acompanhamento de ${total} dias`}
                />
                <p className="text-apoio text-texto-2">
                  <span className="text-texto font-mono font-medium">
                    {feitas} de {total}
                  </span>{" "}
                  {feitas === 1 ? "visita feita" : "visitas feitas"}
                </p>
              </div>
            ) : null}

            {fraseSensivel ? (
              <p
                className={cn(
                  "text-apoio text-sensivel rounded-2 flex items-start gap-2 px-3 py-2",
                  pausa ? "bg-sensivel-lavado" : "bg-superficie",
                )}
              >
                <OctagonPause
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {fraseSensivel}
              </p>
            ) : null}

            <p
              className={cn(
                "rounded-2 text-corpo text-texto flex items-center gap-3 px-3 py-2",
                pausa
                  ? "border-linha border"
                  : proximaEhHoje
                    ? "bg-dourado-claro"
                    : "bg-lavanda-clara",
              )}
            >
              {pausa ? null : (
                <TileIcone
                  tom={proximaEhHoje ? "dourado" : "lavanda"}
                  tamanho="p"
                >
                  <CalendarDays />
                </TileIcone>
              )}
              <span>{fraseProximaVisita(proxima)}</span>
            </p>
          </>
        );
        const classes = cn(
          "rounded-3 flex flex-col gap-4 p-4 lg:p-5",
          pausa ? "bg-superficie border-linha border" : "bg-areia-clara",
        );
        return (
          <li key={f.familiaId} data-familia={f.familiaId}>
            {comLink ? (
              <Link
                href={`/minhas-familias/${f.familiaId}`}
                className={cn(
                  classes,
                  "ease-estado text-inherit no-underline transition-transform duration-140 active:scale-[0.99]",
                )}
              >
                {corpo}
              </Link>
            ) : (
              <div className={classes}>{corpo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
