import * as React from "react";
import { OctagonPause } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da família com freio (DESIGN.md, seção 6; PRD 20.4). Faixa de
 * areia de ponta a ponta: nome, selo do estágio, dia do acompanhamento,
 * bairro e as quatro datas (DPP "estimativa"; nascimento, alta e início
 * "fato"). O espaço do botão de freio fica reservado no canto superior
 * direito em toda tela da família. Quando o freio está puxado, a faixa
 * inteira vira ameixa (`sensivel`) e mostra a frase de bloqueio no lugar
 * das datas.
 */
export interface DataChaveFamilia {
  rotulo: string;
  /** Valor já formatado (ex: por formatarData) ou o texto de "ainda não há". */
  valor: React.ReactNode;
  tipo: "estimativa" | "fato" | "ausente";
}

export interface CabecalhoFamiliaProps {
  nome: string;
  /** Linha com selo do estágio, dia do acompanhamento e bairro. */
  meta?: React.ReactNode;
  datas: DataChaveFamilia[];
  freioAtivo?: boolean;
  /** Botão de freio (mostrado só quando `freioAtivo` é falso). */
  acaoFreio?: React.ReactNode;
  /** Frase de bloqueio, mostrada no lugar das datas quando ativo. */
  textoFreioAtivo?: React.ReactNode;
  /** Rótulo do selo estático "Freio ativo" mostrado no canto quando ativo. */
  rotuloFreioAtivo?: string;
  className?: string;
}

export function CabecalhoFamilia({
  nome,
  meta,
  datas,
  freioAtivo,
  acaoFreio,
  textoFreioAtivo,
  rotuloFreioAtivo,
  className,
}: CabecalhoFamiliaProps) {
  return (
    <div
      className={cn(
        "-mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 pt-4 pb-5 lg:-mx-8 lg:px-8 lg:pt-6",
        freioAtivo
          ? "bg-sensivel text-texto-inverso"
          : "bg-superficie-2 text-texto",
        className,
      )}
    >
      <div>
        <h3 className="font-titulo text-1 leading-tight font-medium tracking-[-0.015em]">
          {nome}
        </h3>
        {freioAtivo ? (
          <p className="text-apoio mt-2">{textoFreioAtivo}</p>
        ) : (
          <div
            className={cn(
              "text-apoio mt-2 flex flex-wrap items-center gap-2",
              "text-marinho-72",
            )}
          >
            {meta}
          </div>
        )}
      </div>

      {freioAtivo ? (
        <span className="min-h-toque rounded-pilula bg-superficie text-apoio text-sensivel inline-flex items-center gap-2 px-4 py-0 pl-3 font-semibold">
          <OctagonPause className="size-[18px]" aria-hidden="true" />
          {rotuloFreioAtivo}
        </span>
      ) : (
        acaoFreio
      )}

      {!freioAtivo ? (
        <dl className="col-span-full grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {datas.map((data) => (
            <div key={data.rotulo} className="flex flex-col gap-0.5">
              <dt className="text-mini text-marinho-72">{data.rotulo}</dt>
              <dd
                className={cn(
                  "text-corpo text-texto font-mono font-medium tabular-nums",
                  data.tipo === "ausente" &&
                    "border-marinho-50 text-texto-2 border-b border-dashed",
                )}
              >
                {data.valor}
              </dd>
              <dd className="text-mini text-marinho-72 italic">
                {data.tipo === "estimativa"
                  ? "estimativa"
                  : data.tipo === "fato"
                    ? "fato"
                    : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
