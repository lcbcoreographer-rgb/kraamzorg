"use client";

import * as React from "react";
import { OctagonPause } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da família com freio (DESIGN.md, seção 6; PRD 20.4). Faixa de
 * areia: nome, selo do estágio, dia do acompanhamento, bairro e as quatro
 * datas (DPP "estimativa"; nascimento, alta e início "fato"). O botão de
 * freio fica no canto superior direito em toda tela da família. Quando o
 * freio está puxado, a faixa inteira vira ameixa (`sensivel`); as quatro
 * datas continuam visíveis (PRD 20.4: "sempre visíveis na ficha"), só a
 * linha de meta dá lugar à frase de bloqueio.
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
  /** Botão de freio (mostrado só quando `freioAtivo` é falso). Ex: `BotaoFreio`. */
  acaoFreio?: React.ReactNode;
  /** Frase de bloqueio, mostrada na linha de meta quando ativo. */
  textoFreioAtivo?: React.ReactNode;
  /** Rótulo do selo estático "Freio ativo" mostrado no canto quando ativo. */
  rotuloFreioAtivo?: string;
  /**
   * Ação do selo "Freio ativo" (ex: abre a folha de reversão, que exige
   * coordenação ou diretoria). Sem esta prop, o selo é só informativo, do
   * mesmo tamanho de um `Selo` comum (28 px), não um alvo de toque de 44 px
   * sem função.
   */
  acaoFreioAtivo?: () => void;
  /** Título da seção (`h1` na ficha da família, `h3` num cartão de lista). */
  nivelTitulo?: "h1" | "h2" | "h3";
  /**
   * Estica a faixa com margem negativa até a borda do contêiner pai
   * ("de ponta a ponta"). Sem isto, o padding interno do componente fica
   * de pé sozinho: quem precisa do efeito pede explicitamente.
   */
  sangrar?: boolean;
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
  acaoFreioAtivo,
  nivelTitulo = "h3",
  sangrar,
  className,
}: CabecalhoFamiliaProps) {
  const Titulo = nivelTitulo;
  const refSelo = React.useRef<HTMLButtonElement | HTMLSpanElement>(null);
  const freioAtivoAnterior = React.useRef(freioAtivo);

  React.useEffect(() => {
    // O botão de freio (que tinha o foco) some do DOM quando o freio liga;
    // sem isto, o foco cai no <body> (achado da auditoria da P10 parcial).
    // Leva o foco para o selo "Freio ativo" que aparece no lugar dele.
    if (freioAtivo && !freioAtivoAnterior.current) {
      refSelo.current?.focus();
    }
    freioAtivoAnterior.current = freioAtivo;
  }, [freioAtivo]);

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 pt-4 pb-5 lg:px-8 lg:pt-6",
        sangrar && "-mx-4 lg:-mx-8",
        freioAtivo
          ? "bg-sensivel text-texto-inverso"
          : "bg-superficie-2 text-texto",
        className,
      )}
    >
      <div>
        <Titulo className="font-titulo text-1 leading-tight font-medium tracking-[-0.015em]">
          {nome}
        </Titulo>
        <div
          role="status"
          className={cn(
            "text-apoio mt-2 flex flex-wrap items-center gap-2",
            freioAtivo ? undefined : "text-marinho-72",
          )}
        >
          {freioAtivo ? textoFreioAtivo : meta}
        </div>
      </div>

      {freioAtivo ? (
        acaoFreioAtivo ? (
          <button
            ref={refSelo as React.Ref<HTMLButtonElement>}
            type="button"
            onClick={acaoFreioAtivo}
            className="rounded-pilula bg-superficie text-mini text-sensivel inline-flex min-h-[28px] items-center gap-1.5 px-3 font-semibold whitespace-nowrap"
          >
            <OctagonPause className="size-4" aria-hidden="true" />
            {rotuloFreioAtivo}
          </button>
        ) : (
          <span
            ref={refSelo as React.Ref<HTMLSpanElement>}
            tabIndex={-1}
            className="rounded-pilula bg-superficie text-mini text-sensivel inline-flex min-h-[28px] items-center gap-1.5 px-3 font-semibold whitespace-nowrap"
          >
            <OctagonPause className="size-4" aria-hidden="true" />
            {rotuloFreioAtivo}
          </span>
        )
      ) : (
        acaoFreio
      )}

      <dl className="tablet:grid-cols-4 col-span-full grid grid-cols-2 gap-x-4 gap-y-2">
        {datas.map((data) => (
          <div key={data.rotulo} className="flex flex-col gap-0.5">
            <dt
              className={cn(
                "text-mini",
                freioAtivo ? "text-texto-inverso" : "text-marinho-72",
              )}
            >
              {data.rotulo}
            </dt>
            <dd
              className={cn(
                "text-corpo font-mono font-medium tabular-nums",
                freioAtivo ? "text-texto-inverso" : "text-texto",
                data.tipo === "ausente" &&
                  !freioAtivo &&
                  "border-marinho-50 text-texto-2 border-b border-dashed",
              )}
            >
              {data.valor}
            </dd>
            {/* Sem <dd> vazio no tipo "ausente": não há rótulo de
                "estimativa"/"fato" para mostrar (achado da auditoria da
                P10 parcial). */}
            {data.tipo === "ausente" ? null : (
              <dd
                className={cn(
                  "text-mini italic",
                  freioAtivo ? "text-texto-inverso" : "text-marinho-72",
                )}
              >
                {data.tipo === "estimativa" ? "estimativa" : "fato"}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
